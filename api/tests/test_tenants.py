"""
Tenant CRUD tests — covers create, list, duplicate, get-by-id.

Auth is bypassed by overriding `get_current_user` to return a fake super_admin.
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


# ---- Create tenant ----

@pytest.mark.asyncio
async def test_create_tenant(client: AsyncClient):
    resp = await client.post("/tenants", json={
        "slug": "test_tenant",
        "domain": "test.pbx.local",
        "name": "Test PBX Tenant",
        "max_extensions": 50,
        "max_concurrent_calls": 10,
        "codecs": "ulaw,alaw",
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["slug"] == "test_tenant"
    assert data["domain"] == "test.pbx.local"
    assert "id" in data


@pytest.mark.asyncio
async def test_create_tenant_duplicate_returns_409(client: AsyncClient):
    """Duplicate slug/domain should return 409 Conflict (not 400)."""
    payload = {
        "slug": "dup_tenant",
        "domain": "dup.pbx.local",
        "name": "Duplicate Tenant",
    }
    resp1 = await client.post("/tenants", json=payload)
    assert resp1.status_code == 201

    resp2 = await client.post("/tenants", json=payload)
    assert resp2.status_code == 409


# ---- List tenants ----

@pytest.mark.asyncio
async def test_list_tenants_returns_paginated_response(client: AsyncClient):
    # Seed a tenant first
    await client.post("/tenants", json={
        "slug": "list_tenant",
        "domain": "list.pbx.local",
        "name": "List Test",
    })

    resp = await client.get("/tenants")
    assert resp.status_code == 200

    data = resp.json()
    # TenantListResponse has: items, total, page, per_page, pages
    assert "items" in data
    assert "total" in data
    assert "page" in data
    assert isinstance(data["items"], list)
    assert len(data["items"]) >= 1
    assert data["items"][0]["slug"] is not None


# ---- Get single tenant ----

@pytest.mark.asyncio
async def test_get_tenant_by_id(client: AsyncClient):
    create = await client.post("/tenants", json={
        "slug": "get_tenant",
        "domain": "get.pbx.local",
        "name": "Get Test",
    })
    tenant_id = create.json()["id"]

    resp = await client.get(f"/tenants/{tenant_id}")
    assert resp.status_code == 200
    assert resp.json()["slug"] == "get_tenant"


@pytest.mark.asyncio
async def test_get_nonexistent_tenant_returns_404(client: AsyncClient):
    fake_id = str(uuid.uuid4())
    resp = await client.get(f"/tenants/{fake_id}")
    assert resp.status_code == 404
