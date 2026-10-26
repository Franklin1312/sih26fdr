"""Clearance routes - Clearance officer workflow."""

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status, Header
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.database import get_db
from backend.services.auth import auth_service
from backend.services.access_control import access_control
from backend.services.audit_service import audit_service
from backend.services.case_service import CaseService
from backend.models.entities_case import (
    DepositCase,
)
from backend.models.entities_clarification import (
    ClearanceTask,
)
from backend.models.entities_core import User
from backend.models.enums import (
    AuditAction,
    CaseStatus,
    ClearanceStatus,
    UserRole,
)
from backend.schemas.clearance import (
    ClearanceClaimRequest,
    ClearanceCompleteRequest,
    ClearanceHistoryResponse,
    ClearanceQueueItem,
    ClearanceQueueResponse,
    ClearanceTaskDetail,
    ClearanceTaskUpdateRequest,
)
from backend.schemas.institution import CurrentUserResponse

router = APIRouter(prefix="/clearance", tags=["clearance"])


async def get_current_user(authorization: str = Header(None)):
    try:
        user = await auth_service.get_current_user(authorization)
        return user
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))


async def get_case_service(db: AsyncSession = Depends(get_db)) -> CaseService:
    return CaseService(db)


@router.get("/queue", response_model=ClearanceQueueResponse)
async def get_clearance_queue(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status_filter: Optional[str] = Query(None, alias="status"),
    current_user=Depends(get_current_user),
    case_service: CaseService = Depends(get_case_service),
    db: AsyncSession = Depends(get_db),
):
    """Get clearance queue for the current clearance officer."""
    if UserRole.CLEARANCE_OFFICER not in current_user.roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only clearance officers can access clearance queue"
        )
    
    query = select(DepositCase).where(
        and_(
            DepositCase.status == CaseStatus.CLEARANCE_QUEUE,
            or_(
                DepositCase.assigned_officer_id == current_user.user_id,
                DepositCase.assigned_officer_id.is_(None),
            ),
        )
    )
    
    # Browser filter controls submit an empty string for "All statuses".
    # Parse it explicitly rather than letting FastAPI turn it into a 422.
    if status_filter:
        try:
            query = query.where(DepositCase.status == CaseStatus(status_filter))
        except ValueError:
            raise HTTPException(status_code=400, detail="Unknown clearance status filter")
    
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0
    
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size).order_by(DepositCase.created_at.desc())
    query = query.options(
        selectinload(DepositCase.clearances).selectinload(ClearanceTask.assigned_to_user),
        selectinload(DepositCase.institution),
    )
    
    result = await db.execute(query)
    cases = result.scalars().unique().all()
    
    items = []
    for case in cases:
        tasks = [t for t in case.clearances if t.assigned_to == current_user.user_id]
        items.append(ClearanceQueueItem(
            case_id=case.id, case_number=case.case_number,
            institution_name=case.institution.name if case.institution else "Unknown",
            deposit_type=case.deposit_type.value, deposit_method=case.deposit_method.value,
            amount=float(case.amount), status=case.status,
            assigned_officer_id=case.assigned_officer_id, clearance_tasks=tasks,
            created_at=case.created_at, submitted_at=case.submitted_at,
        ))
    
    return ClearanceQueueResponse(items=items, total=total, page=page, page_size=page_size)


@router.get("/cases/{case_id}", response_model=ClearanceTaskDetail)
async def get_clearance_case_detail(
    case_id: str, current_user=Depends(get_current_user), db: AsyncSession = Depends(get_db),
):
    """Get case detail with all clearance tasks for the officer."""
    if UserRole.CLEARANCE_OFFICER not in current_user.roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only clearance officers can access clearance cases")
    
    query = select(DepositCase).where(DepositCase.id == case_id).options(
        selectinload(DepositCase.clearances).selectinload(ClearanceTask.assigned_to_user),
        selectinload(DepositCase.institution),
    )
    result = await db.execute(query)
    case = result.scalar_one_or_none()
    
    if not case: raise HTTPException(status_code=404, detail="Case not found")
    if case.assigned_officer_id != current_user.user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not assigned to this case")
    
    tasks = [t for t in case.clearances if t.assigned_to == current_user.user_id]
    if not tasks: raise HTTPException(status_code=404, detail="No clearance tasks assigned to you for this case")
    
    task = tasks[0]
    return ClearanceTaskDetail(
        id=task.id, case_id=task.case_id, clearance_type=task.clearance_type,
        assigned_to=task.assigned_to, status=task.status, evidence=task.evidence,
        notes=task.notes, completed_at=task.completed_at, created_at=task.created_at,
        updated_at=task.updated_at, assigned_to_user=task.assigned_to_user,
        case_number=case.case_number,
        institution_name=case.institution.name if case.institution else "Unknown",
        deposit_type=case.deposit_type.value, deposit_method=case.deposit_method.value,
    )


# --- Additional endpoints ---


