import logging

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings

engine = create_async_engine(settings.PG_URL, echo=False)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

# SQL 日志：通过 logging 框架输出，整合到 uvicorn 日志流中
if settings.SQL_ECHO:
    logging.basicConfig()
    logging.getLogger("sqlalchemy.engine").setLevel(logging.INFO)


async def get_pg_db():
    """FastAPI 依赖：提供 AsyncSession，请求结束后自动提交或回滚"""
    async with async_session() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
