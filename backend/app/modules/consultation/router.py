from fastapi import APIRouter, Depends, Query
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
    complete_visit,
    create_diagnosis,
    create_visit,
    get_visit,
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


@router.get("/api/consultation/visits/{visit_id}")
async def get_visit_endpoint(
    visit_id: int,
    db: AsyncSession = Depends(get_pg_db),
    user: dict = Depends(get_current_user),
):
    """就诊详情（含诊断、处方明细）"""
    return await get_visit(db, visit_id)


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


@router.put("/api/consultation/visits/{visit_id}/complete", response_model=VisitOut)
async def complete_visit_endpoint(
    visit_id: int,
    db: AsyncSession = Depends(get_pg_db),
    user: dict = Depends(require_role("医生")),
):
    """完成诊疗（接诊中 → 待收费）"""
    return await complete_visit(db, visit_id)


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
