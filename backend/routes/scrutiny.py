"""Scrutiny routes - Scrutiny officer queue and review workflow."""

from typing import List, Optional
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status, Header, Query
from sqlalchemy import select, func, or_, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.database import get_db
from backend.services.auth import auth_service
from backend.services.access_control import access_control, UserContext
from backend.services.case_service import CaseService
from backend.services.audit_service import audit_service
from backend.models import DepositCase, CaseEvent, ClarificationRequest
from backend.models.enums import (
    CaseStatus,
    ClarificationStatus,
    AuditAction,
)
from backend.schemas.deposit_case import DepositCaseDetail, DepositCaseResponse
from backend.schemas.workflow import ClarificationRequestCreate, ClarificationRequestResponse
from backend.schemas.institution import CurrentUserResponse
from backend.schemas.common import PaginatedResponse, PaginationParams

router = APIRouter(prefix="/scrutiny", tags=["scrutiny"])


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


@router.get("/queue", response_model=PaginatedResponse[DepositCaseResponse])
async def get_scrutiny_queue(
    params: PaginationParams = Depends(),
    status_filter: Optional[str] = Query(None, alias="status"),
    case_service: CaseService = Depends(get_case_service),
    user: UserContext = Depends(get_user_context),
):
    """Get scrutiny officer queue (SUBMITTED and UNDER_SCRUTINY cases)."""
    if not user.has_permission("case:read_assigned"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission denied")

    query_statuses = [
        CaseStatus.SUBMITTED,
        CaseStatus.UNDER_SCRUTINY,
        CaseStatus.CLARIFICATION_PENDING,
    ]

    stmt = select(DepositCase).options(selectinload(DepositCase.institution))

    if status_filter:
        try:
            filter_status = CaseStatus(status_filter)
            stmt = stmt.where(DepositCase.status == filter_status)
        except ValueError:
            stmt = stmt.where(DepositCase.status.in_(query_statuses))
    else:
        stmt = stmt.where(DepositCase.status.in_(query_statuses))

    stmt = stmt.where(
        or_(
            DepositCase.status.in_([
                CaseStatus.SUBMITTED,
                CaseStatus.CLARIFICATION_PENDING,
            ]),
            and_(
                DepositCase.status.in_([
                    CaseStatus.UNDER_SCRUTINY,
                    CaseStatus.CLEARANCE_QUEUE,
                ]),
                or_(
                    DepositCase.assigned_officer_id == user.user_id,
                    DepositCase.assigned_officer_id == None,
                ),
            ),
        )
    )

    stmt = stmt.order_by(
        DepositCase.status.desc(),
        DepositCase.created_at.asc(),
    )

    count_stmt = select(func.count()).select_from(stmt.subquery())
    total_result = await case_service.db.execute(count_stmt)
    total = total_result.scalar()

    stmt = stmt.offset((params.page - 1) * params.page_size).limit(params.page_size)
    result = await case_service.db.execute(stmt)
    cases = result.scalars().all()

    case_responses = [DepositCaseResponse.model_validate(case) for case in cases]

    return PaginatedResponse(
        items=case_responses,
        total=total,
        page=params.page,
        page_size=params.page_size,
        total_pages=(total + params.page_size - 1) // params.page_size,
    )


@router.get("/cases/{case_id}", response_model=DepositCaseDetail)
async def get_scrutiny_case(
    case_id: str,
    case_service: CaseService = Depends(get_case_service),
    user: UserContext = Depends(get_user_context),
):
    """Get case detail for scrutiny review."""
    if not user.has_permission("case:review"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission denied")

    try:
        case = await case_service.get_case(case_id, user)
        return case
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))


