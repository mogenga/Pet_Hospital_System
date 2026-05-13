from datetime import date

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.exceptions import AppError, Conflict, NotFound
from app.modules.hospitalization.schemas import AdmitCreate, NursingCreate
from app.shared.services.billing_service import add_item as billing_add_item


async def _ensure_mongo_indexes(mongo_db: AsyncIOMotorDatabase):
    """确保 MongoDB nursing_logs 集合索引存在"""
    await mongo_db.nursing_logs.create_index("record_id", unique=True, name="idx_nursing_record_id")
    await mongo_db.nursing_logs.create_index("hosp_id", name="idx_nursing_hosp_id")


async def list_wards(db: AsyncSession) -> list[dict]:
    result = await db.execute(
        text("SELECT ward_id, ward_no, type, status, daily_rate FROM ward ORDER BY ward_no")
    )
    return [
        {
            "ward_id": row.ward_id,
            "ward_no": row.ward_no,
            "type": row.type,
            "status": row.status,
            "daily_rate": str(row.daily_rate),
        }
        for row in result.fetchall()
    ]


async def admit(db: AsyncSession, data: AdmitCreate) -> dict:
    """转入住院：验证 visit 已诊断 + ward 空闲，同一事务内 INSERT + UPDATE ward"""
    # 验证 visit 存在且有诊断
    diag = await db.execute(
        text("SELECT diagnosis_id FROM diagnosis WHERE visit_id = :vid"),
        {"vid": data.visit_id},
    )
    if diag.fetchone() is None:
        raise AppError(detail="该就诊尚未完成诊断，无法转入住院")

    # 验证 visit 是否已住院
    existing = await db.execute(
        text("SELECT hosp_id FROM hospitalization WHERE visit_id = :vid"),
        {"vid": data.visit_id},
    )
    if existing.fetchone():
        raise Conflict(detail="该就诊已转入住院，不能重复转入")

    # 锁定并检查笼位状态
    ward = await db.execute(
        text("SELECT ward_id, status FROM ward WHERE ward_id = :wid FOR UPDATE"),
        {"wid": data.ward_id},
    )
    ward_row = ward.fetchone()
    if ward_row is None:
        raise NotFound(detail="笼位不存在")
    if ward_row.status != "空闲":
        raise Conflict(detail=f"笼位当前状态为'{ward_row.status}'，无法使用")

    # 转入住院
    result = await db.execute(
        text(
            "INSERT INTO hospitalization (visit_id, ward_id, admit_date) "
            "VALUES (:vid, :wid, :admit) "
            "RETURNING hosp_id"
        ),
        {"vid": data.visit_id, "wid": data.ward_id, "admit": data.admit_date},
    )
    hosp_id = result.scalar_one()

    # 更新笼位状态
    await db.execute(
        text("UPDATE ward SET status = '占用' WHERE ward_id = :wid"),
        {"wid": data.ward_id},
    )
    await db.flush()

    return {
        "hosp_id": hosp_id,
        "visit_id": data.visit_id,
        "ward_id": data.ward_id,
        "admit_date": str(data.admit_date),
        "discharge_date": None,
        "status": "住院中",
    }


async def list_hospitalizations(db: AsyncSession, status: str | None = None) -> list[dict]:
    query = """
        SELECT h.hosp_id, h.visit_id, h.ward_id, h.admit_date, h.discharge_date, h.status,
               w.ward_no, w.type AS ward_type
        FROM hospitalization h
        JOIN ward w ON h.ward_id = w.ward_id
    """
    params = {}
    if status:
        query += " WHERE h.status = :status"
        params["status"] = status
    query += " ORDER BY h.hosp_id DESC"

    result = await db.execute(text(query), params)
    return [
        {
            "hosp_id": row.hosp_id,
            "visit_id": row.visit_id,
            "ward_id": row.ward_id,
            "ward_no": row.ward_no,
            "ward_type": row.ward_type,
            "admit_date": str(row.admit_date),
            "discharge_date": str(row.discharge_date) if row.discharge_date else None,
            "status": row.status,
        }
        for row in result.fetchall()
    ]


