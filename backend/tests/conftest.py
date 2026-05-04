import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.main import app
from app.shared.pg_db import async_session


@pytest.fixture(scope="module")
async def db():
    """模块级数据库会话，模块内所有测试共享，模块结束后统一回滚"""
    async with async_session() as session:
        yield session
        await session.rollback()
    # 重置连接池，避免跨模块 event loop 隔离导致的连接失效
    from app.shared.pg_db import engine
    await engine.dispose()


@pytest.fixture(scope="module")
async def client(db: AsyncSession):
    """模块级 httpx 客户端，复用 db 会话避免 event loop 隔离问题"""
    # 覆盖 get_pg_db 依赖，用测试会话替代
    async def override():
        yield db

    app.dependency_overrides = {}
    from app.shared.pg_db import get_pg_db
    app.dependency_overrides[get_pg_db] = override

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()
