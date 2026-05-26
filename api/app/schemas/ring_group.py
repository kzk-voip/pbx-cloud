"""
RingGroup schemas — Pydantic request/response models for Ring Group management.
"""

import uuid
from datetime import datetime
from pydantic import BaseModel, Field


class RingGroupMemberSchema(BaseModel):
    extension_id: uuid.UUID
    extension_number: str
    display_name: str | None = None
    priority: int


class RingGroupBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100, examples=["Sales Department"])
    number: str = Field(..., min_length=1, max_length=20, pattern=r"^\d+$", examples=["600"])
    strategy: str = Field("ringall", examples=["ringall"])  # ringall, roundrobin, random
    timeout: int = Field(30, ge=5, le=120)


class RingGroupCreate(RingGroupBase):
    member_ids: list[uuid.UUID] = []  # Ordered list of extension IDs to link


class RingGroupUpdate(RingGroupBase):
    member_ids: list[uuid.UUID] = []  # Ordered list of extension IDs to link


class RingGroupResponse(RingGroupBase):
    id: uuid.UUID
    tenant_id: uuid.UUID
    created_at: datetime
    members: list[RingGroupMemberSchema] = []

    model_config = {"from_attributes": True}


class RingGroupListResponse(BaseModel):
    items: list[RingGroupResponse]
    total: int
