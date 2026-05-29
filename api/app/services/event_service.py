"""
Event logging service — helper to create tenant events from other services.
"""

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.context import client_ip_var
from app.models.tenant_event import TenantEvent


async def log_event(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    action: str,
    source: str | None = None,
    ip: str | None = None,
    extension: str | None = None,
    details: dict | None = None,
) -> None:
    """Log a tenant event. Does not commit — caller should commit."""
    if ip is None:
        ip = client_ip_var.get()

    event = TenantEvent(
        tenant_id=tenant_id,
        action=action,
        source=source,
        ip=ip,
        extension=extension,
        details=details,
    )
    db.add(event)
