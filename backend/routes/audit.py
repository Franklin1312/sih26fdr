"""Audit log API routes."""

from fastapi import APIRouter, Depends, HTTPException, status, Query, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from typing import List, Optional, Any, Dict
from datetime import datetime
from pydantic import BaseModel

from backend.database import get_db
from backend.models import AuditLog, User, DepositCase, DepositEvidence
from backend.models.enums import AuditAction
from backend.services.auth import auth_service
from backend.services.access_control import access_control, UserContext
from backend.services.audit_service import audit_service
from backend.schemas.institution import CurrentUserResponse

router = APIRouter()


async def get_current_user(authorization: str = Header(None)) -> CurrentUserResponse:
    try:
        return await auth_service.get_current_user(authorization)
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


class ActorInfo(BaseModel):
    id: str
    full_name: Optional[str] = None
    email: Optional[str] = None
    role: Optional[str] = None


class AuditLogResponse(BaseModel):
    id: str
    entity_type: str
    entity_id: str
    action: str
    actor_id: str
    actor: Optional[ActorInfo] = None
    old_values: Optional[Dict[str, Any]] = None
    new_values: Optional[Dict[str, Any]] = None
    timestamp: datetime
    hash: str
    prev_hash: str
    sequence: int
    is_checkpoint: bool

    class Config:
        from_attributes = True


class AuditListResponse(BaseModel):
    items: List[AuditLogResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class ChainVerificationResponse(BaseModel):
    chain_valid: bool
    total_records: int
    verified_records: int
    first_hash: str
    last_hash: str
    tampered_records: List[str]
    message: str


def _format_audit_log(log: AuditLog) -> AuditLogResponse:
    actor_info = None
    if log.actor:
        actor_info = ActorInfo(
            id=log.actor.id,
            full_name=log.actor.full_name,
            email=log.actor.email,
            role=log.actor.role.value if hasattr(log.actor.role, "value") else str(log.actor.role),
        )
    return AuditLogResponse(
        id=log.id,
        entity_type=log.entity_type,
        entity_id=log.entity_id,
        action=log.action.value if hasattr(log.action, "value") else str(log.action),
        actor_id=log.actor_id,
        actor=actor_info,
        old_values=log.old_values,
        new_values=log.new_values,
        timestamp=log.timestamp,
        hash=log.hash,
        prev_hash=log.prev_hash,
        sequence=log.sequence,
        is_checkpoint=log.is_checkpoint,
    )


@router.get("/audit/verify", response_model=ChainVerificationResponse)
async def verify_audit_chain(
    db: AsyncSession = Depends(get_db),
    user: UserContext = Depends(get_user_context),
):
    """Verify cryptographic SHA-256 hash-chain integrity of all audit records."""
    try:
        result = await audit_service.verify_chain(db)
        return ChainVerificationResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/audit/cases/{case_id}", response_model=List[AuditLogResponse])
async def get_case_audit_logs(
    case_id: str,
    db: AsyncSession = Depends(get_db),
    user: UserContext = Depends(get_user_context),
):
    """Get complete audit trail for a specific deposit case and its child entities."""
    # Find all entity IDs associated with this case (case itself, documents, etc.)
    evidence_query = select(DepositEvidence.id).where(DepositEvidence.case_id == case_id)
    evidence_res = await db.execute(evidence_query)
    related_evidence_ids = [str(r[0]) for r in evidence_res.all()]

    all_ids = [case_id] + related_evidence_ids

    stmt = (
        select(AuditLog)
        .where(
            or_(
                AuditLog.entity_id.in_(all_ids),
                AuditLog.new_values["case_id"].as_string() == case_id,
            )
        )
        .order_by(AuditLog.sequence.desc())
    )
    result = await db.execute(stmt)
    logs = result.scalars().all()
    return [_format_audit_log(log) for log in logs]


@router.get("/audit", response_model=AuditListResponse)
async def list_audit_logs(
    entity_type: Optional[str] = Query(None),
    entity_id: Optional[str] = Query(None),
    action: Optional[str] = Query(None),
    actor_id: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    user: UserContext = Depends(get_user_context),
):
    """List system-wide audit records with pagination and filters."""
    query = select(AuditLog)
    count_query = select(func.count(AuditLog.id))

    if entity_type:
        query = query.where(AuditLog.entity_type == entity_type)
        count_query = count_query.where(AuditLog.entity_type == entity_type)
    if entity_id:
        query = query.where(AuditLog.entity_id == entity_id)
        count_query = count_query.where(AuditLog.entity_id == entity_id)
    if action:
        try:
            act_enum = AuditAction(action)
            query = query.where(AuditLog.action == act_enum)
            count_query = count_query.where(AuditLog.action == act_enum)
        except ValueError:
            pass
    if actor_id:
        query = query.where(AuditLog.actor_id == actor_id)
        count_query = count_query.where(AuditLog.actor_id == actor_id)

    total_res = await db.execute(count_query)
    total = total_res.scalar() or 0

    query = query.order_by(AuditLog.sequence.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    logs = result.scalars().all()

    items = [_format_audit_log(log) for log in logs]
    total_pages = (total + page_size - 1) // page_size if total > 0 else 1

    return AuditListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )
