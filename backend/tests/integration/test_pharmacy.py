"""药品库存模块集成测试"""
import asyncio
from datetime import date, timedelta

import pytest
from httpx import AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password


@pytest.fixture(scope="module")
async def admin_token(client: AsyncClient, db: AsyncSession):
    """模块级：创建管理员并登录，返回 token（幂等：已存在则跳过创建）"""
    # 先检查是否已存在
    existing = await db.execute(
        text("SELECT a.account_id FROM account a WHERE a.username = 'admin_pharm'")
    )
    if existing.fetchone():
        resp = await client.post("/api/auth/login", json={"username": "admin_pharm", "password": "admin123"})
        return resp.json()["access_token"]

    pwd = hash_password("admin123")
    r = await db.execute(
        text("INSERT INTO employee (name, role, phone) VALUES ('药师', '管理员', '13900000001') RETURNING employee_id"),
    )
    emp_id = r.scalar_one()
    await db.execute(
        text("INSERT INTO account (employee_id, username, password_hash, is_active) VALUES (:eid, :u, :pwd, TRUE)"),
        {"eid": emp_id, "u": "admin_pharm", "pwd": pwd},
    )
    await db.flush()
    resp = await client.post("/api/auth/login", json={"username": "admin_pharm", "password": "admin123"})
    return resp.json()["access_token"]


