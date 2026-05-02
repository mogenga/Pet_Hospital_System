import asyncio

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.main import app
from app.shared.pg_db import async_session


@pytest.fixture(scope="module")
def event_loop():
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    yield loop
    loop.close()


@pytest.fixture(scope="module")
async def db():
    async with async_session() as session:
        yield session
        await session.rollback()


@pytest.fixture(scope="module")
async def client(db: AsyncSession):
    async def override_get_pg_db():
        yield db

    app.dependency_overrides = {}
    from app.shared.pg_db import get_pg_db
    app.dependency_overrides[get_pg_db] = override_get_pg_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()
