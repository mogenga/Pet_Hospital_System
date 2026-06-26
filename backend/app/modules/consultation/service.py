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
from app.shared.services.billing_service import add_item as billing_add_item


# ═══════════════════════════════════════════
# Visit
# ═══════════════════════════════════════════

async def list_visits(db: AsyncSession, status: str | None = None) -> list[VisitOut]:
    query = (
        "SELECT v.visit_id, v.pet_id, v.employee_id, v.visit_time, v.complaint, v.status, "
        "p.name AS pet_name, c.name AS customer_name "
        "FROM visit v "
        "JOIN pet p ON v.pet_id = p.pet_id "
        "JOIN customer c ON p.customer_id = c.customer_id "
    )
    params = {}
    if status:
        query += " WHERE v.status = :status"
        params["status"] = status
    query += " ORDER BY v.visit_id DESC"
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


async def get_visit(db: AsyncSession, visit_id: int) -> dict:
    """获取单个就诊详情，含诊断和处方信息"""
    result = await db.execute(
        text(
            "SELECT v.visit_id, v.pet_id, v.employee_id, v.visit_time, v.complaint, v.status, "
            "p.name AS pet_name, p.species, p.breed, c.name AS customer_name, "
            "e.name AS doctor_name "
            "FROM visit v "
            "JOIN pet p ON v.pet_id = p.pet_id "
            "JOIN customer c ON p.customer_id = c.customer_id "
            "JOIN employee e ON v.employee_id = e.employee_id "
            "WHERE v.visit_id = :id"
        ),
        {"id": visit_id},
    )
    row = result.fetchone()
    if row is None:
        raise NotFound(detail="就诊记录不存在")

    visit_data = {
        "visit_id": row.visit_id,
        "pet_id": row.pet_id,
        "pet_name": row.pet_name,
        "species": row.species,
        "breed": row.breed,
        "customer_name": row.customer_name,
        "employee_id": row.employee_id,
        "doctor_name": row.doctor_name,
        "visit_time": row.visit_time.isoformat(),
        "complaint": row.complaint,
        "status": row.status,
        "diagnosis": None,
        "prescriptions": [],
    }

    # 查诊断
    diag = await db.execute(
        text("SELECT diagnosis_id, diagnosis_result, notes FROM diagnosis WHERE visit_id = :vid"),
        {"vid": visit_id},
    )
    diag_row = diag.fetchone()
    if diag_row:
        visit_data["diagnosis"] = {
            "diagnosis_id": diag_row.diagnosis_id,
            "diagnosis_result": diag_row.diagnosis_result,
            "notes": diag_row.notes,
        }
        # 查处方明细
        rx = await db.execute(
            text(
                "SELECT pi.item_id, pi.batch_id, pi.quantity, pi.dosage, "
                "m.name AS medicine_name "
                "FROM prescription_item pi "
                "JOIN medicine_batch mb ON pi.batch_id = mb.batch_id "
                "JOIN medicine m ON mb.medicine_id = m.medicine_id "
                "WHERE pi.diagnosis_id = :did"
            ),
            {"did": diag_row.diagnosis_id},
        )
        visit_data["prescriptions"] = [
            {
                "item_id": rx_row.item_id,
                "batch_id": rx_row.batch_id,
                "medicine_name": rx_row.medicine_name,
                "quantity": rx_row.quantity,
                "dosage": rx_row.dosage,
            }
            for rx_row in rx.fetchall()
        ]

    return visit_data


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


async def complete_visit(db: AsyncSession, visit_id: int) -> VisitOut:
    """完成诊疗，状态 接诊中 → 待收费"""
    result = await db.execute(
        text("SELECT visit_id, pet_id, employee_id, visit_time, complaint, status FROM visit WHERE visit_id = :id"),
        {"id": visit_id},
    )
    row = result.fetchone()
    if row is None:
        raise NotFound(detail="就诊记录不存在")
    if row.status != "接诊中":
        raise Conflict(detail=f"当前状态'{row.status}'不可完成诊疗，只有'接诊中'状态可以操作")

    await db.execute(
        text("UPDATE visit SET status = '待收费' WHERE visit_id = :id"),
        {"id": visit_id},
    )
    return VisitOut(
        visit_id=row.visit_id,
        pet_id=row.pet_id,
        employee_id=row.employee_id,
        visit_time=row.visit_time,
        complaint=row.complaint,
        status="待收费",
    )


# ═══════════════════════════════════════════
# Diagnosis
# ═══════════════════════════════════════════

async def create_diagnosis(
    db: AsyncSession,
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

    # 插入诊断 + 更新 visit 状态：接诊中 → 待收费
    diag_result = await db.execute(
        text(
            "INSERT INTO diagnosis (visit_id, diagnosis_result, notes) "
            "VALUES (:vid, :result, :notes) "
            "RETURNING diagnosis_id, visit_id, diagnosis_result, notes"
        ),
        {"vid": visit_id, "result": data.diagnosis_result, "notes": data.notes},
    )
    diag_row = diag_result.fetchone()

    await db.execute(
        text("UPDATE visit SET status = '待收费' WHERE visit_id = :vid"),
        {"vid": visit_id},
    )

    await db.flush()

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

    # 批量查询所有批次的 medicine_id + unit_price + name（消除 N+1）
    batch_ids = [item.batch_id for item in items]
    batch_result = await db.execute(
        text(
            "SELECT mb.batch_id, mb.medicine_id, m.name AS medicine_name, m.unit_price "
            "FROM medicine_batch mb JOIN medicine m ON mb.medicine_id = m.medicine_id "
            "WHERE mb.batch_id = ANY(:bids)"
        ),
        {"bids": batch_ids},
    )
    batch_rows = batch_result.fetchall()
    batch_map = {row.batch_id: row.medicine_id for row in batch_rows}
    batch_price_map = {row.batch_id: (row.unit_price, row.medicine_name) for row in batch_rows}

    # 验证所有批次存在
    for item in items:
        if item.batch_id not in batch_map:
            raise NotFound(detail=f"批次{item.batch_id}不存在")

    created = []
    for item in items:
        medicine_id = batch_map[item.batch_id]
        # 调 pharmacy 扣库存
        await deduct_stock(db, medicine_id, item.quantity)

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

        # 自动生成药品费账单（处方开具即计费）
        unit_price, med_name = batch_price_map[item.batch_id]
        amount = float(unit_price) * item.quantity
        await billing_add_item(
            db,
            visit_id=row.visit_id,
            item_type="药品费",
            source_type="prescription",
            source_id=rx_row.item_id,
            amount=amount,
            description=f"{med_name} x{item.quantity}",
        )

    await db.flush()
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
