"""
Admin router — system-level management endpoints (super_admin only).
Includes IP blacklist management via Kamailio JSONRPC.
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.dependencies.auth import require_role
from app.models.user import User
from app.services import kamailio_service

router = APIRouter(prefix="/admin", tags=["Admin"])


class BlacklistEntry(BaseModel):
    ip: str = Field(..., examples=["192.168.1.100"])
    reason: str = Field("manual", examples=["Suspicious activity"])


class BlacklistResponse(BaseModel):
    entries: list[dict]
    total: int


@router.get("/blacklist", response_model=BlacklistResponse)
async def get_blacklist(
    user: User = Depends(require_role("super_admin")),
):
    """
    List all IP addresses in the Kamailio blacklist.
    Requires super_admin role.
    """
    result = await kamailio_service.dump_blacklist()
    if result is None:
        return BlacklistResponse(entries=[], total=0)

    entries = []
    if "result" in result:
        for slot in result["result"]:
            if "slot" in slot:
                for item in slot["slot"]:
                    entries.append({
                        "ip": item.get("name", ""),
                        "value": item.get("value", ""),
                    })

    return BlacklistResponse(entries=entries, total=len(entries))


@router.post("/blacklist", status_code=status.HTTP_201_CREATED)
async def add_to_blacklist(
    data: BlacklistEntry,
    user: User = Depends(require_role("super_admin")),
):
    """
    Manually add an IP to the Kamailio blacklist (1h auto-expire).
    Requires super_admin role.
    """
    success = await kamailio_service.blacklist_ip(data.ip)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to add IP to Kamailio blacklist",
        )
    return {"status": "ok", "ip": data.ip, "message": "Blacklisted for 1 hour"}


@router.delete("/blacklist/{ip}")
async def remove_from_blacklist(
    ip: str,
    user: User = Depends(require_role("super_admin")),
):
    """
    Remove an IP from the Kamailio blacklist.
    Requires super_admin role.
    """
    success = await kamailio_service.unblacklist_ip(ip)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to remove IP from Kamailio blacklist",
        )
    return {"status": "ok", "ip": ip, "message": "Removed from blacklist"}


@router.get("/system-status")
async def system_status(
    user: User = Depends(require_role("super_admin")),
):
    """
    Get real-time system status: active calls from both Asterisk nodes,
    and overall system health indicator.
    """
    from app.services.ami_service import AMIClient

    total_channels = 0
    nodes = []

    for label, port in [("asterisk-1", 5038), ("asterisk-2", 5039)]:
        try:
            ami = AMIClient()
            ami.host = "127.0.0.1"
            ami.port = port
            channels = await ami.get_active_channels()
            count = len(channels)
            total_channels += count
            nodes.append({"node": label, "channels": count, "status": "ok"})
        except Exception:
            nodes.append({"node": label, "channels": 0, "status": "error"})

    return {
        "status": "ok",
        "active_calls": total_channels,
        "nodes": nodes,
    }


@router.get("/cdr-stats")
async def cdr_stats(
    days: int = 30,
    user: User = Depends(require_role("super_admin")),
):
    """
    Get CDR analytics for the dashboard:
    - call_volume: calls per day (last N days)
    - disposition_breakdown: count by disposition
    - peak_hours: calls grouped by hour of day
    - totals: total calls, total duration, avg duration
    """
    from datetime import datetime, timedelta

    from sqlalchemy import func, select, cast, Integer, extract
    from sqlalchemy.ext.asyncio import AsyncSession

    from app.dependencies.database import get_db
    from app.models.cdr import CDR
    from app.database import async_session

    async with async_session() as db:
        cutoff = datetime.utcnow() - timedelta(days=days)

        # Total calls and duration
        totals_q = select(
            func.count().label("total_calls"),
            func.coalesce(func.sum(CDR.duration), 0).label("total_duration"),
            func.coalesce(func.avg(CDR.duration), 0).label("avg_duration"),
        ).where(CDR.calldate >= cutoff)
        totals_result = await db.execute(totals_q)
        totals_row = totals_result.one()

        # Calls per day
        daily_q = (
            select(
                func.date(CDR.calldate).label("day"),
                func.count().label("count"),
            )
            .where(CDR.calldate >= cutoff)
            .group_by(func.date(CDR.calldate))
            .order_by(func.date(CDR.calldate))
        )
        daily_result = await db.execute(daily_q)
        call_volume = [
            {"date": str(row.day), "calls": row.count}
            for row in daily_result.all()
        ]

        # Disposition breakdown
        disp_q = (
            select(
                CDR.disposition,
                func.count().label("count"),
            )
            .where(CDR.calldate >= cutoff)
            .group_by(CDR.disposition)
            .order_by(func.count().desc())
        )
        disp_result = await db.execute(disp_q)
        disposition_breakdown = [
            {"disposition": row.disposition or "UNKNOWN", "count": row.count}
            for row in disp_result.all()
        ]

        # Peak hours
        hour_q = (
            select(
                extract("hour", CDR.calldate).label("hour"),
                func.count().label("count"),
            )
            .where(CDR.calldate >= cutoff)
            .group_by(extract("hour", CDR.calldate))
            .order_by(extract("hour", CDR.calldate))
        )
        hour_result = await db.execute(hour_q)
        peak_hours = [
            {"hour": int(row.hour), "calls": row.count}
            for row in hour_result.all()
        ]

    return {
        "totals": {
            "total_calls": totals_row.total_calls,
            "total_duration": int(totals_row.total_duration),
            "avg_duration": round(float(totals_row.avg_duration), 1),
        },
        "call_volume": call_volume,
        "disposition_breakdown": disposition_breakdown,
        "peak_hours": peak_hours,
    }

