"""
CallRoute ORM model — outbound routing rules for matching dialed patterns.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class CallRoute(Base):
    __tablename__ = "call_routes"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    pattern: Mapped[str] = mapped_column(String(100), nullable=False)  # Asterisk pattern, e.g. _9.
    trunk_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("trunks.id", ondelete="CASCADE"),
        nullable=False,
    )
    prefix_strip: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    prefix_add: Mapped[str] = mapped_column(String(40), nullable=False, server_default="''")
    priority: Mapped[int] = mapped_column(Integer, nullable=False, server_default="10")
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))

    # Relationships
    tenant = relationship("Tenant", back_populates="call_routes")
    trunk = relationship("Trunk")

    def __repr__(self) -> str:
        return f"<CallRoute {self.name} ({self.pattern}) -> Trunk:{self.trunk_id}>"
