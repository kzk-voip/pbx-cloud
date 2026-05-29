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
    allow_international: bool = Field(False, description="Allow international calls (00/011 prefix)")
    recordings_cleanup_days: int = Field(0, ge=0, le=3650)
    recordings_cleanup_pct: int = Field(0, ge=0, le=100)
    recordings_storage_limit_mb: int = Field(100, ge=1, le=100000)


class TenantUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=100)
    max_extensions: int | None = Field(None, ge=1, le=1000)
    max_concurrent_calls: int | None = Field(None, ge=1, le=500)
    codecs: str | None = Field(None, max_length=200)
    is_active: bool | None = None
    allow_international: bool | None = None
    recordings_cleanup_days: int | None = Field(None, ge=0, le=3650)
    recordings_cleanup_pct: int | None = Field(None, ge=0, le=100)
    recordings_storage_limit_mb: int | None = Field(None, ge=1, le=100000)


class TenantResponse(BaseModel):
    id: uuid.UUID
    slug: str
    domain: str
    name: str
    max_extensions: int
    max_concurrent_calls: int
    codecs: str
    is_active: bool
    allow_international: bool
    recordings_cleanup_days: int
    recordings_cleanup_pct: int
    recordings_storage_limit_mb: int
    recordings_storage_used_bytes: int = 0
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
