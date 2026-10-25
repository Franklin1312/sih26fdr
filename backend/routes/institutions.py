"""Institution routes."""

from fastapi import APIRouter, Depends, HTTPException, status, Header
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from backend.database import get_db
from backend.services.auth import auth_service
from backend.services.access_control import access_control, UserContext
from backend.schemas.institution import (
    InstitutionCreate,
    InstitutionUpdate,
    InstitutionResponse,
    InstitutionWithStats,
    CurrentUserResponse,
)
from backend.schemas.common import PaginationParams, PaginatedResponse
from backend.models import Institution
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


@router.post("", response_model=InstitutionResponse, status_code=status.HTTP_201_CREATED)
async def create_institution(
    institution_data: InstitutionCreate,
    db: AsyncSession = Depends(get_db),
    user: UserContext = Depends(get_user_context),
):
    if not access_control.require_permission(user, "institution:create"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
    
    existing = await db.execute(select(Institution).where(Institution.code == institution_data.code))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Institution code already exists")
    
    institution = Institution(**institution_data.model_dump())
    db.add(institution)
    await db.commit()
    await db.refresh(institution)
    return institution


@router.get("", response_model=PaginatedResponse[InstitutionResponse])
async def list_institutions(
    params: PaginationParams = Depends(),
    db: AsyncSession = Depends(get_db),
    user: UserContext = Depends(get_user_context),
):
    if not access_control.require_permission(user, "institution:read"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
    
    query = select(Institution)
    if params.search:
        query = query.where(Institution.name.ilike(f"%{params.search}%"))
    
    total_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = total_result.scalar() or 0
    
    query = query.offset(params.offset).limit(params.limit)
    result = await db.execute(query)
    institutions = result.scalars().all()
    
    return PaginatedResponse(
        items=list(institutions),
        total=total,
        page=params.page,
        page_size=params.page_size,
        total_pages=(total + params.page_size - 1) // params.page_size,
    )


@router.get("/{institution_id}", response_model=InstitutionWithStats)
async def get_institution(
    institution_id: str,
    db: AsyncSession = Depends(get_db),
    user: UserContext = Depends(get_user_context),
):
    institution = await db.get(Institution, institution_id)
    if not institution:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Institution not found")
    
    if UserRole.INSTITUTION_REP in user.roles and user.institution_id != institution_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot access other institution")
    
    from backend.models import DepositCase
    from backend.models.enums import CaseStatus
    
    total_cases_result = await db.execute(select(func.count(DepositCase.id)).where(DepositCase.institution_id == institution_id))
    total_cases = total_cases_result.scalar() or 0
    
    active_cases_result = await db.execute(select(func.count(DepositCase.id)).where(DepositCase.institution_id == institution_id, DepositCase.status.not_in([CaseStatus.RELEASED, CaseStatus.REJECTED, CaseStatus.CLOSED])))
    active_cases = active_cases_result.scalar() or 0
    
    released_cases_result = await db.execute(select(func.count(DepositCase.id)).where(DepositCase.institution_id == institution_id, DepositCase.status == CaseStatus.RELEASED))
    released_cases = released_cases_result.scalar() or 0
    
    response = InstitutionWithStats.model_validate(institution)
    response.total_cases = total_cases
    response.active_cases = active_cases
    response.released_cases = released_cases
    return response


@router.patch("/{institution_id}", response_model=InstitutionResponse)
async def update_institution(
    institution_id: str,
    institution_data: InstitutionUpdate,
    db: AsyncSession = Depends(get_db),
    user: UserContext = Depends(get_user_context),
):
    institution = await db.get(Institution, institution_id)
    if not institution:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Institution not found")
    
    if not access_control.require_permission(user, "institution:update"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
    
    update_data = institution_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(institution, field, value)
    
    await db.commit()
    await db.refresh(institution)
    return institution