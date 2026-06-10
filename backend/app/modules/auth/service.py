import json
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
from app.modules.auth.schemas import AccountCreate, AccountOut, EmployeeOut, LoginResponse, UserInfo
from app.shared.redis import redis_client

CACHE_KEY = "employee:list"
CACHE_TTL = 3600  # 60 分钟


async def _invalidate_cache():
    await redis_client.delete(CACHE_KEY)


async def check_login_rate_limit(redis: Redis, ip: str):
    """检查登录限流：同一 IP 15 分钟内最多 5 次失败"""
    key = f"ratelimit:login:{ip}"
    attempts = await redis.get(key)
    if attempts and int(attempts) >= 5:
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

    # 登录成功，清除限流计数和该账号的黑名单（新登录应覆盖旧的登出状态）
    await redis.delete(f"ratelimit:login:{ip}", f"jwt:blacklist:{row.account_id}")

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
    """将账号加入 JWT 黑名单（按 account_id），该账号所有设备同时登出"""
    try:
        payload = decode_access_token(token)
    except Exception:
        return  # token 已无效，无需加入黑名单
    exp = payload["exp"]
    now = datetime.now(timezone.utc).timestamp()
    ttl = max(0, int(exp - now))
    await redis.set(f"jwt:blacklist:{payload['sub']}", "1", ex=ttl)


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
    await _invalidate_cache()
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


async def list_employees(db: AsyncSession) -> list[EmployeeOut]:
    cached = await redis_client.get(CACHE_KEY)
    if cached:
        items = json.loads(cached)
        return [EmployeeOut.model_validate(item) for item in items]

    result = await db.execute(
        text("SELECT employee_id, name, role, phone FROM employee ORDER BY employee_id")
    )
    rows = result.fetchall()
    data = [EmployeeOut.model_validate(row._mapping).model_dump(mode="json") for row in rows]
    await redis_client.set(CACHE_KEY, json.dumps(data, ensure_ascii=False), ex=CACHE_TTL)
    return [EmployeeOut.model_validate(row._mapping) for row in rows]


async def delete_account(db: AsyncSession, account_id: int):
    result = await db.execute(
        text("DELETE FROM account WHERE account_id = :id"), {"id": account_id}
    )
    if result.rowcount == 0:
        raise NotFound(detail="账号不存在")
