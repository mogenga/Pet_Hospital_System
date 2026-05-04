from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, require_role
from app.modules.pharmacy import service
from app.modules.pharmacy.schemas import BatchCreate, BatchOut, MedicineCreate, MedicineOut
from app.shared.pg_db import get_pg_db

router = APIRouter(prefix="/api/pharmacy")


@router.get("/medicines", response_model=list[MedicineOut])
async def list_medicines(
    db: AsyncSession = Depends(get_pg_db),
    _: dict = Depends(get_current_user),
):
    """药品列表"""
    return await service.list_medicines(db)


@router.post("/medicines", response_model=MedicineOut, status_code=201)
async def create_medicine(
    body: MedicineCreate,
    db: AsyncSession = Depends(get_pg_db),
    _: dict = Depends(require_role("管理员")),
):
    """新增药品（管理员）"""
    return await service.create_medicine(db, body)


@router.get("/batches", response_model=list[BatchOut])
async def list_batches(
    stock_qty_lt: int | None = Query(None, description="库存预警阈值"),
    db: AsyncSession = Depends(get_pg_db),
    _: dict = Depends(get_current_user),
):
    """批次列表，可按库存预警筛选"""
    return await service.list_batches(db, stock_qty_lt)


@router.post("/batches", response_model=BatchOut, status_code=201)
async def create_batch(
    body: BatchCreate,
    db: AsyncSession = Depends(get_pg_db),
    _: dict = Depends(require_role("管理员")),
):
    """批次入库（管理员）"""
    return await service.create_batch(db, body)
