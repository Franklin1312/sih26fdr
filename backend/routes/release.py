"""Release routes - Authority release workflow."""

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status, Header
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.database import get_db
from backend.services.auth import auth_service
from backend.services.access_control import access_control
from backend.services.audit_service import audit_service
from backend.services.case_service import CaseService
from backend.services.checklist import get_checklist_engine
from backend.models.entities_case import (
    DepositCase,
)
from backend.models.entities_release import (
    ReleaseRequest,
)
from backend.models.entities_core import User
from backend.models.enums import (
    CaseStatus,
    ReleaseDecision,
    ReleaseRequestType,
    UserRole,
)
from backend.schemas.clearance import (
    ReleaseChecklistResponse,
    ReleaseDecisionRequest,
    ReleaseDecisionResponse,
    ReleaseDetailResponse,
    ReleaseQueueItem,
    ReleaseQueueResponse,
    ReleaseRequestCreateRequest,
    ReleaseChecklistItem,
)
from backend.schemas.institution import CurrentUserResponse

router = APIRouter(prefix="/release", tags=["release"])


async def get_current_user(authorization: str = Header(None)):
    try:
        user = await auth_service.get_current_user(authorization)
        return user
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))


async def get_case_service(db: AsyncSession = Depends(get_db)) -> CaseService:
    return CaseService(db)


# More endpoints will be added


@router.post("/request", response_model=ReleaseDetailResponse)
async def create_release_request(
    request: ReleaseRequestCreateRequest,
    current_user=Depends(get_current_user),
    case_service: CaseService = Depends(get_case_service),
    db: AsyncSession = Depends(get_db),
):
    """Create a release request (Institution)."""
    if UserRole.INSTITUTION_REP not in current_user.roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only institution representatives can request release"
        )
    
    query = select(DepositCase).where(DepositCase.id == request.case_id).options(
        selectinload(DepositCase.institution),
        selectinload(DepositCase.release_requests),
    )
    result = await db.execute(query)
    case = result.scalar_one_or_none()
    
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    
    if case.institution_id != current_user.institution_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized for this case"
        )
    
    if case.status != CaseStatus.CLEARED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Case must be CLEARED to request release (current: {case.status.value})"
        )
    
    pending_requests = [r for r in case.release_requests if r.status == "pending"]
    if pending_requests:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Release request already pending for this case"
        )
    
    review_path_map = {
        "fdr_rpgf": "fdr_rpgf",
        "rtgs": "rtgs", 
        "security_deposit_refund": "sd_refund",
    }
    review_path = review_path_map.get(case.deposit_method.value, "fdr_rpgf")
    
    release_request = ReleaseRequest(
        case_id=case.id,
        created_by=current_user.user_id,
        request_type=request.request_type,
        review_path=review_path,
        status="pending",
        checklist_data={},
    )
    db.add(release_request)
    
    old_status = case.status
    case.status = CaseStatus.RELEASE_REQUESTED
    
    await case_service._log_case_event(
        case.id, "status_changed", current_user.user_id,
        old_status, CaseStatus.RELEASE_REQUESTED,
        {"reason": f"Release requested: {request.request_type.value}", "request_id": release_request.id}
    )
    
    await audit_service.log_event(
        db,
        actor_id=current_user.user_id,
        action="release_requested",
        resource_type="deposit_case",
        resource_id=case.id,
        details={"case_number": case.case_number, "request_type": request.request_type.value},
    )
    
    await db.flush()
    
    checklist_engine = get_checklist_engine()
    case_data = {
        "deposit_method": case.deposit_method.value,
        "request_type": request.request_type.value,
        "amount": float(case.amount),
        "institution_type": case.institution.institution_type.value if case.institution else "unknown",
    }
    checklist = checklist_engine.evaluate_checklist(
        {}, request.request_type.value, case.deposit_method.value, case_data
    )
    
    return ReleaseDetailResponse(
        id=release_request.id,
        case_id=release_request.case_id,
        request_type=release_request.request_type,
        checklist_data=release_request.checklist_data,
        created_by=release_request.created_by,
        decided_by=release_request.decided_by,
        review_path=release_request.review_path,
        final_decision=release_request.final_decision,
        decision_reasoning=release_request.decision_reasoning,
        status=release_request.status,
        decided_at=release_request.decided_at,
        created_at=release_request.created_at,
        updated_at=release_request.updated_at,
        created_by_user=None,
        decided_by_user=None,
        case_number=case.case_number,
        institution_name=case.institution.name if case.institution else "Unknown",
        deposit_type=case.deposit_type.value,
        deposit_method=case.deposit_method.value,
        amount=float(case.amount),
        case_status=case.status,
        checklist=ReleaseChecklistResponse(
            request_type=request.request_type,
            deposit_method=case.deposit_method.value,
            items=[ReleaseChecklistItem(**item) for item in checklist["items"]],
            passed=checklist["passed"],
            mandatory_count=checklist["mandatory_count"],
            completed_count=checklist["completed_count"],
            missing_items=checklist["missing_items"],
        ),
    )


# More endpoints will be added


