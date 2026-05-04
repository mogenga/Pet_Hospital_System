from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, require_role
from app.modules.customer import service
from app.modules.customer.schemas import (
    CustomerCreate,
    CustomerOut,
    CustomerUpdate,
    PetCreate,
    PetOut,
    PetUpdate,
)
from app.shared.pg_db import get_pg_db

router = APIRouter(prefix="/api/customers")


@router.get("", response_model=list[CustomerOut])
async def list_customers(
    db: AsyncSession = Depends(get_pg_db),
    _: dict = Depends(get_current_user),
):
    """客户列表（含缓存）"""
    return await service.list_customers(db)


@router.get("/{customer_id}", response_model=CustomerOut)
async def get_customer(
    customer_id: int,
    db: AsyncSession = Depends(get_pg_db),
    _: dict = Depends(get_current_user),
):
    """客户详情 + 宠物列表"""
    return await service.get_customer(db, customer_id)


@router.post("", response_model=CustomerOut, status_code=201)
async def create_customer(
    body: CustomerCreate,
    db: AsyncSession = Depends(get_pg_db),
    _: dict = Depends(require_role("管理员")),
):
    """新增客户（管理员）"""
    return await service.create_customer(db, body)


@router.put("/{customer_id}", response_model=CustomerOut)
async def update_customer(
    customer_id: int,
    body: CustomerUpdate,
    db: AsyncSession = Depends(get_pg_db),
    _: dict = Depends(require_role("管理员")),
):
    """编辑客户（管理员）"""
    return await service.update_customer(db, customer_id, body)


@router.delete("/{customer_id}", status_code=204)
async def delete_customer(
    customer_id: int,
    db: AsyncSession = Depends(get_pg_db),
    _: dict = Depends(require_role("管理员")),
):
    """删除客户（管理员）"""
    await service.delete_customer(db, customer_id)


@router.post("/{customer_id}/pets", response_model=PetOut, status_code=201)
async def add_pet(
    customer_id: int,
    body: PetCreate,
    db: AsyncSession = Depends(get_pg_db),
    _: dict = Depends(require_role("管理员")),
):
    """添加宠物（管理员）"""
    return await service.add_pet(db, customer_id, body)


@router.put("/{customer_id}/pets/{pet_id}", response_model=PetOut)
async def update_pet(
    customer_id: int,
    pet_id: int,
    body: PetUpdate,
    db: AsyncSession = Depends(get_pg_db),
    _: dict = Depends(require_role("管理员")),
):
    """编辑宠物（管理员）"""
    return await service.update_pet(db, customer_id, pet_id, body)


@router.delete("/{customer_id}/pets/{pet_id}", status_code=204)
async def delete_pet(
    customer_id: int,
    pet_id: int,
    db: AsyncSession = Depends(get_pg_db),
    _: dict = Depends(require_role("管理员")),
):
    """删除宠物（管理员）"""
    await service.delete_pet(db, customer_id, pet_id)
