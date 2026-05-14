"""寄养模块集成测试"""
import pytest
from httpx import AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password


@pytest.fixture(scope="module")
async def admin_token(client: AsyncClient, db: AsyncSession):
    existing = await db.execute(
        text("SELECT a.account_id FROM account a WHERE a.username = 'admin_board'")
    )
    if existing.fetchone():
        resp = await client.post("/api/auth/login", json={"username": "admin_board", "password": "admin123"})
        return resp.json()["access_token"]

    pwd = hash_password("admin123")
    r = await db.execute(
        text("INSERT INTO employee (name, role, phone) VALUES ('寄养员', '管理员', '13900000031') RETURNING employee_id"),
    )
    emp_id = r.scalar_one()
    await db.execute(
        text("INSERT INTO account (employee_id, username, password_hash, is_active) VALUES (:eid, :u, :pwd, TRUE)"),
        {"eid": emp_id, "u": "admin_board", "pwd": pwd},
    )
    await db.flush()
    resp = await client.post("/api/auth/login", json={"username": "admin_board", "password": "admin123"})
    return resp.json()["access_token"]


@pytest.fixture(scope="module")
async def test_setup(db: AsyncSession, admin_token: str, client: AsyncClient):
    # 客户 + 宠物
    r = await db.execute(
        text("INSERT INTO customer (name, phone) VALUES ('寄养客户', '13900000032') RETURNING customer_id"),
    )
    cust_id = r.scalar_one()
    r = await db.execute(
        text("INSERT INTO pet (customer_id, name, species, breed) VALUES (:cid, '寄养宠物', '猫', '英短') RETURNING pet_id"),
        {"cid": cust_id},
    )
    pet_id = r.scalar_one()

    # 寄养笼位
    r = await db.execute(
        text("INSERT INTO ward (ward_no, type, status, daily_rate) VALUES ('B01', '寄养笼', '空闲', 50.00) RETURNING ward_id"),
    )
    ward_id = r.scalar_one()

    await db.flush()

    return {"customer_id": cust_id, "pet_id": pet_id, "ward_id": ward_id}


class TestBoardingFlow:
    """寄养完整流程"""

    async def test_register_boarding(self, client: AsyncClient, admin_token: str, test_setup: dict):
        """登记寄养"""
        resp = await client.post(
            "/api/boarding",
            json={
                "pet_id": test_setup["pet_id"],
                "ward_id": test_setup["ward_id"],
                "start_date": "2026-05-10",
            },
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["pet_id"] == test_setup["pet_id"]
        assert data["ward_id"] == test_setup["ward_id"]
        assert data["start_date"] == "2026-05-10"
        assert data["end_date"] is None
        assert "boarding_id" in data

    async def test_list_boardings(self, client: AsyncClient, admin_token: str):
        """寄养列表"""
        resp = await client.get(
            "/api/boarding",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert resp.status_code == 200
        boardings = resp.json()
        assert len(boardings) >= 1

    async def test_boarding_detail_with_fee(self, client: AsyncClient, admin_token: str, test_setup: dict):
        """寄养详情含动态计算费用"""
        resp = await client.get(
            "/api/boarding",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        bid = resp.json()[0]["boarding_id"]

        resp = await client.get(
            f"/api/boarding/{bid}",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "current_fee" in data
        # 费用 = 50/day × 天数，至少 1 天
        assert float(data["current_fee"]) >= 50.0

    async def test_end_boarding(self, client: AsyncClient, admin_token: str, test_setup: dict):
        """结束寄养 → 设置 end_date"""
        resp = await client.get(
            "/api/boarding",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        bid = resp.json()[0]["boarding_id"]

        resp = await client.put(
            f"/api/boarding/{bid}/end",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["end_date"] is not None

    async def test_end_already_ended(self, client: AsyncClient, admin_token: str, test_setup: dict):
        """已结束寄养再次结束 → 409"""
        resp = await client.get(
            "/api/boarding",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        bid = resp.json()[0]["boarding_id"]

        resp = await client.put(
            f"/api/boarding/{bid}/end",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert resp.status_code == 409
