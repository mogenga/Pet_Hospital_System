from pydantic import BaseModel, Field


class UploadUrlRequest(BaseModel):
    file_key: str = Field(..., description="MinIO 对象 key，如 photos/pets/1.jpg")
    content_type: str = Field(default="application/octet-stream", description="文件 MIME 类型")


class UploadUrlResponse(BaseModel):
    upload_url: str
    file_key: str
