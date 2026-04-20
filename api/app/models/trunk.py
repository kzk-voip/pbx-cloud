"""
Trunk ORM model — maps to existing 'trunks' table.
"""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Trunk(Base):
    __tablename__ = "trunks"

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
    provider: Mapped[str | None] = mapped_column(String(80))
    host: Mapped[str] = mapped_column(String(255), nullable=False)
    port: Mapped[int] = mapped_column(Integer, nullable=False, server_default="5060")
    transport: Mapped[str] = mapped_column(String(10), nullable=False, server_default="udp")
    username: Mapped[str | None] = mapped_column(String(80))
    password: Mapped[str | None] = mapped_column(String(80))
    codecs: Mapped[str] = mapped_column(String(200), nullable=False, server_default="ulaw,alaw")
    max_channels: Mapped[int] = mapped_column(Integer, nullable=False, server_default="10")
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))

    # Relationships
    tenant = relationship("Tenant", back_populates="trunks")

    def __repr__(self) -> str:
        return f"<Trunk {self.name} -> {self.host}:{self.port}>"
