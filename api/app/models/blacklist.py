"""
NumberBlacklist — SQLAlchemy model for per-tenant number blocking.
"""

import uuid

from sqlalchemy import Column, String, DateTime, Boolean, ForeignKey, text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID

from app.database import Base


class NumberBlacklist(Base):
    __tablename__ = "number_blacklist"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()"))
    tenant_id = Column(PG_UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    pattern = Column(String(64), nullable=False)
    reason = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=text("NOW()"))
