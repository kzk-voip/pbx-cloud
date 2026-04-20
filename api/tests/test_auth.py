"""
Auth tests — login, token refresh, /me endpoint, and RBAC basics.

NOTE: Since the test's db_session and the route handler's session are
SEPARATE (to avoid asyncpg concurrent operation errors), we MUST commit
seed data before making HTTP calls. The route handler won't see uncommitted
data from a different connection.

Each fixture generates a UNIQUE username (uuid suffix) because there is no
automatic rollback between tests — data persists until schema teardown.
"""

import uuid

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.services.auth_service import hash_password


def _uid() -> str:
    """Short unique suffix to avoid conflicts between tests."""
    return uuid.uuid4().hex[:8]


@pytest_asyncio.fixture()
async def sample_user(db_session: AsyncSession):
    """Seed a super_admin user with a unique username."""
    uname = f"admin_{_uid()}"
    user = User(
        username=uname,
        password_hash=hash_password("securepassword"),
        role="super_admin",
        is_active=True,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture()
async def inactive_user(db_session: AsyncSession):
    """Seed a disabled user with a unique username."""
    uname = f"disabled_{_uid()}"
    user = User(
        username=uname,
        password_hash=hash_password("password123"),
        role="user",
        is_active=False,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


# ---- Login ----

@pytest.mark.asyncio
async def test_login_success(client: AsyncClient, sample_user: User):
    resp = await client.post("/auth/login", json={
        "username": sample_user.username,
        "password": "securepassword",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"


@pytest.mark.asyncio
async def test_login_wrong_password(client: AsyncClient, sample_user: User):
    resp = await client.post("/auth/login", json={
        "username": sample_user.username,
        "password": "wrongpassword",
    })
    assert resp.status_code == 401
    assert "Invalid" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_login_nonexistent_user(client: AsyncClient):
    resp = await client.post("/auth/login", json={
        "username": f"ghost_{_uid()}",
        "password": "anything",
    })
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_login_disabled_account(client: AsyncClient, inactive_user: User):
    resp = await client.post("/auth/login", json={
        "username": inactive_user.username,
        "password": "password123",
    })
    assert resp.status_code == 403
    assert "disabled" in resp.json()["detail"].lower()


# ---- /me ----

@pytest.mark.asyncio
async def test_me_returns_current_user(client: AsyncClient, sample_user: User):
    login = await client.post("/auth/login", json={
        "username": sample_user.username,
        "password": "securepassword",
    })
    token = login.json()["access_token"]

    resp = await client.get("/auth/me", headers={
        "Authorization": f"Bearer {token}",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["username"] == sample_user.username
    assert data["role"] == "super_admin"


@pytest.mark.asyncio
async def test_me_rejects_no_token(client: AsyncClient):
    resp = await client.get("/auth/me")
    assert resp.status_code == 403


# ---- Refresh token ----

@pytest.mark.asyncio
async def test_refresh_token(client: AsyncClient, sample_user: User):
    login = await client.post("/auth/login", json={
        "username": sample_user.username,
        "password": "securepassword",
    })
    refresh_token = login.json()["refresh_token"]

    resp = await client.post("/auth/refresh", json={
        "refresh_token": refresh_token,
    })
    assert resp.status_code == 200
    assert "access_token" in resp.json()


@pytest.mark.asyncio
async def test_refresh_with_access_token_fails(client: AsyncClient, sample_user: User):
    login = await client.post("/auth/login", json={
        "username": sample_user.username,
        "password": "securepassword",
    })
    access_token = login.json()["access_token"]

    resp = await client.post("/auth/refresh", json={
        "refresh_token": access_token,
    })
    assert resp.status_code == 401
