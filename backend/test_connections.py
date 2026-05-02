"""
测试 PostgreSQL / Redis / MongoDB / MinIO 连接情况
用法: python test_connections.py
"""

import asyncio
import sys
import io

# 确保 stdout 使用 UTF-8，避免 Windows GBK 编码报错
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

from app.core.config import settings
from app.shared.pg_db import engine
from app.shared.redis import redis_client
from app.shared.mongo_db import mongo_client
from app.shared.minio import minio_client


async def test_pg():
    try:
        from sqlalchemy import text

        async with engine.connect() as conn:
            result = await conn.execute(text("SELECT 1"))
            row = result.fetchone()
            print(f"  [OK] PostgreSQL - SELECT 1 = {row[0]}")
            return True
    except Exception as e:
        print(f"  [FAIL] PostgreSQL - {e}")
        return False


async def test_redis():
    try:
        await redis_client.ping()
        print("  [OK] Redis - PING success")
        return True
    except Exception as e:
        print(f"  [FAIL] Redis - {e}")
        return False


async def test_mongo():
    try:
        await mongo_client.admin.command("ping")
        print("  [OK] MongoDB - ping success")
        return True
    except Exception as e:
        print(f"  [FAIL] MongoDB - {e}")
        return False


def test_minio():
    try:
        buckets = minio_client.list_buckets()
        bucket_names = [b.name for b in buckets]
        target = settings.MINIO_BUCKET
        status = "exists" if target in bucket_names else "not found"
        print(f"  [OK] MinIO - bucket '{target}' {status}")
        return True
    except Exception as e:
        print(f"  [FAIL] MinIO - {e}")
        return False


async def main():
    print("=" * 55)
    print("  External Service Connection Test")
    print("=" * 55)

    results = {}

    def safe_url(url):
        return url.split("@")[1] if "@" in url else url

    print("\n[1/4] PostgreSQL:", safe_url(settings.PG_URL))
    results["pg"] = await test_pg()

    print("\n[2/4] Redis:", safe_url(settings.REDIS_URL))
    results["redis"] = await test_redis()

    print("\n[3/4] MongoDB:", settings.MONGO_URL)
    results["mongo"] = await test_mongo()

    print("\n[4/4] MinIO:", settings.MINIO_ENDPOINT)
    results["minio"] = test_minio()

    print("\n" + "=" * 55)
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    for name, ok in results.items():
        print(f"  {'PASS' if ok else 'FAIL'} - {name}")
    print(f"\n  Result: {passed}/{total} passed")
    print("=" * 55)

    await engine.dispose()
    await redis_client.aclose()
    mongo_client.close()


if __name__ == "__main__":
    asyncio.run(main())
