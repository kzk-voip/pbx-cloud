"""
Phase 7: Test fixtures — simplified, battle-tested approach.

Key decisions:
- NO separate schema. Tests run against the existing tables in the real DB.
- Test data isolation via unique UUID suffixes (no two tests share a slug/username).
- NullPool on the test engine — each session gets a fresh connection,
  eliminating "attached to a different loop" and connection reuse bugs.
- db_session and client use SEPARATE sessions (separate connections)
  to avoid asyncpg's "another operation is in progress" error.
"""

import os

import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.pool import NullPool
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.config import settings
from app.dependencies.database import get_db

# ---------------------------------------------------------------------------
# Test engine — NullPool = fresh connection per session, no stale loop issues
# ---------------------------------------------------------------------------
DATABASE_TEST_URL = os.getenv("DATABASE_TEST_URL", settings.database_url)

test_engine = create_async_engine(
    DATABASE_TEST_URL,
    echo=False,
    poolclass=NullPool,
)

TestingSessionLocal = async_sessionmaker(
    test_engine, class_=AsyncSession, expire_on_commit=False
)


# ---------------------------------------------------------------------------
# Per-test: standalone session for seeding data / assertions
# ---------------------------------------------------------------------------
@pytest_asyncio.fixture()
async def db_session() -> AsyncSession:
    async with TestingSessionLocal() as session:
        yield session


# ---------------------------------------------------------------------------
# Per-test: HTTPX async client (route handlers get their own sessions)
# ---------------------------------------------------------------------------
@pytest_asyncio.fixture()
async def client():
    from app.main import app

    async def _override_get_db():
        async with TestingSessionLocal() as session:
            yield session

    app.dependency_overrides[get_db] = _override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.pop(get_db, None)
