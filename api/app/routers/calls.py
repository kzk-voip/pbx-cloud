"""
Active calls router — realtime call information via Asterisk AMI.
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.auth import require_role
from app.dependencies.database import get_db
from app.models.tenant import Tenant
from app.models.user import User
from app.services import ami_service

router = APIRouter(prefix="/tenants/{tenant_id}/active-calls", tags=["Active Calls"])


@router.get("")
async def get_active_calls(
    tenant_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("super_admin", "tenant_admin")),
):
    """
    Get active calls for a tenant via Asterisk AMI.
    Returns a list of active channels filtered by tenant.
    """
    # RBAC: tenant_admin can only view their own tenant
    if user.role == "tenant_admin" and user.tenant_id != tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied — you can only view your own tenant's calls",
        )

    # Get tenant slug for AMI filtering
    result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = result.scalar_one_or_none()
    if tenant is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found",
        )

    channels = await ami_service.get_active_calls(tenant.slug)

    return {
        "tenant_id": str(tenant_id),
        "tenant_slug": tenant.slug,
        "active_channels": channels,
        "count": len(channels),
    }
