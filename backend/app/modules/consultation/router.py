from fastapi import APIRouter, Depends, Query
from motor.motor_asyncio import AsyncIOMotorDatabase
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, require_role
from app.modules.consultation.schemas import (
    DiagnosisCreate,
    DiagnosisOut,
    PrescriptionCreate,
    PrescriptionItemOut,
    VisitCreate,
    VisitOut,
)
from app.modules.consultation.service import (
    accept_visit,
    add_prescription,
    cancel_visit,
    create_diagnosis,
    create_visit,
    list_visits,
)
from app.shared.mongo_db import mongo_db
from app.shared.pg_db import get_pg_db

router = APIRouter(tags=["就诊管理"])


@router.get("/api/consultation/visits", response_model=list[VisitOut])
async def list_visits_endpoint(
    status: str | None = Query(None),
    db: AsyncSession = Depends(get_pg_db),
    user: dict = Depends(get_current_user),
):
    return await list_visits(db, status)


@router.post("/api/consultation/visits", status_code=201, response_model=VisitOut)
async def create_visit_endpoint(
    data: VisitCreate,
    db: AsyncSession = Depends(get_pg_db),
    user: dict = Depends(require_role("管理员")),
):
    return await create_visit(db, data)


@router.put("/api/consultation/visits/{visit_id}/accept", response_model=VisitOut)
async def accept_visit_endpoint(
    visit_id: int,
    db: AsyncSession = Depends(get_pg_db),
    user: dict = Depends(require_role("医生")),
):
    return await accept_visit(db, visit_id)


@router.post("/api/consultation/visits/{visit_id}/diagnosis", status_code=201, response_model=DiagnosisOut)
async def create_diagnosis_endpoint(
    visit_id: int,
    data: DiagnosisCreate,
    db: AsyncSession = Depends(get_pg_db),
    user: dict = Depends(require_role("医生")),
):
    return await create_diagnosis(db, mongo_db, visit_id, data, user)


@router.post("/api/consultation/diagnoses/{diagnosis_id}/prescriptions", status_code=201, response_model=list[PrescriptionItemOut])
async def add_prescription_endpoint(
    diagnosis_id: int,
    data: PrescriptionCreate,
    db: AsyncSession = Depends(get_pg_db),
    user: dict = Depends(require_role("医生")),
):
    return await add_prescription(db, diagnosis_id, data.items)


@router.delete("/api/consultation/visits/{visit_id}", status_code=204)
async def cancel_visit_endpoint(
    visit_id: int,
    db: AsyncSession = Depends(get_pg_db),
    user: dict = Depends(require_role("管理员")),
):
    await cancel_visit(db, visit_id)


@router.get("/api/customers/{customer_id}/history")
async def get_customer_history_endpoint(
    customer_id: int,
    db: AsyncSession = Depends(get_pg_db),
    user: dict = Depends(require_role("医生")),
):
    """客户就诊历史聚合（PG visit + diagnosis + MongoDB medical_records）"""
    visits = await db.execute(
        text(
            "SELECT v.visit_id, v.pet_id, v.employee_id, v.visit_time, v.complaint, v.status "
            "FROM visit v JOIN pet p ON v.pet_id = p.pet_id "
            "WHERE p.customer_id = :cid "
            "ORDER BY v.visit_time DESC"
        ),
        {"cid": customer_id},
    )
    visit_rows = visits.fetchall()

    result = []
    for v in visit_rows:
        visit_data = {
            "visit_id": v.visit_id,
            "pet_id": v.pet_id,
            "employee_id": v.employee_id,
            "visit_time": v.visit_time.isoformat(),
            "complaint": v.complaint,
            "status": v.status,
            "diagnosis": None,
            "medical_record": None,
        }

        # 查诊断（PG）
        diag = await db.execute(
            text("SELECT diagnosis_id, diagnosis_result, notes FROM diagnosis WHERE visit_id = :vid"),
            {"vid": v.visit_id},
        )
        diag_row = diag.fetchone()
        if diag_row:
            visit_data["diagnosis"] = {
                "diagnosis_id": diag_row.diagnosis_id,
                "diagnosis_result": diag_row.diagnosis_result,
                "notes": diag_row.notes,
            }
            # 查 MongoDB 病历
            mongo_doc = await mongo_db.medical_records.find_one({"diagnosis_id": diag_row.diagnosis_id})
            if mongo_doc:
                mongo_doc.pop("_id", None)
                visit_data["medical_record"] = mongo_doc

        result.append(visit_data)

    return result
