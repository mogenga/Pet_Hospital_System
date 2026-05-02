from datetime import datetime, timezone

from redis.asyncio import Redis
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import Conflict, NotFound, Unauthorized
from app.core.security import (
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)
from app.modules.auth.schemas import AccountCreate, AccountOut, LoginResponse, UserInfo


async def check_login_rate_limit(redis: Redis, ip: str):
    """检查登录限流：同一 IP 15 分钟内最多 5 次失败"""
    key = f"ratelimit:login:{ip}"
    attempts = await redis.get(key)
    if attempts and int(attempts) > 5:
        raise Unauthorized(detail="登录尝试过于频繁，请15分钟后重试")


async def record_login_failure(redis: Redis, ip: str):
    """记录一次登录失败"""
    key = f"ratelimit:login:{ip}"
    attempts = await redis.incr(key)
    if attempts == 1:
        await redis.expire(key, 900)


async def login(db: AsyncSession, redis: Redis, ip: str, username: str, password: str) -> LoginResponse:
    # 先检查是否已被限流
    await check_login_rate_limit(redis, ip)

    result = await db.execute(
        text(
            "SELECT a.account_id, a.username, a.password_hash, a.is_active, "
            "e.name, e.role, e.employee_id "
            "FROM account a JOIN employee e ON a.employee_id = e.employee_id "
            "WHERE a.username = :username"
        ),
        {"username": username},
    )
    row = result.fetchone()
    if row is None:
        await record_login_failure(redis, ip)
        raise Unauthorized(detail="用户名或密码错误")

    if not row.is_active:
        await record_login_failure(redis, ip)
        raise Unauthorized(detail="账号已被禁用")

    if not verify_password(password, row.password_hash):
        await record_login_failure(redis, ip)
        raise Unauthorized(detail="用户名或密码错误")

    # 签发 JWT
    token = create_access_token(data={"sub": str(row.account_id), "role": row.role})

    # 更新最后登录时间
    await db.execute(
        text("UPDATE account SET last_login = :now WHERE account_id = :id"),
        {"now": datetime.now(timezone.utc).replace(tzinfo=None), "id": row.account_id},
    )

    user = UserInfo(
        account_id=row.account_id,
        username=row.username,
        name=row.name,
        role=row.role,
        employee_id=row.employee_id,
    )
    return LoginResponse(access_token=token, user=user)


async def logout(redis: Redis, token: str):
    """将 JWT 加入黑名单（按 JTI），TTL 为 token 剩余有效时间"""
    payload = decode_access_token(token)
    exp = payload["exp"]
    now = datetime.now(timezone.utc).timestamp()
    ttl = max(0, int(exp - now))
    await redis.set(f"jwt:blacklist:{payload['jti']}", "1", ex=ttl)


async def create_account(db: AsyncSession, data: AccountCreate) -> AccountOut:
    # 检查 username 唯一
    existing = await db.execute(
        text("SELECT 1 FROM account WHERE username = :username"),
        {"username": data.username},
    )
    if existing.fetchone():
        raise Conflict(detail="用户名已存在")

    # 检查 employee 存在且未绑定账号
    emp = await db.execute(
        text(
            "SELECT e.employee_id, e.name, e.role, e.phone "
            "FROM employee e LEFT JOIN account a ON e.employee_id = a.employee_id "
            "WHERE e.employee_id = :eid AND a.account_id IS NULL"
        ),
        {"eid": data.employee_id},
    )
    emp_row = emp.fetchone()
    if emp_row is None:
        raise NotFound(detail="员工不存在或已有绑定账号")

    password_hash = hash_password(data.password)
    result = await db.execute(
        text(
            "INSERT INTO account (employee_id, username, password_hash) "
            "VALUES (:eid, :username, :ph) RETURNING account_id, employee_id, username, is_active, last_login, created_at"
        ),
        {"eid": data.employee_id, "username": data.username, "ph": password_hash},
    )
    row = result.fetchone()
    return AccountOut(
        account_id=row.account_id,
        employee_id=row.employee_id,
        username=row.username,
        is_active=row.is_active,
        last_login=row.last_login,
        created_at=row.created_at,
    )


async def list_accounts(db: AsyncSession) -> list[AccountOut]:
    result = await db.execute(
        text("SELECT account_id, employee_id, username, is_active, last_login, created_at FROM account ORDER BY account_id")
    )
    return [
        AccountOut(
            account_id=row.account_id,
            employee_id=row.employee_id,
            username=row.username,
            is_active=row.is_active,
            last_login=row.last_login,
            created_at=row.created_at,
        )
        for row in result.fetchall()
    ]


async def toggle_account(db: AsyncSession, account_id: int, is_active: bool) -> AccountOut:
    result = await db.execute(
        text(
            "UPDATE account SET is_active = :active WHERE account_id = :id "
            "RETURNING account_id, employee_id, username, is_active, last_login, created_at"
        ),
        {"active": is_active, "id": account_id},
    )
    row = result.fetchone()
    if row is None:
        raise NotFound(detail="账号不存在")
    return AccountOut(
        account_id=row.account_id,
        employee_id=row.employee_id,
        username=row.username,
        is_active=row.is_active,
        last_login=row.last_login,
        created_at=row.created_at,
    )


async def delete_account(db: AsyncSession, account_id: int):
    result = await db.execute(
        text("DELETE FROM account WHERE account_id = :id"), {"id": account_id}
    )
    if result.rowcount == 0:
        raise NotFound(detail="账号不存在")
