"""Deposit Case routes."""

from fastapi import APIRouter, Depends, HTTPException, status, Header
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
import os
import shutil
from uuid import uuid4

from backend.database import get_db
from backend.services.auth import auth_service
from backend.services.access_control import access_control, UserContext
from backend.services.case_service import CaseService
from backend.schemas.deposit_case import (
    DepositCaseCreate,
    DepositCaseUpdate,
    DepositCaseStatusUpdate,
    DepositCaseResponse,
    DepositCaseDetail,
    DepositCaseListParams,
    DepositCaseDashboardStats,
)
from backend.schemas.common import PaginationParams, PaginatedResponse
from backend.schemas.institution import CurrentUserResponse

router = APIRouter()


async def get_current_user(authorization: str = Header(None)):
    try:
        user = await auth_service.get_current_user(authorization)
        # Don't re-register user to avoid overwriting institution_id from initial registration
        # The user context is already registered during startup
        return user
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))


async def get_user_context(current_user: CurrentUserResponse = Depends(get_current_user)) -> UserContext:
    # Look up the registered user context which has the correct institution_id
    context = access_control.get_user_context(current_user.user_id)
    if context:
        return context
    # Fallback if not found
    return UserContext(
        user_id=current_user.user_id,
        email=current_user.email,
        full_name=current_user.full_name,
        roles={current_user.role} if current_user.role else set(),
        institution_id=current_user.institution_id,
    )


async def get_case_service(db: AsyncSession = Depends(get_db)) -> CaseService:
    return CaseService(db)


@router.post("", response_model=DepositCaseResponse, status_code=status.HTTP_201_CREATED)
async def create_case(
    case_data: DepositCaseCreate,
    case_service: CaseService = Depends(get_case_service),
    user: UserContext = Depends(get_user_context),
):
    """Create a new deposit case in DRAFT status."""
    try:
        case = await case_service.create_case(case_data, user)
        return case
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))


@router.get("", response_model=PaginatedResponse[DepositCaseResponse])
async def list_cases(
    params: DepositCaseListParams = Depends(),
    case_service: CaseService = Depends(get_case_service),
    user: UserContext = Depends(get_user_context),
):
    """List deposit cases with pagination and filters."""
    cases, total = await case_service.list_cases(params, user)
    # Convert SQLAlchemy models to Pydantic schemas
    case_responses = [DepositCaseResponse.model_validate(case) for case in cases]
    return PaginatedResponse(
        items=case_responses,
        total=total,
        page=params.page,
        page_size=params.page_size,
        total_pages=(total + params.page_size - 1) // params.page_size,
    )





@router.get("/{case_id}", response_model=DepositCaseDetail)
async def get_case(
    case_id: str,
    case_service: CaseService = Depends(get_case_service),
    user: UserContext = Depends(get_user_context),
):
    """Get a deposit case by ID with all related data."""
    try:
        case = await case_service.get_case(case_id, user)
        return case
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))


@router.patch("/{case_id}", response_model=DepositCaseResponse)
async def update_case(
    case_id: str,
    case_data: DepositCaseUpdate,
    case_service: CaseService = Depends(get_case_service),
    user: UserContext = Depends(get_user_context),
):
    """Update a deposit case (only in DRAFT status)."""
    try:
        case = await case_service.update_case(case_id, case_data, user)
        return case
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))


@router.post("/{case_id}/submit", response_model=DepositCaseResponse)
async def submit_case(
    case_id: str,
    case_service: CaseService = Depends(get_case_service),
    user: UserContext = Depends(get_user_context),
):
    """Submit a case for review (DRAFT -> SUBMITTED)."""
    try:
        case = await case_service.submit_case(case_id, user)
        return case
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))


@router.post("/{case_id}/transition", response_model=DepositCaseResponse)
async def transition_case_status(
    case_id: str,
    status_update: DepositCaseStatusUpdate,
    case_service: CaseService = Depends(get_case_service),
    user: UserContext = Depends(get_user_context),
):
    """Transition case status with validation."""
    try:
        case = await case_service.transition_case_status(case_id, status_update, user)
        return case
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))


@router.get("/dashboard/stats", response_model=DepositCaseDashboardStats)
async def get_dashboard_stats(
    case_service: CaseService = Depends(get_case_service),
    user: UserContext = Depends(get_user_context),
):
    """Get dashboard statistics for deposit cases."""
    try:
        stats = await case_service.get_dashboard_stats(user)
        return stats
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))