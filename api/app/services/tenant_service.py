"""
Tenant service — business logic for tenant CRUD operations.
"""

import logging
import math
import uuid
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tenant import Tenant
from app.models.extension import Extension
from app.schemas.tenant import TenantCreate, TenantUpdate, TenantResponse, TenantListResponse
from app.services import kamailio_service

logger = logging.getLogger(__name__)


async def _tenant_to_response(db: AsyncSession, tenant: Tenant) -> TenantResponse:
    """Convert a Tenant ORM object to a TenantResponse with extension count."""
    count_result = await db.execute(
        select(func.count()).where(Extension.tenant_id == tenant.id)
    )
    ext_count = count_result.scalar() or 0

    return TenantResponse(
        id=tenant.id,
        slug=tenant.slug,
        domain=tenant.domain,
        name=tenant.name,
        max_extensions=tenant.max_extensions,
        max_concurrent_calls=tenant.max_concurrent_calls,
        codecs=tenant.codecs,
        is_active=tenant.is_active,
        created_at=tenant.created_at,
        updated_at=tenant.updated_at,
        extension_count=ext_count,
    )


async def create_tenant(db: AsyncSession, data: TenantCreate) -> TenantResponse:
    """
    Create a new tenant. If a soft-deleted tenant with the same slug/domain
    exists, re-activate it with updated data. Raises ValueError only if
    an active tenant with this slug or domain already exists.
    """
    existing_result = await db.execute(
        select(Tenant).where((Tenant.slug == data.slug) | (Tenant.domain == data.domain))
    )
    existing = existing_result.scalar_one_or_none()

    if existing is not None:
        if existing.is_active:
            raise ValueError("Tenant with this slug or domain already exists")

        # Re-activate soft-deleted tenant with updated data
        logger.info(f"Re-activating soft-deleted tenant: {existing.slug}")
        existing.slug = data.slug
        existing.domain = data.domain
        existing.name = data.name
        existing.max_extensions = data.max_extensions
        existing.max_concurrent_calls = data.max_concurrent_calls
        existing.codecs = data.codecs
        existing.is_active = True
        existing.updated_at = datetime.now(timezone.utc)
        await db.commit()
        await db.refresh(existing)
        tenant = existing
    else:
        tenant = Tenant(
            slug=data.slug,
            domain=data.domain,
            name=data.name,
            max_extensions=data.max_extensions,
            max_concurrent_calls=data.max_concurrent_calls,
            codecs=data.codecs,
        )
        db.add(tenant)
        await db.commit()
        await db.refresh(tenant)

    # Sync to Kamailio htable (domain -> slug mapping)
    if not await kamailio_service.add_tenant_domain(tenant.domain, tenant.slug):
        logger.warning(f"Tenant {tenant.slug} created in DB but Kamailio sync failed. "
                       f"Kamailio restart may be needed.")

    return await _tenant_to_response(db, tenant)


async def get_tenant(db: AsyncSession, tenant_id: uuid.UUID) -> TenantResponse | None:
    """Get a single active tenant by ID."""
    result = await db.execute(
        select(Tenant).where(Tenant.id == tenant_id, Tenant.is_active == True)
    )
    tenant = result.scalar_one_or_none()
    if tenant is None:
        return None
    return await _tenant_to_response(db, tenant)


async def list_tenants(
    db: AsyncSession, page: int = 1, per_page: int = 20
) -> TenantListResponse:
    """List all active tenants with pagination."""
    # Total count (active only)
    count_result = await db.execute(
        select(func.count()).select_from(Tenant).where(Tenant.is_active == True)
    )
    total = count_result.scalar() or 0

    # Paginated query (active only)
    offset = (page - 1) * per_page
    result = await db.execute(
        select(Tenant)
        .where(Tenant.is_active == True)
        .order_by(Tenant.created_at.desc())
        .offset(offset)
        .limit(per_page)
    )
    tenants = result.scalars().all()

    items = []
    for tenant in tenants:
        items.append(await _tenant_to_response(db, tenant))

    return TenantListResponse(
        items=items,
        total=total,
        page=page,
        per_page=per_page,
        pages=math.ceil(total / per_page) if per_page > 0 else 0,
    )


async def update_tenant(
    db: AsyncSession, tenant_id: uuid.UUID, data: TenantUpdate
) -> TenantResponse | None:
    """Update a tenant's mutable fields. Returns None if not found."""
    result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = result.scalar_one_or_none()
    if tenant is None:
        return None

    # Apply only provided fields
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(tenant, field, value)

    tenant.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(tenant)
    return await _tenant_to_response(db, tenant)


async def delete_tenant(db: AsyncSession, tenant_id: uuid.UUID) -> bool:
    """Soft-delete a tenant (set is_active=false). Returns False if not found."""
    result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = result.scalar_one_or_none()
    if tenant is None:
        return False

    tenant.is_active = False
    tenant.updated_at = datetime.now(timezone.utc)
    await db.commit()

    # Remove from Kamailio htable
    await kamailio_service.remove_tenant_domain(tenant.domain)

    return True
