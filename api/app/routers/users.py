"""
Users router — CRUD API for web users management.
"""

import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.auth import get_current_user, require_role
from app.dependencies.database import get_db
from app.models.user import User
from app.models.extension import Extension
from app.schemas.user import UserCreate, UserUpdate, UserResponse, UserListResponse
from app.services.auth_service import hash_password

router = APIRouter(prefix="/tenants/{tenant_id}/users", tags=["Users"])


def _check_tenant_access(current_user: User, tenant_id: uuid.UUID) -> None:
    if current_user.role == "tenant_admin" and current_user.tenant_id != tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied — you can only manage users of your own tenant",
        )
    if current_user.role == "user":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions",
        )


@router.get("", response_model=UserListResponse)
async def list_users(
    tenant_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("super_admin", "tenant_admin")),
):
    """
    List all users for a tenant.
    """
    _check_tenant_access(current_user, tenant_id)

    query = (
        select(User, Extension.extension_number)
        .outerjoin(Extension, User.extension_id == Extension.id)
        .where(User.tenant_id == tenant_id)
        .order_by(User.created_at.desc())
    )
    result = await db.execute(query)
    
    items = []
    for row in result.all():
        user_obj, ext_num = row
        items.append(
            UserResponse(
                id=user_obj.id,
                username=user_obj.username,
                role=user_obj.role,
                tenant_id=user_obj.tenant_id,
                is_active=user_obj.is_active,
                created_at=user_obj.created_at,
                extension_id=user_obj.extension_id,
                extension_number=ext_num,
            )
        )
    return UserListResponse(items=items, total=len(items))


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    tenant_id: uuid.UUID,
    data: UserCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("super_admin", "tenant_admin")),
):
    """
    Create a new web user account.
    """
    _check_tenant_access(current_user, tenant_id)

    # Check username uniqueness system-wide
    uniq_query = select(User).where(User.username == data.username)
    existing = await db.execute(uniq_query)
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username already exists",
        )

    # Check extension belongs to tenant
    if data.extension_id:
        ext_query = select(Extension).where(
            Extension.id == data.extension_id, Extension.tenant_id == tenant_id
        )
        ext_res = await db.execute(ext_query)
        if not ext_res.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Linked extension not found or does not belong to this tenant",
            )

    new_user = User(
        tenant_id=tenant_id,
        username=data.username,
        password_hash=hash_password(data.password),
        role=data.role,
        extension_id=data.extension_id,
        is_active=data.is_active,
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)

    # Load extension number if set
    ext_num = None
    if new_user.extension_id:
        ext_num_query = select(Extension.extension_number).where(
            Extension.id == new_user.extension_id
        )
        ext_num_res = await db.execute(ext_num_query)
        ext_num = ext_num_res.scalar_one_or_none()

    return UserResponse(
        id=new_user.id,
        username=new_user.username,
        role=new_user.role,
        tenant_id=new_user.tenant_id,
        is_active=new_user.is_active,
        created_at=new_user.created_at,
        extension_id=new_user.extension_id,
        extension_number=ext_num,
    )


@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    tenant_id: uuid.UUID,
    user_id: uuid.UUID,
    data: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("super_admin", "tenant_admin")),
):
    """
    Update an existing user account.
    """
    _check_tenant_access(current_user, tenant_id)

    user_query = select(User).where(User.id == user_id, User.tenant_id == tenant_id)
    res = await db.execute(user_query)
    db_user = res.scalar_one_or_none()
    if not db_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    # Validate username uniqueness
    if data.username and data.username != db_user.username:
        uniq_query = select(User).where(User.username == data.username)
        existing = await db.execute(uniq_query)
        if existing.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Username already exists",
            )
        db_user.username = data.username

    # Update password if provided
    if data.password:
        db_user.password_hash = hash_password(data.password)

    # Update role if provided
    if data.role:
        if data.role not in ["tenant_admin", "user"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid role. Must be 'tenant_admin' or 'user'",
            )
        db_user.role = data.role

    # Update extension if provided
    if data.extension_id is not None:
        if data.extension_id:
            ext_query = select(Extension).where(
                Extension.id == data.extension_id, Extension.tenant_id == tenant_id
            )
            ext_res = await db.execute(ext_query)
            if not ext_res.scalar_one_or_none():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Linked extension not found or does not belong to this tenant",
                )
        db_user.extension_id = data.extension_id

    # Update status if provided
    if data.is_active is not None:
        db_user.is_active = data.is_active

    await db.commit()
    await db.refresh(db_user)

    # Load extension number if set
    ext_num = None
    if db_user.extension_id:
        ext_num_query = select(Extension.extension_number).where(
            Extension.id == db_user.extension_id
        )
        ext_num_res = await db.execute(ext_num_query)
        ext_num = ext_num_res.scalar_one_or_none()

    return UserResponse(
        id=db_user.id,
        username=db_user.username,
        role=db_user.role,
        tenant_id=db_user.tenant_id,
        is_active=db_user.is_active,
        created_at=db_user.created_at,
        extension_id=db_user.extension_id,
        extension_number=ext_num,
    )


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    tenant_id: uuid.UUID,
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("super_admin", "tenant_admin")),
):
    """
    Delete a user account.
    """
    _check_tenant_access(current_user, tenant_id)

    if current_user.id == user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot delete your own account",
        )

    user_query = select(User).where(User.id == user_id, User.tenant_id == tenant_id)
    res = await db.execute(user_query)
    db_user = res.scalar_one_or_none()
    if not db_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    await db.delete(db_user)
    await db.commit()