@router.get("/queue", response_model=ReleaseQueueResponse)
async def get_release_queue(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    review_path: Optional[str] = Query(None),
    current_user=Depends(get_current_user),
    case_service: CaseService = Depends(get_case_service),
    db: AsyncSession = Depends(get_db),
):
    """Get release queue for the competent authority."""
    if UserRole.COMPETENT_AUTHORITY not in current_user.roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only competent authority can access release queue"
        )
    
    review_statuses = [
        CaseStatus.FDR_RPGF_REVIEW,
        CaseStatus.RTGS_REVIEW,
        CaseStatus.SD_REFUND_REVIEW,
        CaseStatus.RELEASE_REQUESTED,
    ]
    
    query = select(DepositCase).where(
        and_(
            DepositCase.status.in_(review_statuses),
        )
    ).options(
        selectinload(DepositCase.institution),
        selectinload(DepositCase.release_requests),
    )
    
    if review_path:
        query = query.where(DepositCase.status == CaseStatus(review_path.upper().replace("_", "_")))
    
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0
    
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size).order_by(DepositCase.created_at.desc())
    
    result = await db.execute(query)
    cases = result.scalars().unique().all()
    
    items = []
    for case in cases:
        release_request = max(case.release_requests, key=lambda r: r.created_at) if case.release_requests else None
        
        deadline_days_map = {
            CaseStatus.FDR_RPGF_REVIEW: 15,
            CaseStatus.RTGS_REVIEW: 10,
            CaseStatus.SD_REFUND_REVIEW: 10,
            CaseStatus.RELEASE_REQUESTED: 15,
        }
        deadline_days = deadline_days_map.get(case.status, 15)
        
        checklist_progress = {"passed": False, "completed": 0, "total": 0}
        if release_request:
            checklist_engine = get_checklist_engine()
            case_data = {"deposit_method": case.deposit_method.value, "amount": float(case.amount)}
            eval_result = checklist_engine.evaluate_checklist(
                release_request.checklist_data or {},
                release_request.request_type.value,
                case.deposit_method.value,
                case_data,
            )
            checklist_progress = {
                "passed": eval_result["passed"],
                "completed": eval_result["completed_count"],
                "total": eval_result["mandatory_count"],
            }
        
        items.append(ReleaseQueueItem(
            case_id=case.id,
            case_number=case.case_number,
            institution_name=case.institution.name if case.institution else "Unknown",
            deposit_type=case.deposit_type.value,
            deposit_method=case.deposit_method.value,
            amount=float(case.amount),
            status=case.status,
            review_path=release_request.review_path if release_request else "",
            request_type=release_request.request_type if release_request else ReleaseRequestType.MATURITY,
            requested_by=release_request.created_by if release_request else "",
            requested_at=release_request.created_at if release_request else case.created_at,
            deadline_days=deadline_days,
            deadline_at=None,
            checklist_progress=checklist_progress,
        ))
    
    return ReleaseQueueResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
    )


# More endpoints will be added