async def get_hospitalization_detail(db: AsyncSession, hosp_id: int) -> dict:
    hosp = await db.execute(
        text(
            "SELECT h.hosp_id, h.visit_id, h.ward_id, h.admit_date, h.discharge_date, h.status, "
            "w.ward_no, w.type AS ward_type "
            "FROM hospitalization h "
            "JOIN ward w ON h.ward_id = w.ward_id "
            "WHERE h.hosp_id = :id"
        ),
        {"id": hosp_id},
    )
    hosp_row = hosp.fetchone()
    if hosp_row is None:
        raise NotFound(detail="住院记录不存在")

    nursing = await db.execute(
        text(
            "SELECT nr.record_id, nr.hosp_id, nr.employee_id, "
            "TO_CHAR(nr.record_time, 'YYYY-MM-DD HH24:MI:SS') AS record_time, "
            "nr.content, e.name AS nurse_name "
            "FROM nursing_record nr "
            "JOIN employee e ON nr.employee_id = e.employee_id "
            "WHERE nr.hosp_id = :id "
            "ORDER BY nr.record_time DESC"
        ),
        {"id": hosp_id},
    )

    return {
        "hosp_id": hosp_row.hosp_id,
        "visit_id": hosp_row.visit_id,
        "ward_id": hosp_row.ward_id,
        "ward_no": hosp_row.ward_no,
        "ward_type": hosp_row.ward_type,
        "admit_date": str(hosp_row.admit_date),
        "discharge_date": str(hosp_row.discharge_date) if hosp_row.discharge_date else None,
        "status": hosp_row.status,
        "nursing_records": [
            {
                "record_id": row.record_id,
                "hosp_id": row.hosp_id,
                "employee_id": row.employee_id,
                "nurse_name": row.nurse_name,
                "record_time": row.record_time,
                "content": row.content,
            }
            for row in nursing.fetchall()
        ],
    }


async def add_nursing_record(
    db: AsyncSession, mongo_db: AsyncIOMotorDatabase, hosp_id: int, data: NursingCreate
) -> dict:
    """添加护理记录，PG + MongoDB 双写"""
    # 验证住院记录存在且状态为住院中
    hosp = await db.execute(
        text("SELECT hosp_id, status FROM hospitalization WHERE hosp_id = :id"),
        {"id": hosp_id},
    )
    hosp_row = hosp.fetchone()
    if hosp_row is None:
        raise NotFound(detail="住院记录不存在")
    if hosp_row.status != "住院中":
        raise AppError(detail="已出院，无法添加护理记录")

    # PG 写入
    result = await db.execute(
        text(
            "INSERT INTO nursing_record (hosp_id, employee_id, content) "
            "VALUES (:hid, :eid, :content) "
            "RETURNING record_id, hosp_id, employee_id, "
            "TO_CHAR(record_time, 'YYYY-MM-DD HH24:MI:SS') AS record_time, content"
        ),
        {"hid": hosp_id, "eid": data.employee_id, "content": data.content},
    )
    row = result.fetchone()
    record = {
        "record_id": row.record_id,
        "hosp_id": row.hosp_id,
        "employee_id": row.employee_id,
        "record_time": row.record_time,
        "content": row.content,
    }

    # MongoDB 双写
    await _ensure_mongo_indexes(mongo_db)
    doc = {
        "record_id": row.record_id,
        "hosp_id": hosp_id,
        "employee_id": data.employee_id,
        "record_time": row.record_time,
        "content": data.content,
    }
    await mongo_db.nursing_logs.insert_one(doc)

    await db.flush()
    return record


async def discharge(db: AsyncSession, hosp_id: int, discharge_date: date | None = None) -> dict:
    """出院：更新 hospitalization + 释放 ward + 自动生成住院费"""
    if discharge_date is None:
        discharge_date = date.today()

    hosp = await db.execute(
        text(
            "SELECT h.hosp_id, h.visit_id, h.ward_id, h.admit_date, h.status, w.daily_rate "
            "FROM hospitalization h "
            "JOIN ward w ON h.ward_id = w.ward_id "
            "WHERE h.hosp_id = :id FOR UPDATE"
        ),
        {"id": hosp_id},
    )
    hosp_row = hosp.fetchone()
    if hosp_row is None:
        raise NotFound(detail="住院记录不存在")
    if hosp_row.status == "已出院":
        raise Conflict(detail="已出院，无需重复操作")

    # 计算住院天数（至少 1 天）
    days = (discharge_date - hosp_row.admit_date).days
    if days < 1:
        days = 1
    fee = float(hosp_row.daily_rate) * days

    # 更新住院记录
    await db.execute(
        text(
            "UPDATE hospitalization SET discharge_date = :ddate, status = '已出院' "
            "WHERE hosp_id = :id"
        ),
        {"ddate": discharge_date, "id": hosp_id},
    )

    # 释放笼位
    await db.execute(
        text("UPDATE ward SET status = '空闲' WHERE ward_id = :wid"),
        {"wid": hosp_row.ward_id},
    )

    # 自动生成住院费（调 BillingService）
    await billing_add_item(
        db,
        visit_id=hosp_row.visit_id,
        item_type="住院费",
        source_type="hospitalization",
        source_id=hosp_id,
        amount=fee,
        description=f"住院{days}天 × ¥{hosp_row.daily_rate}/天",
    )

    await db.flush()

    return {
        "hosp_id": hosp_id,
        "visit_id": hosp_row.visit_id,
        "status": "已出院",
        "discharge_date": str(discharge_date),
    }
