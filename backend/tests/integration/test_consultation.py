"""就诊模块集成测试 — 挂号→接诊→诊断→处方 完整链路"""
import pytest
from httpx import AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password


# ═══════════════════════════════════════════
# 模块级 Fixtures
# ═══════════════════════════════════════════

@pytest.fixture(scope="module")
async def admin_token(client: AsyncClient, db: AsyncSession):
    """创建管理员并登录"""
    existing = await db.execute(
        text("SELECT a.account_id FROM account a WHERE a.username = 'admin_consult'")
    )
    if existing.fetchone():
        resp = await client.post("/api/auth/login", json={"username": "admin_consult", "password": "admin123"})
        return resp.json()["access_token"]

    pwd = hash_password("admin123")
    r = await db.execute(
        text("INSERT INTO employee (name, role, phone) VALUES ('诊管', '管理员', '13900000010') RETURNING employee_id"),
    )
    emp_id = r.scalar_one()
    await db.execute(
        text("INSERT INTO account (employee_id, username, password_hash, is_active) VALUES (:eid, :u, :pwd, TRUE)"),
        {"eid": emp_id, "u": "admin_consult", "pwd": pwd},
    )
    await db.flush()
    resp = await client.post("/api/auth/login", json={"username": "admin_consult", "password": "admin123"})
    return resp.json()["access_token"]


@pytest.fixture(scope="module")
async def doctor_token(client: AsyncClient, db: AsyncSession):
    """创建医生并登录"""
    existing = await db.execute(
        text("SELECT a.account_id FROM account a WHERE a.username = 'doctor_consult'")
    )
    if existing.fetchone():
        resp = await client.post("/api/auth/login", json={"username": "doctor_consult", "password": "doctor123"})
        return resp.json()["access_token"]

    pwd = hash_password("doctor123")
    r = await db.execute(
        text("INSERT INTO employee (name, role, phone) VALUES ('诊医', '医生', '13900000011') RETURNING employee_id"),
    )
    emp_id = r.scalar_one()
    await db.execute(
        text("INSERT INTO account (employee_id, username, password_hash, is_active) VALUES (:eid, :u, :pwd, TRUE)"),
        {"eid": emp_id, "u": "doctor_consult", "pwd": pwd},
    )
    await db.flush()
    resp = await client.post("/api/auth/login", json={"username": "doctor_consult", "password": "doctor123"})
    return resp.json()["access_token"]


@pytest.fixture(scope="module")
async def test_setup(db: AsyncSession, admin_token: str, doctor_token: str, client: AsyncClient):
    """创建测试客户+宠物+药品+批次"""
    # 创建客户
    r = await db.execute(
        text("INSERT INTO customer (name, phone) VALUES ('就诊客户', '13900000012') RETURNING customer_id"),
    )
    customer_id = r.scalar_one()

    # 创建宠物
    r = await db.execute(
        text("INSERT INTO pet (customer_id, name, species, breed) VALUES (:cid, '小黄', '犬', '金毛') RETURNING pet_id"),
        {"cid": customer_id},
    )
    pet_id = r.scalar_one()

    # 创建药品
    r = await db.execute(
        text("INSERT INTO medicine (name, unit, unit_price, category) VALUES ('阿莫西林', '片', 2.50, '抗生素') RETURNING medicine_id"),
    )
    medicine_id = r.scalar_one()

    # 创建批次（库存 100）
    r = await db.execute(
        text("INSERT INTO medicine_batch (medicine_id, in_date, expire_date, stock_qty, cost_price) VALUES (:mid, '2026-01-01', '2027-12-31', 100, 1.50) RETURNING batch_id"),
        {"mid": medicine_id},
    )
    batch_id = r.scalar_one()

    await db.flush()

    # 获取管理员 employee_id
    r = await db.execute(
        text("SELECT e.employee_id FROM employee e JOIN account a ON e.employee_id = a.employee_id WHERE a.username = 'admin_consult'"),
    )
    admin_emp_id = r.scalar_one()

    # 获取医生 employee_id
    r = await db.execute(
        text("SELECT e.employee_id FROM employee e JOIN account a ON e.employee_id = a.employee_id WHERE a.username = 'doctor_consult'"),
    )
    doctor_emp_id = r.scalar_one()

    return {
        "customer_id": customer_id,
        "pet_id": pet_id,
        "medicine_id": medicine_id,
        "batch_id": batch_id,
        "admin_emp_id": admin_emp_id,
        "doctor_emp_id": doctor_emp_id,
    }


