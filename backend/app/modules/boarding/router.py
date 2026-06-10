from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_pg_db, require_role
from app.modules.boarding.schemas import BoardingCreate
from app.modules.boarding.service import (
    create_boarding,
    end_boarding,
    get_boarding_detail,
    list_boardings,
)

router = APIRouter(tags=["寄养管理"])


@router.post("/api/boarding")
async def register_boarding(
    data: BoardingCreate,
    db: AsyncSession = Depends(get_pg_db),
    _current_user=Depends(require_role("管理员")),
):
    """登记寄养（仅管理员）"""
    result = await create_boarding(db, data)
    return JSONResponse(content=result, status_code=201)


@router.get("/api/boarding")
async def boarding_list(
    db: AsyncSession = Depends(get_pg_db),
    _current_user=Depends(get_current_user),
):
    """寄养列表"""
    return await list_boardings(db)


@router.get("/api/boarding/{boarding_id}")
async def boarding_detail(
    boarding_id: int,
    db: AsyncSession = Depends(get_pg_db),
    _current_user=Depends(get_current_user),
):
    """寄养详情（含动态计算费用）"""
    return await get_boarding_detail(db, boarding_id)


@router.put("/api/boarding/{boarding_id}/end")
async def end(
    boarding_id: int,
    db: AsyncSession = Depends(get_pg_db),
    _current_user=Depends(require_role("管理员")),
):
    """结束寄养（仅管理员）"""
    return await end_boarding(db, boarding_id)
