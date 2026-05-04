from datetime import datetime, timezone

from motor.motor_asyncio import AsyncIOMotorDatabase
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import Conflict, NotFound
from app.modules.consultation.schemas import (
    DiagnosisCreate,
    DiagnosisOut,
    PrescriptionItemCreate,
    PrescriptionItemOut,
    VisitCreate,
    VisitOut,
)
from app.modules.pharmacy.service import deduct_stock


# ═══════════════════════════════════════════
# MongoDB 索引
# ═══════════════════════════════════════════

async def _ensure_mongo_indexes(mongo_db: AsyncIOMotorDatabase):
    await mongo_db.medical_records.create_index("diagnosis_id", unique=True, name="idx_diagnosis_id")
    await mongo_db.medical_records.create_index("visit_id", name="idx_visit_id")
    await mongo_db.medical_records.create_index("created_by", name="idx_created_by")


# ═══════════════════════════════════════════
# Visit
# ═══════════════════════════════════════════

async def list_visits(db: AsyncSession, status: str | None = None) -> list[VisitOut]:
    query = "SELECT visit_id, pet_id, employee_id, visit_time, complaint, status FROM visit"
    params = {}
    if status:
        query += " WHERE status = :status"
        params["status"] = status
    query += " ORDER BY visit_id DESC"
    result = await db.execute(text(query), params)
    return [VisitOut.model_validate(row._mapping) for row in result.fetchall()]


async def create_visit(db: AsyncSession, data: VisitCreate) -> VisitOut:
    result = await db.execute(
        text(
            "INSERT INTO visit (pet_id, employee_id, complaint) "
            "VALUES (:pet_id, :emp_id, :complaint) "
            "RETURNING visit_id, pet_id, employee_id, visit_time, complaint, status"
        ),
        {"pet_id": data.pet_id, "emp_id": data.employee_id, "complaint": data.complaint},
    )
    row = result.fetchone()
    return VisitOut.model_validate(row._mapping)


async def accept_visit(db: AsyncSession, visit_id: int) -> VisitOut:
    result = await db.execute(
        text("SELECT visit_id, pet_id, employee_id, visit_time, complaint, status FROM visit WHERE visit_id = :id"),
        {"id": visit_id},
    )
    row = result.fetchone()
    if row is None:
        raise NotFound(detail="就诊记录不存在")
    if row.status != "待接诊":
        raise Conflict(detail=f"当前状态'{row.status}'不可接诊，只有'待接诊'状态可以接诊")

    await db.execute(
        text("UPDATE visit SET status = '接诊中' WHERE visit_id = :id"),
        {"id": visit_id},
    )
    return VisitOut(
        visit_id=row.visit_id,
        pet_id=row.pet_id,
        employee_id=row.employee_id,
        visit_time=row.visit_time,
        complaint=row.complaint,
        status="接诊中",
    )


# ═══════════════════════════════════════════
# Diagnosis（双写 PG + MongoDB）
# ═══════════════════════════════════════════

async def create_diagnosis(
    db: AsyncSession,
    mongo_db: AsyncIOMotorDatabase,
    visit_id: int,
    data: DiagnosisCreate,
    user: dict,
) -> DiagnosisOut:
    # 查 visit 状态 + 关联 pet + customer 信息
    result = await db.execute(
        text(
            "SELECT v.status, v.pet_id, p.customer_id, p.name AS pet_name "
            "FROM visit v JOIN pet p ON v.pet_id = p.pet_id "
            "WHERE v.visit_id = :id"
        ),
        {"id": visit_id},
    )
    row = result.fetchone()
    if row is None:
        raise NotFound(detail="就诊记录不存在")
    if row.status != "接诊中":
        raise Conflict(detail=f"当前状态'{row.status}'不可诊断，需要先接诊")

    # PG: 插入诊断
    diag_result = await db.execute(
        text(
            "INSERT INTO diagnosis (visit_id, diagnosis_result, notes) "
            "VALUES (:vid, :result, :notes) "
            "RETURNING diagnosis_id, visit_id, diagnosis_result, notes"
        ),
        {"vid": visit_id, "result": data.diagnosis_result, "notes": data.notes},
    )
    diag_row = diag_result.fetchone()

    # 更新 visit 状态为待收费
    await db.execute(
        text("UPDATE visit SET status = '待收费' WHERE visit_id = :id"),
        {"id": visit_id},
    )

    # MongoDB: 写入完整病历
    await _ensure_mongo_indexes(mongo_db)
    mongo_doc = {
        "diagnosis_id": diag_row.diagnosis_id,
        "visit_id": visit_id,
        "pet_id": row.pet_id,
        "customer_id": row.customer_id,
        "pet_name": row.pet_name,
        "diagnosis_result": data.diagnosis_result,
        "notes": data.notes,
        "created_by": user["name"],
        "created_by_id": user["employee_id"],
        "created_at": datetime.now(timezone.utc),
    }
    await mongo_db.medical_records.insert_one(mongo_doc)

    return DiagnosisOut(
        diagnosis_id=diag_row.diagnosis_id,
        visit_id=diag_row.visit_id,
        diagnosis_result=diag_row.diagnosis_result,
        notes=diag_row.notes,
    )


