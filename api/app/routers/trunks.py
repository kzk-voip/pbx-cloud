"""
Trunks router — CRUD API for SIP trunk management.
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.auth import get_current_user, require_role
from app.dependencies.database import get_db
from app.models.user import User
from app.schemas.trunk import (
    TrunkCreate,
    TrunkListResponse,
    TrunkResponse,
    TrunkUpdate,
)
from app.services import trunk_service

router = APIRouter(prefix="/tenants/{tenant_id}/trunks", tags=["Trunks"])


def _check_tenant_access(user: User, tenant_id: uuid.UUID) -> None:
    """Ensure tenant_admin can only access their own tenant."""
    if user.role == "tenant_admin" and user.tenant_id != tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied — you can only manage your own tenant's trunks",
        )
    if user.role == "user":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions",
        )


@router.post("", response_model=TrunkResponse, status_code=status.HTTP_201_CREATED)
async def create_trunk(
    tenant_id: uuid.UUID,
    data: TrunkCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("super_admin", "tenant_admin")),
):
    """Create a new SIP trunk for a tenant."""
    _check_tenant_access(user, tenant_id)
    try:
        return await trunk_service.create_trunk(db, tenant_id, data)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))


@router.get("", response_model=TrunkListResponse)
async def list_trunks(
    tenant_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("super_admin", "tenant_admin")),
):
    """List all trunks for a tenant."""
    _check_tenant_access(user, tenant_id)
    return await trunk_service.list_trunks(db, tenant_id)


@router.put("/{trunk_id}", response_model=TrunkResponse)
async def update_trunk(
    tenant_id: uuid.UUID,
    trunk_id: uuid.UUID,
    data: TrunkUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("super_admin", "tenant_admin")),
):
    """Update trunk configuration."""
    _check_tenant_access(user, tenant_id)
    trunk = await trunk_service.update_trunk(db, tenant_id, trunk_id, data)
    if trunk is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trunk not found")
    return trunk


@router.delete("/{trunk_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_trunk(
    tenant_id: uuid.UUID,
    trunk_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("super_admin", "tenant_admin")),
):
    """Delete a trunk."""
    _check_tenant_access(user, tenant_id)
    deleted = await trunk_service.delete_trunk(db, tenant_id, trunk_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trunk not found")
