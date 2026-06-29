"""
Inbound Rule schemas — Pydantic request/response models.
"""

import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class InboundRuleCreate(BaseModel):
    did_number: str = Field(..., min_length=1, max_length=40, examples=["+14155551234"])
    destination_type: str = Field("extension", pattern=r"^(extension|ring_group|voicemail|ivr_menu)$")
    destination_value: str = Field(..., min_length=1, max_length=80, examples=["101"])
    priority: int = Field(10, ge=1, le=100)
    enabled: bool = True


class InboundRuleUpdate(BaseModel):
    did_number: str | None = Field(None, min_length=1, max_length=40)
    destination_type: str | None = Field(None, pattern=r"^(extension|ring_group|voicemail|ivr_menu)$")
    destination_value: str | None = Field(None, min_length=1, max_length=80)
    priority: int | None = Field(None, ge=1, le=100)
    enabled: bool | None = None


class InboundRuleResponse(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    did_number: str
    destination_type: str
    destination_value: str
    priority: int
    enabled: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class InboundRuleListResponse(BaseModel):
    items: list[InboundRuleResponse]
    total: int
