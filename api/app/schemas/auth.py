"""
Auth schemas — Pydantic request/response models for authentication.
"""

import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    username: str = Field(..., min_length=1, max_length=80, examples=["admin"])
    password: str = Field(..., min_length=1, max_length=128, examples=["admin"])


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


class UserResponse(BaseModel):
    id: uuid.UUID
    username: str
    role: str
    tenant_id: uuid.UUID | None
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(..., min_length=1, max_length=128)
    new_password: str = Field(..., min_length=8, max_length=128)

