import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.exceptions import AppError, app_error_handler


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 启动时初始化（并行执行，减少阻塞）
    from app.shared.minio import ensure_bucket

    # MinIO bucket 检查放到线程池，避免同步 HTTP 阻塞 event loop
    try:
        await asyncio.get_event_loop().run_in_executor(None, ensure_bucket)
    except Exception:
        pass  # MinIO 不可用时不影响核心业务启动

    # MongoDB 索引并行创建（避免串行等待）
    from app.shared.mongo_db import mongo_db as _mongo
    async def create_indexes():
        try:
            await asyncio.gather(
                _mongo.medical_records.create_index("diagnosis_id", unique=True, name="idx_diagnosis_id"),
                _mongo.medical_records.create_index("visit_id", name="idx_visit_id"),
                _mongo.medical_records.create_index("created_by", name="idx_created_by"),
                _mongo.nursing_logs.create_index("record_id", unique=True, name="idx_nursing_record_id"),
                _mongo.nursing_logs.create_index("hosp_id", name="idx_nursing_hosp_id"),
            )
        except Exception:
            pass  # 索引可能已存在

    await create_indexes()

    yield

    # 关闭时清理连接
    from app.shared.redis import redis_client as _redis
    from app.shared.mongo_db import mongo_client as _mongo_client
    await _redis.aclose()
    _mongo_client.close()


app = FastAPI(title="宠物医院诊疗与住院管理系统", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_exception_handler(AppError, app_error_handler)

from app.modules.auth.router import router as auth_router
from app.modules.consultation.router import router as consultation_router
from app.modules.customer.router import router as customer_router
from app.modules.billing.router import router as billing_router
from app.modules.boarding.router import router as boarding_router
from app.modules.hospitalization.router import router as hospitalization_router
from app.modules.minio_upload.router import router as minio_upload_router
from app.modules.pharmacy.router import router as pharmacy_router

app.include_router(auth_router)
app.include_router(minio_upload_router)
app.include_router(consultation_router)
app.include_router(customer_router)
app.include_router(pharmacy_router)
app.include_router(billing_router)
app.include_router(hospitalization_router)
app.include_router(boarding_router)


@app.get("/api/health")
def health():
    return {"status": "ok"}
