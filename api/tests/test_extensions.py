"""
Extension CRUD tests — create, list, and ARA provisioning verification.

Uses the same auth mock pattern as test_tenants.
"""

import uuid

import pytest
import pytest_asyncio
from httpx import AsyncClient

from app.dependencies.auth import get_current_user
from app.models.user import User


@pytest.fixture(autouse=True)
def _mock_super_admin():
    """Override auth for every test in this module → fake super_admin."""
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
    """Create a tenant and return its UUID for extension tests."""
    resp = await client.post("/tenants", json={
        "slug": "ext_tenant",
        "domain": "ext.pbx.local",
        "name": "Extension Test Tenant",
    })
    assert resp.status_code == 201
    return resp.json()["id"]


# ---- Create extension ----

@pytest.mark.asyncio
async def test_create_extension(client: AsyncClient, tenant_id: str):
    resp = await client.post(f"/tenants/{tenant_id}/extensions", json={
        "extension_number": "1001",
        "display_name": "Test User",
        "password": "securesecret",
    })
    assert resp.status_code == 201

    data = resp.json()
    # ExtensionCredentials fields
    assert data["extension_number"] == "1001"
    assert "sip_username" in data
    assert "sip_password" in data
    assert "sip_domain" in data


# ---- List extensions ----

@pytest.mark.asyncio
async def test_list_extensions(client: AsyncClient, tenant_id: str):
    # Create one extension first
    await client.post(f"/tenants/{tenant_id}/extensions", json={
        "extension_number": "2001",
        "display_name": "List Test",
    })

    resp = await client.get(f"/tenants/{tenant_id}/extensions")
    assert resp.status_code == 200

    data = resp.json()
    # ExtensionListResponse has: items, total
    assert "items" in data
    assert "total" in data
    assert isinstance(data["items"], list)
    assert data["total"] >= 1
    assert data["items"][0]["extension_number"] is not None


# ---- Duplicate extension ----

@pytest.mark.asyncio
async def test_create_duplicate_extension_returns_409(client: AsyncClient, tenant_id: str):
    payload = {
        "extension_number": "3001",
        "display_name": "Dup Test",
    }
    resp1 = await client.post(f"/tenants/{tenant_id}/extensions", json=payload)
    assert resp1.status_code == 201

    resp2 = await client.post(f"/tenants/{tenant_id}/extensions", json=payload)
    assert resp2.status_code == 409
