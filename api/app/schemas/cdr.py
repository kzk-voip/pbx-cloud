"""
CDR schemas — Pydantic request/response models for CDR queries.
"""

import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class CDRResponse(BaseModel):
    id: int
    tenant_id: uuid.UUID | None
    calldate: datetime
    clid: str | None
    src: str | None
    dst: str | None
    dcontext: str | None
    channel: str | None
    dstchannel: str | None
    lastapp: str | None
    duration: int
    billsec: int
    disposition: str | None
    accountcode: str | None
    uniqueid: str | None

    model_config = {"from_attributes": True}


class CDRListResponse(BaseModel):
    items: list[CDRResponse]
    total: int
    page: int
    per_page: int
    pages: int
