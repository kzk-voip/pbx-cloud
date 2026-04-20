"""
Extension service — business logic with ARA auto-provisioning.

When an extension is created, the service automatically provisions
the corresponding ps_endpoints, ps_auths, and ps_aors records
so the SIP client can register immediately without Asterisk restart.

Phase 5: Redis cache invalidation on create/update/delete.
"""

import secrets
import uuid

from sqlalchemy import func, select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tenant import Tenant
from app.models.extension import Extension
from app.models.ara import PjsipEndpoint, PjsipAuth, PjsipAor
from app.redis import redis_client
from app.services.ara_cache_service import invalidate_endpoint
from app.schemas.extension import (
    ExtensionCreate,
    ExtensionUpdate,
    ExtensionResponse,
    ExtensionCredentials,
    ExtensionListResponse,
)


def _make_sip_id(tenant_slug: str, ext_number: str) -> str:
    """Generate composite SIP ID: {tenant_slug}_{extension_number}"""
    return f"{tenant_slug}_{ext_number}"


def _generate_password() -> str:
    """Generate a secure random SIP password."""
    return secrets.token_urlsafe(16)


def _ext_to_response(ext: Extension, tenant_slug: str) -> ExtensionResponse:
    """Convert Extension ORM to response with sip_username."""
    return ExtensionResponse(
        id=ext.id,
        tenant_id=ext.tenant_id,
        extension_number=ext.extension_number,
        display_name=ext.display_name,
        email=ext.email,
        enabled=ext.enabled,
        created_at=ext.created_at,
        sip_username=_make_sip_id(tenant_slug, ext.extension_number),
    )


async def _get_tenant_or_raise(db: AsyncSession, tenant_id: uuid.UUID) -> Tenant:
    """Fetch tenant or raise ValueError."""
    result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = result.scalar_one_or_none()
    if tenant is None:
        raise ValueError("Tenant not found")
    return tenant


async def create_extension(
    db: AsyncSession, tenant_id: uuid.UUID, data: ExtensionCreate
) -> ExtensionCredentials:
    """
    Create an extension with full ARA provisioning.
    Inserts into: extensions, ps_aors, ps_auths, ps_endpoints.
    Returns SIP credentials for immediate registration.
    """
    tenant = await _get_tenant_or_raise(db, tenant_id)

    # Check extension limit
    count_result = await db.execute(
        select(func.count()).where(Extension.tenant_id == tenant_id)
    )
    current_count = count_result.scalar() or 0
    if current_count >= tenant.max_extensions:
        raise ValueError(
            f"Extension limit reached ({tenant.max_extensions}). "
            f"Upgrade tenant plan to add more."
        )

    # Check uniqueness within tenant
    existing = await db.execute(
        select(Extension).where(
            Extension.tenant_id == tenant_id,
            Extension.extension_number == data.extension_number,
        )
    )
    if existing.scalar_one_or_none() is not None:
        raise ValueError(f"Extension {data.extension_number} already exists for this tenant")

    sip_id = _make_sip_id(tenant.slug, data.extension_number)
    sip_password = data.password or _generate_password()

    # 1. Extension metadata
    extension = Extension(
        tenant_id=tenant_id,
        extension_number=data.extension_number,
        display_name=data.display_name,
        email=data.email,
    )
    db.add(extension)

    # 2. AOR (Address of Record)
    aor = PjsipAor(
        id=sip_id,
        tenant_id=tenant_id,
        max_contacts=1,
        support_path=True,
        qualify_frequency=30,
    )
    db.add(aor)

    # 3. Auth
    auth = PjsipAuth(
        id=sip_id,
        tenant_id=tenant_id,
        auth_type="userpass",
        username=sip_id,
        password=sip_password,
    )
    db.add(auth)

    # 4. Endpoint
    callerid = f'"{data.display_name or sip_id}" <{data.extension_number}>'
    endpoint = PjsipEndpoint(
        id=sip_id,
        tenant_id=tenant_id,
        transport="transport-udp",
        aors=sip_id,
        auth=sip_id,
        context="from-kamailio",
        disallow="all",
        allow=tenant.codecs.split(",")[0] if tenant.codecs else "ulaw",
        direct_media=False,
        force_rport=True,
        rewrite_contact=False,
        rtp_symmetric=True,
        dtmf_mode="rfc4733",
        callerid=callerid,
    )
    db.add(endpoint)

    await db.commit()
    await db.refresh(extension)

    # Invalidate ARA cache for this endpoint
    if redis_client:
        await invalidate_endpoint(redis_client, sip_id)

    return ExtensionCredentials(
        id=extension.id,
        extension_number=data.extension_number,
        sip_username=sip_id,
        sip_password=sip_password,
        sip_domain=tenant.domain,
        display_name=data.display_name,
    )


