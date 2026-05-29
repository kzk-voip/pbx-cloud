"""
User schemas — Pydantic request/response models for user management.
"""

import uuid
from datetime import datetime
from pydantic import BaseModel, Field


class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=80, examples=["john_doe"])
    password: str = Field(..., min_length=6, max_length=128, examples=["secretpass"])
    role: str = Field(..., examples=["user"])  # tenant_admin or user
    extension_id: uuid.UUID | None = Field(None)
    is_active: bool = Field(True)


class UserUpdate(BaseModel):
    username: str | None = Field(None, min_length=3, max_length=80)
    password: str | None = Field(None, min_length=6, max_length=128)
    role: str | None = Field(None)
    extension_id: uuid.UUID | None = Field(None)
    is_active: bool | None = Field(None)


class UserResponse(BaseModel):
    id: uuid.UUID
    username: str
    role: str
    tenant_id: uuid.UUID | None
    is_active: bool
    created_at: datetime
    extension_id: uuid.UUID | None = None
    extension_number: str | None = None

    model_config = {"from_attributes": True}


class UserListResponse(BaseModel):
    items: list[UserResponse]
    total: int