@router.get("/cases/{case_id}", response_model=ReleaseDetailResponse)
async def get_release_case_detail(
    case_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get release case detail with checklist."""
    if UserRole.COMPETENT_AUTHORITY not in current_user.roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only competent authority can access release cases"
        )
    
    query = select(DepositCase).where(DepositCase.id == case_id).options(
        selectinload(DepositCase.institution),
        selectinload(DepositCase.release_requests),
    )
    result = await db.execute(query)
    case = result.scalar_one_or_none()
    
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    
    release_request = max(case.release_requests, key=lambda r: r.created_at) if case.release_requests else None
    if not release_request:
        raise HTTPException(status_code=404, detail="No release request found for this case")
    
    checklist_engine = get_checklist_engine()
    case_data = {"deposit_method": case.deposit_method.value, "amount": float(case.amount)}
    checklist = checklist_engine.evaluate_checklist(
        release_request.checklist_data or {},
        release_request.request_type.value,
        case.deposit_method.value,
        case_data,
    )
    
    return ReleaseDetailResponse(
        id=release_request.id,
        case_id=release_request.case_id,
        request_type=release_request.request_type,
        checklist_data=release_request.checklist_data,
        created_by=release_request.created_by,
        decided_by=release_request.decided_by,
        review_path=release_request.review_path,
        final_decision=release_request.final_decision,
        decision_reasoning=release_request.decision_reasoning,
        status=release_request.status,
        decided_at=release_request.decided_at,
        created_at=release_request.created_at,
        updated_at=release_request.updated_at,
        created_by_user=None,
        decided_by_user=None,
        case_number=case.case_number,
        institution_name=case.institution.name if case.institution else "Unknown",
        deposit_type=case.deposit_type.value,
        deposit_method=case.deposit_method.value,
        amount=float(case.amount),
        case_status=case.status,
        checklist=ReleaseChecklistResponse(
            request_type=release_request.request_type,
            deposit_method=case.deposit_method.value,
            items=[ReleaseChecklistItem(**item) for item in checklist["items"]],
            passed=checklist["passed"],
            mandatory_count=checklist["mandatory_count"],
            completed_count=checklist["completed_count"],
            missing_items=checklist["missing_items"],
        ),
    )


# More endpoints will be added



@router.post("/cases/{case_id}/decide", response_model=ReleaseDecisionResponse)
async def decide_release(
    case_id: str,
    request: ReleaseDecisionRequest,
    current_user=Depends(get_current_user),
    case_service: CaseService = Depends(get_case_service),
    db: AsyncSession = Depends(get_db),
):
    """Decide on a release request (Competent Authority)."""
    if UserRole.COMPETENT_AUTHORITY not in current_user.roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only competent authority can decide on release"
        )
    
    query = select(DepositCase).where(DepositCase.id == case_id).options(
        selectinload(DepositCase.release_requests),
    )
    result = await db.execute(query)
    case = result.scalar_one_or_none()
    
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    
    release_request = max(case.release_requests, key=lambda r: r.created_at) if case.release_requests else None
    if not release_request:
        raise HTTPException(status_code=404, detail="No release request found for this case")
    
    if release_request.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Release request already decided (status: {release_request.status})"
        )
    
    if request.final_decision == ReleaseDecision.RELEASE:
        checklist_engine = get_checklist_engine()
        case_data = {"deposit_method": case.deposit_method.value, "amount": float(case.amount)}
        checklist_eval = checklist_engine.evaluate_checklist(
            request.checklist_data or {},
            release_request.request_type.value,
            case.deposit_method.value,
            case_data,
        )
        if not checklist_eval["passed"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Checklist not complete. Missing: {', '.join(checklist_eval['missing_items'])}"
            )
    
    release_request.final_decision = request.final_decision
    release_request.decision_reasoning = request.decision_reasoning
    release_request.checklist_data = request.checklist_data or {}
    release_request.decided_by = current_user.user_id
    release_request.decided_at = func.now()
    release_request.status = "decided"
    
    old_status = case.status
    message = ""
    
    if request.final_decision == ReleaseDecision.RELEASE:
        case.status = CaseStatus.RELEASED
        message = "Funds released successfully"
    elif request.final_decision == ReleaseDecision.REJECT:
        case.status = CaseStatus.CLEARED
        message = "Release rejected"
    elif request.final_decision == ReleaseDecision.RETURN:
        case.status = CaseStatus.CLEARED
        message = "Release returned for clarification"
    
    await case_service._log_case_event(
        case.id, "status_changed", current_user.user_id,
        old_status, case.status,
        {"reason": message, "decision": request.final_decision.value, "reasoning": request.decision_reasoning}
    )
    
    await audit_service.log_event(
        db,
        actor_id=current_user.user_id,
        action="release_decided",
        resource_type="deposit_case",
        resource_id=case.id,
        details={
            "case_number": case.case_number,
            "decision": request.final_decision.value,
            "reasoning": request.decision_reasoning,
        },
    )
    
    await db.flush()
    
    return ReleaseDecisionResponse(
        release_request=ReleaseDetailResponse(
            id=release_request.id,
            case_id=release_request.case_id,
            request_type=release_request.request_type,
            checklist_data=release_request.checklist_data,
            created_by=release_request.created_by,
            decided_by=release_request.decided_by,
            review_path=release_request.review_path,
            final_decision=release_request.final_decision,
            decision_reasoning=release_request.decision_reasoning,
            status=release_request.status,
            decided_at=release_request.decided_at,
            created_at=release_request.created_at,
            updated_at=release_request.updated_at,
            created_by_user=None,
            decided_by_user=None,
            case_number=case.case_number,
            institution_name=case.institution.name if case.institution else "Unknown",
            deposit_type=case.deposit_type.value,
            deposit_method=case.deposit_method.value,
            amount=float(case.amount),
            case_status=case.status,
            checklist=None,
        ),
        case_status=case.status,
        message=message,
    )



@router.get("/cases/{case_id}/checklist", response_model=ReleaseChecklistResponse)
async def get_release_checklist(
    case_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get release checklist for a case."""
    if UserRole.COMPETENT_AUTHORITY not in current_user.roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only competent authority can access release checklist"
        )
    
    query = select(DepositCase).where(DepositCase.id == case_id).options(
        selectinload(DepositCase.release_requests),
    )
    result = await db.execute(query)
    case = result.scalar_one_or_none()
    
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    
    release_request = max(case.release_requests, key=lambda r: r.created_at) if case.release_requests else None
    if not release_request:
        raise HTTPException(status_code=404, detail="No release request found for this case")
    
    checklist_engine = get_checklist_engine()
    case_data = {"deposit_method": case.deposit_method.value, "amount": float(case.amount)}
    checklist = checklist_engine.evaluate_checklist(
        release_request.checklist_data or {},
        release_request.request_type.value,
        case.deposit_method.value,
        case_data,
    )
    
    return ReleaseChecklistResponse(
        request_type=release_request.request_type,
        deposit_method=case.deposit_method.value,
        items=[ReleaseChecklistItem(**item) for item in checklist["items"]],
        passed=checklist["passed"],
        mandatory_count=checklist["mandatory_count"],
        completed_count=checklist["completed_count"],
        missing_items=checklist["missing_items"],
    )
