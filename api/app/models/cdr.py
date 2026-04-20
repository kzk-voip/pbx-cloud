"""
CDR ORM model — maps to existing 'cdr' table.
"""

import uuid
from datetime import datetime

from sqlalchemy import BigInteger, DateTime, ForeignKey, Integer, String, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class CDR(Base):
    __tablename__ = "cdr"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    tenant_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id"),
    )
    calldate: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))
    clid: Mapped[str | None] = mapped_column(String(80))
    src: Mapped[str | None] = mapped_column(String(80))
    dst: Mapped[str | None] = mapped_column(String(80))
    dcontext: Mapped[str | None] = mapped_column(String(80))
    channel: Mapped[str | None] = mapped_column(String(80))
    dstchannel: Mapped[str | None] = mapped_column(String(80))
    lastapp: Mapped[str | None] = mapped_column(String(80))
    lastdata: Mapped[str | None] = mapped_column(String(200))
    duration: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    billsec: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    disposition: Mapped[str | None] = mapped_column(String(45))
    amaflags: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    accountcode: Mapped[str | None] = mapped_column(String(20))
    uniqueid: Mapped[str | None] = mapped_column(String(150))
    userfield: Mapped[str | None] = mapped_column(String(255))
    peeraccount: Mapped[str | None] = mapped_column(String(80))
    linkedid: Mapped[str | None] = mapped_column(String(150))
    sequence: Mapped[int | None] = mapped_column(Integer)

    def __repr__(self) -> str:
        return f"<CDR {self.src} -> {self.dst} ({self.disposition})>"