@router.post("/cases/{case_id}/claim", response_model=ClearanceTaskDetail)
async def claim_clearance_case(
    case_id: str, request: ClearanceClaimRequest,
    current_user=Depends(get_current_user),
    case_service: CaseService = Depends(get_case_service),
    db: AsyncSession = Depends(get_db),
):
    """Claim a clearance case (assign self as officer)."""
    if UserRole.CLEARANCE_OFFICER not in current_user.roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only clearance officers can claim cases")
    
    query = select(DepositCase).where(DepositCase.id == case_id).options(selectinload(DepositCase.clearances))
    result = await db.execute(query)
    case = result.scalar_one_or_none()
    
    if not case: raise HTTPException(status_code=404, detail="Case not found")
    if case.status != CaseStatus.CLEARANCE_QUEUE:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Case is not in clearance queue (status: {case.status.value})")
    
    if case.assigned_officer_id and case.assigned_officer_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Case has already been claimed by another officer")
    if not case.clearances:
        raise HTTPException(status_code=409, detail="Case has no clearance tasks")
    case.assigned_officer_id = current_user.user_id
    for task in case.clearances:
        task.assigned_to = current_user.user_id
    
    await db.flush()
    
    await audit_service.log_event(
        db=db, entity_type="deposit_case", entity_id=case_id,
        actor_id=current_user.user_id, action=AuditAction.CLEARANCE_CASE_CLAIMED,
        new_values={"case_number": case.case_number},
    )
    
    task = case.clearances[0] if case.clearances else None
    if not task: raise HTTPException(status_code=404, detail="No clearance tasks found")
    
    return ClearanceTaskDetail(
        id=task.id, case_id=task.case_id, clearance_type=task.clearance_type,
        assigned_to=task.assigned_to, status=task.status, evidence=task.evidence,
        notes=task.notes, completed_at=task.completed_at, created_at=task.created_at,
        updated_at=task.updated_at, assigned_to_user=task.assigned_to_user,
        case_number=case.case_number,
        institution_name=case.institution.name if case.institution else "Unknown",
        deposit_type=case.deposit_type.value, deposit_method=case.deposit_method.value,
    )


# More endpoints will be added


@router.patch("/tasks/{task_id}", response_model=ClearanceTaskDetail)
async def update_clearance_task(
    task_id: str, request: ClearanceTaskUpdateRequest,
    current_user=Depends(get_current_user),
    case_service: CaseService = Depends(get_case_service),
    db: AsyncSession = Depends(get_db),
):
    """Update a clearance task (status, evidence, notes)."""
    if UserRole.CLEARANCE_OFFICER not in current_user.roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only clearance officers can update clearance tasks")
    
    task = await db.get(ClearanceTask, task_id)
    if not task: raise HTTPException(status_code=404, detail="Clearance task not found")
    if task.assigned_to != current_user.user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not assigned to this task")
    if request.status == ClearanceStatus.CLEARED and not (request.evidence or task.evidence):
        raise HTTPException(status_code=400, detail="Evidence is required before a clearance can be completed")
    
    if request.status is not None:
        task.status = request.status
        if request.status == ClearanceStatus.CLEARED:
            task.completed_at = func.now()
    if request.evidence is not None: task.evidence = request.evidence
    if request.notes is not None: task.notes = request.notes
    
    await db.flush()
    
    # Check if all tasks for this case are cleared
    # This response and the all-clear check need relationships.  Loading a
    # bare case then reading ``case.clearances`` causes an implicit async lazy
    # load (and a 500/MissingGreenlet) in a real server request.
    case_result = await db.execute(
        select(DepositCase).where(DepositCase.id == task.case_id).options(
            selectinload(DepositCase.clearances),
            selectinload(DepositCase.institution),
        )
    )
    case = case_result.scalar_one_or_none()
    if case:
        all_cleared = bool(case.clearances) and all(t.status == ClearanceStatus.CLEARED for t in case.clearances)
        if all_cleared and case.status == CaseStatus.CLEARANCE_QUEUE:
            old_status = case.status
            case.status = CaseStatus.CLEARED
            await case_service._log_case_event(
                case.id, "status_changed", current_user.user_id,
                old_status, CaseStatus.CLEARED,
                {"reason": "All clearance tasks completed", "auto_transition": True}
            )
            await audit_service.log_event(
                db=db, entity_type="deposit_case", entity_id=case.id,
                actor_id=current_user.user_id, action=AuditAction.CLEARANCE_ALL_CLEARED,
                new_values={"case_number": case.case_number, "all_tasks_cleared": True},
            )
    
    # completed_at / updated_at are assigned by the database. Refresh scalar
    # fields before building the response so async SQLAlchemy does not attempt
    # an implicit lazy load during serialization.
    await db.refresh(task)
    await db.refresh(task, ["assigned_to_user"])
    
    return ClearanceTaskDetail(
        id=task.id, case_id=task.case_id, clearance_type=task.clearance_type,
        assigned_to=task.assigned_to, status=task.status, evidence=task.evidence,
        notes=task.notes, completed_at=task.completed_at, created_at=task.created_at,
        updated_at=task.updated_at, assigned_to_user=task.assigned_to_user,
        case_number=case.case_number if case else "Unknown",
        institution_name=case.institution.name if case and case.institution else "Unknown",
        deposit_type=case.deposit_type.value if case else "Unknown",
        deposit_method=case.deposit_method.value if case else "Unknown",
    )


