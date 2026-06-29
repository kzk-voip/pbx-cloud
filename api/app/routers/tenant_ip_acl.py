"""
Tenant IP ACL router — per-tenant strict IP whitelist.
When entries exist, only listed IPs can register SIP and access web UI.
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.auth import require_role
from app.dependencies.database import get_db
from app.models.user import User
from app.models.tenant import Tenant
from app.models.tenant_ip_acl import TenantIpAcl
from app.services import kamailio_service

router = APIRouter(prefix="/tenants/{tenant_id}/ip-acl", tags=["Tenant IP ACL"])


# ── Schemas ──

class AclEntryCreate(BaseModel):
    ip_address: str = Field(..., min_length=1, max_length=45, examples=["10.0.1.50"])
    description: str | None = Field(None, max_length=255, examples=["Office network"])


class AclEntryOut(BaseModel):
    id: str
    tenant_id: str
    ip_address: str
    description: str | None
    created_at: str

    model_config = {"from_attributes": True}


class AclEntryList(BaseModel):
    items: list[AclEntryOut]
    total: int


def _check_tenant_access(user: User, tenant_id: uuid.UUID) -> None:
    if user.role == "tenant_admin" and user.tenant_id != tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied",
        )
    if user.role == "user":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions",
        )


async def _sync_tenant_acl_to_kamailio(db: AsyncSession, tenant_id: uuid.UUID) -> None:
    """Sync a tenant's full ACL to Kamailio htable after any change."""
    # Get tenant slug
    tenant_result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = tenant_result.scalar_one_or_none()
    if not tenant:
        return

    slug = tenant.slug

    # Get all ACL entries for this tenant
    result = await db.execute(
        select(TenantIpAcl).where(TenantIpAcl.tenant_id == tenant_id)
    )
    entries = result.scalars().all()

    if entries:
        # ACL enabled: set marker + all IPs
        await kamailio_service.set_tenant_acl_marker(slug, True)
        # Remove all old entries first (we don't track which were removed)
        await kamailio_service.clear_tenant_acl(slug)
        for entry in entries:
            await kamailio_service.add_tenant_acl_ip(slug, entry.ip_address)
    else:
        # ACL disabled: remove marker
        await kamailio_service.set_tenant_acl_marker(slug, False)
        await kamailio_service.clear_tenant_acl(slug)


@router.get("", response_model=AclEntryList)
async def list_acl(
    tenant_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("super_admin", "tenant_admin")),
):
    """List all whitelisted IPs for a tenant."""
    _check_tenant_access(user, tenant_id)
    result = await db.execute(
        select(TenantIpAcl)
        .where(TenantIpAcl.tenant_id == tenant_id)
        .order_by(TenantIpAcl.created_at.desc())
    )
    items = result.scalars().all()
    return AclEntryList(
        items=[AclEntryOut(
            id=str(i.id),
            tenant_id=str(i.tenant_id),
            ip_address=i.ip_address,
            description=i.description,
            created_at=i.created_at.isoformat() if i.created_at else "",
        ) for i in items],
        total=len(items),
    )


@router.post("", response_model=AclEntryOut, status_code=status.HTTP_201_CREATED)
async def add_to_acl(
    tenant_id: uuid.UUID,
    data: AclEntryCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("super_admin", "tenant_admin")),
):
    """Add an IP to the tenant's ACL whitelist. Syncs to Kamailio htable."""
    _check_tenant_access(user, tenant_id)

    entry = TenantIpAcl(
        tenant_id=tenant_id,
        ip_address=data.ip_address.strip(),
        description=data.description,
    )
    db.add(entry)
    from sqlalchemy.exc import IntegrityError
    try:
        await db.commit()
        await db.refresh(entry)
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"IP '{data.ip_address}' already in ACL for this tenant",
        )

    # Sync to Kamailio
    await _sync_tenant_acl_to_kamailio(db, tenant_id)

    return AclEntryOut(
        id=str(entry.id),
        tenant_id=str(entry.tenant_id),
        ip_address=entry.ip_address,
        description=entry.description,
        created_at=entry.created_at.isoformat() if entry.created_at else "",
    )


@router.delete("/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_from_acl(
    tenant_id: uuid.UUID,
    entry_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("super_admin", "tenant_admin")),
):
    """Remove an IP from the tenant's ACL. Syncs to Kamailio htable."""
    _check_tenant_access(user, tenant_id)

    result = await db.execute(
        select(TenantIpAcl)
        .where(TenantIpAcl.id == entry_id, TenantIpAcl.tenant_id == tenant_id)
    )
    entry = result.scalar_one_or_none()
    if entry is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ACL entry not found")

    await db.delete(entry)
    await db.commit()

    # Sync to Kamailio
    await _sync_tenant_acl_to_kamailio(db, tenant_id)
