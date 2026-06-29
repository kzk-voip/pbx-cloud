"""
Ring Group service — business logic for Ring Groups management and routing.
"""

import uuid
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tenant import Tenant
from app.models.extension import Extension
from app.models.ring_group import RingGroup, RingGroupMember
from app.schemas.ring_group import (
    RingGroupCreate,
    RingGroupUpdate,
    RingGroupResponse,
    RingGroupMemberSchema,
    RingGroupListResponse,
)
from app.services import event_service


def _map_ring_group_to_response(group: RingGroup) -> RingGroupResponse:
    """Helper to convert ORM model to Pydantic schema with nested extension details."""
    member_schemas = []
    for m in group.members:
        # m.extension is preloaded
        member_schemas.append(
            RingGroupMemberSchema(
                extension_id=m.extension_id,
                extension_number=m.extension.extension_number if m.extension else "unknown",
                display_name=m.extension.display_name if m.extension else "unknown",
                priority=m.priority,
            )
        )
    return RingGroupResponse(
        id=group.id,
        tenant_id=group.tenant_id,
        name=group.name,
        number=group.number,
        strategy=group.strategy,
        timeout=group.timeout,
        created_at=group.created_at,
        members=member_schemas,
    )


async def create_ring_group(
    db: AsyncSession, tenant_id: uuid.UUID, data: RingGroupCreate
) -> RingGroupResponse:
    # 1. Verify tenant exists
    tenant_result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    if tenant_result.scalar_one_or_none() is None:
        raise ValueError("Tenant not found")

    # 2. Check for number conflicts
    # Check Extensions
    ext_result = await db.execute(
        select(Extension).where(
            Extension.tenant_id == tenant_id,
            Extension.extension_number == data.number,
        )
    )
    if ext_result.scalar_one_or_none() is not None:
        raise ValueError(f"Number {data.number} is already in use by an Extension.")

    # Check existing Ring Groups
    rg_result = await db.execute(
        select(RingGroup).where(
            RingGroup.tenant_id == tenant_id,
            RingGroup.number == data.number,
        )
    )
    if rg_result.scalar_one_or_none() is not None:
        raise ValueError(f"Number {data.number} is already in use by another Ring Group.")

    # 3. Create Ring Group
    group = RingGroup(
        tenant_id=tenant_id,
        name=data.name,
        number=data.number,
        strategy=data.strategy,
        timeout=data.timeout,
    )
    db.add(group)
    await db.flush()  # Get group.id

    # 4. Add members
    for index, ext_id in enumerate(data.member_ids):
        # Verify extension belongs to tenant
        ext_check = await db.execute(
            select(Extension).where(
                Extension.id == ext_id,
                Extension.tenant_id == tenant_id,
            )
        )
        if ext_check.scalar_one_or_none() is None:
            continue

        member = RingGroupMember(
            ring_group_id=group.id,
            extension_id=ext_id,
            priority=index,
        )
        db.add(member)

    # Log event
    await event_service.log_event(
        db,
        tenant_id,
        "ring_group_created",
        source="api",
        details={"name": data.name, "number": data.number, "strategy": data.strategy},
    )

    await db.commit()
    # Re-fetch with relationships loaded
    result = await db.execute(
        select(RingGroup).where(RingGroup.id == group.id)
    )
    group = result.unique().scalar_one()
    return _map_ring_group_to_response(group)


async def list_ring_groups(
    db: AsyncSession, tenant_id: uuid.UUID
) -> RingGroupListResponse:
    result = await db.execute(
        select(RingGroup)
        .where(RingGroup.tenant_id == tenant_id)
        .order_by(RingGroup.number.asc())
    )
    groups = result.unique().scalars().all()
    items = [_map_ring_group_to_response(g) for g in groups]
    return RingGroupListResponse(items=items, total=len(items))


async def update_ring_group(
    db: AsyncSession, tenant_id: uuid.UUID, group_id: uuid.UUID, data: RingGroupUpdate
) -> RingGroupResponse | None:
    # 1. Fetch group
    result = await db.execute(
        select(RingGroup).where(
            RingGroup.id == group_id,
            RingGroup.tenant_id == tenant_id,
        )
    )
    group = result.unique().scalar_one_or_none()
    if group is None:
        return None

    # 2. Check for number conflicts if number changed
    if group.number != data.number:
        # Check Extensions
        ext_result = await db.execute(
            select(Extension).where(
                Extension.tenant_id == tenant_id,
                Extension.extension_number == data.number,
            )
        )
        if ext_result.scalar_one_or_none() is not None:
            raise ValueError(f"Number {data.number} is already in use by an Extension.")

        # Check other Ring Groups
        rg_result = await db.execute(
            select(RingGroup).where(
                RingGroup.tenant_id == tenant_id,
                RingGroup.number == data.number,
                RingGroup.id != group_id,
            )
        )
        if rg_result.scalar_one_or_none() is not None:
            raise ValueError(f"Number {data.number} is already in use by another Ring Group.")

    # 3. Update metadata
    group.name = data.name
    group.number = data.number
    group.strategy = data.strategy
    group.timeout = data.timeout

    # 4. Update members (delete all and recreate to sync order/priorities)
    await db.execute(
        delete(RingGroupMember).where(RingGroupMember.ring_group_id == group_id)
    )

    for index, ext_id in enumerate(data.member_ids):
        # Verify extension belongs to tenant
        ext_check = await db.execute(
            select(Extension).where(
                Extension.id == ext_id,
                Extension.tenant_id == tenant_id,
            )
        )
        if ext_check.scalar_one_or_none() is None:
            continue

        member = RingGroupMember(
            ring_group_id=group_id,
            extension_id=ext_id,
            priority=index,
        )
        db.add(member)

    # Log event
    await event_service.log_event(
        db,
        tenant_id,
        "ring_group_updated",
        source="api",
        details={"name": data.name, "number": data.number, "strategy": data.strategy},
    )

    await db.commit()
    # Re-fetch
    result = await db.execute(
        select(RingGroup).where(RingGroup.id == group_id)
    )
    group = result.unique().scalar_one()
    return _map_ring_group_to_response(group)


async def delete_ring_group(
    db: AsyncSession, tenant_id: uuid.UUID, group_id: uuid.UUID
) -> bool:
    result = await db.execute(
        select(RingGroup).where(
            RingGroup.id == group_id,
            RingGroup.tenant_id == tenant_id,
        )
    )
    group = result.unique().scalar_one_or_none()
    if group is None:
        return False

    # Delete (cascade deletes members automatically)
    await db.execute(delete(RingGroup).where(RingGroup.id == group_id))

    # Log event
    await event_service.log_event(
        db,
        tenant_id,
        "ring_group_deleted",
        source="api",
        details={"name": group.name, "number": group.number},
    )

    await db.commit()
    return True
