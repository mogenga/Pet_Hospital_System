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

    # 支持用户名或手机号登录：同时匹配 account.username 和 employee.phone
    result = await db.execute(
        text(
            "SELECT a.account_id, a.username, a.password_hash, a.is_active, "
            "e.name, e.role, e.employee_id "
            "FROM account a JOIN employee e ON a.employee_id = e.employee_id "
            "WHERE a.username = :credential OR e.phone = :credential"
        ),
        {"credential": username},
    )
    row = result.fetchone()
    if row is None:
        await record_login_failure(redis, ip)
        raise Unauthorized(detail="用户名/手机号或密码错误")

    if not row.is_active:
        await record_login_failure(redis, ip)
        raise Unauthorized(detail="账号已被禁用")

    if not verify_password(password, row.password_hash):
        await record_login_failure(redis, ip)
        raise Unauthorized(detail="用户名/手机号或密码错误")

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
    """新增账号，同时创建员工记录"""
    # 检查手机号唯一（employee.phone）
    existing_phone = await db.execute(
        text("SELECT 1 FROM employee WHERE phone = :phone"),
        {"phone": data.phone},
    )
    if existing_phone.fetchone():
        raise Conflict(detail="该手机号已被其他员工使用")

    # 密码默认使用电话后6位
    password = data.password if data.password else data.phone[-6:]
    if len(password) < 6:
        raise Conflict(detail="密码长度不足，手机号至少需要6位")

    # 用户名使用手机号
    username = data.phone

    # 检查用户名唯一
    existing_username = await db.execute(
        text("SELECT 1 FROM account WHERE username = :username"),
        {"username": username},
    )
    if existing_username.fetchone():
        raise Conflict(detail="该手机号已注册账号")

    password_hash = hash_password(password)

    # 在事务中创建员工和账号
    async with db.begin_nested():
        # 创建员工
        emp_result = await db.execute(
            text(
                "INSERT INTO employee (name, role, phone) "
                "VALUES (:name, :role, :phone) RETURNING employee_id, name, role, phone"
            ),
            {"name": data.name, "role": data.role, "phone": data.phone},
        )
        emp_row = emp_result.fetchone()

        # 创建账号
        acct_result = await db.execute(
            text(
                "INSERT INTO account (employee_id, username, password_hash) "
                "VALUES (:eid, :username, :ph) RETURNING account_id, employee_id, username, is_active, last_login, created_at"
            ),
            {"eid": emp_row.employee_id, "username": username, "ph": password_hash},
        )
        acct_row = acct_result.fetchone()

    await _invalidate_cache()
    return AccountOut(
        account_id=acct_row.account_id,
        employee_id=acct_row.employee_id,
        username=acct_row.username,
        is_active=acct_row.is_active,
        last_login=acct_row.last_login,
        created_at=acct_row.created_at,
        employee_name=emp_row.name,
        employee_role=emp_row.role,
        employee_phone=emp_row.phone,
    )


async def list_accounts(db: AsyncSession) -> list[AccountOut]:
    result = await db.execute(
        text(
            "SELECT a.account_id, a.employee_id, a.username, a.is_active, a.last_login, a.created_at, "
            "e.name AS employee_name, e.role AS employee_role, e.phone AS employee_phone "
            "FROM account a JOIN employee e ON a.employee_id = e.employee_id "
            "ORDER BY a.account_id"
        )
    )
    return [
        AccountOut(
            account_id=row.account_id,
            employee_id=row.employee_id,
            username=row.username,
            is_active=row.is_active,
            last_login=row.last_login,
            created_at=row.created_at,
            employee_name=row.employee_name,
            employee_role=row.employee_role,
            employee_phone=row.employee_phone,
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

    # 查询关联的员工信息
    emp = await db.execute(
        text("SELECT name, role, phone FROM employee WHERE employee_id = :eid"),
        {"eid": row.employee_id},
    )
    emp_row = emp.fetchone()

    return AccountOut(
        account_id=row.account_id,
        employee_id=row.employee_id,
        username=row.username,
        is_active=row.is_active,
        last_login=row.last_login,
        created_at=row.created_at,
        employee_name=emp_row.name if emp_row else "",
        employee_role=emp_row.role if emp_row else "",
        employee_phone=emp_row.phone if emp_row else "",
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
