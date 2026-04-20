"""
Phase 7: Test fixtures — isolated DB schema, async client, auth helpers.

Key design decisions:
- Uses a separate PostgreSQL schema 'pbx_test' within the same database
  to achieve full table isolation without needing a separate container.
- Each test function gets its own DB session that is rolled back after the test,
  so tests never leak state to each other.
- The FastAPI dependency override for get_db is scoped per-test to avoid conflicts
  with other dependency overrides (e.g. auth mocks).
"""

import os

import pytest
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
# Test database engine (uses the same Postgres instance, different schema)
# ---------------------------------------------------------------------------
DATABASE_TEST_URL = os.getenv(
    "DATABASE_TEST_URL",
    "postgresql+asyncpg://pbx_user:pbx_pass@localhost:5432/pbx",
)

test_engine = create_async_engine(DATABASE_TEST_URL, echo=False)
TestingSessionLocal = async_sessionmaker(
    test_engine, class_=AsyncSession, expire_on_commit=False
)


# ---------------------------------------------------------------------------
# Ensure every new connection uses the pbx_test search_path automatically
# ---------------------------------------------------------------------------
@event.listens_for(test_engine.sync_engine, "connect")
def _set_search_path(dbapi_conn, connection_record):
    """Set search_path on raw DBAPI connection so every session inherits it."""
    cursor = dbapi_conn.cursor()
    cursor.execute("SET search_path TO pbx_test, public;")
    cursor.close()
    dbapi_conn.commit()


# ---------------------------------------------------------------------------
# Session-scoped: create / drop the pbx_test schema once per test run
# ---------------------------------------------------------------------------
@pytest_asyncio.fixture(scope="session", autouse=True)
async def setup_test_db():
    """Create 'pbx_test' schema and all ORM tables before the test session."""
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
# Per-test: provide a session with automatic rollback
# ---------------------------------------------------------------------------
@pytest_asyncio.fixture()
async def db_session() -> AsyncSession:
    """Yield an async session scoped to a single test; rolls back on teardown."""
    async with TestingSessionLocal() as session:
        try:
            yield session
        finally:
            await session.rollback()
            await session.close()


# ---------------------------------------------------------------------------
# Per-test: HTTPX async client with the test DB wired in
# ---------------------------------------------------------------------------
@pytest_asyncio.fixture()
async def client(db_session: AsyncSession):
    """
    Provide an async HTTPX client whose requests hit the FastAPI app directly.
    The get_db dependency is overridden to use the test session.
    """
    # Import app lazily so module-level side effects (redis, AMI) don't fire
    # until we actually need the app instance.
    from app.main import app

    async def _override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    # Only remove our own override — don't nuke overrides set by individual tests
    app.dependency_overrides.pop(get_db, None)
