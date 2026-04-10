"""
Tenant ORM model — maps to existing 'tenants' table.
"""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, String, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Tenant(Base):
    __tablename__ = "tenants"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    slug: Mapped[str] = mapped_column(String(40), unique=True, nullable=False)
    domain: Mapped[str] = mapped_column(String(80), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    max_extensions: Mapped[int] = mapped_column(Integer, nullable=False, server_default="10")
    max_concurrent_calls: Mapped[int] = mapped_column(Integer, nullable=False, server_default="5")
    codecs: Mapped[str] = mapped_column(String(200), nullable=False, server_default="ulaw,alaw")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))

    # Relationships
    extensions = relationship("Extension", back_populates="tenant", cascade="all, delete-orphan")
    trunks = relationship("Trunk", back_populates="tenant", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Tenant {self.slug} ({self.domain})>"
