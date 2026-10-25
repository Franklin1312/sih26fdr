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
    DepositCaseRenewalCreate,
    DepositCaseUpdate,
    DepositCaseStatusUpdate,
    DepositCaseResponse,
    DepositCaseDetail,
    DepositCaseListParams,
    DepositCaseDashboardStats,
    SystemAlertResponse,
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


@router.post("/{case_id}/renew", response_model=DepositCaseResponse, status_code=status.HTTP_201_CREATED)
async def renew_case(
    case_id: str,
    renewal_data: DepositCaseRenewalCreate,
    case_service: CaseService = Depends(get_case_service),
    user: UserContext = Depends(get_user_context),
):
    """Create a renewal or replacement case linked to an existing instrument."""
    try:
        case = await case_service.create_renewal_case(case_id, renewal_data, user)
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





@router.get("/alerts", response_model=List[SystemAlertResponse])
async def get_system_alerts(
    case_service: CaseService = Depends(get_case_service),
    user: UserContext = Depends(get_user_context),
):
    """Get active system alerts and notifications."""
    try:
        alerts = await case_service.get_active_alerts(user)
        return [SystemAlertResponse(**a) for a in alerts]
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


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


@router.get("/tracking/{tracking_ref}", response_model=DepositCaseDetail)
async def get_case_by_tracking_ref(
    tracking_ref: str,
    db: AsyncSession = Depends(get_db),
    case_service: CaseService = Depends(get_case_service),
    user: UserContext = Depends(get_user_context),
):
    from sqlalchemy import select
    from backend.models import DepositCase

    result = await db.execute(select(DepositCase.id).where(DepositCase.tracking_ref == tracking_ref))
    case_id = result.scalar_one_or_none()
    if not case_id:
        raise HTTPException(status_code=404, detail="Case not found")
    try:
        return await case_service.get_case(case_id, user)
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc))


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


from pydantic import BaseModel
from typing import Optional
from datetime import timezone, datetime
from backend.models import DepositCase, DepositEvidence, CaseEvent
from backend.models.enums import AuditAction
from backend.services.audit_service import audit_service


class BankVerificationRequest(BaseModel):
    verification_ref: str
    verified_amount: float
    verified_maturity_date: Optional[str] = None
    bank_notes: Optional[str] = None


class BankVerificationResponse(BaseModel):
    success: bool
    has_discrepancy: bool
    discrepancies: List[str]
    evidence_id: str
    case_id: str
    verified_amount: float
    expected_amount: float
    message: str


@router.post("/{case_id}/evidence/{evidence_id}/verify-bank", response_model=BankVerificationResponse)
async def verify_bank_details(
    case_id: str,
    evidence_id: str,
    payload: BankVerificationRequest,
    db: AsyncSession = Depends(get_db),
    user: UserContext = Depends(get_user_context),
):
    """Mark an evidence instrument as verified with independent bank records and detect discrepancies."""
    from sqlalchemy import select

    case_res = await db.execute(select(DepositCase).where(DepositCase.id == case_id))
    case = case_res.scalar_one_or_none()
    if not case:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deposit case not found")

    ev_res = await db.execute(select(DepositEvidence).where(DepositEvidence.id == evidence_id, DepositEvidence.case_id == case_id))
    evidence = ev_res.scalar_one_or_none()
    if not evidence:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Evidence document not found for this case")

    discrepancies: List[str] = []

    # Check amount discrepancy
    if abs(float(payload.verified_amount) - float(case.amount)) > 0.01:
        discrepancies.append(
            f"Amount Mismatch: Institution reported INR {case.amount:,.2f}, but Bank confirmed INR {payload.verified_amount:,.2f}"
        )

    # Check maturity date discrepancy if provided
    if payload.verified_maturity_date and case.maturity_date:
        case_mat_str = case.maturity_date.strftime("%Y-%m-%d") if hasattr(case.maturity_date, "strftime") else str(case.maturity_date)[:10]
        if str(payload.verified_maturity_date)[:10] != case_mat_str:
            discrepancies.append(
                f"Maturity Date Variation: Institution entered {case_mat_str}, but Bank records show {payload.verified_maturity_date[:10]}"
            )

    has_discrepancy = len(discrepancies) > 0

    # Update evidence validation flags
    flags = dict(evidence.validation_flags or {})
    flags["bank_verified"] = True
    flags["bank_verification_ref"] = payload.verification_ref
    flags["bank_verified_at"] = datetime.now(timezone.utc).isoformat()
    flags["bank_verified_amount"] = payload.verified_amount
    flags["bank_verified_by"] = user.user_id
    flags["has_discrepancy"] = has_discrepancy
    flags["discrepancies"] = discrepancies
    if payload.bank_notes:
        flags["bank_notes"] = payload.bank_notes
    evidence.validation_flags = flags

    # Record CaseEvent
    ev_record = CaseEvent(
        id=str(uuid4()),
        case_id=case_id,
        event_type="bank_verification",
        actor_id=user.user_id,
        details={
            "verification_ref": payload.verification_ref,
            "verified_amount": payload.verified_amount,
            "has_discrepancy": has_discrepancy,
            "discrepancies": discrepancies,
            "bank_notes": payload.bank_notes,
            "verified_at": datetime.now(timezone.utc).isoformat(),
        },
    )
    db.add(ev_record)

    # Audit log
    await audit_service.log_event(
        db=db,
        entity_type="deposit_evidence",
        entity_id=evidence.id,
        action=AuditAction.UPDATE,
        actor_id=user.user_id,
        old_values={"bank_verified": False},
        new_values={
            "bank_verified": True,
            "has_discrepancy": has_discrepancy,
            "discrepancies": discrepancies,
            "case_id": case_id,
        },
    )

    await db.commit()

    return BankVerificationResponse(
        success=True,
        has_discrepancy=has_discrepancy,
        discrepancies=discrepancies,
        evidence_id=evidence_id,
        case_id=case_id,
        verified_amount=payload.verified_amount,
        expected_amount=float(case.amount),
        message="Independent bank confirmation recorded successfully"
        if not has_discrepancy
        else f"Bank record logged with {len(discrepancies)} discrepancy warning(s)",
    )


