"""
Tenant schemas — Pydantic request/response models for tenant management.
"""

import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class TenantCreate(BaseModel):
    slug: str = Field(..., min_length=2, max_length=40, pattern=r"^[a-z0-9_]+$",
                      examples=["stark"], description="Unique identifier (lowercase, no spaces)")
    domain: str = Field(..., min_length=3, max_length=80,
                        examples=["stark.pbx.local"], description="SIP domain for this tenant")
    name: str = Field(..., min_length=1, max_length=100,
                      examples=["Stark Industries"], description="Display name")
    max_extensions: int = Field(10, ge=1, le=1000)
    max_concurrent_calls: int = Field(5, ge=1, le=500)
    codecs: str = Field("ulaw,alaw", max_length=200)


class TenantUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=100)
    max_extensions: int | None = Field(None, ge=1, le=1000)
    max_concurrent_calls: int | None = Field(None, ge=1, le=500)
    codecs: str | None = Field(None, max_length=200)
    is_active: bool | None = None


class TenantResponse(BaseModel):
    id: uuid.UUID
    slug: str
    domain: str
    name: str
    max_extensions: int
    max_concurrent_calls: int
    codecs: str
    is_active: bool
    created_at: datetime
    updated_at: datetime
    extension_count: int = 0

    model_config = {"from_attributes": True}


class TenantListResponse(BaseModel):
    items: list[TenantResponse]
    total: int
    page: int
    per_page: int
    pages: int
