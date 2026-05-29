"""
Inbound Rule service — business logic for inbound DID routing rules.
"""

import uuid

from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tenant import Tenant
from app.models.inbound_rule import InboundRule
from app.schemas.inbound_rule import (
    InboundRuleCreate,
    InboundRuleUpdate,
    InboundRuleResponse,
    InboundRuleListResponse,
)
from app.services import event_service


async def create_rule(
    db: AsyncSession, tenant_id: uuid.UUID, data: InboundRuleCreate
) -> InboundRuleResponse:
    tenant_result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    if tenant_result.scalar_one_or_none() is None:
        raise ValueError("Tenant not found")

    rule = InboundRule(
        tenant_id=tenant_id,
        did_number=data.did_number,
        destination_type=data.destination_type,
        destination_value=data.destination_value,
        priority=data.priority,
        enabled=data.enabled,
    )
    db.add(rule)
    await event_service.log_event(
        db, tenant_id, "inbound_rule_created", source="api",
        details={"did": data.did_number, "dest": f"{data.destination_type}:{data.destination_value}"},
    )
    await db.commit()
    await db.refresh(rule)
    return InboundRuleResponse.model_validate(rule)


async def list_rules(
    db: AsyncSession, tenant_id: uuid.UUID
) -> InboundRuleListResponse:
    result = await db.execute(
        select(InboundRule)
        .where(InboundRule.tenant_id == tenant_id)
        .order_by(InboundRule.priority.asc(), InboundRule.did_number)
    )
    rules = result.scalars().all()
    items = [InboundRuleResponse.model_validate(r) for r in rules]
    return InboundRuleListResponse(items=items, total=len(items))


async def update_rule(
    db: AsyncSession, tenant_id: uuid.UUID, rule_id: uuid.UUID, data: InboundRuleUpdate
) -> InboundRuleResponse | None:
    result = await db.execute(
        select(InboundRule).where(InboundRule.id == rule_id, InboundRule.tenant_id == tenant_id)
    )
    rule = result.scalar_one_or_none()
    if rule is None:
        return None

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(rule, field, value)

    await db.commit()
    await db.refresh(rule)
    return InboundRuleResponse.model_validate(rule)


async def delete_rule(
    db: AsyncSession, tenant_id: uuid.UUID, rule_id: uuid.UUID
) -> bool:
    result = await db.execute(
        select(InboundRule).where(InboundRule.id == rule_id, InboundRule.tenant_id == tenant_id)
    )
    rule = result.scalar_one_or_none()
    if rule is None:
        return False

    await db.execute(delete(InboundRule).where(InboundRule.id == rule_id))
    await event_service.log_event(
        db, tenant_id, "inbound_rule_deleted", source="api",
        details={"did": rule.did_number},
    )
    await db.commit()
    return True
