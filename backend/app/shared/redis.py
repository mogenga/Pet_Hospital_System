import redis.asyncio as aioredis

from app.core.config import settings

redis_client = aioredis.from_url(settings.REDIS_URL, decode_responses=True)


async def get_redis():
    """FastAPI 依赖：提供独立的 Redis 连接（每次请求新建，确保 event loop 隔离）"""
    client = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
    try:
        yield client
    finally:
        await client.aclose()
