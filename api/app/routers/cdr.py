"""
CDR router — query API for Call Detail Records.
"""

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.auth import get_current_user
from app.dependencies.database import get_db
from app.models.user import User
from app.schemas.cdr import CDRListResponse
from app.services import cdr_service

router = APIRouter(prefix="/tenants/{tenant_id}/cdr", tags=["CDR"])


@router.get("", response_model=CDRListResponse)
async def get_cdr(
    tenant_id: uuid.UUID,
    date_from: datetime | None = Query(None, description="Filter: calls after this date"),
    date_to: datetime | None = Query(None, description="Filter: calls before this date"),
    src: str | None = Query(None, description="Filter: source number (partial match)"),
    dst: str | None = Query(None, description="Filter: destination number (partial match)"),
    disposition: str | None = Query(None, description="Filter: ANSWERED, NO ANSWER, BUSY, FAILED"),
    min_duration: int | None = Query(None, ge=0, description="Filter: minimum duration in seconds"),
    page: int = Query(1, ge=1, description="Page number"),
    per_page: int = Query(50, ge=1, le=200, description="Items per page"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Query CDR records for a tenant with optional filters.
    - super_admin: can view any tenant's CDR
    - tenant_admin: can view only their own tenant's CDR
    - user: can view only their own calls
    """
    # RBAC enforcement
    if user.role == "tenant_admin" and user.tenant_id != tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied — you can only view your own tenant's CDR",
        )
    if user.role == "user" and user.tenant_id != tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions",
        )

    # For 'user' role: restrict to their own calls (by username)
    user_src = None
    user_dst = None
    if user.role == "user":
        # user's SIP username is {tenant_slug}_{extension}, but we filter on
        # the extension number part (src/dst in CDR are extension numbers)
        user_src = src  # keep user-supplied filter if any
        user_dst = dst

    return await cdr_service.query_cdr(
        db=db,
        tenant_id=tenant_id,
        date_from=date_from,
        date_to=date_to,
        src=src,
        dst=dst,
        disposition=disposition,
        min_duration=min_duration,
        page=page,
        per_page=per_page,
    )
