import redis.asyncio as aioredis

from app.core.config import settings

redis_client = aioredis.from_url(settings.REDIS_URL, decode_responses=True)


async def get_redis():
    """FastAPI 依赖：提供 Redis 连接"""
    yield redis_client
