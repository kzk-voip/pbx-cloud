"""
Extensions router — CRUD API with ARA auto-provisioning.
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.auth import get_current_user, require_role
from app.dependencies.database import get_db
from app.models.user import User
from app.schemas.extension import (
    ExtensionCreate,
    ExtensionCredentials,
    ExtensionListResponse,
    ExtensionResponse,
    ExtensionUpdate,
)
from app.services import extension_service

router = APIRouter(prefix="/tenants/{tenant_id}/extensions", tags=["Extensions"])


def _check_tenant_access(user: User, tenant_id: uuid.UUID) -> None:
    """Ensure tenant_admin can only access their own tenant."""
    if user.role == "tenant_admin" and user.tenant_id != tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied — you can only manage your own tenant's extensions",
        )
    if user.role == "user":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions",
        )


@router.post("", response_model=ExtensionCredentials, status_code=status.HTTP_201_CREATED)
async def create_extension(
    tenant_id: uuid.UUID,
    data: ExtensionCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("super_admin", "tenant_admin")),
):
    """
    Create an extension with full ARA provisioning.
    Returns SIP credentials for immediate registration.
    """
    _check_tenant_access(user, tenant_id)
    try:
        return await extension_service.create_extension(db, tenant_id, data)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))


@router.get("", response_model=ExtensionListResponse)
async def list_extensions(
    tenant_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("super_admin", "tenant_admin")),
):
    """List all extensions for a tenant."""
    _check_tenant_access(user, tenant_id)
    try:
        return await extension_service.list_extensions(db, tenant_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.get("/{ext_id}", response_model=ExtensionResponse)
async def get_extension(
    tenant_id: uuid.UUID,
    ext_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("super_admin", "tenant_admin")),
):
    """Get extension details."""
    _check_tenant_access(user, tenant_id)
    ext = await extension_service.get_extension(db, tenant_id, ext_id)
    if ext is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Extension not found")
    return ext


@router.put("/{ext_id}", response_model=ExtensionResponse)
async def update_extension(
    tenant_id: uuid.UUID,
    ext_id: uuid.UUID,
    data: ExtensionUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("super_admin", "tenant_admin")),
):
    """Update extension metadata."""
    _check_tenant_access(user, tenant_id)
    ext = await extension_service.update_extension(db, tenant_id, ext_id, data)
    if ext is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Extension not found")
    return ext


@router.delete("/{ext_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_extension(
    tenant_id: uuid.UUID,
    ext_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("super_admin", "tenant_admin")),
):
    """Delete extension and its ARA records."""
    _check_tenant_access(user, tenant_id)
    deleted = await extension_service.delete_extension(db, tenant_id, ext_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Extension not found")


@router.post("/{ext_id}/reset-password", response_model=ExtensionCredentials)
async def reset_password(
    tenant_id: uuid.UUID,
    ext_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("super_admin", "tenant_admin")),
):
    """Reset SIP password for an extension. Returns new credentials."""
    _check_tenant_access(user, tenant_id)
    creds = await extension_service.reset_password(db, tenant_id, ext_id)
    if creds is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Extension not found")
    return creds
