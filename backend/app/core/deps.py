from fastapi import Depends, Request
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import Forbidden, Unauthorized
from app.core.security import decode_access_token
from app.shared.pg_db import get_pg_db
from app.shared.redis import get_redis

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_pg_db),
    redis=Depends(get_redis),
) -> dict:
    """验 JWT → 查黑名单 → 查数据库确认账号有效 → 返回用户信息"""
    try:
        payload = decode_access_token(token)
    except JWTError:
        raise Unauthorized(detail="无效的登录凭证")

    account_id = payload.get("sub")
    if account_id is None:
        raise Unauthorized(detail="无效的登录凭证")

    # 查黑名单（按 JTI）
    jti = payload.get("jti")
    if jti:
        blacklisted = await redis.get(f"jwt:blacklist:{jti}")
        if blacklisted:
            raise Unauthorized(detail="登录已过期，请重新登录")

    # 从数据库确认账号仍存在且启用
    result = await db.execute(
        text(
            "SELECT a.account_id, a.username, e.name, e.role, e.employee_id "
            "FROM account a JOIN employee e ON a.employee_id = e.employee_id "
            "WHERE a.account_id = :id AND a.is_active = TRUE"
        ),
        {"id": int(account_id)},
    )
    row = result.fetchone()
    if row is None:
        raise Unauthorized(detail="账号不存在或已禁用")

    return {
        "account_id": row.account_id,
        "username": row.username,
        "name": row.name,
        "role": row.role,
        "employee_id": row.employee_id,
    }


def require_role(*roles: str):
    """角色守卫工厂：只允许指定角色访问"""

    async def checker(user: dict = Depends(get_current_user)):
        if user["role"] not in roles:
            raise Forbidden(detail="权限不足")
        return user

    return checker
