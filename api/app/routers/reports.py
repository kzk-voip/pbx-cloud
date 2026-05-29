"""
Reports router — analytics and aggregated report endpoints.
"""

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.auth import get_current_user
from app.dependencies.database import get_db
from app.models.user import User
from app.schemas.reports import AgentSummaryResponse
from app.services import report_service

router = APIRouter(prefix="/tenants/{tenant_id}/reports", tags=["Reports"])


@router.get("/agent-summary", response_model=AgentSummaryResponse)
async def get_agent_summary(
    tenant_id: uuid.UUID,
    date_from: datetime | None = Query(None, description="Filter: calls after this date"),
    date_to: datetime | None = Query(None, description="Filter: calls before this date"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Agent summary report — per-extension call statistics.
    - super_admin: can view any tenant's report
    - tenant_admin: can view only their own tenant's report
    """
    # RBAC enforcement
    if user.role == "tenant_admin" and user.tenant_id != tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied — you can only view your own tenant's reports",
        )
    if user.role == "user" and user.tenant_id != tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions",
        )

    return await report_service.get_agent_summary(
        db=db,
        tenant_id=tenant_id,
        date_from=date_from,
        date_to=date_to,
    )