class TestMedicineAPI:
    """药品档案 API"""

    async def test_list_empty(self, client: AsyncClient, admin_token: str):
        """空列表"""
        resp = await client.get(
            "/api/pharmacy/medicines",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert resp.status_code == 200
        assert resp.json() == []

    async def test_create_and_list(self, client: AsyncClient, admin_token: str):
        """新增药品后列表可查"""
        resp = await client.post(
            "/api/pharmacy/medicines",
            json={"name": "阿莫西林", "unit": "片", "unit_price": 1.5, "category": "抗生素"},
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert resp.status_code == 201
        assert resp.json()["name"] == "阿莫西林"

        resp = await client.get(
            "/api/pharmacy/medicines",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert len(resp.json()) == 1


class TestBatchAPI:
    """批次入库 API"""

    async def test_create_batch(self, client: AsyncClient, admin_token: str):
        """正常入库"""
        resp = await client.post(
            "/api/pharmacy/medicines",
            json={"name": "头孢拉定", "unit": "支", "unit_price": 8.0, "category": "抗生素"},
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        med_id = resp.json()["medicine_id"]

        today = date.today()
        resp = await client.post(
            "/api/pharmacy/batches",
            json={
                "medicine_id": med_id,
                "in_date": str(today),
                "expire_date": str(today + timedelta(days=365)),
                "stock_qty": 100,
                "cost_price": 5.0,
            },
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert resp.status_code == 201
        assert resp.json()["stock_qty"] == 100

    async def test_create_batch_invalid_date(self, client: AsyncClient, admin_token: str):
        """expire_date <= in_date 应被拒绝"""
        resp = await client.post(
            "/api/pharmacy/medicines",
            json={"name": "葡萄糖", "unit": "ml", "unit_price": 0.5, "category": "输液"},
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        med_id = resp.json()["medicine_id"]

        today = date.today()
        resp = await client.post(
            "/api/pharmacy/batches",
            json={
                "medicine_id": med_id,
                "in_date": str(today),
                "expire_date": str(today),  # 等于入库日期，无效
                "stock_qty": 50,
                "cost_price": 0.3,
            },
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert resp.status_code == 400

    async def test_list_batches_stock_filter(self, client: AsyncClient, admin_token: str):
        """库存预警筛选 stock_qty < N"""
        resp = await client.post(
            "/api/pharmacy/medicines",
            json={"name": "维生素C", "unit": "片", "unit_price": 0.2, "category": "维生素"},
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        med_id = resp.json()["medicine_id"]

        today = date.today()
        # 低库存批次
        await client.post(
            "/api/pharmacy/batches",
            json={
                "medicine_id": med_id,
                "in_date": str(today),
                "expire_date": str(today + timedelta(days=180)),
                "stock_qty": 5,
                "cost_price": 0.1,
            },
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        # 正常库存批次
        await client.post(
            "/api/pharmacy/batches",
            json={
                "medicine_id": med_id,
                "in_date": str(today),
                "expire_date": str(today + timedelta(days=365)),
                "stock_qty": 200,
                "cost_price": 0.15,
            },
            headers={"Authorization": f"Bearer {admin_token}"},
        )

        resp = await client.get(
            "/api/pharmacy/batches",
            params={"stock_qty_lt": 10},
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["stock_qty"] == 5


class TestStockDeduction:
    """库存扣减（service 层直接调用）"""

    async def test_deduct_success(self, client: AsyncClient, admin_token: str, db: AsyncSession):
        """正常扣减 → 库存减少"""
        from app.modules.pharmacy import service

        resp = await client.post(
            "/api/pharmacy/medicines",
            json={"name": "布洛芬", "unit": "片", "unit_price": 2.0, "category": "消炎"},
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        med_id = resp.json()["medicine_id"]

        today = date.today()
        resp = await client.post(
            "/api/pharmacy/batches",
            json={
                "medicine_id": med_id,
                "in_date": str(today),
                "expire_date": str(today + timedelta(days=365)),
                "stock_qty": 100,
                "cost_price": 1.0,
            },
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        batch_id = resp.json()["batch_id"]

        result = await service.deduct_stock(db, med_id, 30)
        assert result["medicine_id"] == med_id
        assert result["deducted"] == 30

        # 验证库存实际减少
        r = await db.execute(
            text("SELECT stock_qty FROM medicine_batch WHERE batch_id = :bid"),
            {"bid": batch_id},
        )
        assert r.scalar_one() == 70

    async def test_deduct_insufficient(self, client: AsyncClient, admin_token: str, db: AsyncSession):
        """库存不足 → 409，错误信息包含药品名"""
        from app.core.exceptions import Conflict
        from app.modules.pharmacy import service

        resp = await client.post(
            "/api/pharmacy/medicines",
            json={"name": "对乙酰氨基酚", "unit": "片", "unit_price": 1.0, "category": "解热镇痛"},
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        med_id = resp.json()["medicine_id"]

        today = date.today()
        await client.post(
            "/api/pharmacy/batches",
            json={
                "medicine_id": med_id,
                "in_date": str(today),
                "expire_date": str(today + timedelta(days=365)),
                "stock_qty": 10,
                "cost_price": 0.5,
            },
            headers={"Authorization": f"Bearer {admin_token}"},
        )

        with pytest.raises(Conflict) as exc:
            await service.deduct_stock(db, med_id, 100)
        assert "对乙酰氨基酚" in exc.value.detail

    async def test_deduct_concurrent(self, client: AsyncClient, admin_token: str, db: AsyncSession):
        """10 协程并发扣减，恰好扣完库存，不超卖"""
        from app.core.exceptions import Conflict
        from app.modules.pharmacy import service
        from app.shared.pg_db import async_session

        # 用独立 session 准备数据并提交，避免污染模块级未提交事务
        today = date.today()
        async with async_session() as s:
            r = await s.execute(
                text("INSERT INTO medicine (name, unit, unit_price, category) "
                     "VALUES ('阿司匹林', '片', 3.0, '解热镇痛') RETURNING medicine_id"),
            )
            med_id = r.scalar_one()
            await s.execute(
                text("INSERT INTO medicine_batch (medicine_id, in_date, expire_date, stock_qty, cost_price) "
                     "VALUES (:mid, :ind, :expd, 100, 2.0)"),
                {"mid": med_id, "ind": today, "expd": today + timedelta(days=365)},
            )
            await s.commit()

        # 10 协程各扣 10，共 100 = 库存 100，全部成功
        async def deduct_one():
            async with async_session() as session:
                try:
                    await service.deduct_stock(session, med_id, 10)
                    return 10
                except Conflict:
                    return 0

        tasks = [deduct_one() for _ in range(10)]
        results = await asyncio.gather(*tasks)
        assert sum(results) == 100  # 不超卖

        # 清理：用独立 session 删除测试数据
        async with async_session() as s:
            await s.execute(text("DELETE FROM medicine_batch WHERE medicine_id = :mid"), {"mid": med_id})
            await s.execute(text("DELETE FROM medicine WHERE medicine_id = :mid"), {"mid": med_id})
            await s.commit()
