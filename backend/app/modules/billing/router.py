from fastapi import APIRouter, BackgroundTasks, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_pg_db, require_role
from app.modules.billing.schemas import BillItemCreate
from app.modules.billing.service import create_bill_item, get_bill_detail, list_bills, settle_bill
from app.shared.minio import ensure_bucket, minio_client
from app.core.config import settings

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
    return JSONResponse(content=result, status_code=status_code)


@router.post("/api/billing/bills/{bill_id}/settle")
async def settle(
    bill_id: int,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_pg_db),
    _current_user=Depends(require_role("管理员")),
):
    """结账（管理员），结账成功后异步生成 PDF"""
    result = await settle_bill(db, bill_id)
    # 异步触发 PDF 导出
    from app.tasks.export_bill import export_bill_background
    background_tasks.add_task(export_bill_background, bill_id)
    return result


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


@router.get("/api/billing/bills/{bill_id}/download")
async def bill_download_url(
    bill_id: int,
    _current_user=Depends(get_current_user),
):
    """获取账单 PDF 的 presigned 下载 URL（7 天有效）"""
    file_key = f"exports/bills/{bill_id}.pdf"
    ensure_bucket()
    try:
        minio_client.stat_object(settings.MINIO_BUCKET, file_key)
    except Exception:
        from app.core.exceptions import NotFound
        raise NotFound(detail="账单 PDF 尚未生成，请先结账")
    url = minio_client.presigned_get_object(
        settings.MINIO_BUCKET, file_key, expires=604800
    )
    return {"url": url, "file_key": file_key}