# ═══════════════════════════════════════════
# TestConsultationFlow — 完整就诊链路
# ═══════════════════════════════════════════

class TestConsultationFlow:
    """挂号→接诊→诊断→处方 完整链路"""

    async def test_create_visit(self, client: AsyncClient, admin_token: str, test_setup: dict):
        """挂号：创建就诊记录，状态为待接诊"""
        resp = await client.post(
            "/api/consultation/visits",
            json={
                "pet_id": test_setup["pet_id"],
                "employee_id": test_setup["admin_emp_id"],
                "complaint": "咳嗽三天，食欲不振",
            },
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["pet_id"] == test_setup["pet_id"]
        assert data["status"] == "待接诊"
        assert data["complaint"] == "咳嗽三天，食欲不振"
        assert "visit_id" in data
        # 保存 visit_id 供后续测试使用
        test_setup["visit_id"] = data["visit_id"]

    async def test_accept_visit(self, client: AsyncClient, doctor_token: str, test_setup: dict):
        """接诊：医生接诊，状态变为接诊中"""
        vid = test_setup["visit_id"]
        resp = await client.put(
            f"/api/consultation/visits/{vid}/accept",
            headers={"Authorization": f"Bearer {doctor_token}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "接诊中"

    async def test_create_diagnosis(self, client: AsyncClient, doctor_token: str, test_setup: dict):
        """诊断：创建诊断 + MongoDB 双写，状态变为待收费"""
        vid = test_setup["visit_id"]
        resp = await client.post(
            f"/api/consultation/visits/{vid}/diagnosis",
            json={
                "diagnosis_result": "上呼吸道感染",
                "notes": "建议口服抗生素，观察三天",
            },
            headers={"Authorization": f"Bearer {doctor_token}"},
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["diagnosis_result"] == "上呼吸道感染"
        assert data["visit_id"] == vid
        assert "diagnosis_id" in data
        test_setup["diagnosis_id"] = data["diagnosis_id"]

        # 确认 visit 状态已更新为待收费
        resp = await client.get(
            "/api/consultation/visits",
            headers={"Authorization": f"Bearer {doctor_token}"},
        )
        visits = [v for v in resp.json() if v["visit_id"] == vid]
        assert len(visits) == 1
        assert visits[0]["status"] == "待收费"

    async def test_add_prescription(self, client: AsyncClient, doctor_token: str, test_setup: dict):
        """处方：开具处方 + 扣减库存"""
        did = test_setup["diagnosis_id"]
        resp = await client.post(
            f"/api/consultation/diagnoses/{did}/prescriptions",
            json={
                "items": [
                    {
                        "batch_id": test_setup["batch_id"],
                        "quantity": 5,
                        "dosage": "每日两次，每次一片，饭后服用",
                    }
                ]
            },
            headers={"Authorization": f"Bearer {doctor_token}"},
        )
        assert resp.status_code == 201
        data = resp.json()
        assert len(data) == 1
        assert data[0]["batch_id"] == test_setup["batch_id"]
        assert data[0]["quantity"] == 5
        assert data[0]["dosage"] == "每日两次，每次一片，饭后服用"


# ═══════════════════════════════════════════
# TestStateMachine — 状态机守卫
# ═══════════════════════════════════════════

class TestStateMachine:
    """状态机非法跳转"""

    async def test_accept_invalid_status(self, client: AsyncClient, admin_token: str, doctor_token: str, test_setup: dict, db: AsyncSession):
        """非待接诊状态不可接诊"""
        # 创建一个新 visit 并直接尝试诊断（跳过接诊）
        resp = await client.post(
            "/api/consultation/visits",
            json={
                "pet_id": test_setup["pet_id"],
                "employee_id": test_setup["admin_emp_id"],
                "complaint": "测试非法状态跳转",
            },
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        vid = resp.json()["visit_id"]

        # 在待接诊状态下直接诊断应被拒绝
        resp = await client.post(
            f"/api/consultation/visits/{vid}/diagnosis",
            json={"diagnosis_result": "测试", "notes": ""},
            headers={"Authorization": f"Bearer {doctor_token}"},
        )
        assert resp.status_code == 409
        assert "不可诊断" in resp.json()["detail"]

        # 清理
        await db.execute(text("DELETE FROM visit WHERE visit_id = :vid"), {"vid": vid})

    async def test_double_accept(self, client: AsyncClient, admin_token: str, doctor_token: str, test_setup: dict, db: AsyncSession):
        """已接诊的 visit 不可再次接诊"""
        resp = await client.post(
            "/api/consultation/visits",
            json={
                "pet_id": test_setup["pet_id"],
                "employee_id": test_setup["admin_emp_id"],
                "complaint": "测试重复接诊",
            },
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        vid = resp.json()["visit_id"]

        # 第一次接诊
        await client.put(
            f"/api/consultation/visits/{vid}/accept",
            headers={"Authorization": f"Bearer {doctor_token}"},
        )

        # 第二次接诊 → 409
        resp = await client.put(
            f"/api/consultation/visits/{vid}/accept",
            headers={"Authorization": f"Bearer {doctor_token}"},
        )
        assert resp.status_code == 409

        # 清理
        await db.execute(text("DELETE FROM visit WHERE visit_id = :vid"), {"vid": vid})


# ═══════════════════════════════════════════
# TestCancelRules — 取消规则
# ═══════════════════════════════════════════

class TestCancelRules:
    """取消就诊规则"""

    async def test_cancel_without_diagnosis(self, client: AsyncClient, admin_token: str, test_setup: dict):
        """无诊断时可以取消"""
        resp = await client.post(
            "/api/consultation/visits",
            json={
                "pet_id": test_setup["pet_id"],
                "employee_id": test_setup["admin_emp_id"],
                "complaint": "轻微擦伤",
            },
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        vid = resp.json()["visit_id"]

        resp = await client.delete(
            f"/api/consultation/visits/{vid}",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert resp.status_code == 204

        # 确认状态为已取消
        resp = await client.get(
            "/api/consultation/visits",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        cancelled = [v for v in resp.json() if v["visit_id"] == vid]
        assert len(cancelled) == 1
        assert cancelled[0]["status"] == "已取消"

    async def test_cancel_with_diagnosis_fails(self, client: AsyncClient, admin_token: str, doctor_token: str, test_setup: dict):
        """已有诊断时取消应失败"""
        resp = await client.post(
            "/api/consultation/visits",
            json={
                "pet_id": test_setup["pet_id"],
                "employee_id": test_setup["admin_emp_id"],
                "complaint": "呕吐腹泻",
            },
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        vid = resp.json()["visit_id"]

        # 接诊
        await client.put(
            f"/api/consultation/visits/{vid}/accept",
            headers={"Authorization": f"Bearer {doctor_token}"},
        )

        # 诊断
        await client.post(
            f"/api/consultation/visits/{vid}/diagnosis",
            json={"diagnosis_result": "肠胃炎", "notes": "禁食一天"},
            headers={"Authorization": f"Bearer {doctor_token}"},
        )

        # 取消应失败
        resp = await client.delete(
            f"/api/consultation/visits/{vid}",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert resp.status_code == 409
        assert "诊断" in resp.json()["detail"]


# ═══════════════════════════════════════════
# TestMongoDBDualWrite — MongoDB 双写
# ═══════════════════════════════════════════

class TestMongoDBDualWrite:
    """MongoDB 病历双写"""

    async def test_diagnosis_saves_to_mongo(self, client: AsyncClient, admin_token: str, doctor_token: str, test_setup: dict):
        """诊断后 MongoDB medical_records 集合有对应文档"""
        from app.shared.mongo_db import mongo_db

        resp = await client.post(
            "/api/consultation/visits",
            json={
                "pet_id": test_setup["pet_id"],
                "employee_id": test_setup["admin_emp_id"],
                "complaint": "精神萎靡",
            },
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        vid = resp.json()["visit_id"]

        # 接诊
        await client.put(
            f"/api/consultation/visits/{vid}/accept",
            headers={"Authorization": f"Bearer {doctor_token}"},
        )

        # 诊断
        resp = await client.post(
            f"/api/consultation/visits/{vid}/diagnosis",
            json={
                "diagnosis_result": "营养不良",
                "notes": "补充维生素，改善饮食",
            },
            headers={"Authorization": f"Bearer {doctor_token}"},
        )
        diagnosis_id = resp.json()["diagnosis_id"]

        # 验证 MongoDB 中有对应文档
        doc = await mongo_db.medical_records.find_one({"diagnosis_id": diagnosis_id})
        assert doc is not None
        assert doc["diagnosis_result"] == "营养不良"
        assert doc["visit_id"] == vid

        # 清理 MongoDB
        await mongo_db.medical_records.delete_one({"diagnosis_id": diagnosis_id})
