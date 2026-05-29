"""
CDR router — query API for Call Detail Records.
"""

import os
import uuid
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.auth import get_current_user
from app.dependencies.database import get_db
from app.models.cdr import CDR
from app.models.user import User
from app.schemas.cdr import CDRListResponse
from app.services import cdr_service

router = APIRouter(prefix="/tenants/{tenant_id}/cdr", tags=["CDR"])

RECORDINGS_DIR = Path(os.getenv("RECORDINGS_DIR", "/recordings"))


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

    # For 'user' role: restrict to their own calls by extension number
    if user.role == "user":
        if user.extension_id is None:
            # User has no extension linked — return empty
            return CDRListResponse(items=[], total=0, page=1, per_page=per_page, pages=0)
        from app.models.extension import Extension
        ext_result = await db.execute(
            select(Extension.extension_number).where(Extension.id == user.extension_id)
        )
        ext_number = ext_result.scalar_one_or_none()
        if ext_number is None:
            return CDRListResponse(items=[], total=0, page=1, per_page=per_page, pages=0)
        # Force src filter to user's extension
        src = ext_number

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


@router.get("/{cdr_id}/recording")
async def get_recording(
    tenant_id: uuid.UUID,
    cdr_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Stream a call recording audio file.
    The recording path is derived by convention: /recordings/{accountcode}/{uniqueid}.wav
    """
    # RBAC enforcement
    if user.role == "tenant_admin" and user.tenant_id != tenant_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    if user.role == "user" and user.tenant_id != tenant_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    # Fetch CDR record
    result = await db.execute(select(CDR).where(CDR.id == cdr_id, CDR.tenant_id == tenant_id))
    cdr_record = result.scalar_one_or_none()
    if not cdr_record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="CDR record not found")

    # For 'user' role: verify this is their own call
    if user.role == "user":
        from app.models.extension import Extension
        ext_result = await db.execute(
            select(Extension.extension_number).where(Extension.id == user.extension_id)
        )
        ext_number = ext_result.scalar_one_or_none()
        if ext_number and cdr_record.src != ext_number and cdr_record.dst != ext_number:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    # Build recording file path by convention
    if not cdr_record.accountcode or not cdr_record.uniqueid:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No recording available")

    recording_path = RECORDINGS_DIR / cdr_record.accountcode / f"{cdr_record.uniqueid}.wav"

    # Security: prevent path traversal
    try:
        recording_path = recording_path.resolve()
        if not str(recording_path).startswith(str(RECORDINGS_DIR.resolve())):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid path")
    except (ValueError, OSError):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid path")

    if not recording_path.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recording file not found")

    return FileResponse(
        path=str(recording_path),
        media_type="audio/wav",
        filename=f"recording_{cdr_record.uniqueid}.wav",
    )

