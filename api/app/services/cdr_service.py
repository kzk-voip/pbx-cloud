"""
CDR service — business logic for CDR queries with tenant-scoped filtering.
"""

import math
import uuid
from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.cdr import CDR
from app.schemas.cdr import CDRResponse, CDRListResponse


async def query_cdr(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    src: str | None = None,
    dst: str | None = None,
    disposition: str | None = None,
    min_duration: int | None = None,
    page: int = 1,
    per_page: int = 50,
) -> CDRListResponse:
    """
    Query CDR records for a tenant with optional filters.
    Results are paginated and ordered by calldate descending.
    """
    # Base filter: tenant scope
    conditions = [CDR.tenant_id == tenant_id]

    if date_from is not None:
        conditions.append(CDR.calldate >= date_from)
    if date_to is not None:
        conditions.append(CDR.calldate <= date_to)
    if src is not None:
        conditions.append(CDR.src.ilike(f"%{src}%"))
    if dst is not None:
        conditions.append(CDR.dst.ilike(f"%{dst}%"))
    if disposition is not None:
        conditions.append(CDR.disposition == disposition)
    if min_duration is not None:
        conditions.append(CDR.duration >= min_duration)

    # Total count
    count_query = select(func.count()).select_from(CDR).where(*conditions)
    count_result = await db.execute(count_query)
    total = count_result.scalar() or 0

    # Paginated data
    offset = (page - 1) * per_page
    data_query = (
        select(CDR)
        .where(*conditions)
        .order_by(CDR.calldate.desc())
        .offset(offset)
        .limit(per_page)
    )
    result = await db.execute(data_query)
    records = result.scalars().all()

    items = [CDRResponse.model_validate(r) for r in records]

    return CDRListResponse(
        items=items,
        total=total,
        page=page,
        per_page=per_page,
        pages=math.ceil(total / per_page) if per_page > 0 else 0,
    )
