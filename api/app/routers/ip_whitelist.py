"""
Global IP Whitelist & Blacklist router — super_admin only.

Whitelist: IPs immune from pike/fail2ban blocking.
Blacklist: Manual permanent IP bans (separate from auto-expire pike).
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.auth import require_role
from app.dependencies.database import get_db
from app.models.user import User
from app.models.global_ip_whitelist import GlobalIpWhitelist
from app.services import kamailio_service

router = APIRouter(prefix="/admin", tags=["IP Access Control"])


# ── Schemas ──

class IpEntryCreate(BaseModel):
    ip_address: str = Field(..., min_length=1, max_length=45, examples=["192.168.1.100"])
    description: str | None = Field(None, max_length=255, examples=["Office VPN"])


class IpEntryOut(BaseModel):
    id: str
    ip_address: str
    description: str | None
    created_at: str

    model_config = {"from_attributes": True}


class IpEntryList(BaseModel):
    items: list[IpEntryOut]
    total: int


class BlacklistEntryOut(BaseModel):
    ip: str
    value: str


class BlacklistList(BaseModel):
    entries: list[BlacklistEntryOut]
    total: int


# ── Global Whitelist ──

@router.get("/ip-whitelist", response_model=IpEntryList)
async def list_whitelist(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("super_admin")),
):
    """List all globally whitelisted IPs."""
    result = await db.execute(
        select(GlobalIpWhitelist).order_by(GlobalIpWhitelist.created_at.desc())
    )
    items = result.scalars().all()
    return IpEntryList(
        items=[IpEntryOut(
            id=str(i.id),
            ip_address=i.ip_address,
            description=i.description,
            created_at=i.created_at.isoformat() if i.created_at else "",
        ) for i in items],
        total=len(items),
    )


@router.post("/ip-whitelist", response_model=IpEntryOut, status_code=status.HTTP_201_CREATED)
async def add_to_whitelist(
    data: IpEntryCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("super_admin")),
):
    """Add an IP to the global whitelist. Syncs to Kamailio htable."""
    entry = GlobalIpWhitelist(
        ip_address=data.ip_address.strip(),
        description=data.description,
        created_by=user.id,
    )
    db.add(entry)
    try:
        await db.commit()
        await db.refresh(entry)
    except Exception:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"IP '{data.ip_address}' is already whitelisted",
        )

    # Sync to Kamailio htable
    await kamailio_service.whitelist_ip(entry.ip_address)
    # Also remove from blacklist if present
    await kamailio_service.unblacklist_ip(entry.ip_address)

    return IpEntryOut(
        id=str(entry.id),
        ip_address=entry.ip_address,
        description=entry.description,
        created_at=entry.created_at.isoformat() if entry.created_at else "",
    )


@router.delete("/ip-whitelist/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_from_whitelist(
    entry_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("super_admin")),
):
    """Remove an IP from the global whitelist."""
    result = await db.execute(
        select(GlobalIpWhitelist).where(GlobalIpWhitelist.id == entry_id)
    )
    entry = result.scalar_one_or_none()
    if entry is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Entry not found")

    ip = entry.ip_address
    await db.delete(entry)
    await db.commit()

    # Remove from Kamailio htable
    await kamailio_service.unwhitelist_ip(ip)


# ── Global Blacklist (manual permanent bans) ──

@router.get("/ip-blacklist", response_model=BlacklistList)
async def get_blacklist(
    user: User = Depends(require_role("super_admin")),
):
    """List all IPs in the Kamailio blacklist (pike auto + manual)."""
    result = await kamailio_service.dump_blacklist()
    if result is None:
        return BlacklistList(entries=[], total=0)

    entries = []
    if "result" in result:
        for slot in result["result"]:
            if "slot" in slot:
                for item in slot["slot"]:
                    entries.append(BlacklistEntryOut(
                        ip=item.get("name", ""),
                        value=str(item.get("value", "")),
                    ))

    return BlacklistList(entries=entries, total=len(entries))


@router.post("/ip-blacklist", status_code=status.HTTP_201_CREATED)
async def add_to_blacklist(
    data: IpEntryCreate,
    user: User = Depends(require_role("super_admin")),
):
    """Manually blacklist an IP in Kamailio."""
    ip = data.ip_address.strip()
    success = await kamailio_service.blacklist_ip(ip)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to sync with Kamailio",
        )
    return {"ip": ip, "status": "blacklisted"}


@router.delete("/ip-blacklist/{ip}")
async def remove_from_blacklist(
    ip: str,
    user: User = Depends(require_role("super_admin")),
):
    """Remove an IP from the Kamailio blacklist."""
    success = await kamailio_service.unblacklist_ip(ip)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to sync with Kamailio",
        )
    return {"ip": ip, "status": "removed"}
