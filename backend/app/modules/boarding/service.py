import json
from datetime import date

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import Conflict, NotFound
from app.modules.boarding.schemas import BoardingCreate
from app.shared.redis import redis_client


async def create_boarding(db: AsyncSession, data: BoardingCreate) -> dict:
    # 验证笼位空闲
    ward = await db.execute(
        text("SELECT ward_id, status FROM ward WHERE ward_id = :wid FOR UPDATE"),
        {"wid": data.ward_id},
    )
    ward_row = ward.fetchone()
    if ward_row is None:
        raise NotFound(detail="笼位不存在")
    if ward_row.status != "空闲":
        raise Conflict(detail=f"笼位当前状态为'{ward_row.status}'，无法使用")

    # 创建寄养记录
    result = await db.execute(
        text(
            "INSERT INTO boarding (pet_id, ward_id, start_date) "
            "VALUES (:pid, :wid, :sdate) "
            "RETURNING boarding_id"
        ),
        {"pid": data.pet_id, "wid": data.ward_id, "sdate": data.start_date},
    )
    bid = result.scalar_one()

    # 更新笼位状态
    await db.execute(
        text("UPDATE ward SET status = '占用' WHERE ward_id = :wid"),
        {"wid": data.ward_id},
    )
    await db.flush()
    await redis_client.delete("ward:status")

    return {
        "boarding_id": bid,
        "pet_id": data.pet_id,
        "ward_id": data.ward_id,
        "start_date": str(data.start_date),
        "end_date": None,
    }


async def list_boardings(db: AsyncSession) -> list[dict]:
    result = await db.execute(
        text(
            "SELECT b.boarding_id, b.pet_id, p.name AS pet_name, "
            "b.ward_id, w.ward_no, b.start_date, b.end_date "
            "FROM boarding b "
            "JOIN pet p ON b.pet_id = p.pet_id "
            "JOIN ward w ON b.ward_id = w.ward_id "
            "ORDER BY b.boarding_id DESC"
        ),
    )
    return [
        {
            "boarding_id": row.boarding_id,
            "pet_id": row.pet_id,
            "pet_name": row.pet_name,
            "ward_id": row.ward_id,
            "ward_no": row.ward_no,
            "start_date": str(row.start_date),
            "end_date": str(row.end_date) if row.end_date else None,
        }
        for row in result.fetchall()
    ]


async def get_boarding_detail(db: AsyncSession, boarding_id: int) -> dict:
    result = await db.execute(
        text(
            "SELECT b.boarding_id, b.pet_id, p.name AS pet_name, "
            "b.ward_id, w.ward_no, w.daily_rate, b.start_date, b.end_date "
            "FROM boarding b "
            "JOIN pet p ON b.pet_id = p.pet_id "
            "JOIN ward w ON b.ward_id = w.ward_id "
            "WHERE b.boarding_id = :id"
        ),
        {"id": boarding_id},
    )
    row = result.fetchone()
    if row is None:
        raise NotFound(detail="寄养记录不存在")

    # 动态计算费用：daily_rate × (end_date 或今天 - start_date)，至少 1 天
    end = row.end_date if row.end_date else date.today()
    days = (end - row.start_date).days
    if days < 1:
        days = 1
    fee = float(row.daily_rate) * days

    return {
        "boarding_id": row.boarding_id,
        "pet_id": row.pet_id,
        "pet_name": row.pet_name,
        "ward_id": row.ward_id,
        "ward_no": row.ward_no,
        "daily_rate": str(row.daily_rate),
        "start_date": str(row.start_date),
        "end_date": str(row.end_date) if row.end_date else None,
        "current_fee": str(fee),
    }


async def end_boarding(db: AsyncSession, boarding_id: int) -> dict:
    result = await db.execute(
        text(
            "SELECT b.boarding_id, b.ward_id, b.start_date, b.end_date, w.daily_rate "
            "FROM boarding b "
            "JOIN ward w ON b.ward_id = w.ward_id "
            "WHERE b.boarding_id = :id FOR UPDATE"
        ),
        {"id": boarding_id},
    )
    row = result.fetchone()
    if row is None:
        raise NotFound(detail="寄养记录不存在")
    if row.end_date is not None:
        raise Conflict(detail="该寄养已结束")

    today = date.today()
    await db.execute(
        text("UPDATE boarding SET end_date = :edate WHERE boarding_id = :id"),
        {"edate": today, "id": boarding_id},
    )

    # 释放笼位
    await db.execute(
        text("UPDATE ward SET status = '空闲' WHERE ward_id = :wid"),
        {"wid": row.ward_id},
    )
    await db.flush()
    await redis_client.delete("ward:status")

    # 计算寄养费用
    days = (today - row.start_date).days
    if days < 1:
        days = 1
    fee = float(row.daily_rate) * days

    return {
        "boarding_id": boarding_id,
        "end_date": str(today),
        "days": days,
        "total_fee": str(fee),
    }
