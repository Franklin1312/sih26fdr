"""Release routes - Authority release workflow."""

from typing import List, Optional
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status, Header
from sqlalchemy import and_, func, or_, select
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
    AuditAction,
    CaseStatus,
    DepositMethod,
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


def _review_status(path: str) -> CaseStatus:
    return {
        "fdr_rpgf": CaseStatus.FDR_RPGF_REVIEW,
        "rtgs": CaseStatus.RTGS_REVIEW,
        "sd_refund": CaseStatus.SD_REFUND_REVIEW,
    }[path]


def _route_authority(path: str) -> UserRole:
    return {
        "fdr_rpgf": UserRole.APPROVAL_BUREAU,
        "rtgs": UserRole.COUNCIL,
        "sd_refund": UserRole.COMPETENT_AUTHORITY,
    }[path]


def _require_route_authority(current_user, path: str) -> None:
    expected = _route_authority(path)
    # The Competent Authority is the cross-route final decision maker used by
    # the Authority workbench.  Route cells (Approval Bureau/Council) retain
    # access for their specialised routes and for recording their final output.
    # FDR cases have a sequential Approval Bureau -> Council stage after the
    # Competent Authority decision, so Council may read that routed case once
    # the NOC has been issued.
    additional_role = UserRole.COUNCIL if path == "fdr_rpgf" else None
    if (
        UserRole.COMPETENT_AUTHORITY not in current_user.roles
        and expected not in current_user.roles
        and additional_role not in current_user.roles
    ):
        raise HTTPException(status_code=403, detail=f"Only {expected.value.replace('_', ' ')} can act on this route")


