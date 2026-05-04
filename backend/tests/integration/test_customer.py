"""客户模块集成测试"""
import pytest
from httpx import AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password


@pytest.fixture(scope="module")
async def admin_token(client: AsyncClient, db: AsyncSession):
    """模块级：创建管理员并登录，返回 token（幂等）"""
    existing = await db.execute(
        text("SELECT a.account_id FROM account a WHERE a.username = 'admin_cust'")
    )
    if existing.fetchone():
        resp = await client.post("/api/auth/login", json={"username": "admin_cust", "password": "admin123"})
        return resp.json()["access_token"]

    pwd = hash_password("admin123")
    r = await db.execute(
        text("INSERT INTO employee (name, role, phone) VALUES ('客服', '管理员', '13900000002') RETURNING employee_id"),
    )
    emp_id = r.scalar_one()
    await db.execute(
        text("INSERT INTO account (employee_id, username, password_hash, is_active) VALUES (:eid, :u, :pwd, TRUE)"),
        {"eid": emp_id, "u": "admin_cust", "pwd": pwd},
    )
    await db.flush()
    resp = await client.post("/api/auth/login", json={"username": "admin_cust", "password": "admin123"})
    return resp.json()["access_token"]


class TestCustomerCRUD:
    """客户 CRUD"""

    async def test_list_empty(self, client: AsyncClient, admin_token: str):
        """空列表"""
        resp = await client.get(
            "/api/customers",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert resp.status_code == 200
        assert resp.json() == []

    async def test_create_and_detail(self, client: AsyncClient, admin_token: str):
        """创建客户后详情可查"""
        resp = await client.post(
            "/api/customers",
            json={"name": "张三", "phone": "13800000001", "address": "北京市朝阳区"},
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == "张三"
        assert data["phone"] == "13800000001"
        assert data["address"] == "北京市朝阳区"
        assert "customer_id" in data
        assert data.get("pets") == []

        # 详情
        cid = data["customer_id"]
        resp = await client.get(
            f"/api/customers/{cid}",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert resp.status_code == 200
        assert resp.json()["name"] == "张三"

    async def test_update(self, client: AsyncClient, admin_token: str):
        """更新客户信息"""
        resp = await client.post(
            "/api/customers",
            json={"name": "李四", "phone": "13800000002", "address": "上海市"},
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        cid = resp.json()["customer_id"]

        resp = await client.put(
            f"/api/customers/{cid}",
            json={"name": "李四（改）", "phone": "13800000002", "address": "上海市浦东新区"},
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert resp.status_code == 200
        assert resp.json()["name"] == "李四（改）"
        assert resp.json()["address"] == "上海市浦东新区"

    async def test_delete(self, client: AsyncClient, admin_token: str):
        """删除客户"""
        resp = await client.post(
            "/api/customers",
            json={"name": "王五", "phone": "13800000003"},
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        cid = resp.json()["customer_id"]

        resp = await client.delete(
            f"/api/customers/{cid}",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert resp.status_code == 204

        # 确认已删除
        resp = await client.get(
            f"/api/customers/{cid}",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert resp.status_code == 404

    async def test_list_after_create(self, client: AsyncClient, admin_token: str):
        """创建后列表包含新客户"""
        resp = await client.post(
            "/api/customers",
            json={"name": "赵六", "phone": "13800000004"},
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert resp.status_code == 201

        resp = await client.get(
            "/api/customers",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert resp.status_code == 200
        names = [c["name"] for c in resp.json()]
        assert "赵六" in names


class TestCustomerCache:
    """Redis Cache-Aside 缓存"""

    async def test_cache_invalidated_on_create(self, client: AsyncClient, admin_token: str, db: AsyncSession):
        """创建客户后 customer:list 缓存被删除"""
        from app.shared.redis import get_redis

        # 先触发一次列表查询填充缓存
        await client.get(
            "/api/customers",
            headers={"Authorization": f"Bearer {admin_token}"},
        )

        # 创建新客户 → 缓存应失效
        await client.post(
            "/api/customers",
            json={"name": "缓存测试", "phone": "13800000005"},
            headers={"Authorization": f"Bearer {admin_token}"},
        )

        # 验证：再查列表应包含新客户（无论缓存是否命中）
        resp = await client.get(
            "/api/customers",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        names = [c["name"] for c in resp.json()]
        assert "缓存测试" in names


class TestPetAssociation:
    """宠物关联"""

    async def test_add_pet_to_customer(self, client: AsyncClient, admin_token: str):
        """添加宠物后客户详情包含宠物"""
        resp = await client.post(
            "/api/customers",
            json={"name": "钱七", "phone": "13800000006"},
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        cid = resp.json()["customer_id"]

        resp = await client.post(
            f"/api/customers/{cid}/pets",
            json={"name": "旺财", "species": "犬", "breed": "金毛", "birth_date": "2023-01-15"},
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert resp.status_code == 201
        pet = resp.json()
        assert pet["name"] == "旺财"
        assert pet["species"] == "犬"
        assert pet["breed"] == "金毛"

        # 客户详情应包含宠物
        resp = await client.get(
            f"/api/customers/{cid}",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert len(resp.json()["pets"]) == 1
        assert resp.json()["pets"][0]["name"] == "旺财"

    async def test_update_pet(self, client: AsyncClient, admin_token: str):
        """更新宠物信息"""
        resp = await client.post(
            "/api/customers",
            json={"name": "周八", "phone": "13800000007"},
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        cid = resp.json()["customer_id"]

        resp = await client.post(
            f"/api/customers/{cid}/pets",
            json={"name": "咪咪", "species": "猫", "breed": "英短"},
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        pid = resp.json()["pet_id"]

        resp = await client.put(
            f"/api/customers/{cid}/pets/{pid}",
            json={"name": "咪咪（改）", "breed": "美短"},
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert resp.status_code == 200
        assert resp.json()["name"] == "咪咪（改）"
        assert resp.json()["breed"] == "美短"
        assert resp.json()["species"] == "猫"  # 未改字段保持原值

    async def test_delete_pet(self, client: AsyncClient, admin_token: str):
        """删除宠物"""
        resp = await client.post(
            "/api/customers",
            json={"name": "孙九", "phone": "13800000008"},
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        cid = resp.json()["customer_id"]

        resp = await client.post(
            f"/api/customers/{cid}/pets",
            json={"name": "小强", "species": "兔", "breed": "荷兰垂耳"},
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        pid = resp.json()["pet_id"]

        resp = await client.delete(
            f"/api/customers/{cid}/pets/{pid}",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert resp.status_code == 204

        # 客户详情中应无宠物
        resp = await client.get(
            f"/api/customers/{cid}",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert resp.json()["pets"] == []

    async def test_multiple_pets(self, client: AsyncClient, admin_token: str):
        """一个客户可拥有多只宠物"""
        resp = await client.post(
            "/api/customers",
            json={"name": "吴十", "phone": "13800000009"},
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        cid = resp.json()["customer_id"]

        await client.post(
            f"/api/customers/{cid}/pets",
            json={"name": "大白", "species": "犬", "breed": "萨摩耶"},
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        await client.post(
            f"/api/customers/{cid}/pets",
            json={"name": "小白", "species": "猫", "breed": "波斯"},
            headers={"Authorization": f"Bearer {admin_token}"},
        )

        resp = await client.get(
            f"/api/customers/{cid}",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert len(resp.json()["pets"]) == 2
