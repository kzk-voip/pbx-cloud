"""
Auth dependencies — JWT extraction, user loading, and role-based access control.
"""

from typing import Sequence

from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.database import get_db
from app.models.user import User
from app.models.tenant_ip_acl import TenantIpAcl
from app.services.auth_service import decode_token

security = HTTPBearer()


async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    Extract JWT from Authorization header, decode it,
    and return the corresponding User from the database.
    """
    token = credentials.credentials
    payload = decode_token(token)

    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Ensure this is an access token, not a refresh token
    if payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
            headers={"WWW-Authenticate": "Bearer"},
        )

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if user.tenant_id:
        await verify_tenant_ip_acl(user.tenant_id, request, db)

    return user


async def verify_tenant_ip_acl(tenant_id, request: Request, db: AsyncSession):
    """
    Check if the request IP is allowed by the tenant's IP ACL.
    If the ACL has entries, the IP must be in the list.
    If the ACL is empty, all IPs are allowed.
    If the table does not exist yet, silently allow.
    """
    import logging
    logger = logging.getLogger(__name__)

    forwarded = request.headers.get("X-Forwarded-For")
    ip = forwarded.split(",")[0].strip() if forwarded else request.client.host

    try:
        # Check if ACL is active (has entries)
        acl_count = await db.scalar(
            select(func.count()).select_from(TenantIpAcl).where(TenantIpAcl.tenant_id == tenant_id)
        )

        if acl_count > 0:
            is_allowed = await db.scalar(
                select(TenantIpAcl).where(
                    TenantIpAcl.tenant_id == tenant_id,
                    TenantIpAcl.ip_address == ip
                )
            )
            if not is_allowed:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="IP Not Authorized for Tenant",
                )
    except HTTPException:
        raise
    except Exception as exc:
        logger.warning("IP ACL check failed (table may not exist): %s", exc)
        # Roll back the failed transaction so subsequent queries work
        await db.rollback()


def require_role(*allowed_roles: str):
    """
    Dependency factory that checks if the current user has one of the allowed roles.

    Usage:
        @router.get("/tenants")
        async def list_tenants(user: User = Depends(require_role("super_admin"))):
            ...
    """
    async def role_checker(
        current_user: User = Depends(get_current_user),
    ) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Insufficient permissions. Required role: {', '.join(allowed_roles)}",
            )
        return current_user

    return role_checker
