"""
RingGroup and RingGroupMember ORM models — maps to 'ring_groups' and 'ring_group_members' tables.
"""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class RingGroup(Base):
    __tablename__ = "ring_groups"

    __table_args__ = (
        UniqueConstraint("tenant_id", "number", name="uq_tenant_ring_group_number"),
    )

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
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    number: Mapped[str] = mapped_column(String(20), nullable=False)
    strategy: Mapped[str] = mapped_column(String(50), nullable=False, server_default="ringall", default="ringall")
    timeout: Mapped[int] = mapped_column(Integer, nullable=False, server_default="30", default=30)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )

    # Relationships
    tenant = relationship("Tenant")
    members = relationship(
        "RingGroupMember",
        back_populates="ring_group",
        cascade="all, delete-orphan",
        passive_deletes=True,
        lazy="selectin",
        order_by="RingGroupMember.priority.asc()",
    )


class RingGroupMember(Base):
    __tablename__ = "ring_group_members"

    __table_args__ = (
        UniqueConstraint("ring_group_id", "extension_id", name="uq_ring_group_extension"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    ring_group_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("ring_groups.id", ondelete="CASCADE"),
        nullable=False,
    )
    extension_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("extensions.id", ondelete="CASCADE"),
        nullable=False,
    )
    priority: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0", default=0)

    # Relationships
    ring_group = relationship("RingGroup", back_populates="members")
    extension = relationship("Extension", lazy="selectin")
