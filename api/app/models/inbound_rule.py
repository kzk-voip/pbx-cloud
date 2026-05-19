"""
InboundRule ORM model — DID routing rules for inbound calls.
"""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class InboundRule(Base):
    __tablename__ = "inbound_rules"

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
    did_number: Mapped[str] = mapped_column(String(40), nullable=False)
    destination_type: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default="extension"
    )  # extension, ring_group, voicemail, ivr_menu
    destination_value: Mapped[str] = mapped_column(String(80), nullable=False)
    priority: Mapped[int] = mapped_column(Integer, nullable=False, server_default="10")
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))

    # Relationships
    tenant = relationship("Tenant", back_populates="inbound_rules")

    def __repr__(self) -> str:
        return f"<InboundRule {self.did_number} -> {self.destination_type}:{self.destination_value}>"
