from datetime import timedelta
from io import BytesIO

from fastapi import APIRouter, Depends, Query, UploadFile, File, Form

from app.core.deps import get_current_user, require_role
from app.shared.minio import ensure_bucket, minio_client
from app.core.config import settings
from app.core.exceptions import AppError, NotFound

router = APIRouter(prefix="/api/minio", tags=["文件上传"])


@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    file_key: str = Form(..., description="MinIO 对象 key"),
    _user: dict = Depends(require_role("管理员", "医生")),
):
    """上传文件到 MinIO（后端代理，避免 CORS 问题）"""
    ensure_bucket()

    content = await file.read()
    if len(content) > 5 * 1024 * 1024:
        raise AppError(detail="文件大小不能超过 5MB", status_code=400)

    try:
        minio_client.put_object(
            bucket_name=settings.MINIO_BUCKET,
            object_name=file_key,
            data=BytesIO(content),
            length=len(content),
            content_type=file.content_type or "image/jpeg",
        )
    except Exception as e:
        raise AppError(detail=f"文件上传失败: {str(e)}", status_code=500)

    return {"file_key": file_key, "message": "上传成功"}


@router.get("/download-url")
async def get_download_url(
    file_key: str = Query(..., description="MinIO 对象 key"),
    _user: dict = Depends(get_current_user),
):
    """获取 MinIO presigned GET URL，前端展示图片用（全部角色）"""
    ensure_bucket()
    try:
        minio_client.stat_object(settings.MINIO_BUCKET, file_key)
    except Exception:
        raise NotFound(detail="文件不存在")

    url = minio_client.presigned_get_object(
        settings.MINIO_BUCKET, file_key, expires=timedelta(days=7)
    )
    return {"url": url, "file_key": file_key}