@router.post("/cases/{case_id}/claim", response_model=DepositCaseResponse)
async def claim_case(
    case_id: str,
    case_service: CaseService = Depends(get_case_service),
    user: UserContext = Depends(get_user_context),
):
    """Claim a SUBMITTED case (SUBMITTED -> UNDER_SCRUTINY)."""
    if not user.has_permission("case:review"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission denied")

    case = await case_service.db.get(DepositCase, case_id)
    if not case:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case not found")

    if case.status != CaseStatus.SUBMITTED:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Case is not in SUBMITTED status")

    case.assigned_officer_id = user.user_id
    old_status = case.status
    case.status = CaseStatus.UNDER_SCRUTINY

    await case_service.db.flush()

    await audit_service.log_event(
        db=case_service.db,
        entity_type="deposit_case",
        entity_id=case.id,
        action=AuditAction.STATUS_CHANGE,
        actor_id=user.user_id,
        old_values={"status": old_status.value, "assigned_officer_id": None},
        new_values={"status": case.status.value, "assigned_officer_id": user.user_id},
    )

    event = CaseEvent(
        case_id=case.id,
        event_type="case_claimed",
        actor_id=user.user_id,
        old_status=old_status,
        new_status=case.status,
        details={"claimed_by": user.user_id},
    )
    case_service.db.add(event)

    # SQLite populates the server-managed updated_at value during the UPDATE.
    # Refresh before Pydantic serializes it to avoid async lazy loading outside
    # SQLAlchemy's greenlet context (which otherwise becomes a 500 response).
    await case_service.db.refresh(case)

    return DepositCaseResponse.model_validate(case)


@router.post("/cases/{case_id}/unassign", response_model=DepositCaseResponse)
async def unassign_case(
    case_id: str,
    case_service: CaseService = Depends(get_case_service),
    user: UserContext = Depends(get_user_context),
):
    """Return a claimed case to the scrutiny queue (UNDER_SCRUTINY -> SUBMITTED)."""
    if not user.has_permission("case:review"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission denied")

    case = await case_service.db.get(DepositCase, case_id)
    if not case:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case not found")
    if case.status != CaseStatus.UNDER_SCRUTINY:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only cases under scrutiny can be unassigned")
    if case.assigned_officer_id != user.user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the assigned scrutiny officer can unassign this case")

    old_status = case.status
    case.assigned_officer_id = None
    case.status = CaseStatus.SUBMITTED
    await case_service.db.flush()
    await audit_service.log_event(
        db=case_service.db,
        entity_type="deposit_case",
        entity_id=case.id,
        action=AuditAction.STATUS_CHANGE,
        actor_id=user.user_id,
        old_values={"status": old_status.value, "assigned_officer_id": user.user_id},
        new_values={"status": case.status.value, "assigned_officer_id": None},
    )
    case_service.db.add(CaseEvent(
        case_id=case.id,
        event_type="case_unassigned",
        actor_id=user.user_id,
        old_status=old_status,
        new_status=case.status,
        details={"unassigned_by": user.user_id},
    ))
    await case_service.db.refresh(case)
    return DepositCaseResponse.model_validate(case)


@router.post("/cases/{case_id}/review", response_model=DepositCaseResponse)
async def review_case(
    case_id: str,
    status_update: dict,
    case_service: CaseService = Depends(get_case_service),
    user: UserContext = Depends(get_user_context),
):
    """Review case and transition status (clarification/clearance/reject)."""
    if not user.has_permission("case:review"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission denied")

    new_status_str = status_update.get("new_status")
    reason = status_update.get("reason")
    details = status_update.get("details", {})

    if not new_status_str:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="new_status is required")

    try:
        new_status = CaseStatus(new_status_str)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid status: {new_status_str}")

    # Keep this endpoint in lock-step with the workflow state machine.  The
    # generic scrutiny modal is also used for an unclaimed submitted case;
    # that first move must be allowed to claim it for the reviewing officer.
    case = await case_service.db.get(DepositCase, case_id)
    if not case:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case not found")

    allowed_by_current_status = {
        CaseStatus.SUBMITTED: {CaseStatus.UNDER_SCRUTINY, CaseStatus.REJECTED},
        CaseStatus.UNDER_SCRUTINY: {
            CaseStatus.CLARIFICATION_PENDING,
            CaseStatus.CLEARANCE_QUEUE,
            CaseStatus.REJECTED,
        },
        CaseStatus.CLARIFICATION_PENDING: {CaseStatus.UNDER_SCRUTINY, CaseStatus.REJECTED},
    }
    allowed_transitions = allowed_by_current_status.get(case.status, set())

    if new_status not in allowed_transitions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Invalid transition from {case.status.value} to {new_status.value}. "
                f"Allowed: {[s.value for s in allowed_transitions]}"
            )
        )

    from backend.schemas.deposit_case import DepositCaseStatusUpdate
    status_obj = DepositCaseStatusUpdate(
        new_status=new_status,
        reason=reason,
        details=details,
    )

    try:
        case = await case_service.transition_case_status(case_id, status_obj, user)
        return case
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))


@router.post("/cases/{case_id}/clarifications", response_model=ClarificationRequestResponse)
async def create_clarification(
    case_id: str,
    request: ClarificationRequestCreate,
    case_service: CaseService = Depends(get_case_service),
    user: UserContext = Depends(get_user_context),
):
    """Create clarification request (from scrutiny case detail)."""
    if not user.has_permission("clarification:request"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission denied")

    request.case_id = case_id
    try:
        clarification = await case_service.create_clarification(request, user)
        return clarification
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))


@router.get("/cases/{case_id}/clarifications", response_model=PaginatedResponse[ClarificationRequestResponse])
async def list_case_clarifications(
    case_id: str,
    params: PaginationParams = Depends(),
    case_service: CaseService = Depends(get_case_service),
    user: UserContext = Depends(get_user_context),
):
    """List clarifications for a case."""
    clarifications, total = await case_service.list_clarifications(case_id, params, user)
    return PaginatedResponse(
        items=clarifications,
        total=total,
        page=params.page,
        page_size=params.page_size,
        total_pages=(total + params.page_size - 1) // params.page_size,
    )


@router.get("/stats", response_model=dict)
async def get_scrutiny_stats(
    case_service: CaseService = Depends(get_case_service),
    user: UserContext = Depends(get_user_context),
):
    """Get scrutiny officer dashboard stats."""
    if not user.has_permission("dashboard:view_assigned"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission denied")

    stats = await case_service.get_dashboard_stats(user)
    total_assigned = stats.by_status.get("under_scrutiny", 0)
    submitted_unassigned = stats.by_status.get("submitted", 0)
    clarification_pending = stats.by_status.get("clarification_pending", 0)
    return {
        "total_assigned": total_assigned,
        "submitted_unassigned": submitted_unassigned,
        "clarification_pending": clarification_pending,
        "queue_size": total_assigned + submitted_unassigned + clarification_pending,
        "total_cases": stats.total,
    }
