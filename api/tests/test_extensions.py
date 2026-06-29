"""
Extension CRUD tests — create, list, duplicate.
Uses unique slugs/domains per test for isolation.
"""

import uuid

import pytest
import pytest_asyncio
from httpx import AsyncClient

from app.dependencies.auth import get_current_user
from app.models.user import User


def _uid() -> str:
    return uuid.uuid4().hex[:8]


@pytest.fixture(autouse=True)
def _mock_super_admin():
    from app.main import app

    def _fake_user():
        return User(
            id=uuid.uuid4(),
            username="test_super_admin",
            password_hash="unused",
            role="super_admin",
            is_active=True,
        )

    app.dependency_overrides[get_current_user] = _fake_user
    yield
    app.dependency_overrides.pop(get_current_user, None)


@pytest_asyncio.fixture()
async def tenant_id(client: AsyncClient) -> str:
    """Create a unique tenant and return its ID."""
    uid = _uid()
    resp = await client.post("/tenants", json={
        "slug": f"ext_{uid}",
        "domain": f"ext{uid}.pbx.local",
        "name": "Extension Tenant",
    })
    assert resp.status_code == 201
    return resp.json()["id"]


# ---- Create ----

@pytest.mark.asyncio
async def test_create_extension(client: AsyncClient, tenant_id: str):
    resp = await client.post(f"/tenants/{tenant_id}/extensions", json={
        "extension_number": "1001",
        "display_name": "Test User",
        "password": "securesecret",
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["extension_number"] == "1001"
    assert "sip_username" in data
    assert "sip_password" in data
    assert "sip_domain" in data


# ---- List ----

@pytest.mark.asyncio
async def test_list_extensions(client: AsyncClient, tenant_id: str):
    await client.post(f"/tenants/{tenant_id}/extensions", json={
        "extension_number": "2001",
        "display_name": "List Test",
    })

    resp = await client.get(f"/tenants/{tenant_id}/extensions")
    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data
    assert "total" in data
    assert data["total"] >= 1


# ---- Duplicate ----

@pytest.mark.asyncio
async def test_create_duplicate_extension_returns_409(client: AsyncClient, tenant_id: str):
    payload = {
        "extension_number": "3001",
        "display_name": "Dup",
    }
    resp1 = await client.post(f"/tenants/{tenant_id}/extensions", json=payload)
    assert resp1.status_code == 201

    resp2 = await client.post(f"/tenants/{tenant_id}/extensions", json=payload)
    assert resp2.status_code == 409
