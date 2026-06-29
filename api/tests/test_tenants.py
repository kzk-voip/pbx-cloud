"""
Tenant CRUD tests — create, list, duplicate, get-by-id.

Auth bypassed via get_current_user override → fake super_admin.
Each test uses unique slugs/domains (uuid suffix) for isolation.
"""

import uuid

import pytest
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


# ---- Create ----

@pytest.mark.asyncio
async def test_create_tenant(client: AsyncClient):
    uid = _uid()
    resp = await client.post("/tenants", json={
        "slug": f"t_{uid}",
        "domain": f"{uid}.pbx.local",
        "name": "Test Tenant",
        "max_extensions": 50,
        "max_concurrent_calls": 10,
        "codecs": "ulaw,alaw",
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["slug"] == f"t_{uid}"
    assert "id" in data


@pytest.mark.asyncio
async def test_create_tenant_duplicate_returns_409(client: AsyncClient):
    uid = _uid()
    payload = {
        "slug": f"dup_{uid}",
        "domain": f"dup{uid}.pbx.local",
        "name": "Dup",
    }
    resp1 = await client.post("/tenants", json=payload)
    assert resp1.status_code == 201

    resp2 = await client.post("/tenants", json=payload)
    assert resp2.status_code == 409


# ---- List ----

@pytest.mark.asyncio
async def test_list_tenants_returns_paginated_response(client: AsyncClient):
    uid = _uid()
    await client.post("/tenants", json={
        "slug": f"list_{uid}",
        "domain": f"list{uid}.pbx.local",
        "name": "List",
    })

    resp = await client.get("/tenants")
    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data
    assert "total" in data
    assert "page" in data
    assert isinstance(data["items"], list)
    assert len(data["items"]) >= 1


# ---- Get by ID ----

@pytest.mark.asyncio
async def test_get_tenant_by_id(client: AsyncClient):
    uid = _uid()
    create = await client.post("/tenants", json={
        "slug": f"get_{uid}",
        "domain": f"get{uid}.pbx.local",
        "name": "Get",
    })
    tenant_id = create.json()["id"]

    resp = await client.get(f"/tenants/{tenant_id}")
    assert resp.status_code == 200
    assert resp.json()["slug"] == f"get_{uid}"


@pytest.mark.asyncio
async def test_get_nonexistent_tenant_returns_404(client: AsyncClient):
    fake_id = str(uuid.uuid4())
    resp = await client.get(f"/tenants/{fake_id}")
    assert resp.status_code == 404
