"""
Event logging service — helper to create tenant events from other services.

Uses a separate DB session so event logging failures never break
the caller's transaction (e.g. extension creation).
"""

import logging
import uuid

from app.database import async_session
from app.models.tenant_event import TenantEvent

logger = logging.getLogger(__name__)


async def log_event(
    db,  # accepted for API compat but not used — we create our own session
    tenant_id: uuid.UUID,
    action: str,
    source: str | None = None,
    ip: str | None = None,
    extension: str | None = None,
    details: dict | None = None,
) -> None:
    """
    Log a tenant event in a separate session.
    Failures are logged but never propagated to the caller.
    """
    try:
        async with async_session() as session:
            event = TenantEvent(
                tenant_id=tenant_id,
                action=action,
                source=source,
                ip=ip,
                extension=extension,
                details=details,
            )
            session.add(event)
            await session.commit()
    except Exception as exc:
        logger.warning("Failed to log event '%s' for tenant %s: %s", action, tenant_id, exc)
