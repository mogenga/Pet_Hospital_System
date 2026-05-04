from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.exceptions import AppError, app_error_handler
from app.shared.minio import ensure_bucket


@asynccontextmanager
async def lifespan(app: FastAPI):
    ensure_bucket()
    yield


app = FastAPI(title="宠物医院诊疗与住院管理系统", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_exception_handler(AppError, app_error_handler)

from app.modules.auth.router import router as auth_router
from app.modules.consultation.router import router as consultation_router
from app.modules.customer.router import router as customer_router
from app.modules.pharmacy.router import router as pharmacy_router

app.include_router(auth_router)
app.include_router(consultation_router)
app.include_router(customer_router)
app.include_router(pharmacy_router)


@app.get("/api/health")
def health():
    return {"status": "ok"}
