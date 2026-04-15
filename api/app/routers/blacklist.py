"""
Number blacklist router — per-tenant number/pattern blocking.
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies.auth import require_role
from app.models.user import User
from app.models.blacklist import NumberBlacklist

router = APIRouter(prefix="/tenants/{tenant_id}/blacklist", tags=["Number Blacklist"])


class BlacklistCreate(BaseModel):
    pattern: str = Field(..., min_length=1, max_length=64, examples=["0044*", "00380*"])
    reason: str | None = Field(None, max_length=255, examples=["Premium rate numbers"])


class BlacklistOut(BaseModel):
    id: str
    tenant_id: str
    pattern: str
    reason: str | None
    created_at: str

    model_config = {"from_attributes": True}


class BlacklistList(BaseModel):
    items: list[BlacklistOut]
    total: int


@router.get("", response_model=BlacklistList)
async def list_blacklist(
    tenant_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("super_admin", "tenant_admin")),
):
    """List all blacklisted number patterns for a tenant."""
    result = await db.execute(
        select(NumberBlacklist)
        .where(NumberBlacklist.tenant_id == tenant_id)
        .order_by(NumberBlacklist.created_at.desc())
    )
    items = result.scalars().all()

    return BlacklistList(
        items=[BlacklistOut(
            id=str(i.id),
            tenant_id=str(i.tenant_id),
            pattern=i.pattern,
            reason=i.reason,
            created_at=i.created_at.isoformat() if i.created_at else "",
        ) for i in items],
        total=len(items),
    )


@router.post("", status_code=status.HTTP_201_CREATED, response_model=BlacklistOut)
async def add_to_blacklist(
    tenant_id: uuid.UUID,
    data: BlacklistCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("super_admin", "tenant_admin")),
):
    """Add a number pattern to the tenant's blacklist."""
    entry = NumberBlacklist(
        tenant_id=tenant_id,
        pattern=data.pattern,
        reason=data.reason,
    )
    db.add(entry)

    try:
        await db.commit()
        await db.refresh(entry)
    except Exception:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Pattern '{data.pattern}' already blacklisted for this tenant",
        )

    return BlacklistOut(
        id=str(entry.id),
        tenant_id=str(entry.tenant_id),
        pattern=entry.pattern,
        reason=entry.reason,
        created_at=entry.created_at.isoformat() if entry.created_at else "",
    )


@router.delete("/{blacklist_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_from_blacklist(
    tenant_id: uuid.UUID,
    blacklist_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("super_admin", "tenant_admin")),
):
    """Remove a pattern from the tenant's blacklist."""
    result = await db.execute(
        delete(NumberBlacklist)
        .where(NumberBlacklist.id == blacklist_id)
        .where(NumberBlacklist.tenant_id == tenant_id)
    )

    if result.rowcount == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Blacklist entry not found")

    await db.commit()
