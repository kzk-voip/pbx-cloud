"""
Trunk schemas — Pydantic request/response models for trunk management.
"""

import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class TrunkCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=80, examples=["voip_provider_1"])
    provider: str | None = Field(None, max_length=80, examples=["Twilio"])
    host: str = Field(..., min_length=1, max_length=255, examples=["sip.provider.com"])
    port: int = Field(5060, ge=1, le=65535)
    transport: str = Field("udp", pattern=r"^(udp|tcp|tls)$")
    username: str | None = Field(None, max_length=80)
    password: str | None = Field(None, max_length=80)
    codecs: str = Field("ulaw,alaw", max_length=200)
    max_channels: int = Field(10, ge=1, le=1000)


class TrunkUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=80)
    provider: str | None = Field(None, max_length=80)
    host: str | None = Field(None, min_length=1, max_length=255)
    port: int | None = Field(None, ge=1, le=65535)
    transport: str | None = Field(None, pattern=r"^(udp|tcp|tls)$")
    username: str | None = None
    password: str | None = None
    codecs: str | None = Field(None, max_length=200)
    max_channels: int | None = Field(None, ge=1, le=1000)
    enabled: bool | None = None


class TrunkResponse(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    name: str
    provider: str | None
    host: str
    port: int
    transport: str
    codecs: str
    max_channels: int
    enabled: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TrunkListResponse(BaseModel):
    items: list[TrunkResponse]
    total: int
