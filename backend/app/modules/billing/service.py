from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import Conflict, NotFound
from app.modules.billing.schemas import BillDetailOut, BillItemCreate, BillItemOut, BillOut
from app.shared.services.billing_service import add_item


async def create_bill_item(
    db: AsyncSession, visit_id: int, data: BillItemCreate
) -> dict:
    """生成收费项，调用 BillingService 幂等入口"""
    result = await add_item(
        db,
        visit_id=visit_id,
        item_type=data.item_type,
        source_type=data.source_type,
        source_id=data.source_id,
        amount=float(data.amount),
        description=data.description,
    )
    # 查询完整记录
    row = await db.execute(
        text(
            "SELECT bill_item_id, bill_id, item_type, source_type, source_id, description, amount "
            "FROM bill_item WHERE bill_item_id = :id"
        ),
        {"id": result["bill_item_id"]},
    )
    item = BillItemOut.model_validate(row.fetchone()._mapping)

    return {
        "bill_item_id": item.bill_item_id,
        "bill_id": item.bill_id,
        "item_type": item.item_type,
        "source_type": item.source_type,
        "source_id": item.source_id,
        "description": item.description,
        "amount": str(item.amount),
        "is_duplicate": result["is_duplicate"],
    }


async def settle_bill(db: AsyncSession, bill_id: int) -> dict:
    """结账：'未结清' → '已结清'"""
    result = await db.execute(
        text("SELECT bill_id, visit_id, status FROM bill WHERE bill_id = :id"),
        {"id": bill_id},
    )
    row = result.fetchone()
    if row is None:
        raise NotFound(detail="账单不存在")

    if row.status == "已结清":
        raise Conflict(detail="账单已结清，无需重复结账")

    import logging
    _logger = logging.getLogger(__name__)

    await db.execute(
        text("UPDATE bill SET status = '已结清' WHERE bill_id = :id"),
        {"id": bill_id},
    )

    # 同步更新 visit 状态：→ 已完成（架构规格：管理员结账 → 已完成）
    # 先查当前状态用于日志
    current = await db.execute(
        text("SELECT status FROM visit WHERE visit_id = :vid"),
        {"vid": row.visit_id},
    )
    current_status = current.scalar()

    await db.execute(
        text("UPDATE visit SET status = '已完成' WHERE visit_id = :vid"),
        {"vid": row.visit_id},
    )

    if current_status and current_status != "待收费":
        _logger.warning(
            "结账时 visit 状态异常 visit_id=%s 状态=%s 预期=待收费 bill_id=%s",
            row.visit_id, current_status, bill_id,
        )

    await db.flush()

    return {"bill_id": row.bill_id, "visit_id": row.visit_id, "status": "已结清"}


async def list_bills(db: AsyncSession) -> list[dict]:
    """账单列表（含宠物/客户信息）"""
    result = await db.execute(
        text(
            "SELECT b.bill_id, b.visit_id, b.status, "
            "TO_CHAR(b.created_at, 'YYYY-MM-DD HH24:MI:SS') AS created_at, "
            "v.total_amount, "
            "p.name AS pet_name, c.name AS customer_name "
            "FROM v_bill_total v "
            "JOIN bill b ON b.bill_id = v.bill_id "
            "JOIN visit vis ON b.visit_id = vis.visit_id "
            "JOIN pet p ON vis.pet_id = p.pet_id "
            "JOIN customer c ON p.customer_id = c.customer_id "
            "ORDER BY b.bill_id DESC"
        ),
    )
    return [
        {
            "bill_id": row.bill_id,
            "visit_id": row.visit_id,
            "status": row.status,
            "created_at": row.created_at,
            "total_amount": str(row.total_amount) if row.total_amount else None,
            "pet_name": row.pet_name,
            "customer_name": row.customer_name,
        }
        for row in result.fetchall()
    ]


async def get_bill_detail(db: AsyncSession, bill_id: int) -> dict:
    """账单详情 + 收费项明细"""
    bill = await db.execute(
        text(
            "SELECT b.bill_id, b.visit_id, b.status, "
            "TO_CHAR(b.created_at, 'YYYY-MM-DD HH24:MI:SS') AS created_at, "
            "v.total_amount, "
            "p.name AS pet_name, c.name AS customer_name "
            "FROM v_bill_total v "
            "JOIN bill b ON b.bill_id = v.bill_id "
            "JOIN visit vis ON b.visit_id = vis.visit_id "
            "JOIN pet p ON vis.pet_id = p.pet_id "
            "JOIN customer c ON p.customer_id = c.customer_id "
            "WHERE b.bill_id = :id"
        ),
        {"id": bill_id},
    )
    bill_row = bill.fetchone()
    if bill_row is None:
        raise NotFound(detail="账单不存在")

    items = await db.execute(
        text(
            "SELECT bill_item_id, bill_id, item_type, source_type, source_id, description, amount "
            "FROM bill_item WHERE bill_id = :bid ORDER BY bill_item_id"
        ),
        {"bid": bill_id},
    )
    item_list = [BillItemOut.model_validate(row._mapping) for row in items.fetchall()]

    return {
        "bill_id": bill_row.bill_id,
        "visit_id": bill_row.visit_id,
        "status": bill_row.status,
        "created_at": bill_row.created_at,
        "total_amount": str(bill_row.total_amount) if bill_row.total_amount else "0",
        "pet_name": bill_row.pet_name,
        "customer_name": bill_row.customer_name,
        "items": [
            {
                "bill_item_id": item.bill_item_id,
                "bill_id": item.bill_id,
                "item_type": item.item_type,
                "source_type": item.source_type,
                "source_id": item.source_id,
                "description": item.description,
                "amount": str(item.amount),
            }
            for item in item_list
        ],
    }
