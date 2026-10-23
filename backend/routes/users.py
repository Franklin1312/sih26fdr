"""User routes."""

from fastapi import APIRouter, Depends, HTTPException, status, Header
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db
from backend.services.auth import auth_service, hash_password
from backend.services.access_control import access_control, UserContext
from backend.schemas.institution import UserCreate, UserUpdate, UserResponse, CurrentUserResponse
from backend.schemas.common import PaginationParams, PaginatedResponse
from backend.models import User
from backend.models.enums import UserRole
from sqlalchemy import select, func

router = APIRouter()


async def get_current_user(authorization: str = Header(None)):
    try:
        user = await auth_service.get_current_user(authorization)
        access_control.register_user(user)
        return user
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))


async def get_user_context(current_user: CurrentUserResponse = Depends(get_current_user)) -> UserContext:
    return UserContext(
        user_id=current_user.user_id,
        email=current_user.email,
        full_name=current_user.full_name,
        roles={current_user.role} if current_user.role else set(),
        institution_id=current_user.institution_id,
    )


@router.post("/users", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    user_data: UserCreate,
    db: AsyncSession = Depends(get_db),
    user: UserContext = Depends(get_user_context),
):
    if not access_control.require_permission(user, "user:create"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
    
    existing = await db.execute(select(User).where(User.email == user_data.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")
    
    hashed_password = hash_password(user_data.password)
    
    user_obj = User(
        email=user_data.email,
        full_name=user_data.full_name,
        role=user_data.role,
        institution_id=user_data.institution_id,
        password_hash=hashed_password,
    )
    db.add(user_obj)
    await db.commit()
    await db.refresh(user_obj)
    return user_obj


@router.get("/users", response_model=PaginatedResponse[UserResponse])
async def list_users(
    params: PaginationParams = Depends(),
    db: AsyncSession = Depends(get_db),
    user: UserContext = Depends(get_user_context),
):
    if not access_control.require_permission(user, "user:read"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
    
    query = select(User)
    if UserRole.INSTITUTION_REP in user.roles:
        query = query.where(User.institution_id == user.institution_id)
    
    total_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = total_result.scalar() or 0
    
    query = query.offset(params.offset).limit(params.limit)
    result = await db.execute(query)
    users = result.scalars().all()
    
    return PaginatedResponse(items=list(users), total=total, page=params.page, page_size=params.page_size, total_pages=(total + params.page_size - 1) // params.page_size)


@router.get("/users/me", response_model=CurrentUserResponse)
async def get_current_user_info(current_user: CurrentUserResponse = Depends(get_current_user)):
    return current_user


@router.get("/users/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    user: UserContext = Depends(get_user_context),
):
    target_user = await db.get(User, user_id)
    if not target_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    
    if UserRole.INSTITUTION_REP in user.roles and user.institution_id != target_user.institution_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot access user from other institution")
    
    return target_user


@router.patch("/users/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: str,
    user_data: UserUpdate,
    db: AsyncSession = Depends(get_db),
    user: UserContext = Depends(get_user_context),
):
    target_user = await db.get(User, user_id)
    if not target_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    
    if not access_control.require_permission(user, "user:update"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
    
    update_data = user_data.model_dump(exclude_unset=True)
    if "password" in update_data:
        update_data["password_hash"] = hash_password(update_data.pop("password"))
    
    for field, value in update_data.items():
        setattr(target_user, field, value)
    
    await db.commit()
    await db.refresh(target_user)
    return target_user