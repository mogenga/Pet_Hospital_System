from fastapi import APIRouter, Depends, Header, Request
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, require_role
from app.core.exceptions import Unauthorized
from app.modules.auth.schemas import AccountCreate, AccountOut, LoginRequest, LoginResponse, UserInfo
from app.modules.auth import service
from app.shared.pg_db import get_pg_db
from app.shared.redis import get_redis

router = APIRouter(prefix="/api")


@router.post("/auth/login", response_model=LoginResponse)
async def login(
    body: LoginRequest,
    request: Request,
    db: AsyncSession = Depends(get_pg_db),
    redis: Redis = Depends(get_redis),
):
    """登录"""
    ip = request.client.host if request.client else "127.0.0.1"
    return await service.login(db, redis, ip, body.username, body.password)


@router.post("/auth/logout")
async def logout(
    authorization: str = Header(...),
    redis: Redis = Depends(get_redis),
):
    """登出，JWT 加入黑名单"""
    if not authorization.startswith("Bearer "):
        raise Unauthorized(detail="无效的登录凭证")
    token = authorization[7:]
    await service.logout(redis, token)
    return {"message": "已登出"}


@router.get("/auth/me", response_model=UserInfo)
async def me(user: dict = Depends(get_current_user)):
    """当前用户信息"""
    return user


# 账号管理（管理员专属）

@router.get("/accounts", response_model=list[AccountOut])
async def list_accounts(
    db: AsyncSession = Depends(get_pg_db),
    _: dict = Depends(require_role("管理员")),
):
    return await service.list_accounts(db)


@router.post("/accounts", response_model=AccountOut, status_code=201)
async def create_account(
    body: AccountCreate,
    db: AsyncSession = Depends(get_pg_db),
    _: dict = Depends(require_role("管理员")),
):
    return await service.create_account(db, body)


@router.put("/accounts/{account_id}", response_model=AccountOut)
async def toggle_account(
    account_id: int,
    is_active: bool,
    db: AsyncSession = Depends(get_pg_db),
    _: dict = Depends(require_role("管理员")),
):
    return await service.toggle_account(db, account_id, is_active)


@router.delete("/accounts/{account_id}")
async def delete_account(
    account_id: int,
    db: AsyncSession = Depends(get_pg_db),
    _: dict = Depends(require_role("管理员")),
):
    await service.delete_account(db, account_id)
    return {"message": "已删除"}
