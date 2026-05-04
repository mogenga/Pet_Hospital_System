from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import AppError, Conflict, NotFound
from app.modules.pharmacy.schemas import BatchCreate, BatchOut, MedicineCreate, MedicineOut


async def list_medicines(db: AsyncSession) -> list[MedicineOut]:
    result = await db.execute(
        text("SELECT medicine_id, name, unit, unit_price, category FROM medicine ORDER BY medicine_id")
    )
    return [MedicineOut.model_validate(row._mapping) for row in result.fetchall()]


async def create_medicine(db: AsyncSession, data: MedicineCreate) -> MedicineOut:
    result = await db.execute(
        text(
            "INSERT INTO medicine (name, unit, unit_price, category) "
            "VALUES (:name, :unit, :price, :cat) "
            "RETURNING medicine_id, name, unit, unit_price, category"
        ),
        {"name": data.name, "unit": data.unit, "price": data.unit_price, "cat": data.category},
    )
    row = result.fetchone()
    return MedicineOut.model_validate(row._mapping)


async def list_batches(db: AsyncSession, stock_qty_lt: int | None = None) -> list[BatchOut]:
    query = """
        SELECT mb.batch_id, mb.medicine_id, m.name AS medicine_name,
               mb.in_date, mb.expire_date, mb.stock_qty, mb.cost_price
        FROM medicine_batch mb
        JOIN medicine m ON mb.medicine_id = m.medicine_id
    """
    params = {}
    if stock_qty_lt is not None:
        query += " WHERE mb.stock_qty < :qty"
        params["qty"] = stock_qty_lt
    query += " ORDER BY mb.expire_date ASC"
    result = await db.execute(text(query), params)
    return [BatchOut.model_validate(row._mapping) for row in result.fetchall()]


async def create_batch(db: AsyncSession, data: BatchCreate) -> BatchOut:
    # 验证日期
    if data.expire_date <= data.in_date:
        raise AppError(detail="expire_date 必须大于 in_date")

    # 验证药品存在
    med = await db.execute(
        text("SELECT name FROM medicine WHERE medicine_id = :id"),
        {"id": data.medicine_id},
    )
    med_row = med.fetchone()
    if med_row is None:
        raise NotFound(detail="药品不存在")

    result = await db.execute(
        text(
            "INSERT INTO medicine_batch (medicine_id, in_date, expire_date, stock_qty, cost_price) "
            "VALUES (:mid, :in_date, :exp_date, :qty, :cost) "
            "RETURNING batch_id"
        ),
        {
            "mid": data.medicine_id,
            "in_date": data.in_date,
            "exp_date": data.expire_date,
            "qty": data.stock_qty,
            "cost": data.cost_price,
        },
    )
    batch_id = result.scalar_one()

    return BatchOut(
        batch_id=batch_id,
        medicine_id=data.medicine_id,
        medicine_name=med_row.name,
        in_date=data.in_date,
        expire_date=data.expire_date,
        stock_qty=data.stock_qty,
        cost_price=data.cost_price,
    )


async def deduct_stock(db: AsyncSession, medicine_id: int, quantity: int) -> dict:
    """扣减库存，FIFO（临期优先），SELECT FOR UPDATE 行级锁防超卖"""
    if quantity <= 0:
        raise AppError(detail="扣减数量必须大于 0")

    # 查询药品名称
    med = await db.execute(
        text("SELECT name FROM medicine WHERE medicine_id = :id"),
        {"id": medicine_id},
    )
    med_row = med.fetchone()
    if med_row is None:
        raise NotFound(detail="药品不存在")

    # 锁定有库存且未过期的批次，FIFO：expire_date 升序
    result = await db.execute(
        text(
            "SELECT batch_id, stock_qty FROM medicine_batch "
            "WHERE medicine_id = :mid AND stock_qty > 0 AND expire_date >= CURRENT_DATE "
            "ORDER BY expire_date ASC "
            "FOR UPDATE"
        ),
        {"mid": medicine_id},
    )
    batches = [(row.batch_id, row.stock_qty) for row in result.fetchall()]
    total = sum(qty for _, qty in batches)

    if total < quantity:
        raise Conflict(detail=f"{med_row.name}库存不足：需要{quantity}，当前库存{total}")

    # FIFO 扣减
    remaining = quantity
    for batch_id, stock in batches:
        if remaining <= 0:
            break
        take = min(stock, remaining)
        await db.execute(
            text("UPDATE medicine_batch SET stock_qty = stock_qty - :take WHERE batch_id = :bid"),
            {"take": take, "bid": batch_id},
        )
        remaining -= take

    return {"medicine_id": medicine_id, "deducted": quantity}