# More endpoints will be added


@router.post("/tasks/{task_id}/complete", response_model=ClearanceTaskDetail)
async def complete_clearance_task(
    task_id: str, request: ClearanceCompleteRequest,
    current_user=Depends(get_current_user),
    case_service: CaseService = Depends(get_case_service),
    db: AsyncSession = Depends(get_db),
):
    """Mark a clearance task as complete (CLEARED)."""
    if UserRole.CLEARANCE_OFFICER not in current_user.roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only clearance officers can complete clearance tasks")
    
    task = await db.get(ClearanceTask, task_id)
    if not task: raise HTTPException(status_code=404, detail="Clearance task not found")
    if task.assigned_to != current_user.user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not assigned to this task")
    if not request.evidence or not request.evidence.strip():
        raise HTTPException(status_code=400, detail="Linked evidence is required before a clearance can be completed")
    
    task.status = ClearanceStatus.CLEARED
    task.completed_at = func.now()
    task.evidence = request.evidence.strip()
    if request.notes:
        task.notes = (task.notes or "") + f"\nCompletion: {request.notes}"
    
    await db.flush()
    
    # Eager-load the aggregate before checking completion and serializing its
    # institution fields; otherwise the first completion attempt can return
    # an Internal Server Error outside SQLAlchemy's async greenlet context.
    case_result = await db.execute(
        select(DepositCase).where(DepositCase.id == task.case_id).options(
            selectinload(DepositCase.clearances),
            selectinload(DepositCase.institution),
        )
    )
    case = case_result.scalar_one_or_none()
    if case:
        all_cleared = bool(case.clearances) and all(t.status == ClearanceStatus.CLEARED for t in case.clearances)
        if all_cleared and case.status == CaseStatus.CLEARANCE_QUEUE:
            old_status = case.status
            case.status = CaseStatus.CLEARED
            await case_service._log_case_event(
                case.id, "status_changed", current_user.user_id,
                old_status, CaseStatus.CLEARED,
                {"reason": "All clearance tasks completed", "auto_transition": True}
            )
            await audit_service.log_event(
                db=db, entity_type="deposit_case", entity_id=case.id,
                actor_id=current_user.user_id, action=AuditAction.CLEARANCE_ALL_CLEARED,
                new_values={"case_number": case.case_number, "all_tasks_cleared": True},
            )
    
    # completed_at / updated_at are assigned by the database. Refresh scalar
    # fields before building the response so async SQLAlchemy does not attempt
    # an implicit lazy load during serialization.
    await db.refresh(task)
    await db.refresh(task, ["assigned_to_user"])
    
    return ClearanceTaskDetail(
        id=task.id, case_id=task.case_id, clearance_type=task.clearance_type,
        assigned_to=task.assigned_to, status=task.status, evidence=task.evidence,
        notes=task.notes, completed_at=task.completed_at, created_at=task.created_at,
        updated_at=task.updated_at, assigned_to_user=task.assigned_to_user,
        case_number=case.case_number if case else "Unknown",
        institution_name=case.institution.name if case and case.institution else "Unknown",
        deposit_type=case.deposit_type.value if case else "Unknown",
        deposit_method=case.deposit_method.value if case else "Unknown",
    )


@router.get("/cases/{case_id}/history", response_model=ClearanceHistoryResponse)
async def get_clearance_history(
    case_id: str, current_user=Depends(get_current_user), db: AsyncSession = Depends(get_db),
):
    """Get clearance history for a case."""
    if UserRole.CLEARANCE_OFFICER not in current_user.roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only clearance officers can view clearance history")
    
    query = select(DepositCase).where(DepositCase.id == case_id).options(
        selectinload(DepositCase.clearances).selectinload(ClearanceTask.assigned_to_user)
    )
    result = await db.execute(query)
    case = result.scalar_one_or_none()
    
    if not case: raise HTTPException(status_code=404, detail="Case not found")
    
    tasks = []
    for task in case.clearances:
        officer_name = task.assigned_to_user.full_name if task.assigned_to_user else None
        tasks.append(ClearanceHistoryItem(
            task_id=task.id, clearance_type=task.clearance_type, status=task.status,
            evidence=task.evidence, notes=task.notes, completed_at=task.completed_at,
            officer_name=officer_name,
        ))
    all_cleared = bool(case.clearances) and all(t.status == ClearanceStatus.CLEARED for t in case.clearances)
    
    return ClearanceHistoryResponse(
        case_id=case.id, case_number=case.case_number, current_status=case.status,
        tasks=tasks, all_cleared=all_cleared,
    )
