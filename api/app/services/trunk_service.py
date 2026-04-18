"""
Trunk service — business logic for trunk CRUD.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import func, select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tenant import Tenant
from app.models.trunk import Trunk
from app.schemas.trunk import (
    TrunkCreate,
    TrunkUpdate,
    TrunkResponse,
    TrunkListResponse,
)


async def create_trunk(
    db: AsyncSession, tenant_id: uuid.UUID, data: TrunkCreate
) -> TrunkResponse:
    """Create a new trunk for a tenant."""
    # Verify tenant exists
    tenant_result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    if tenant_result.scalar_one_or_none() is None:
        raise ValueError("Tenant not found")

    # Check name uniqueness within tenant
    existing = await db.execute(
        select(Trunk).where(Trunk.tenant_id == tenant_id, Trunk.name == data.name)
    )
    if existing.scalar_one_or_none() is not None:
        raise ValueError(f"Trunk '{data.name}' already exists for this tenant")

    trunk = Trunk(
        tenant_id=tenant_id,
        name=data.name,
        provider=data.provider,
        host=data.host,
        port=data.port,
        transport=data.transport,
        username=data.username,
        password=data.password,
        codecs=data.codecs,
        max_channels=data.max_channels,
    )
    db.add(trunk)
    await db.commit()
    await db.refresh(trunk)
    return TrunkResponse.model_validate(trunk)


async def list_trunks(
    db: AsyncSession, tenant_id: uuid.UUID
) -> TrunkListResponse:
    """List all trunks for a tenant."""
    result = await db.execute(
        select(Trunk)
        .where(Trunk.tenant_id == tenant_id)
        .order_by(Trunk.name)
    )
    trunks = result.scalars().all()
    items = [TrunkResponse.model_validate(t) for t in trunks]
    return TrunkListResponse(items=items, total=len(items))


async def update_trunk(
    db: AsyncSession, tenant_id: uuid.UUID, trunk_id: uuid.UUID, data: TrunkUpdate
) -> TrunkResponse | None:
    """Update a trunk. Returns None if not found."""
    result = await db.execute(
        select(Trunk).where(Trunk.id == trunk_id, Trunk.tenant_id == tenant_id)
    )
    trunk = result.scalar_one_or_none()
    if trunk is None:
        return None

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(trunk, field, value)

    trunk.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(trunk)
    return TrunkResponse.model_validate(trunk)


async def delete_trunk(
    db: AsyncSession, tenant_id: uuid.UUID, trunk_id: uuid.UUID
) -> bool:
    """Delete a trunk. Returns False if not found."""
    result = await db.execute(
        select(Trunk).where(Trunk.id == trunk_id, Trunk.tenant_id == tenant_id)
    )
    trunk = result.scalar_one_or_none()
    if trunk is None:
        return False

    await db.execute(delete(Trunk).where(Trunk.id == trunk_id))
    await db.commit()
    return True
