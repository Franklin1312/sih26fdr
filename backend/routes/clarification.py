"""Clarification routes - Clarification request/response workflow."""

from typing import Optional, List
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status, Header
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.database import get_db
from backend.services.auth import auth_service
from backend.services.access_control import access_control, UserContext
from backend.services.case_service import CaseService
from backend.services.audit_service import audit_service
from backend.models import ClarificationRequest, DepositCase
from backend.models.enums import (
    ClarificationStatus,
    CaseStatus,
    AuditAction,
)
from backend.schemas.workflow import (
    ClarificationRequestCreate,
    ClarificationRequestResponse,
    ClarificationRequestUpdate,
)
from backend.schemas.institution import CurrentUserResponse
from backend.schemas.common import PaginatedResponse, PaginationParams

router = APIRouter(prefix="/clarifications", tags=["clarifications"])


async def get_current_user(authorization: str = Header(None)):
    try:
        user = await auth_service.get_current_user(authorization)
        return user
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))


async def get_user_context(current_user: CurrentUserResponse = Depends(get_current_user)) -> UserContext:
    context = access_control.get_user_context(current_user.user_id)
    if context:
        return context
    return UserContext(
        user_id=current_user.user_id,
        email=current_user.email,
        full_name=current_user.full_name,
        roles={current_user.role} if current_user.role else set(),
        institution_id=current_user.institution_id,
    )


async def get_case_service(db: AsyncSession = Depends(get_db)) -> CaseService:
    return CaseService(db)


@router.post("", response_model=ClarificationRequestResponse, status_code=status.HTTP_201_CREATED)
async def create_clarification(
    request: ClarificationRequestCreate,
    case_service: CaseService = Depends(get_case_service),
    user: UserContext = Depends(get_user_context),
):
    """Create a clarification request (Scrutiny Officer only)."""
    if not user.has_permission("clarification:request"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission denied")

    try:
        clarification = await case_service.create_clarification(request, user)
        return clarification
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))


@router.get("/case/{case_id}", response_model=PaginatedResponse[ClarificationRequestResponse])
async def list_clarifications(
    case_id: str,
    params: PaginationParams = Depends(),
    case_service: CaseService = Depends(get_case_service),
    user: UserContext = Depends(get_user_context),
):
    """List clarification requests for a case."""
    clarifications, total = await case_service.list_clarifications(case_id, params, user)
    return PaginatedResponse(
        items=clarifications,
        total=total,
        page=params.page,
        page_size=params.page_size,
        total_pages=(total + params.page_size - 1) // params.page_size,
    )


@router.get("/{clarification_id}", response_model=ClarificationRequestResponse)
async def get_clarification(
    clarification_id: str,
    case_service: CaseService = Depends(get_case_service),
    user: UserContext = Depends(get_user_context),
):
    """Get a specific clarification request."""
    clarification = await case_service.get_clarification(clarification_id, user)
    if not clarification:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Clarification not found")
    return clarification


@router.post("/{clarification_id}/respond", response_model=ClarificationRequestResponse)
async def respond_clarification(
    clarification_id: str,
    request: ClarificationRequestUpdate,
    case_service: CaseService = Depends(get_case_service),
    user: UserContext = Depends(get_user_context),
):
    """Respond to a clarification request (Institution Rep only)."""
    if not user.has_permission("clarification:respond"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission denied")

    try:
        clarification = await case_service.respond_clarification(clarification_id, request, user)
        return clarification
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))


@router.patch("/{clarification_id}", response_model=ClarificationRequestResponse)
async def update_clarification_status(
    clarification_id: str,
    status_update: ClarificationStatus,
    case_service: CaseService = Depends(get_case_service),
    user: UserContext = Depends(get_user_context),
):
    """Update clarification status (Scrutiny Officer - resolve/reopen)."""
    if not user.has_permission("clarification:request"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission denied")

    try:
        clarification = await case_service.update_clarification_status(clarification_id, status_update, user)
        return clarification
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))