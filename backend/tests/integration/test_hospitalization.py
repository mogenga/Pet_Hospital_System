"""住院模块集成测试"""
import pytest
from httpx import AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password


@pytest.fixture(scope="module")
async def admin_token(client: AsyncClient, db: AsyncSession):
    """模块级：创建管理员并登录（幂等）"""
    existing = await db.execute(
        text("SELECT a.account_id FROM account a WHERE a.username = 'admin_hosp'")
    )
    if existing.fetchone():
        resp = await client.post("/api/auth/login", json={"username": "admin_hosp", "password": "admin123"})
        return resp.json()["access_token"]

    pwd = hash_password("admin123")
    r = await db.execute(
        text("INSERT INTO employee (name, role, phone) VALUES ('住院管理员', '管理员', '13900000021') RETURNING employee_id"),
    )
    emp_id = r.scalar_one()
    await db.execute(
        text("INSERT INTO account (employee_id, username, password_hash, is_active) VALUES (:eid, :u, :pwd, TRUE)"),
        {"eid": emp_id, "u": "admin_hosp", "pwd": pwd},
    )
    await db.flush()
    resp = await client.post("/api/auth/login", json={"username": "admin_hosp", "password": "admin123"})
    return resp.json()["access_token"]


@pytest.fixture(scope="module")
async def doctor_token(client: AsyncClient, db: AsyncSession):
    """模块级：创建医生并登录"""
    existing = await db.execute(
        text("SELECT a.account_id FROM account a WHERE a.username = 'doctor_hosp'")
    )
    if existing.fetchone():
        resp = await client.post("/api/auth/login", json={"username": "doctor_hosp", "password": "doctor123"})
        return resp.json()["access_token"]

    pwd = hash_password("doctor123")
    r = await db.execute(
        text("INSERT INTO employee (name, role, phone) VALUES ('住院医生', '医生', '13900000022') RETURNING employee_id"),
    )
    emp_id = r.scalar_one()
    await db.execute(
        text("INSERT INTO account (employee_id, username, password_hash, is_active) VALUES (:eid, :u, :pwd, TRUE)"),
        {"eid": emp_id, "u": "doctor_hosp", "pwd": pwd},
    )
    await db.flush()
    resp = await client.post("/api/auth/login", json={"username": "doctor_hosp", "password": "doctor123"})
    return resp.json()["access_token"]


