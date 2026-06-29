"""
TenantEvent ORM model — tracks tenant-level actions (login, config change, etc.).
"""

import uuid
from datetime import datetime

from sqlalchemy import BigInteger, DateTime, ForeignKey, String, text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class TenantEvent(Base):
    __tablename__ = "tenant_events"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()"), index=True,
    )
    action: Mapped[str] = mapped_column(String(50), nullable=False)
    source: Mapped[str | None] = mapped_column(String(20))  # sip / web / api
    ip: Mapped[str | None] = mapped_column(String(45))
    extension: Mapped[str | None] = mapped_column(String(40))
    details: Mapped[dict | None] = mapped_column(JSONB)

    def __repr__(self) -> str:
        return f"<TenantEvent {self.action} tenant={self.tenant_id}>"
