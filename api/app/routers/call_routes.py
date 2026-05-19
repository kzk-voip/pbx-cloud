"""
Call Routes router — CRUD API for outbound dialplan routes.
"""

import uuid
import re

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.dependencies.auth import require_role
from app.dependencies.database import get_db
from app.models.user import User
from app.schemas.call_route import (
    CallRouteCreate,
    CallRouteUpdate,
    CallRouteResponse,
    CallRouteListResponse,
)
from app.services import call_route_service
from app.models.call_route import CallRoute
from app.models.trunk import Trunk

router = APIRouter(prefix="/tenants/{tenant_id}/call-routes", tags=["Call Routes"])


def _check_tenant_access(user: User, tenant_id: uuid.UUID) -> None:
    if user.role == "tenant_admin" and user.tenant_id != tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied",
        )
    if user.role == "user":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions",
        )


@router.post("", response_model=CallRouteResponse, status_code=status.HTTP_201_CREATED)
async def create_route(
    tenant_id: uuid.UUID,
    data: CallRouteCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("super_admin", "tenant_admin")),
):
    _check_tenant_access(user, tenant_id)
    # Check if trunk exists and belongs to the same tenant
    trunk_result = await db.execute(
        select(Trunk).where(Trunk.tenant_id == tenant_id, Trunk.id == data.trunk_id)
    )
    if not trunk_result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Trunk not found")
    
    return await call_route_service.create_route(db, tenant_id, data)


@router.get("", response_model=CallRouteListResponse)
async def list_routes(
    tenant_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("super_admin", "tenant_admin")),
):
    _check_tenant_access(user, tenant_id)
    routes = await call_route_service.list_routes(db, tenant_id)
    return {"items": routes}


@router.put("/{route_id}", response_model=CallRouteResponse)
async def update_route(
    tenant_id: uuid.UUID,
    route_id: uuid.UUID,
    data: CallRouteUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("super_admin", "tenant_admin")),
):
    _check_tenant_access(user, tenant_id)
    if data.trunk_id is not None:
        trunk_result = await db.execute(
            select(Trunk).where(Trunk.tenant_id == tenant_id, Trunk.id == data.trunk_id)
        )
        if not trunk_result.scalar_one_or_none():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Trunk not found")

    route = await call_route_service.update_route(db, tenant_id, route_id, data)
    if route is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Route not found")
    return route


@router.delete("/{route_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_route(
    tenant_id: uuid.UUID,
    route_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("super_admin", "tenant_admin")),
):
    _check_tenant_access(user, tenant_id)
    deleted = await call_route_service.delete_route(db, tenant_id, route_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Route not found")


@router.get("/lookup/action")
async def lookup_outbound_route(
    tenant_id: uuid.UUID,
    number: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Internal endpoint for Asterisk dialplan to lookup outbound routing.
    Matches standard Asterisk patterns or prefixes.
    Returns: "trunk_name:prefix_strip:prefix_add" or "none"
    """
    # Fetch all enabled routes for the tenant
    result = await db.execute(
        select(CallRoute)
        .where(CallRoute.tenant_id == tenant_id, CallRoute.enabled == True)
        .order_by(CallRoute.priority.asc())
    )
    routes = result.scalars().all()

    # Simple pattern matching helper (converting Asterisk pattern to regex)
    # Asterisk rules:
    # _X matches any digit 0-9
    # _Z matches any digit 1-9
    # _N matches any digit 2-9
    # . matches one or more characters
    # [1-5] matches range
    def matches_asterisk_pattern(pattern: str, test_str: str) -> bool:
        # Strip leading underscore which denotes an Asterisk pattern
        p = pattern[1:] if pattern.startswith("_") else pattern
        
        # Escape for regex except special characters
        regex_parts = []
        i = 0
        while i < len(p):
            char = p[i]
            if char == ".":
                regex_parts.append(".+")
            elif char == "X":
                regex_parts.append("[0-9]")
            elif char == "Z":
                regex_parts.append("[1-9]")
            elif char == "N":
                regex_parts.append("[2-9]")
            elif char == "[":
                # find matching ]
                end_idx = p.find("]", i)
                if end_idx != -1:
                    regex_parts.append(p[i:end_idx+1])
                    i = end_idx
                else:
                    regex_parts.append("\\[")
            else:
                regex_parts.append(re.escape(char))
            i += 1
        
        regex_str = "^" + "".join(regex_parts) + "$"
        try:
            return bool(re.match(regex_str, test_str))
        except Exception:
            return False

    for route in routes:
        if matches_asterisk_pattern(route.pattern, number):
            # Load trunk to get its name
            trunk_res = await db.execute(select(Trunk).where(Trunk.id == route.trunk_id))
            trunk = trunk_res.scalar_one_or_none()
            if trunk and trunk.enabled:
                return f"{trunk.name}:{route.prefix_strip}:{route.prefix_add}"

    return "none"
