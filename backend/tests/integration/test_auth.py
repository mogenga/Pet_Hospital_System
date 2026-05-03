"""认证模块集成测试"""
import bcrypt
import pytest
import redis.asyncio as aioredis
from httpx import AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings


async def _setup_doctor(db: AsyncSession, username: str, phone: str, is_active: bool = True):
    """创建测试医生+账号，密码 test123456"""
    pwd = bcrypt.hashpw("test123456".encode(), bcrypt.gensalt()).decode()
    r = await db.execute(
        text("INSERT INTO employee (name, role, phone) VALUES ('测试医生', '医生', :ph) RETURNING employee_id"),
        {"ph": phone},
    )
    emp_id = r.scalar_one()
    await db.execute(
        text("INSERT INTO account (employee_id, username, password_hash, is_active) VALUES (:eid, :u, :pwd, :active)"),
        {"eid": emp_id, "u": username, "pwd": pwd, "active": is_active},
    )
    await db.flush()


class TestLogin:
    async def test_login_success(self, client: AsyncClient, db: AsyncSession):
        await _setup_doctor(db, "doctor1", "13800000001")

        resp = await client.post("/api/auth/login", json={
            "username": "doctor1", "password": "test123456",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "access_token" in data
        assert data["user"]["username"] == "doctor1"

    async def test_login_wrong_password(self, client: AsyncClient, db: AsyncSession):
        await _setup_doctor(db, "doctor2", "13800000002")

        resp = await client.post("/api/auth/login", json={
            "username": "doctor2", "password": "wrongpassword",
        })
        assert resp.status_code == 401

    async def test_login_disabled_account(self, client: AsyncClient, db: AsyncSession):
        await _setup_doctor(db, "doctor3", "13800000003", is_active=False)

        resp = await client.post("/api/auth/login", json={
            "username": "doctor3", "password": "test123456",
        })
        assert resp.status_code == 401


class TestRateLimit:
    async def test_login_rate_limit(self, client: AsyncClient, db: AsyncSession):
        await _setup_doctor(db, "doctor4", "13800000004")

        # httpx 通过 ASGITransport 发请求时 request.client 为 None，
        # login 接口取 IP 时 fallback 到 "127.0.0.1"，所以限流 key 固定为此 IP
        r = await aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        await r.delete("ratelimit:login:127.0.0.1")
        await r.aclose()

        # 前 5 次错误 → 401
        for _ in range(5):
            resp = await client.post("/api/auth/login", json={
                "username": "doctor4", "password": "wrongpassword",
            })
            assert resp.status_code == 401

        # 第 6 次触发限流 → 401 + 限流提示
        resp = await client.post("/api/auth/login", json={
            "username": "doctor4", "password": "wrongpassword",
        })
        assert resp.status_code == 401
        assert "频繁" in resp.json()["detail"]

        # 清理 Redis 限流计数，避免影响后续测试
        r = await aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        await r.delete("ratelimit:login:127.0.0.1")
        await r.aclose()
