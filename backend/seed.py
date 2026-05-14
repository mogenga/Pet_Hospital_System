"""种子数据初始化脚本 — 创建管理员/医生/护士三个初始账号"""
import asyncio

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

from app.core.config import settings
from app.core.security import hash_password


SEED_DATA = [
    # (name, role, phone, username, password)
    ("张管理", "管理员", "13800000001", "admin",   "admin123"),
    ("李医生", "医生",   "13800000002", "doctor1", "test123456"),
    ("王护士", "护士",   "13800000003", "nurse1",  "test123456"),
]


async def main():
    engine = create_async_engine(settings.PG_URL)
    async with engine.begin() as conn:
        # 清空已有种子账号（按用户名匹配，不影响手动创建的）
        usernames = [u for _, _, _, u, _ in SEED_DATA]
        await conn.execute(
            text("DELETE FROM account WHERE username = ANY(:usernames)"),
            {"usernames": usernames},
        )

        for name, role, phone, username, password in SEED_DATA:
            # 检查员工是否已存在（按角色+手机号判断）
            r = await conn.execute(
                text("SELECT employee_id FROM employee WHERE role = :role AND phone = :phone"),
                {"role": role, "phone": phone},
            )
            row = r.fetchone()
            if row:
                emp_id = row.employee_id
            else:
                r = await conn.execute(
                    text("INSERT INTO employee (name, role, phone) VALUES (:name, :role, :phone) RETURNING employee_id"),
                    {"name": name, "role": role, "phone": phone},
                )
                emp_id = r.scalar_one()

            # 创建账号
            pwd_hash = hash_password(password)
            await conn.execute(
                text("INSERT INTO account (employee_id, username, password_hash) VALUES (:eid, :u, :pwd) ON CONFLICT (username) DO NOTHING"),
                {"eid": emp_id, "u": username, "pwd": pwd_hash},
            )
            print(f"  {role}: {username} / {password}  [OK]")

    await engine.dispose()
    print("\nSeed data created successfully!")


if __name__ == "__main__":
    asyncio.run(main())
