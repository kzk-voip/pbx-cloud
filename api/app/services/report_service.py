"""
Report service — business logic for aggregated CDR reports.
"""

import uuid
from datetime import datetime

from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.cdr import CDR
from app.models.extension import Extension
from app.schemas.reports import AgentSummaryResponse, AgentSummaryRow


async def get_agent_summary(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
) -> AgentSummaryResponse:
    """
    Aggregate CDR data grouped by source extension (agent).
    Returns per-agent call statistics with optional date filtering.
    """
    # Base filter: tenant scope
    conditions = [CDR.tenant_id == tenant_id]

    if date_from is not None:
        conditions.append(CDR.calldate >= date_from)
    if date_to is not None:
        conditions.append(CDR.calldate <= date_to)

    # Conditional expressions for answered / no_answer
    answered_case = case((CDR.disposition == "ANSWERED", 1), else_=0)
    no_answer_case = case((CDR.disposition != "ANSWERED", 1), else_=0)

    query = (
        select(
            CDR.src.label("agent"),
            Extension.display_name.label("display_name"),
            func.count().label("calls"),
            func.count(func.distinct(CDR.dst)).label("unique_calls"),
            func.coalesce(func.sum(CDR.duration - CDR.billsec), 0).label("ring_time"),
            func.coalesce(func.sum(CDR.billsec), 0).label("talk_time"),
            func.coalesce(func.sum(CDR.duration), 0).label("total_time"),
            func.sum(answered_case).label("answered"),
            func.sum(no_answer_case).label("no_answer"),
            # ASR = answered / total * 100
            case(
                (func.count() > 0,
                 func.sum(answered_case) * 100.0 / func.count()),
                else_=0.0,
            ).label("asr"),
            # ACD = avg(billsec) where billsec > 0
            func.coalesce(
                func.avg(case((CDR.billsec > 0, CDR.billsec), else_=None)),
                0.0,
            ).label("acd"),
        )
        .select_from(CDR)
        .outerjoin(
            Extension,
            (Extension.extension_number == CDR.src) & (Extension.tenant_id == CDR.tenant_id),
        )
        .where(*conditions)
        .group_by(CDR.src, Extension.display_name)
        .order_by(func.count().desc())
    )

    result = await db.execute(query)
    rows = result.all()

    items = [
        AgentSummaryRow(
            agent=row.agent or "",
            display_name=row.display_name,
            calls=row.calls,
            unique_calls=row.unique_calls,
            ring_time=row.ring_time,
            talk_time=row.talk_time,
            total_time=row.total_time,
            answered=row.answered,
            no_answer=row.no_answer,
            asr=round(float(row.asr), 2),
            acd=round(float(row.acd), 2),
        )
        for row in rows
    ]

    total_calls = sum(item.calls for item in items)
    total_answered = sum(item.answered for item in items)
    total_talk_time = sum(item.talk_time for item in items)

    return AgentSummaryResponse(
        items=items,
        date_from=date_from.isoformat() if date_from else None,
        date_to=date_to.isoformat() if date_to else None,
        total_calls=total_calls,
        total_answered=total_answered,
        total_talk_time=total_talk_time,
    )
