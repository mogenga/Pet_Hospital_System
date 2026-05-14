from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


async def ensure_bill(db: AsyncSession, visit_id: int) -> int:
    """获取或创建账单，返回 bill_id"""
    result = await db.execute(
        text("SELECT bill_id FROM bill WHERE visit_id = :vid"),
        {"vid": visit_id},
    )
    row = result.fetchone()
    if row:
        return row.bill_id

    result = await db.execute(
        text(
            "INSERT INTO bill (visit_id) VALUES (:vid) "
            "ON CONFLICT (visit_id) DO NOTHING "
            "RETURNING bill_id"
        ),
        {"vid": visit_id},
    )
    row = result.fetchone()
    if row:
        return row.bill_id

    # 并发冲突时重查
    result = await db.execute(
        text("SELECT bill_id FROM bill WHERE visit_id = :vid"),
        {"vid": visit_id},
    )
    return result.scalar_one()


async def add_item(
    db: AsyncSession,
    visit_id: int,
    item_type: str,
    source_type: str,
    source_id: int,
    amount: float,
    description: str | None = None,
) -> dict:
    """添加收费项（幂等：同 source 不重复插入）

    Returns:
        {"bill_item_id": int, "bill_id": int, "is_duplicate": bool}
    """
    bill_id = await ensure_bill(db, visit_id)

    # INSERT ... ON CONFLICT DO NOTHING — 并发安全
    result = await db.execute(
        text(
            "INSERT INTO bill_item (bill_id, item_type, source_type, source_id, description, amount) "
            "VALUES (:bid, :itype, :stype, :sid, :desc, :amt) "
            "ON CONFLICT (bill_id, source_type, source_id) DO NOTHING "
            "RETURNING bill_item_id"
        ),
        {
            "bid": bill_id,
            "itype": item_type,
            "stype": source_type,
            "sid": source_id,
            "desc": description,
            "amt": amount,
        },
    )
    row = result.fetchone()
    if row:
        await db.flush()
        return {"bill_item_id": row.bill_item_id, "bill_id": bill_id, "is_duplicate": False}

    # 冲突时查询已有记录
    result = await db.execute(
        text(
            "SELECT bill_item_id FROM bill_item "
            "WHERE bill_id = :bid AND source_type = :stype AND source_id = :sid"
        ),
        {"bid": bill_id, "stype": source_type, "sid": source_id},
    )
    return {"bill_item_id": result.scalar_one(), "bill_id": bill_id, "is_duplicate": True}
