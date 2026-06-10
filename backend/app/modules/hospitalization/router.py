from datetime import date

from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_pg_db, require_role
from app.modules.hospitalization.schemas import AdmitCreate, NursingCreate, WardCreate, WardUpdate
from app.modules.hospitalization.service import (
    add_nursing_record,
    admit,
    create_ward,
    delete_ward,
    discharge,
    get_hospitalization_detail,
    list_hospitalizations,
    list_wards,
    update_ward,
)

router = APIRouter(tags=["住院管理"])


@router.get("/api/wards")
async def ward_list(
    db: AsyncSession = Depends(get_pg_db),
    _current_user=Depends(get_current_user),
):
    """笼位列表（全部角色）"""
    return await list_wards(db)


@router.post("/api/wards", status_code=201)
async def create_ward_endpoint(
    data: WardCreate,
    db: AsyncSession = Depends(get_pg_db),
    _current_user=Depends(require_role("管理员")),
):
    """新增笼位（仅管理员）"""
    return await create_ward(db, data)


@router.put("/api/wards/{ward_id}")
async def update_ward_endpoint(
    ward_id: int,
    data: WardUpdate,
    db: AsyncSession = Depends(get_pg_db),
    _current_user=Depends(require_role("管理员")),
):
    """编辑笼位（仅管理员）"""
    return await update_ward(db, ward_id, data)


@router.delete("/api/wards/{ward_id}")
async def delete_ward_endpoint(
    ward_id: int,
    db: AsyncSession = Depends(get_pg_db),
    _current_user=Depends(require_role("管理员")),
):
    """删除笼位（仅管理员，仅空闲笼位可删）"""
    await delete_ward(db, ward_id)
    return {"message": "已删除"}


@router.post("/api/hospitalization")
async def admit_hospitalization(
    data: AdmitCreate,
    db: AsyncSession = Depends(get_pg_db),
    _current_user=Depends(require_role("管理员", "医生")),
):
    """转入住院（管理员/医生）"""
    result = await admit(db, data)
    return JSONResponse(content=result, status_code=201)


@router.get("/api/hospitalization")
async def hosp_list(
    status: str | None = Query(default=None),
    db: AsyncSession = Depends(get_pg_db),
    _current_user=Depends(get_current_user),
):
    """住院列表，支持 ?status= 筛选（医生/护士）"""
    return await list_hospitalizations(db, status)


@router.get("/api/hospitalization/{hosp_id}")
async def hosp_detail(
    hosp_id: int,
    db: AsyncSession = Depends(get_pg_db),
    _current_user=Depends(get_current_user),
):
    """住院详情 + 护理记录列表（医生/护士）"""
    return await get_hospitalization_detail(db, hosp_id)


@router.post("/api/hospitalization/{hosp_id}/nursing")
async def add_nursing(
    hosp_id: int,
    data: NursingCreate,
    db: AsyncSession = Depends(get_pg_db),
    _current_user=Depends(get_current_user),
):
    """添加护理记录（护士）"""
    result = await add_nursing_record(db, hosp_id, data)
    return JSONResponse(content=result, status_code=201)


@router.put("/api/hospitalization/{hosp_id}/discharge")
async def discharge_hosp(
    hosp_id: int,
    db: AsyncSession = Depends(get_pg_db),
    _current_user=Depends(require_role("管理员")),
):
    """出院（管理员，自动生成住院费）"""
    return await discharge(db, hosp_id)
