"""
Ring Groups router — CRUD API for Ring Groups.
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.auth import require_role
from app.dependencies.database import get_db
from app.models.user import User
from app.schemas.ring_group import (
    RingGroupCreate,
    RingGroupUpdate,
    RingGroupResponse,
    RingGroupListResponse,
)
from app.services import ring_group_service

router = APIRouter(prefix="/tenants/{tenant_id}/ring-groups", tags=["Ring Groups"])


def _check_tenant_access(user: User, tenant_id: uuid.UUID) -> None:
    """Ensure tenant_admin can only access their own tenant."""
    if user.role == "tenant_admin" and user.tenant_id != tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied — you can only manage your own tenant's ring groups",
        )
    if user.role == "user":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions",
        )


@router.post("", response_model=RingGroupResponse, status_code=status.HTTP_201_CREATED)
async def create_ring_group(
    tenant_id: uuid.UUID,
    data: RingGroupCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("super_admin", "tenant_admin")),
):
    """Create a new Ring Group for a tenant."""
    _check_tenant_access(user, tenant_id)
    try:
        return await ring_group_service.create_ring_group(db, tenant_id, data)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))


@router.get("", response_model=RingGroupListResponse)
async def list_ring_groups(
    tenant_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("super_admin", "tenant_admin")),
):
    """List all Ring Groups for a tenant."""
    _check_tenant_access(user, tenant_id)
    try:
        return await ring_group_service.list_ring_groups(db, tenant_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{group_id}", response_model=RingGroupResponse)
async def update_ring_group(
    tenant_id: uuid.UUID,
    group_id: uuid.UUID,
    data: RingGroupUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("super_admin", "tenant_admin")),
):
    """Update a Ring Group."""
    _check_tenant_access(user, tenant_id)
    try:
        group = await ring_group_service.update_ring_group(db, tenant_id, group_id, data)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    if group is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ring Group not found")
    return group


@router.delete("/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_ring_group(
    tenant_id: uuid.UUID,
    group_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("super_admin", "tenant_admin")),
):
    """Delete a Ring Group."""
    _check_tenant_access(user, tenant_id)
    success = await ring_group_service.delete_ring_group(db, tenant_id, group_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ring Group not found")
