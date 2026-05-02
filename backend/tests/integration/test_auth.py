"""
认证模块集成测试

TDD: 这些测试先于实现编写，当前应全部 FAIL。
"""
import bcrypt
import pytest
from httpx import AsyncClient
from sqlalchemy import text


class TestLogin:
    """登录相关测试"""

    async def test_login_success(self, client: AsyncClient, test_employee_and_account):
        """有效用户名/密码 → 返回 token"""
        resp = await client.post("/api/auth/login", json={
            "username": "testdoctor",
            "password": "test123456",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        assert data["user"]["username"] == "testdoctor"
        assert data["user"]["role"] == "医生"

    async def test_login_wrong_password(self, client: AsyncClient, test_employee_and_account):
        """错误密码 → 401"""
        resp = await client.post("/api/auth/login", json={
            "username": "testdoctor",
            "password": "wrongpassword",
        })
        assert resp.status_code == 401
        assert "detail" in resp.json()

    async def test_login_disabled_account(self, client: AsyncClient, db):
        """禁用账号 → 401"""
        password_hash = bcrypt.hashpw("test123456".encode(), bcrypt.gensalt()).decode()
        # 创建独立的员工
        result = await db.execute(
            text("INSERT INTO employee (name, role, phone) VALUES ('禁用医生', '医生', '13800000003') RETURNING employee_id")
        )
        emp_id = result.scalar_one()
        await db.execute(
            text("INSERT INTO account (employee_id, username, password_hash, is_active) VALUES (:eid, 'disabled_user', :ph, FALSE)"),
            {"eid": emp_id, "ph": password_hash},
        )
        await db.flush()

        resp = await client.post("/api/auth/login", json={
            "username": "disabled_user",
            "password": "test123456",
        })
        assert resp.status_code == 401


class TestRoleGuard:
    """角色守卫测试"""

    async def test_nurse_cannot_access_doctor_endpoint(self, client: AsyncClient, db):
        """护士访问医生专属接口 → 403"""
        password_hash = bcrypt.hashpw("test123456".encode(), bcrypt.gensalt()).decode()

        result = await db.execute(
            text("INSERT INTO employee (name, role, phone) VALUES ('测试护士', '护士', '13800000002') RETURNING employee_id")
        )
        nurse_emp_id = result.scalar_one()
        await db.execute(
            text("INSERT INTO account (employee_id, username, password_hash, is_active) VALUES (:eid, 'testnurse', :ph, TRUE)"),
            {"eid": nurse_emp_id, "ph": password_hash},
        )
        await db.flush()

        # 用护士账号登录
        resp = await client.post("/api/auth/login", json={
            "username": "testnurse",
            "password": "test123456",
        })
        assert resp.status_code == 200
        token = resp.json()["access_token"]

        # 尝试访问医生专属接口（接诊接口需要医生角色）
        resp = await client.get(
            "/api/consultation/visits?status=接诊中",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 403


class TestRateLimit:
    """登录限流测试"""

    async def test_login_rate_limit(self, client: AsyncClient, test_employee_and_account):
        """连续 6 次错误登录 → 429"""
        for _ in range(5):
            resp = await client.post("/api/auth/login", json={
                "username": "testdoctor",
                "password": "wrongpassword",
            })
            assert resp.status_code == 401

        # 第 6 次应触发限流（第 6 次即达到限制）
        resp = await client.post("/api/auth/login", json={
            "username": "testdoctor",
            "password": "wrongpassword",
        })
        assert resp.status_code == 429
