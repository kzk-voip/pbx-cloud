"""
Events router — tenant event log API.
"""

import math
import uuid

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.auth import require_role
from app.dependencies.database import get_db
from app.models.user import User
from app.models.tenant_event import TenantEvent
from pydantic import BaseModel
from datetime import datetime


router = APIRouter(prefix="/tenants/{tenant_id}/events", tags=["Events"])


class EventResponse(BaseModel):
    id: int
    tenant_id: uuid.UUID
    created_at: datetime
    action: str
    source: str | None
    ip: str | None
    extension: str | None
    details: dict | None

    model_config = {"from_attributes": True}


class EventListResponse(BaseModel):
    items: list[EventResponse]
    total: int
    page: int
    per_page: int
    pages: int


@router.get("", response_model=EventListResponse)
async def list_events(
    tenant_id: uuid.UUID,
    action: str | None = Query(None, description="Filter by action type"),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("super_admin", "tenant_admin")),
):
    """List tenant events with optional action filter and pagination."""
    if user.role == "tenant_admin" and user.tenant_id != tenant_id:
        from fastapi import HTTPException
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    conditions = [TenantEvent.tenant_id == tenant_id]
    if action:
        conditions.append(TenantEvent.action == action)

    # Total count
    count_q = select(func.count()).select_from(TenantEvent).where(*conditions)
    total = (await db.execute(count_q)).scalar() or 0

    # Paginated data
    offset = (page - 1) * per_page
    data_q = (
        select(TenantEvent)
        .where(*conditions)
        .order_by(TenantEvent.created_at.desc())
        .offset(offset)
        .limit(per_page)
    )
    result = await db.execute(data_q)
    items = [EventResponse.model_validate(r) for r in result.scalars().all()]

    return EventListResponse(
        items=items,
        total=total,
        page=page,
        per_page=per_page,
        pages=math.ceil(total / per_page) if per_page > 0 else 0,
    )
