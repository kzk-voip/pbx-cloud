"""
Phase 7: Test fixtures — isolated DB schema, async client, auth helpers.

Architecture:
- 'setup_test_db' (session-scoped) creates/drops the pbx_test schema once.
- 'db_session' gives each test its OWN session for seeding/asserting data.
- 'client' gives each test an HTTPX client; FastAPI route handlers get their
  OWN SEPARATE sessions via the get_db override. This avoids the asyncpg
  "another operation is in progress" error that occurs when a single
  connection is used concurrently by the test AND the route handler.
"""

import os

import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import event, text
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.database import Base
from app.dependencies.database import get_db

# ---------------------------------------------------------------------------
# Test database engine
# ---------------------------------------------------------------------------
DATABASE_TEST_URL = os.getenv(
    "DATABASE_TEST_URL",
    "postgresql+asyncpg://pbx_user:pbx_pass@localhost:5432/pbx",
)

test_engine = create_async_engine(
    DATABASE_TEST_URL,
    echo=False,
    pool_size=5,
    max_overflow=10,
)

TestingSessionLocal = async_sessionmaker(
    test_engine, class_=AsyncSession, expire_on_commit=False
)


# ---------------------------------------------------------------------------
# Force search_path on every raw connection from the pool
# ---------------------------------------------------------------------------
@event.listens_for(test_engine.sync_engine, "connect")
def _set_search_path(dbapi_conn, connection_record):
    cursor = dbapi_conn.cursor()
    cursor.execute("SET search_path TO pbx_test, public;")
    cursor.close()
    dbapi_conn.commit()


# ---------------------------------------------------------------------------
# Session-scoped: create / drop schema once per test run
# ---------------------------------------------------------------------------
@pytest_asyncio.fixture(scope="session", autouse=True)
async def setup_test_db():
    async with test_engine.begin() as conn:
        await conn.execute(text("DROP SCHEMA IF EXISTS pbx_test CASCADE;"))
        await conn.execute(text("CREATE SCHEMA pbx_test;"))
        await conn.execute(text("SET search_path TO pbx_test, public;"))
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.execute(text("DROP SCHEMA IF EXISTS pbx_test CASCADE;"))
    await test_engine.dispose()


# ---------------------------------------------------------------------------
# Per-test: independent session for seeding data / assertions
# ---------------------------------------------------------------------------
@pytest_asyncio.fixture()
async def db_session() -> AsyncSession:
    """
    Yield a standalone session for the TEST ITSELF to insert seed data
    and make assertions. This is NOT the same session that route handlers use.
    """
    async with TestingSessionLocal() as session:
        yield session
        # No rollback — we rely on unique test data + schema drop at end


# ---------------------------------------------------------------------------
# Per-test: HTTPX async client (route handlers get their own sessions)
# ---------------------------------------------------------------------------
@pytest_asyncio.fixture()
async def client():
    """
    HTTPX client backed by ASGITransport.
    Route handlers receive a SEPARATE session from TestingSessionLocal,
    so there is zero connection sharing with the test's db_session.
    """
    from app.main import app

    async def _override_get_db():
        async with TestingSessionLocal() as session:
            try:
                yield session
            finally:
                await session.close()

    app.dependency_overrides[get_db] = _override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.pop(get_db, None)
