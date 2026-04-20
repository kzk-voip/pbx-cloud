"""
Auth tests — login, token refresh, /me endpoint, and RBAC basics.
"""

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.services.auth_service import hash_password


@pytest_asyncio.fixture()
async def sample_user(db_session: AsyncSession) -> User:
    """Seed a super_admin user for auth tests."""
    user = User(
        username="admin_test",
        password_hash=hash_password("securepassword"),
        role="super_admin",
        is_active=True,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture()
async def inactive_user(db_session: AsyncSession) -> User:
    """Seed a disabled user to test account lockout."""
    user = User(
        username="disabled_user",
        password_hash=hash_password("password123"),
        role="user",
        is_active=False,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


# ---- Login tests ----

@pytest.mark.asyncio
async def test_login_success(client: AsyncClient, sample_user: User):
    resp = await client.post("/auth/login", json={
        "username": "admin_test",
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
        "username": "admin_test",
        "password": "wrongpassword",
    })
    assert resp.status_code == 401
    assert "Invalid" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_login_nonexistent_user(client: AsyncClient):
    resp = await client.post("/auth/login", json={
        "username": "ghost",
        "password": "anything",
    })
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_login_disabled_account(client: AsyncClient, inactive_user: User):
    resp = await client.post("/auth/login", json={
        "username": "disabled_user",
        "password": "password123",
    })
    assert resp.status_code == 403
    assert "disabled" in resp.json()["detail"].lower()


# ---- /me endpoint ----

@pytest.mark.asyncio
async def test_me_returns_current_user(client: AsyncClient, sample_user: User):
    login = await client.post("/auth/login", json={
        "username": "admin_test",
        "password": "securepassword",
    })
    token = login.json()["access_token"]

    resp = await client.get("/auth/me", headers={
        "Authorization": f"Bearer {token}",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["username"] == "admin_test"
    assert data["role"] == "super_admin"


@pytest.mark.asyncio
async def test_me_rejects_no_token(client: AsyncClient):
    resp = await client.get("/auth/me")
    assert resp.status_code == 403  # HTTPBearer returns 403 when header missing


# ---- Refresh token ----

@pytest.mark.asyncio
async def test_refresh_token(client: AsyncClient, sample_user: User):
    login = await client.post("/auth/login", json={
        "username": "admin_test",
        "password": "securepassword",
    })
    refresh_token = login.json()["refresh_token"]

    resp = await client.post("/auth/refresh", json={
        "refresh_token": refresh_token,
    })
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert "refresh_token" in data


@pytest.mark.asyncio
async def test_refresh_with_access_token_fails(client: AsyncClient, sample_user: User):
    """Using an access token as a refresh token should fail."""
    login = await client.post("/auth/login", json={
        "username": "admin_test",
        "password": "securepassword",
    })
    access_token = login.json()["access_token"]

    resp = await client.post("/auth/refresh", json={
        "refresh_token": access_token,
    })
    assert resp.status_code == 401
