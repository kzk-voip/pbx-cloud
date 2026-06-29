"""
Call Route schemas — Pydantic request/response models.
"""

import uuid
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class CallRouteBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=80)
    pattern: str = Field(..., min_length=1, max_length=100)
    trunk_id: uuid.UUID
    prefix_strip: int = Field(0, ge=0)
    prefix_add: str = Field("", max_length=40)
    priority: int = Field(10, ge=1)
    enabled: bool = True


class CallRouteCreate(CallRouteBase):
    pass


class CallRouteUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=80)
    pattern: Optional[str] = Field(None, min_length=1, max_length=100)
    trunk_id: Optional[uuid.UUID] = None
    prefix_strip: Optional[int] = Field(None, ge=0)
    prefix_add: Optional[str] = Field(None, max_length=40)
    priority: Optional[int] = Field(None, ge=1)
    enabled: Optional[bool] = None


class CallRouteResponse(CallRouteBase):
    id: uuid.UUID
    tenant_id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class CallRouteListResponse(BaseModel):
    items: List[CallRouteResponse]

    class Config:
        from_attributes = True