@pytest.fixture(scope="module")
async def test_setup(db: AsyncSession, admin_token: str, doctor_token: str, client: AsyncClient):
    """创建测试基础数据：客户、宠物、挂号→接诊→诊断 的 visit，以及空闲笼位"""
    # 客户 + 宠物
    r = await db.execute(
        text("INSERT INTO customer (name, phone) VALUES ('住院客户', '13900000023') RETURNING customer_id"),
    )
    cust_id = r.scalar_one()
    r = await db.execute(
        text("INSERT INTO pet (customer_id, name, species, breed) VALUES (:cid, '住院宠物', '犬', '哈士奇') RETURNING pet_id"),
        {"cid": cust_id},
    )
    pet_id = r.scalar_one()

    # 医生员工
    r = await db.execute(
        text("SELECT e.employee_id FROM employee e JOIN account a ON e.employee_id = a.employee_id WHERE a.username = 'doctor_hosp'")
    )
    doc_id = r.scalar_one()

    # 空闲笼位（用于转入测试）
    r = await db.execute(
        text("INSERT INTO ward (ward_no, type, status, daily_rate) VALUES ('A01', '普通病房', '空闲', 100.00) RETURNING ward_id"),
    )
    free_ward_id = r.scalar_one()

    # 已占用笼位（用于冲突测试）
    r = await db.execute(
        text("INSERT INTO ward (ward_no, type, status, daily_rate) VALUES ('A02', '普通病房', '占用', 120.00) RETURNING ward_id"),
    )
    occupied_ward_id = r.scalar_one()

    await db.flush()

    # 挂号 → 接诊 → 诊断
    resp = await client.post(
        "/api/consultation/visits",
        json={"pet_id": pet_id, "employee_id": doc_id, "complaint": "住院测试症状"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    visit_id = resp.json()["visit_id"]

    await client.put(
        f"/api/consultation/visits/{visit_id}/accept",
        headers={"Authorization": f"Bearer {doctor_token}"},
    )

    resp = await client.post(
        f"/api/consultation/visits/{visit_id}/diagnosis",
        json={"diagnosis_result": "需要住院治疗", "notes": "建议住院观察3天"},
        headers={"Authorization": f"Bearer {doctor_token}"},
    )
    diag_id = resp.json()["diagnosis_id"]

    await db.flush()

    return {
        "customer_id": cust_id,
        "pet_id": pet_id,
        "doctor_id": doc_id,
        "visit_id": visit_id,
        "diagnosis_id": diag_id,
        "free_ward_id": free_ward_id,
        "occupied_ward_id": occupied_ward_id,
    }


class TestAdmit:
    """转入住院"""

    async def test_admit_success(self, client: AsyncClient, admin_token: str, test_setup: dict):
        """已诊断 visit + 空闲 ward → 转入住院成功"""
        resp = await client.post(
            "/api/hospitalization",
            json={
                "visit_id": test_setup["visit_id"],
                "ward_id": test_setup["free_ward_id"],
                "admit_date": "2026-05-13",
            },
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["visit_id"] == test_setup["visit_id"]
        assert data["ward_id"] == test_setup["free_ward_id"]
        assert data["status"] == "住院中"
        assert "hosp_id" in data

    async def test_admit_ward_occupied(self, client: AsyncClient, admin_token: str, test_setup: dict):
        """已占用的笼位 → 409"""
        resp = await client.post(
            "/api/hospitalization",
            json={
                "visit_id": test_setup["visit_id"],
                "ward_id": test_setup["occupied_ward_id"],
                "admit_date": "2026-05-13",
            },
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert resp.status_code == 409

    async def test_admit_duplicate_visit(self, client: AsyncClient, admin_token: str, test_setup: dict):
        """同一 visit 重复转入 → 409"""
        # 第一次转入（已在 test_admit_success 中转入）
        # 再次尝试转入同一 visit
        resp = await client.post(
            "/api/hospitalization",
            json={
                "visit_id": test_setup["visit_id"],
                "ward_id": test_setup["free_ward_id"],
                "admit_date": "2026-05-13",
            },
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert resp.status_code == 409


class TestWardList:
    """笼位列表"""

    async def test_list_wards(self, client: AsyncClient, admin_token: str):
        """笼位列表正常返回"""
        resp = await client.get(
            "/api/wards",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert resp.status_code == 200
        wards = resp.json()
        assert isinstance(wards, list)
        assert len(wards) >= 2
        # 转入后 A01 应为占用状态
        a01 = next((w for w in wards if w["ward_no"] == "A01"), None)
        assert a01 is not None
        assert a01["status"] == "占用"


class TestHospitalizationList:
    """住院列表"""

    async def test_list_all(self, client: AsyncClient, admin_token: str):
        """查询所有住院记录"""
        resp = await client.get(
            "/api/hospitalization",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert resp.status_code == 200
        assert len(resp.json()) >= 1

    async def test_list_filter_by_status(self, client: AsyncClient, admin_token: str):
        """按 status 筛选"""
        # 查询住院中
        resp = await client.get(
            "/api/hospitalization?status=住院中",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert resp.status_code == 200
        for h in resp.json():
            assert h["status"] == "住院中"


class TestNursingRecord:
    """护理记录"""

    async def test_add_nursing_record(self, client: AsyncClient, admin_token: str, test_setup: dict, db: AsyncSession):
        """添加护理记录 → PG + MongoDB 双写"""
        # 获取 hosp_id
        r = await db.execute(
            text("SELECT hosp_id FROM hospitalization WHERE visit_id = :vid"),
            {"vid": test_setup["visit_id"]},
        )
        hosp_id = r.scalar_one()

        # 获取护士 employee_id
        r = await db.execute(
            text("SELECT e.employee_id FROM employee e JOIN account a ON e.employee_id = a.employee_id WHERE a.username = 'admin_hosp'")
        )
        nurse_id = r.scalar_one()

        resp = await client.post(
            f"/api/hospitalization/{hosp_id}/nursing",
            json={
                "employee_id": nurse_id,
                "content": "体温38.5°C，精神状态良好，已喂食喂水",
            },
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["hosp_id"] == hosp_id
        assert "record_id" in data

        # 验证 PG 写入
        r = await db.execute(
            text("SELECT content FROM nursing_record WHERE record_id = :rid"),
            {"rid": data["record_id"]},
        )
        pg_row = r.fetchone()
        assert pg_row is not None
        assert "体温" in pg_row.content

        # 验证 MongoDB 双写
        from app.shared.mongo_db import mongo_db
        mongo_doc = await mongo_db.nursing_logs.find_one({"record_id": data["record_id"]})
        assert mongo_doc is not None
        assert mongo_doc["hosp_id"] == hosp_id

    async def test_list_nursing_records(self, client: AsyncClient, admin_token: str, test_setup: dict, db: AsyncSession):
        """住院详情包含护理记录列表"""
        r = await db.execute(
            text("SELECT hosp_id FROM hospitalization WHERE visit_id = :vid"),
            {"vid": test_setup["visit_id"]},
        )
        hosp_id = r.scalar_one()

        resp = await client.get(
            f"/api/hospitalization/{hosp_id}",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "住院中"
        assert "nursing_records" in data
        assert len(data["nursing_records"]) >= 1


class TestDischarge:
    """出院"""

    async def test_discharge_success(self, client: AsyncClient, admin_token: str, test_setup: dict, db: AsyncSession):
        """出院 → 状态变更 + 笼位释放 + 自动生成住院费"""
        r = await db.execute(
            text("SELECT hosp_id, ward_id FROM hospitalization WHERE visit_id = :vid"),
            {"vid": test_setup["visit_id"]},
        )
        row = r.fetchone()
        hosp_id = row.hosp_id
        ward_id = row.ward_id

        resp = await client.put(
            f"/api/hospitalization/{hosp_id}/discharge",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "已出院"
        assert data["discharge_date"] is not None

        # 验证笼位释放
        r = await db.execute(
            text("SELECT status FROM ward WHERE ward_id = :wid"),
            {"wid": ward_id},
        )
        assert r.scalar_one() == "空闲"

        # 验证自动生成住院费 bill_item
        r = await db.execute(
            text("SELECT bi.bill_item_id FROM bill_item bi "
                 "JOIN bill b ON bi.bill_id = b.bill_id "
                 "WHERE b.visit_id = :vid AND bi.source_type = 'hospitalization'"),
            {"vid": test_setup["visit_id"]},
        )
        assert r.fetchone() is not None

    async def test_discharge_already_discharged(self, client: AsyncClient, admin_token: str, test_setup: dict, db: AsyncSession):
        """已出院再次出院 → 409"""
        r = await db.execute(
            text("SELECT hosp_id FROM hospitalization WHERE visit_id = :vid"),
            {"vid": test_setup["visit_id"]},
        )
        hosp_id = r.scalar_one()

        resp = await client.put(
            f"/api/hospitalization/{hosp_id}/discharge",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert resp.status_code == 409
