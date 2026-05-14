from fastapi import APIRouter, Depends

from app.core.deps import get_current_user
from app.shared.minio import ensure_bucket, minio_client
from app.core.config import settings

from .schemas import UploadUrlRequest, UploadUrlResponse

router = APIRouter(prefix="/api/minio", tags=["文件上传"])


@router.post("/upload-url", response_model=UploadUrlResponse)
async def get_upload_url(
    body: UploadUrlRequest,
    _user: dict = Depends(get_current_user),
):
    """获取 MinIO presigned PUT URL，前端直传文件"""
    ensure_bucket()

    # 文件大小限制：图片 5MB，PDF 10MB
    url = minio_client.presigned_put_object(
        bucket_name=settings.MINIO_BUCKET,
        object_name=body.file_key,
        expires=3600,  # 1 小时有效期
    )

    return UploadUrlResponse(upload_url=url, file_key=body.file_key)
