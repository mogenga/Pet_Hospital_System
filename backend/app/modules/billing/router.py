from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_pg_db, require_role
from app.modules.billing.schemas import BillItemCreate
from app.modules.billing.service import create_bill_item, get_bill_detail, list_bills, settle_bill

router = APIRouter(tags=["收费管理"])


@router.post("/api/billing/visits/{visit_id}/items")
async def add_bill_item(
    visit_id: int,
    data: BillItemCreate,
    db: AsyncSession = Depends(get_pg_db),
    _current_user=Depends(require_role("管理员", "医生")),
):
    """生成收费项（管理员/医生）"""
    result = await create_bill_item(db, visit_id, data)
    status_code = 200 if result["is_duplicate"] else 201
    from fastapi.responses import JSONResponse
    return JSONResponse(content=result, status_code=status_code)


@router.post("/api/billing/bills/{bill_id}/settle")
async def settle(
    bill_id: int,
    db: AsyncSession = Depends(get_pg_db),
    _current_user=Depends(require_role("管理员")),
):
    """结账（管理员）"""
    return await settle_bill(db, bill_id)


@router.get("/api/billing/bills")
async def bill_list(
    db: AsyncSession = Depends(get_pg_db),
    _current_user=Depends(get_current_user),
):
    """账单列表（全部角色）"""
    return await list_bills(db)


@router.get("/api/billing/bills/{bill_id}")
async def bill_detail(
    bill_id: int,
    db: AsyncSession = Depends(get_pg_db),
    _current_user=Depends(get_current_user),
):
    """账单详情 + 收费项明细（全部角色）"""
    return await get_bill_detail(db, bill_id)
