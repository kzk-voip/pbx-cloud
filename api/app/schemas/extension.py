"""
Extension schemas — Pydantic request/response models for extension management.
"""

import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class ExtensionCreate(BaseModel):
    extension_number: str = Field(..., min_length=1, max_length=10, pattern=r"^\d+$",
                                  examples=["401"], description="Extension number (digits only)")
    display_name: str = Field(..., min_length=1, max_length=100, examples=["Tony Stark"])
    email: str | None = Field(None, max_length=255, examples=["tony@stark.com"])
    password: str | None = Field(None, min_length=8, max_length=128,
                                 description="SIP password. Auto-generated if omitted.")


class ExtensionUpdate(BaseModel):
    display_name: str | None = Field(None, min_length=1, max_length=100)
    email: str | None = Field(None, max_length=255)
    enabled: bool | None = None


class ExtensionResponse(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    extension_number: str
    display_name: str | None
    email: str | None
    enabled: bool
    created_at: datetime
    sip_username: str  # e.g. "stark_401"

    model_config = {"from_attributes": True}


class ExtensionCredentials(BaseModel):
    """Returned on CREATE and password reset — contains SIP credentials."""
    id: uuid.UUID
    extension_number: str
    sip_username: str
    sip_password: str
    sip_domain: str
    display_name: str | None


class ExtensionListResponse(BaseModel):
    items: list[ExtensionResponse]
    total: int