def _evaluate_release_checklist(case: DepositCase, release_request: ReleaseRequest) -> dict:
    """Evaluate evidence and clearance records against the configured release checklist."""
    engine = get_checklist_engine()
    maturity_date = case.maturity_date
    if maturity_date and maturity_date.tzinfo is None:
        maturity_date = maturity_date.replace(tzinfo=timezone.utc)
    case_data = {
        "deposit_method": case.deposit_method.value,
        "amount": float(case.amount),
        "institution_type": getattr(case.institution.institution_type, "value", case.institution.institution_type) if case.institution else "unknown",
        "bank_requires_noc": False,
        "deposit_matured": bool(maturity_date and maturity_date <= datetime.now(timezone.utc)),
    }
    case_data.update(case.regulatory_context or {})
    rules = engine.rule_engine.get_release_checklist_items(
        release_request.request_type.value, case.deposit_method.value
    )
    rules_by_key = {item["key"]: item for item in rules}
    generated = engine.generate_checklist(
        release_request.request_type.value, case.deposit_method.value, case_data
    )
    document_types = {
        evidence.document_type for evidence in (case.evidence or [])
        if not evidence.is_deleted and evidence.replaced_by_id is None
    }
    clearances = case.clearances or []
    completed_items = []
    missing = []
    mandatory_count = 0
    completed_count = 0
    for item in generated:
        config = rules_by_key.get(item.key, {})
        if item.key in {"pgrc_clearance", "financial_clearance"}:
            complete = any(
                t.status.value == "cleared" and bool(t.evidence)
                and any(term in t.clearance_type.lower() for term in ("financial", "pgrc"))
                for t in clearances
            )
        elif item.key == "vigilance_clearance":
            complete = any(
                t.status.value == "cleared" and bool(t.evidence)
                and any(term in t.clearance_type.lower() for term in ("legal", "vigilance"))
                for t in clearances
            )
        else:
            doc_type = config.get("document_type")
            complete = bool(doc_type and doc_type in document_types)
        item_data = item.to_dict()
        item_data["completed"] = complete
        item_data["document_type"] = config.get("document_type")
        completed_items.append(item_data)
        if item.mandatory:
            mandatory_count += 1
            if complete:
                completed_count += 1
            else:
                missing.append(item.key)
    return {
        "passed": not missing,
        "mandatory_count": mandatory_count,
        "completed_count": completed_count,
        "missing_items": missing,
        "items": completed_items,
    }


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
        selectinload(DepositCase.clearances),
        selectinload(DepositCase.evidence),
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

    if not case.clearances or any(
        task.status.value != "cleared" or not task.evidence for task in case.clearances
    ):
        raise HTTPException(status_code=400, detail="Complete all clearance tasks and record evidence before requesting release")
    
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
    review_status = _review_status(review_path)
    await case_service._log_case_event(
        case.id, "authority_route_selected", current_user.user_id,
        CaseStatus.RELEASE_REQUESTED, review_status,
        {"review_path": review_path, "request_type": request.request_type.value},
    )
    case.status = review_status
    
    await audit_service.log_event(
        db=db, entity_type="deposit_case", entity_id=case.id,
        actor_id=current_user.user_id, action=AuditAction.RELEASE_REQUESTED,
        new_values={"case_number": case.case_number, "request_type": request.request_type.value, "review_path": review_path},
    )
    
    await db.flush()
    # Ensure this request's case aggregate includes the newly created release
    # request before a subsequent authority action reads it.
    await db.refresh(case, ["release_requests"])
    
    checklist_engine = get_checklist_engine()
    case_data = {
        "deposit_method": case.deposit_method.value,
        "request_type": request.request_type.value,
        "amount": float(case.amount),
        "institution_type": case.institution.institution_type if case.institution else "unknown",
    }
    checklist = _evaluate_release_checklist(case, release_request)
    
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
    if not ({UserRole.COMPETENT_AUTHORITY, UserRole.APPROVAL_BUREAU, UserRole.COUNCIL} & set(current_user.roles)):
        raise HTTPException(status_code=403, detail="Release authority access is required")
    
    review_statuses = [
        CaseStatus.FDR_RPGF_REVIEW,
        CaseStatus.RTGS_REVIEW,
        CaseStatus.SD_REFUND_REVIEW,
        CaseStatus.RELEASE_REQUESTED,
        # Routed NOC/sanction cells must be able to find authorized cases in
        # order to record their final simulated output.
        CaseStatus.FINAL_DECISION,
        CaseStatus.NOC_ISSUED,
    ]
    
    query = select(DepositCase).where(
        and_(
            DepositCase.status.in_(review_statuses),
        )
    ).options(
        selectinload(DepositCase.institution),
        selectinload(DepositCase.release_requests),
        selectinload(DepositCase.clearances),
        selectinload(DepositCase.evidence),
    )
    
    if review_path:
        path_status = {"fdr_rpgf": CaseStatus.FDR_RPGF_REVIEW, "rtgs": CaseStatus.RTGS_REVIEW, "sd_refund": CaseStatus.SD_REFUND_REVIEW}.get(review_path)
        if path_status is None:
            raise HTTPException(status_code=400, detail="Unknown release route")
        _require_route_authority(current_user, review_path)
        query = query.where(DepositCase.status == path_status)
    elif UserRole.APPROVAL_BUREAU in current_user.roles:
        query = query.where(
            DepositCase.status.in_([CaseStatus.FDR_RPGF_REVIEW, CaseStatus.FINAL_DECISION]),
            DepositCase.deposit_method == DepositMethod.FDR_RPGF,
        )
    elif UserRole.COUNCIL in current_user.roles:
        query = query.where(
            or_(
                and_(
                    DepositCase.status.in_([CaseStatus.RTGS_REVIEW, CaseStatus.FINAL_DECISION]),
                    DepositCase.deposit_method == DepositMethod.RTGS,
                ),
                and_(
                    DepositCase.status == CaseStatus.NOC_ISSUED,
                    DepositCase.deposit_method == DepositMethod.FDR_RPGF,
                ),
            )
        )
    
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
            eval_result = _evaluate_release_checklist(case, release_request)
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


