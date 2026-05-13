"""收费模块集成测试"""
import pytest
from httpx import AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password


@pytest.fixture(scope="module")
async def admin_token(client: AsyncClient, db: AsyncSession):
    """模块级：创建管理员并登录，返回 token（幂等）"""
    existing = await db.execute(
        text("SELECT a.account_id FROM account a WHERE a.username = 'admin_bill'")
    )
    if existing.fetchone():
        resp = await client.post("/api/auth/login", json={"username": "admin_bill", "password": "admin123"})
        return resp.json()["access_token"]

    pwd = hash_password("admin123")
    r = await db.execute(
        text("INSERT INTO employee (name, role, phone) VALUES ('收费员', '管理员', '13900000011') RETURNING employee_id"),
    )
    emp_id = r.scalar_one()
    await db.execute(
        text("INSERT INTO account (employee_id, username, password_hash, is_active) VALUES (:eid, :u, :pwd, TRUE)"),
        {"eid": emp_id, "u": "admin_bill", "pwd": pwd},
    )
    await db.flush()
    resp = await client.post("/api/auth/login", json={"username": "admin_bill", "password": "admin123"})
    return resp.json()["access_token"]


@pytest.fixture(scope="module")
async def doctor_token(client: AsyncClient, db: AsyncSession):
    """模块级：创建医生并登录"""
    existing = await db.execute(
        text("SELECT a.account_id FROM account a WHERE a.username = 'doctor_bill'")
    )
    if existing.fetchone():
        resp = await client.post("/api/auth/login", json={"username": "doctor_bill", "password": "doctor123"})
        return resp.json()["access_token"]

    pwd = hash_password("doctor123")
    r = await db.execute(
        text("INSERT INTO employee (name, role, phone) VALUES ('收费医生', '医生', '13900000012') RETURNING employee_id"),
    )
    emp_id = r.scalar_one()
    await db.execute(
        text("INSERT INTO account (employee_id, username, password_hash, is_active) VALUES (:eid, :u, :pwd, TRUE)"),
        {"eid": emp_id, "u": "doctor_bill", "pwd": pwd},
    )
    await db.flush()
    resp = await client.post("/api/auth/login", json={"username": "doctor_bill", "password": "doctor123"})
    return resp.json()["access_token"]