# ═══════════════════════════════════════════
# Prescription（处方 + 库存扣减）
# ═══════════════════════════════════════════

async def add_prescription(
    db: AsyncSession,
    diagnosis_id: int,
    items: list[PrescriptionItemCreate],
) -> list[PrescriptionItemOut]:
    # 验证诊断存在并获取 visit 状态
    result = await db.execute(
        text(
            "SELECT d.diagnosis_id, d.visit_id, v.status "
            "FROM diagnosis d JOIN visit v ON d.visit_id = v.visit_id "
            "WHERE d.diagnosis_id = :id"
        ),
        {"id": diagnosis_id},
    )
    row = result.fetchone()
    if row is None:
        raise NotFound(detail="诊断记录不存在")
    if row.status not in ("接诊中", "待收费"):
        raise Conflict(detail=f"当前状态'{row.status}'不可开具处方")

    created = []
    for item in items:
        # 获取批次对应的 medicine_id
        batch_result = await db.execute(
            text("SELECT medicine_id FROM medicine_batch WHERE batch_id = :bid"),
            {"bid": item.batch_id},
        )
        batch_row = batch_result.fetchone()
        if batch_row is None:
            raise NotFound(detail=f"批次{ item.batch_id}不存在")

        # 调 pharmacy 扣库存
        await deduct_stock(db, batch_row.medicine_id, item.quantity)

        # 插入处方明细
        rx_result = await db.execute(
            text(
                "INSERT INTO prescription_item (diagnosis_id, batch_id, quantity, dosage) "
                "VALUES (:did, :bid, :qty, :dosage) "
                "RETURNING item_id, diagnosis_id, batch_id, quantity, dosage"
            ),
            {
                "did": diagnosis_id,
                "bid": item.batch_id,
                "qty": item.quantity,
                "dosage": item.dosage,
            },
        )
        rx_row = rx_result.fetchone()
        created.append(
            PrescriptionItemOut(
                item_id=rx_row.item_id,
                diagnosis_id=rx_row.diagnosis_id,
                batch_id=rx_row.batch_id,
                quantity=rx_row.quantity,
                dosage=rx_row.dosage,
            )
        )

    return created


# ═══════════════════════════════════════════
# Cancel
# ═══════════════════════════════════════════

async def cancel_visit(db: AsyncSession, visit_id: int) -> None:
    result = await db.execute(
        text("SELECT status FROM visit WHERE visit_id = :id"),
        {"id": visit_id},
    )
    row = result.fetchone()
    if row is None:
        raise NotFound(detail="就诊记录不存在")

    # 先检查是否有诊断（无论状态如何）
    diag = await db.execute(
        text("SELECT diagnosis_id FROM diagnosis WHERE visit_id = :id"),
        {"id": visit_id},
    )
    if diag.fetchone() is not None:
        raise Conflict(detail="已有诊断记录，不可取消")

    if row.status not in ("待接诊", "接诊中"):
        raise Conflict(detail=f"当前状态'{row.status}'不可取消")

    await db.execute(
        text("UPDATE visit SET status = '已取消' WHERE visit_id = :id"),
        {"id": visit_id},
    )