@router.get("/my-requests", response_model=ReleaseQueueResponse)
async def get_my_release_requests(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status_filter: Optional[str] = Query(None, alias="status"),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List release requests belonging to the signed-in institution."""
    if UserRole.INSTITUTION_REP not in current_user.roles:
        raise HTTPException(status_code=403, detail="Only institution representatives can view their requests")
    query = select(ReleaseRequest).join(DepositCase).where(
        DepositCase.institution_id == current_user.institution_id
    ).options(selectinload(ReleaseRequest.case).selectinload(DepositCase.institution))
    if status_filter:
        query = query.where(ReleaseRequest.status == status_filter)
    count_query = select(func.count(ReleaseRequest.id)).select_from(ReleaseRequest).join(DepositCase).where(
        DepositCase.institution_id == current_user.institution_id
    )
    if status_filter:
        count_query = count_query.where(ReleaseRequest.status == status_filter)
    total = (await db.execute(count_query)).scalar() or 0
    requests = (await db.execute(
        query.order_by(ReleaseRequest.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    )).scalars().all()
    items = []
    for release_request in requests:
        case = release_request.case
        items.append(ReleaseQueueItem(
            case_id=case.id,
            case_number=case.case_number,
            institution_name=case.institution.name if case.institution else "Unknown",
            deposit_type=case.deposit_type.value,
            deposit_method=case.deposit_method.value,
            amount=float(case.amount),
            status=case.status,
            review_path=release_request.review_path or "",
            request_type=release_request.request_type,
            requested_by=release_request.created_by,
            requested_at=release_request.created_at,
            deadline_days=0,
            deadline_at=None,
            checklist_progress={},
        ))
    return ReleaseQueueResponse(items=items, total=total, page=page, page_size=page_size)


# More endpoints will be added


@router.get("/cases/{case_id}", response_model=ReleaseDetailResponse)
async def get_release_case_detail(
    case_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get release case detail with checklist."""
    
    query = select(DepositCase).where(DepositCase.id == case_id).options(
        selectinload(DepositCase.institution),
        selectinload(DepositCase.release_requests),
        selectinload(DepositCase.clearances),
        selectinload(DepositCase.evidence),
    )
    result = await db.execute(query)
    case = result.scalar_one_or_none()
    
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    
    release_request = max(case.release_requests, key=lambda r: r.created_at) if case.release_requests else None
    if not release_request:
        raise HTTPException(status_code=404, detail="No release request found for this case")
    _require_route_authority(current_user, release_request.review_path or "")
    
    checklist_engine = get_checklist_engine()
    case_data = {"deposit_method": case.deposit_method.value, "amount": float(case.amount)}
    checklist = _evaluate_release_checklist(case, release_request)
    
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
    
    query = select(DepositCase).where(DepositCase.id == case_id).options(
        selectinload(DepositCase.release_requests),
        selectinload(DepositCase.clearances),
        selectinload(DepositCase.evidence),
        selectinload(DepositCase.institution),
    ).execution_options(populate_existing=True)
    result = await db.execute(query)
    case = result.scalar_one_or_none()
    
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    
    release_request = max(case.release_requests, key=lambda r: r.created_at) if case.release_requests else None
    if not release_request:
        raise HTTPException(status_code=404, detail="No release request found for this case")
    _require_route_authority(current_user, release_request.review_path or "")

    expected_status = _review_status(release_request.review_path or "")
    if case.status != expected_status:
        raise HTTPException(status_code=409, detail="Case is not in the final review stage for this route")
    
    if release_request.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Release request already decided (status: {release_request.status})"
        )
    
    if request.final_decision == ReleaseDecision.RELEASE:
        checklist_engine = get_checklist_engine()
        case_data = {"deposit_method": case.deposit_method.value, "amount": float(case.amount)}
        checklist_eval = _evaluate_release_checklist(case, release_request)
        if not checklist_eval["passed"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Checklist not complete. Missing: {', '.join(checklist_eval['missing_items'])}"
            )
        uncleared = [task.clearance_type for task in case.clearances if task.status.value != "cleared" or not task.evidence]
        if not case.clearances or uncleared:
            raise HTTPException(
                status_code=400,
                detail=f"Required clearances are incomplete or lack evidence: {', '.join(uncleared) if uncleared else 'no clearance tasks'}",
            )
        if not checklist_eval["passed"]:
            raise HTTPException(
                status_code=400,
                detail=f"Missing required evidence or clearance: {', '.join(checklist_eval['missing_items'])}",
            )
    
    release_request.final_decision = request.final_decision
    release_request.decision_reasoning = request.decision_reasoning
    release_request.checklist_data = request.checklist_data or {}
    release_request.decided_by = current_user.user_id
    release_request.decided_at = func.now()
    release_request.status = "decided"
    decision_checklist = _evaluate_release_checklist(case, release_request)
    
    old_status = case.status
    message = ""
    
    if request.final_decision == ReleaseDecision.RELEASE:
        case.status = CaseStatus.FINAL_DECISION
        output = "Approval Bureau NOC" if release_request.review_path == "fdr_rpgf" else "Council sanction order" if release_request.review_path == "rtgs" else "authority decision record"
        message = f"Authorization recorded. Issue and record the {output}; funds are not marked transferred."
    elif request.final_decision == ReleaseDecision.REJECT:
        case.status = CaseStatus.REJECTED
        message = "Release rejected"
    elif request.final_decision == ReleaseDecision.RETURN_FOR_CORRECTION:
        case.status = CaseStatus.CLEARED
        message = "Release returned for clarification"
    
    await case_service._log_case_event(
        case.id, "status_changed", current_user.user_id,
        old_status, case.status,
        {"reason": message, "decision": request.final_decision.value, "reasoning": request.decision_reasoning}
    )
    
    await audit_service.log_event(
        db=db, entity_type="deposit_case", entity_id=case.id,
        actor_id=current_user.user_id, action=AuditAction.RELEASE_DECIDED,
        new_values={
            "case_number": case.case_number,
            "decision": request.final_decision.value,
            "reasoning": request.decision_reasoning,
        },
    )
    
    await db.flush()
    # ``func.now()`` values are generated by the database.  Refresh before
    # building the response so SQLAlchemy does not attempt an implicit async
    # load while FastAPI is serializing it.
    await db.refresh(release_request)
    await db.refresh(case)
    
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
            checklist=ReleaseChecklistResponse(
                request_type=release_request.request_type,
                deposit_method=case.deposit_method.value,
                items=[ReleaseChecklistItem(**item) for item in decision_checklist["items"]],
                passed=decision_checklist["passed"],
                mandatory_count=decision_checklist["mandatory_count"],
                completed_count=decision_checklist["completed_count"],
                missing_items=decision_checklist["missing_items"],
            ),
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
    allowed_roles = {
        UserRole.COMPETENT_AUTHORITY, UserRole.APPROVAL_BUREAU,
        UserRole.COUNCIL, UserRole.INSTITUTION_REP,
    }
    if not (allowed_roles & set(current_user.roles)):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Release checklist access is restricted"
        )
    
    query = select(DepositCase).where(DepositCase.id == case_id).options(
        selectinload(DepositCase.release_requests),
        selectinload(DepositCase.institution),
        selectinload(DepositCase.clearances),
        selectinload(DepositCase.evidence),
    )
    result = await db.execute(query)
    case = result.scalar_one_or_none()
    
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    if UserRole.INSTITUTION_REP in current_user.roles and case.institution_id != current_user.institution_id:
        raise HTTPException(status_code=403, detail="Not authorized for this case")
    
    release_request = max(case.release_requests, key=lambda r: r.created_at) if case.release_requests else None
    if not release_request:
        raise HTTPException(status_code=404, detail="No release request found for this case")
    
    checklist = _evaluate_release_checklist(case, release_request)
    
    return ReleaseChecklistResponse(
        request_type=release_request.request_type,
        deposit_method=case.deposit_method.value,
        items=[ReleaseChecklistItem(**item) for item in checklist["items"]],
        passed=checklist["passed"],
        mandatory_count=checklist["mandatory_count"],
        completed_count=checklist["completed_count"],
        missing_items=checklist["missing_items"],
    )