@pytest.fixture(scope="module")
async def test_setup(db: AsyncSession, admin_token: str, doctor_token: str, client: AsyncClient):
    """创建测试所需的基础数据：客户、宠物、药品、批次、挂号→接诊→诊断→处方"""
    # 客户 + 宠物
    r = await db.execute(
        text("INSERT INTO customer (name, phone, address) VALUES ('收费客户', '13900000013', '测试地址') RETURNING customer_id"),
    )
    cust_id = r.scalar_one()
    r = await db.execute(
        text("INSERT INTO pet (customer_id, name, species, breed) VALUES (:cid, '收费宠物', '犬', '泰迪') RETURNING pet_id"),
        {"cid": cust_id},
    )
    pet_id = r.scalar_one()

    # 医生员工（用于挂号）
    r = await db.execute(
        text("SELECT e.employee_id FROM employee e JOIN account a ON e.employee_id = a.employee_id WHERE a.username = 'doctor_bill'")
    )
    doc_id = r.scalar_one()

    # 药品 + 批次
    r = await db.execute(
        text("INSERT INTO medicine (name, unit, unit_price, category) VALUES ('收费药品', '粒', 10.00, '西药') RETURNING medicine_id"),
    )
    med_id = r.scalar_one()
    r = await db.execute(
        text("INSERT INTO medicine_batch (medicine_id, in_date, expire_date, stock_qty, cost_price) VALUES (:mid, '2026-01-01', '2027-01-01', 100, 8.00) RETURNING batch_id"),
        {"mid": med_id},
    )
    batch_id = r.scalar_one()

    await db.flush()

    # 挂号
    resp = await client.post(
        "/api/consultation/visits",
        json={"pet_id": pet_id, "employee_id": doc_id, "complaint": "收费测试"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    visit_id = resp.json()["visit_id"]

    # 接诊
    await client.put(
        f"/api/consultation/visits/{visit_id}/accept",
        headers={"Authorization": f"Bearer {doctor_token}"},
    )

    # 诊断
    resp = await client.post(
        f"/api/consultation/visits/{visit_id}/diagnosis",
        json={"diagnosis_result": "收费测试诊断", "notes": "无"},
        headers={"Authorization": f"Bearer {doctor_token}"},
    )
    diag_id = resp.json()["diagnosis_id"]

    # 处方
    resp = await client.post(
        f"/api/consultation/diagnoses/{diag_id}/prescriptions",
        json={"items": [{"batch_id": batch_id, "quantity": 2, "dosage": "1粒/次，每日2次"}]},
        headers={"Authorization": f"Bearer {doctor_token}"},
    )
    items = resp.json()

    await db.flush()

    return {
        "customer_id": cust_id,
        "pet_id": pet_id,
        "doctor_id": doc_id,
        "medicine_id": med_id,
        "batch_id": batch_id,
        "visit_id": visit_id,
        "diagnosis_id": diag_id,
        "prescription_item_ids": [item["item_id"] for item in items],
    }


class TestBillItemCreate:
    """收费项生成"""

    async def test_create_diagnosis_fee(self, client: AsyncClient, admin_token: str, test_setup: dict):
        """为诊断生成诊疗费"""
        resp = await client.post(
            f"/api/billing/visits/{test_setup['visit_id']}/items",
            json={
                "item_type": "诊疗费",
                "source_type": "diagnosis",
                "source_id": test_setup["diagnosis_id"],
                "amount": 50.00,
                "description": "初诊诊查费",
            },
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["item_type"] == "诊疗费"
        assert data["source_type"] == "diagnosis"
        assert float(data["amount"]) == 50.00

    async def test_create_prescription_fee(self, client: AsyncClient, admin_token: str, test_setup: dict):
        """为处方生成药品费"""
        resp = await client.post(
            f"/api/billing/visits/{test_setup['visit_id']}/items",
            json={
                "item_type": "药品费",
                "source_type": "prescription",
                "source_id": test_setup["prescription_item_ids"][0],
                "amount": 20.00,
                "description": "收费药品 ×2",
            },
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["item_type"] == "药品费"

    async def test_idempotent(self, client: AsyncClient, admin_token: str, test_setup: dict):
        """重复 POST 同一 source → 不重复插入，返回已有记录"""
        # 使用一个未被其他测试使用的唯一 source_type/source_id 组合
        payload = {
            "item_type": "药品费",
            "source_type": "prescription",
            "source_id": test_setup["prescription_item_ids"][0],
            "amount": 20.00,
            "description": "收费药品 ×2",
        }
        resp1 = await client.post(
            f"/api/billing/visits/{test_setup['visit_id']}/items",
            json=payload,
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        resp2 = await client.post(
            f"/api/billing/visits/{test_setup['visit_id']}/items",
            json=payload,
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        # 同一次测试内两次 POST 应返回相同 bill_item_id
        assert resp1.json()["bill_item_id"] == resp2.json()["bill_item_id"]
        assert resp2.json()["source_type"] == "prescription"
        # 至少有一个是幂等命中（is_duplicate = true）
        assert resp1.json()["is_duplicate"] or resp2.json()["is_duplicate"]


class TestBillSettle:
    """结账"""

    async def test_settle_success(self, client: AsyncClient, admin_token: str, test_setup: dict):
        """未结清账单 → 结账成功"""
        # 先获取 bill
        resp = await client.get(
            "/api/billing/bills",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        bills = resp.json()
        bill = next((b for b in bills if b["visit_id"] == test_setup["visit_id"]), None)
        assert bill is not None
        assert bill["status"] == "未结清"

        resp = await client.post(
            f"/api/billing/bills/{bill['bill_id']}/settle",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "已结清"

    async def test_settle_already_settled(self, client: AsyncClient, admin_token: str, test_setup: dict):
        """已结清账单再次结账 → 409"""
        resp = await client.get(
            "/api/billing/bills",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        bill = next((b for b in resp.json() if b["visit_id"] == test_setup["visit_id"]), None)
        assert bill["status"] == "已结清"

        resp = await client.post(
            f"/api/billing/bills/{bill['bill_id']}/settle",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert resp.status_code == 409


class TestBillList:
    """账单列表与详情"""

    async def test_list_bills(self, client: AsyncClient, admin_token: str):
        """账单列表返回正确"""
        resp = await client.get(
            "/api/billing/bills",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    async def test_bill_detail_with_total(self, client: AsyncClient, admin_token: str, test_setup: dict):
        """账单详情含 total_amount（来自 v_bill_total 视图）"""
        resp = await client.get(
            "/api/billing/bills",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        bill = next((b for b in resp.json() if b["visit_id"] == test_setup["visit_id"]), None)
        assert bill is not None

        resp = await client.get(
            f"/api/billing/bills/{bill['bill_id']}",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "total_amount" in data
        assert "items" in data
        # total_amount 应等于各 item 金额之和
        assert float(data["total_amount"]) == sum(float(item["amount"]) for item in data["items"])