async def list_extensions(
    db: AsyncSession, tenant_id: uuid.UUID
) -> ExtensionListResponse:
    """List all extensions for a tenant."""
    tenant = await _get_tenant_or_raise(db, tenant_id)

    result = await db.execute(
        select(Extension)
        .where(Extension.tenant_id == tenant_id)
        .order_by(Extension.extension_number)
    )
    extensions = result.scalars().all()

    items = [_ext_to_response(ext, tenant.slug) for ext in extensions]

    return ExtensionListResponse(items=items, total=len(items))


async def get_extension(
    db: AsyncSession, tenant_id: uuid.UUID, ext_id: uuid.UUID
) -> ExtensionResponse | None:
    """Get a single extension by ID."""
    tenant = await _get_tenant_or_raise(db, tenant_id)

    result = await db.execute(
        select(Extension).where(
            Extension.id == ext_id,
            Extension.tenant_id == tenant_id,
        )
    )
    ext = result.scalar_one_or_none()
    if ext is None:
        return None

    return _ext_to_response(ext, tenant.slug)


async def update_extension(
    db: AsyncSession, tenant_id: uuid.UUID, ext_id: uuid.UUID, data: ExtensionUpdate
) -> ExtensionResponse | None:
    """Update extension metadata (display_name, email, enabled)."""
    tenant = await _get_tenant_or_raise(db, tenant_id)

    result = await db.execute(
        select(Extension).where(
            Extension.id == ext_id,
            Extension.tenant_id == tenant_id,
        )
    )
    ext = result.scalar_one_or_none()
    if ext is None:
        return None

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(ext, field, value)

    # If display_name changed, update callerid in ps_endpoints too
    if "display_name" in update_data:
        sip_id = _make_sip_id(tenant.slug, ext.extension_number)
        ep_result = await db.execute(
            select(PjsipEndpoint).where(PjsipEndpoint.id == sip_id)
        )
        endpoint = ep_result.scalar_one_or_none()
        if endpoint:
            endpoint.callerid = f'"{data.display_name}" <{ext.extension_number}>'

    await db.commit()
    await db.refresh(ext)

    # Invalidate ARA cache for updated endpoint
    sip_id_for_cache = _make_sip_id(tenant.slug, ext.extension_number)
    if redis_client:
        await invalidate_endpoint(redis_client, sip_id_for_cache)

    return _ext_to_response(ext, tenant.slug)


async def delete_extension(
    db: AsyncSession, tenant_id: uuid.UUID, ext_id: uuid.UUID
) -> bool:
    """Delete an extension and its ARA records."""
    tenant = await _get_tenant_or_raise(db, tenant_id)

    result = await db.execute(
        select(Extension).where(
            Extension.id == ext_id,
            Extension.tenant_id == tenant_id,
        )
    )
    ext = result.scalar_one_or_none()
    if ext is None:
        return False

    sip_id = _make_sip_id(tenant.slug, ext.extension_number)

    # Remove ARA records
    await db.execute(delete(PjsipEndpoint).where(PjsipEndpoint.id == sip_id))
    await db.execute(delete(PjsipAuth).where(PjsipAuth.id == sip_id))
    await db.execute(delete(PjsipAor).where(PjsipAor.id == sip_id))

    # Remove extension metadata
    await db.execute(delete(Extension).where(Extension.id == ext_id))

    await db.commit()

    # Invalidate ARA cache for deleted endpoint
    if redis_client:
        await invalidate_endpoint(redis_client, sip_id)

    return True


async def reset_password(
    db: AsyncSession, tenant_id: uuid.UUID, ext_id: uuid.UUID
) -> ExtensionCredentials | None:
    """Reset SIP password for an extension. Returns new credentials."""
    tenant = await _get_tenant_or_raise(db, tenant_id)

    result = await db.execute(
        select(Extension).where(
            Extension.id == ext_id,
            Extension.tenant_id == tenant_id,
        )
    )
    ext = result.scalar_one_or_none()
    if ext is None:
        return None

    sip_id = _make_sip_id(tenant.slug, ext.extension_number)
    new_password = _generate_password()

    # Update ps_auths
    auth_result = await db.execute(
        select(PjsipAuth).where(PjsipAuth.id == sip_id)
    )
    auth = auth_result.scalar_one_or_none()
    if auth:
        auth.password = new_password
        await db.commit()

    # Invalidate ARA cache for password-reset endpoint
    if redis_client:
        await invalidate_endpoint(redis_client, sip_id)

    return ExtensionCredentials(
        id=ext.id,
        extension_number=ext.extension_number,
        sip_username=sip_id,
        sip_password=new_password,
        sip_domain=tenant.domain,
        display_name=ext.display_name,
    )
