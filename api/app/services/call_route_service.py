"""
Call Route service — business logic for outbound routes.
"""

import uuid
from typing import List, Optional
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.call_route import CallRoute
from app.schemas.call_route import CallRouteCreate, CallRouteUpdate


async def create_route(
    db: AsyncSession, tenant_id: uuid.UUID, data: CallRouteCreate
) -> CallRoute:
    route = CallRoute(
        tenant_id=tenant_id,
        name=data.name,
        pattern=data.pattern,
        trunk_id=data.trunk_id,
        prefix_strip=data.prefix_strip,
        prefix_add=data.prefix_add,
        priority=data.priority,
        enabled=data.enabled,
    )
    db.add(route)
    await db.commit()
    await db.refresh(route)
    return route


async def list_routes(db: AsyncSession, tenant_id: uuid.UUID) -> List[CallRoute]:
    result = await db.execute(
        select(CallRoute)
        .where(CallRoute.tenant_id == tenant_id)
        .order_by(CallRoute.priority.asc(), CallRoute.name.asc())
    )
    return list(result.scalars().all())


async def update_route(
    db: AsyncSession, tenant_id: uuid.UUID, route_id: uuid.UUID, data: CallRouteUpdate
) -> Optional[CallRoute]:
    result = await db.execute(
        select(CallRoute).where(CallRoute.tenant_id == tenant_id, CallRoute.id == route_id)
    )
    route = result.scalar_one_or_none()
    if not route:
        return None

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(route, key, value)
    
    route.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(route)
    return route


async def delete_route(db: AsyncSession, tenant_id: uuid.UUID, route_id: uuid.UUID) -> bool:
    result = await db.execute(
        select(CallRoute).where(CallRoute.tenant_id == tenant_id, CallRoute.id == route_id)
    )
    route = result.scalar_one_or_none()
    if not route:
        return False

    await db.delete(route)
    await db.commit()
    return True
