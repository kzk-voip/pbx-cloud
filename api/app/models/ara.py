"""
ARA (Asterisk Realtime Architecture) ORM models.

Maps ps_endpoints, ps_auths, ps_aors tables.
These are read/written by both Asterisk and the API.
Only columns actively used by our project are mapped as typed fields;
the rest are handled by Asterisk directly.
"""

import uuid

from sqlalchemy import Boolean, Float, Integer, String, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class PjsipEndpoint(Base):
    __tablename__ = "ps_endpoints"

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    tenant_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE")
    )
    transport: Mapped[str | None] = mapped_column(String(40))
    aors: Mapped[str | None] = mapped_column(String(200))
    auth: Mapped[str | None] = mapped_column(String(40))
    context: Mapped[str | None] = mapped_column(String(40))
    disallow: Mapped[str | None] = mapped_column(String(200))
    allow: Mapped[str | None] = mapped_column(String(200))
    direct_media: Mapped[bool | None] = mapped_column(Boolean)
    force_rport: Mapped[bool | None] = mapped_column(Boolean)
    rewrite_contact: Mapped[bool | None] = mapped_column(Boolean)
    rtp_symmetric: Mapped[bool | None] = mapped_column(Boolean)
    dtmf_mode: Mapped[str | None] = mapped_column(String(20))
    callerid: Mapped[str | None] = mapped_column(String(40))

    def __repr__(self) -> str:
        return f"<PjsipEndpoint {self.id}>"


class PjsipAuth(Base):
    __tablename__ = "ps_auths"

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    tenant_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE")
    )
    auth_type: Mapped[str | None] = mapped_column(String(20))
    username: Mapped[str | None] = mapped_column(String(40))
    password: Mapped[str | None] = mapped_column(String(80))
    realm: Mapped[str | None] = mapped_column(String(40))

    def __repr__(self) -> str:
        return f"<PjsipAuth {self.id}>"


class PjsipAor(Base):
    __tablename__ = "ps_aors"

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    tenant_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE")
    )
    max_contacts: Mapped[int | None] = mapped_column(Integer)
    support_path: Mapped[bool | None] = mapped_column(Boolean)
    qualify_frequency: Mapped[int | None] = mapped_column(Integer)
    qualify_timeout: Mapped[float | None] = mapped_column(Float)
    minimum_expiration: Mapped[int | None] = mapped_column(Integer)
    maximum_expiration: Mapped[int | None] = mapped_column(Integer)
    default_expiration: Mapped[int | None] = mapped_column(Integer)

    def __repr__(self) -> str:
        return f"<PjsipAor {self.id}>"
