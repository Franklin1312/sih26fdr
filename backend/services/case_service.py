"""Deposit Case service - Core business logic."""

import logging
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Tuple
from uuid import uuid4

from sqlalchemy import select, func, and_, or_, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.models import (
    DepositCase,
    Institution,
    User,
    DepositEvidence,
    CaseEvent,
    ClarificationRequest,
    ClearanceTask,
    ReleaseRequest,
    LifecycleDate,
    AuditLog,
)
from backend.models.enums import (
    CaseStatus,
    DepositType,
    DepositMethod,
    ClarificationStatus,
    ClearanceStatus,
    ReleaseRequestType,
    ReleaseDecision,
    LifecycleDateType,
    AuditAction,
    UserRole,
    can_transition,
)
from backend.schemas.deposit_case import (
    DepositCaseCreate,
    DepositCaseUpdate,
    DepositCaseStatusUpdate,
    DepositCaseListParams,
    DepositCaseDashboardStats,
)
from backend.schemas.evidence import DepositEvidenceCreate
from backend.schemas.workflow import (
    ClarificationRequestCreate,
    ClarificationRequestUpdate,
    ClearanceTaskCreate,
    ClearanceTaskUpdate,
    ReleaseRequestCreate,
    ReleaseRequestUpdate,
    LifecycleDateCreate,
)
from backend.services.audit_service import audit_service
from backend.services.access_control import access_control, UserContext

logger = logging.getLogger("sih26psfdr.case_service")


class CaseService:
    """Service for managing deposit cases."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_case(self, case_data: DepositCaseCreate, user: UserContext) -> DepositCase:
        """Create a new deposit case in DRAFT status."""
        if not user.has_permission("case:create"):
            raise PermissionError("Cannot create deposit cases")
        institution = await self.db.get(Institution, case_data.institution_id)
        if not institution:
            raise ValueError("Institution not found")
        if UserRole.INSTITUTION_REP in user.roles and user.institution_id != case_data.institution_id:
            raise PermissionError("Cannot create a case for another institution")
        
        if user.institution_id != case_data.institution_id and not access_control.require_permission(user, "case:create"):
            raise PermissionError("Cannot create case for another institution")
        
        tracking_ref = await self._generate_tracking_ref(case_data.deposit_type)
        
        case = DepositCase(
            tracking_ref=tracking_ref,
            institution_id=case_data.institution_id,
            deposit_type=case_data.deposit_type,
            deposit_method=case_data.deposit_method,
            amount=case_data.amount,
            currency=case_data.currency,
            instrument_number=case_data.instrument_number,
            instrument_date=case_data.instrument_date,
            issuing_bank=case_data.issuing_bank,
            maturity_date=case_data.maturity_date,
            term_end_date=case_data.term_end_date,
            aicte_clause_ref=case_data.aicte_clause_ref,
            status=CaseStatus.DRAFT,
            is_demo=False,
        )
        
        self.db.add(case)
        await self.db.flush()
        
        await self._create_lifecycle_dates(case)
        
        await audit_service.log_event(
            db=self.db,
            entity_type="deposit_case",
            entity_id=case.id,
            action=AuditAction.CREATE,
            actor_id=user.user_id,
            new_values={"tracking_ref": tracking_ref, "status": CaseStatus.DRAFT.value},
        )
        
        await self._log_case_event(case.id, "case_created", user.user_id, None, CaseStatus.DRAFT, {"tracking_ref": tracking_ref})
        
        return case

    async def update_case(self, case_id: str, case_data: DepositCaseUpdate, user: UserContext) -> DepositCase:
        """Update a deposit case (only in DRAFT status)."""
        case = await self.db.get(DepositCase, case_id)
        if not case:
            raise ValueError("Case not found")
        
        if not access_control.can_access_case(user, case.institution_id, case.assigned_officer_id, case.status.value):
            raise PermissionError("Cannot access this case")

        if not user.has_permission("case:update_draft"):
            raise PermissionError("Cannot update deposit cases")
        
        if case.status != CaseStatus.DRAFT:
            raise ValueError("Can only update cases in DRAFT status")
        
        old_values = {
            "deposit_type": case.deposit_type.value,
            "deposit_method": case.deposit_method.value,
            "amount": float(case.amount),
            "instrument_number": case.instrument_number,
            "instrument_date": case.instrument_date.isoformat() if case.instrument_date else None,
            "issuing_bank": case.issuing_bank,
            "maturity_date": case.maturity_date.isoformat() if case.maturity_date else None,
            "term_end_date": case.term_end_date.isoformat() if case.term_end_date else None,
            "aicte_clause_ref": case.aicte_clause_ref,
        }
        
        update_data = case_data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(case, field, value)
        
        case.updated_at = datetime.now(timezone.utc)
        
        new_values = {
            "deposit_type": case.deposit_type.value,
            "deposit_method": case.deposit_method.value,
            "amount": float(case.amount),
            "instrument_number": case.instrument_number,
            "instrument_date": case.instrument_date.isoformat() if case.instrument_date else None,
            "issuing_bank": case.issuing_bank,
            "maturity_date": case.maturity_date.isoformat() if case.maturity_date else None,
            "term_end_date": case.term_end_date.isoformat() if case.term_end_date else None,
            "aicte_clause_ref": case.aicte_clause_ref,
        }
        
        await audit_service.log_event(
            db=self.db,
            entity_type="deposit_case",
            entity_id=case.id,
            action=AuditAction.UPDATE,
            actor_id=user.user_id,
            old_values=old_values,
            new_values=new_values,
        )
        
        return case

    async def list_cases(self, params: DepositCaseListParams, user: UserContext) -> Tuple[List[DepositCase], int]:
        """List deposit cases with pagination and filters."""
        query = select(DepositCase).options(
            selectinload(DepositCase.institution),
            selectinload(DepositCase.assigned_officer),
        )
        
        if UserRole.INSTITUTION_REP in user.roles:
            query = query.where(DepositCase.institution_id == user.institution_id)
        elif UserRole.SCRUTINY_OFFICER in user.roles or UserRole.CLEARANCE_OFFICER in user.roles:
            query = query.where(DepositCase.assigned_officer_id == user.user_id)
        
        if params.status:
            query = query.where(DepositCase.status == params.status)
        if params.deposit_type:
            query = query.where(DepositCase.deposit_type == params.deposit_type)
        if params.deposit_method:
            query = query.where(DepositCase.deposit_method == params.deposit_method)
        if params.institution_id:
            query = query.where(DepositCase.institution_id == params.institution_id)
        if params.assigned_officer_id:
            query = query.where(DepositCase.assigned_officer_id == params.assigned_officer_id)
        if params.search:
            search_term = f"%{params.search}%"
            query = query.where(
                or_(
                    DepositCase.tracking_ref.ilike(search_term),
                    DepositCase.instrument_number.ilike(search_term),
                    DepositCase.issuing_bank.ilike(search_term),
                )
            )
        if params.date_from:
            query = query.where(DepositCase.created_at >= params.date_from)
        if params.date_to:
            query = query.where(DepositCase.created_at <= params.date_to)
        
        query = query.order_by(desc(DepositCase.created_at))
        
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await self.db.execute(count_query)
        total = total_result.scalar() or 0
        
        query = query.offset((params.page - 1) * params.page_size).limit(params.page_size)
        
        result = await self.db.execute(query)
        cases = result.scalars().all()
        
        return list(cases), total

    async def get_case(self, case_id: str, user: UserContext) -> DepositCase:
        """Get a deposit case by ID with all related data."""
        query = select(DepositCase).options(
            selectinload(DepositCase.institution),
            selectinload(DepositCase.assigned_officer),
            selectinload(DepositCase.evidence).selectinload(DepositEvidence.uploaded_by_user),
            selectinload(DepositCase.events).selectinload(CaseEvent.actor),
            selectinload(DepositCase.clarifications).selectinload(ClarificationRequest.requested_by_user),
            selectinload(DepositCase.clarifications).selectinload(ClarificationRequest.responded_by_user),
            selectinload(DepositCase.clearances).selectinload(ClearanceTask.assigned_to_user),
            selectinload(DepositCase.release_requests).selectinload(ReleaseRequest.created_by_user),
            selectinload(DepositCase.release_requests).selectinload(ReleaseRequest.decided_by_user),
            selectinload(DepositCase.lifecycle_dates),
        ).where(DepositCase.id == case_id)
        
        result = await self.db.execute(query)
        case = result.scalar_one_or_none()
        
        if not case:
            raise ValueError("Case not found")
        
        if not access_control.can_access_case(user, case.institution_id, case.assigned_officer_id, case.status.value):
            raise PermissionError("Cannot access this case")
        
        return case

    async def submit_case(self, case_id: str, user: UserContext) -> DepositCase:
        """Submit a case for review (DRAFT -> SUBMITTED)."""
        case = await self.get_case(case_id, user)
        confirmation = await self.db.execute(
            select(CaseEvent.id).where(
                CaseEvent.case_id == case_id,
                CaseEvent.event_type == "wizard_review_confirmed",
                CaseEvent.details["confirmed"].as_boolean().is_(True),
                CaseEvent.details["terms_accepted"].as_boolean().is_(True),
            ).limit(1)
        )
        if confirmation.scalar_one_or_none() is None:
            raise ValueError("Complete the review and accept the terms before submitting")
        evidence_result = await self.db.execute(
            select(DepositEvidence).where(
                DepositEvidence.case_id == case_id,
                DepositEvidence.is_deleted.is_(False),
                DepositEvidence.replaced_by_id.is_(None),
            )
        )
        evidence = evidence_result.scalars().all()
        from backend.services.validation import validation_engine
        validation = validation_engine.validate_case_completeness(
            case, [item.document_type for item in evidence]
        )
        if not validation.is_valid:
            raise ValueError(
                "Missing mandatory documents: " + ", ".join(validation.missing_mandatory)
            )
        return await self.transition_case_status(
            case_id,
            DepositCaseStatusUpdate(new_status=CaseStatus.SUBMITTED, reason="Submitted for review"),
            user
        )

    async def transition_case_status(
        self, 
        case_id: str, 
        status_update: DepositCaseStatusUpdate, 
        user: UserContext
    ) -> DepositCase:
        """Transition case status with validation."""
        case = await self.db.get(DepositCase, case_id)
        if not case:
            raise ValueError("Case not found")
        
        if not access_control.can_access_case(user, case.institution_id, case.assigned_officer_id, case.status.value):
            raise PermissionError("Cannot access this case")
        
        if not can_transition(case.status, status_update.new_status):
            raise ValueError(f"Invalid transition from {case.status.value} to {status_update.new_status.value}")

        if status_update.new_status == CaseStatus.RELEASE_REQUESTED:
            raise ValueError("Use the release request workflow to select and validate an authority route")

        if status_update.new_status == CaseStatus.RELEASED:
            raise PermissionError("Cases can only be released through the guarded release decision route")
        if status_update.new_status == CaseStatus.CLEARED:
            raise PermissionError("Clearance completion is the only route that can mark a case cleared")
        
        if not access_control.can_transition_case_status(
            user, case.status.value, status_update.new_status.value, case.institution_id
        ):
            raise PermissionError(f"Insufficient permissions for transition from {case.status.value} to {status_update.new_status.value}")
        
        old_status = case.status
        case.previous_status = old_status
        case.status = status_update.new_status
        case.updated_at = datetime.now(timezone.utc)
        
        if status_update.new_status == CaseStatus.SUBMITTED:
            case.submitted_at = datetime.now(timezone.utc)
        elif status_update.new_status in [CaseStatus.RELEASED, CaseStatus.REJECTED, CaseStatus.CLOSED]:
            case.closed_at = datetime.now(timezone.utc)
        
        if status_update.new_status == CaseStatus.UNDER_SCRUTINY and not case.assigned_officer_id:
            if UserRole.SCRUTINY_OFFICER in user.roles:
                case.assigned_officer_id = user.user_id
        
        await audit_service.log_event(
            db=self.db,
            entity_type="deposit_case",
            entity_id=case.id,
            action=AuditAction.STATUS_CHANGE,
            actor_id=user.user_id,
            old_values={"status": old_status.value},
            new_values={"status": status_update.new_status.value, "reason": status_update.reason},
        )
        
        await self._log_case_event(
            case.id, 
            "status_changed", 
            user.user_id, 
            old_status, 
            status_update.new_status, 
            {"reason": status_update.reason, "details": status_update.details}
        )
        
        if status_update.new_status == CaseStatus.CLEARANCE_QUEUE:
            await self._create_default_clearance_tasks(case.id, user.user_id)
        
        if status_update.new_status == CaseStatus.RELEASE_REQUESTED:
            await self._create_release_review_task(case.id, user.user_id)
        
        return case

    async def get_dashboard_stats(self, user: UserContext) -> DepositCaseDashboardStats:
        """Get dashboard statistics for deposit cases."""
        base_query = select(DepositCase)
        
        if UserRole.INSTITUTION_REP in user.roles:
            base_query = base_query.where(DepositCase.institution_id == user.institution_id)
        elif UserRole.SCRUTINY_OFFICER in user.roles:
            base_query = base_query.where(DepositCase.assigned_officer_id == user.user_id)
        elif UserRole.CLEARANCE_OFFICER in user.roles:
            base_query = base_query.where(DepositCase.assigned_officer_id == user.user_id)
        
        total_result = await self.db.execute(select(func.count()).select_from(base_query.subquery()))
        total = total_result.scalar() or 0
        
        status_query = select(DepositCase.status, func.count()).select_from(base_query.subquery()).group_by(DepositCase.status)
        status_result = await self.db.execute(status_query)
        by_status = {row[0].value: row[1] for row in status_result.all()}
        
        type_query = select(DepositCase.deposit_type, func.count()).select_from(base_query.subquery()).group_by(DepositCase.deposit_type)
        type_result = await self.db.execute(type_query)
        by_type = {row[0].value: row[1] for row in type_result.all()}
        
        method_query = select(DepositCase.deposit_method, func.count()).select_from(base_query.subquery()).group_by(DepositCase.deposit_method)
        method_result = await self.db.execute(method_query)
        by_method = {row[0].value: row[1] for row in method_result.all()}
        
        pending_my_action = 0
        if UserRole.INSTITUTION_REP in user.roles:
            pending_query = select(func.count()).where(
                and_(
                    DepositCase.institution_id == user.institution_id,
                    DepositCase.status.in_([
                        CaseStatus.DRAFT,
                        CaseStatus.CLARIFICATION_PENDING,
                        CaseStatus.CLEARED,
                    ])
                )
            )
            pending_result = await self.db.execute(pending_query)
            pending_my_action = pending_result.scalar() or 0
        elif UserRole.SCRUTINY_OFFICER in user.roles:
            pending_query = select(func.count()).where(
                and_(
                    DepositCase.assigned_officer_id == user.user_id,
                    DepositCase.status.in_([
                        CaseStatus.SUBMITTED,
                        CaseStatus.UNDER_SCRUTINY,
                        CaseStatus.CLARIFICATION_PENDING,
                    ])
                )
            )
            pending_result = await self.db.execute(pending_query)
            pending_my_action = pending_result.scalar() or 0
        elif UserRole.CLEARANCE_OFFICER in user.roles:
            pending_query = select(func.count()).where(
                and_(
                    DepositCase.assigned_officer_id == user.user_id,
                    DepositCase.status == CaseStatus.CLEARANCE_QUEUE,
                )
            )
            pending_result = await self.db.execute(pending_query)
            pending_my_action = pending_result.scalar() or 0
        
        now = datetime.now(timezone.utc)
        scoped_cases = base_query.subquery()
        overdue_query = select(func.count(LifecycleDate.id)).join(
            scoped_cases, LifecycleDate.case_id == scoped_cases.c.id
        ).where(
            LifecycleDate.date_type == LifecycleDateType.ADMIN_DEADLINE,
            LifecycleDate.date_value < now,
            LifecycleDate.alert_sent.is_(False),
        )
        overdue_result = await self.db.execute(overdue_query)
        overdue_clearances = overdue_result.scalar() or 0

        maturity_query = select(func.count(LifecycleDate.id)).join(
            scoped_cases, LifecycleDate.case_id == scoped_cases.c.id
        ).where(
            LifecycleDate.date_type == LifecycleDateType.FDR_MATURITY,
            LifecycleDate.date_value <= now + timedelta(days=30),
            LifecycleDate.date_value >= now,
        )
        maturity_result = await self.db.execute(maturity_query)
        upcoming_maturities = maturity_result.scalar() or 0

        amount_result = await self.db.execute(select(func.coalesce(func.sum(scoped_cases.c.amount), 0)))
        total_amount = float(amount_result.scalar() or 0)
        
        return DepositCaseDashboardStats(
            total=total,
            by_status=by_status,
            by_type=by_type,
            by_method=by_method,
            pending_my_action=pending_my_action,
            overdue_clearances=overdue_clearances,
            upcoming_maturities=upcoming_maturities,
            total_amount=total_amount,
            overdue_count=overdue_clearances,
            upcoming_maturity_count=upcoming_maturities,
        )

    async def _generate_tracking_ref(self, deposit_type: DepositType) -> str:
        """Generate a unique tracking reference."""
        prefix_map = {
            DepositType.SECURITY_DEPOSIT: "SD",
            DepositType.FDR: "FDR",
            DepositType.RPGF: "RPGF",
            DepositType.BANK_GUARANTEE: "BG",
        }
        prefix = prefix_map.get(deposit_type, "CASE")
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
        unique = str(uuid4())[:8].upper()
        return f"{prefix}-{timestamp}-{unique}"

    async def _create_lifecycle_dates(self, case: DepositCase):
        """Create default lifecycle dates for a new case."""
        dates_to_create = []
        
        if case.maturity_date:
            dates_to_create.append(LifecycleDate(
                case_id=case.id,
                date_type=LifecycleDateType.FDR_MATURITY,
                date_value=case.maturity_date,
                alert_lead_days=30,
                description="FDR maturity date - initiate release process",
            ))
        
        if case.term_end_date:
            dates_to_create.append(LifecycleDate(
                case_id=case.id,
                date_type=LifecycleDateType.AICTE_TERM_END,
                date_value=case.term_end_date,
                alert_lead_days=90,
                description="Security-deposit term end date recorded from case evidence",
            ))

        if case.deposit_type == DepositType.FDR and case.maturity_date:
            renewal_due = case.maturity_date - timedelta(days=365)
            if renewal_due > datetime.now(timezone.utc):
                dates_to_create.append(LifecycleDate(
                    case_id=case.id,
                    date_type=LifecycleDateType.RENEWAL_DUE,
                    date_value=renewal_due,
                    alert_lead_days=60,
                    description="FDR renewal due - prepare renewal documentation",
                ))
        
        for date_obj in dates_to_create:
            self.db.add(date_obj)
        
        await self.db.flush()

    async def _create_default_clearance_tasks(self, case_id: str, created_by: str):
        """Create default clearance tasks when case enters clearance queue."""
        clearance_types = [
            ("financial_verification", "Financial document verification"),
            ("legal_compliance", "Legal compliance check"),
            ("technical_verification", "Technical document verification"),
        ]
        
        for clearance_type, description in clearance_types:
            task = ClearanceTask(
                case_id=case_id,
                clearance_type=clearance_type,
                assigned_to=created_by,
                status=ClearanceStatus.PENDING,
                notes=description,
            )
            self.db.add(task)
        
        await self.db.flush()

    async def _create_release_review_task(self, case_id: str, created_by: str):
        """Create release review task based on deposit method."""
        case = await self.db.get(DepositCase, case_id)
        if not case:
            return
        
        review_path_map = {
            DepositMethod.FDR_RPGF: "fdr_rpgf",
            DepositMethod.RTGS: "rtgs",
            DepositMethod.SECURITY_DEPOSIT_REFUND: "sd_refund",
        }
        
        review_path = review_path_map.get(case.deposit_method, "fdr_rpgf")
        
        release_request = ReleaseRequest(
            case_id=case_id,
            created_by=created_by,
            request_type=ReleaseRequestType.MATURITY,
            review_path=review_path,
            status="pending",
            checklist_data={},
        )
        self.db.add(release_request)
        await self.db.flush()

    async def _log_case_event(
        self,
        case_id: str,
        event_type: str,
        actor_id: str,
        old_status: Optional[CaseStatus],
        new_status: Optional[CaseStatus],
        details: Optional[dict],
    ):
        """Log a case event for audit trail."""
        event = CaseEvent(
            case_id=case_id,
            event_type=event_type,
            actor_id=actor_id,
            old_status=old_status,
            new_status=new_status,
            details=details,
        )
        self.db.add(event)
        await self.db.flush()

    # ===== Clarification Methods =====

    async def create_clarification(
        self, request: ClarificationRequestCreate, user: UserContext
    ) -> ClarificationRequest:
        """Create a clarification request (Scrutiny Officer)."""
        case = await self.get_case(request.case_id, user)

        if case.status != CaseStatus.UNDER_SCRUTINY:
            raise ValueError("Clarifications can only be requested for cases under scrutiny")

        if not access_control.can_transition_case_status(user, case.status.value, CaseStatus.CLARIFICATION_PENDING.value, case.institution_id):
            raise PermissionError("Cannot transition case to clarification pending")

        old_status = case.status
        case.status = CaseStatus.CLARIFICATION_PENDING

        clarification = ClarificationRequest(
            case_id=request.case_id,
            requested_by=user.user_id,
            question=request.question,
            status=ClarificationStatus.PENDING,
        )

        self.db.add(clarification)
        await self.db.flush()

        await audit_service.log_event(
            db=self.db,
            entity_type="clarification_request",
            entity_id=clarification.id,
            action=AuditAction.CLARIFICATION_REQUEST,
            actor_id=user.user_id,
            new_values={"question": request.question, "case_status": case.status.value},
        )

        await self._log_case_event(
            case.id, "clarification_requested", user.user_id, old_status, case.status,
            {"clarification_id": clarification.id, "question": request.question}
        )

        return clarification

    async def list_clarifications(
        self, case_id: str, params, user: UserContext
    ) -> Tuple[List[ClarificationRequest], int]:
        """List clarification requests for a case."""
        case = await self.get_case(case_id, user)

        stmt = select(ClarificationRequest).where(
            ClarificationRequest.case_id == case_id
        ).order_by(ClarificationRequest.created_at.desc())

        count_stmt = select(func.count()).select_from(stmt.subquery())
        total_result = await self.db.execute(count_stmt)
        total = total_result.scalar()

        stmt = stmt.offset((params.page - 1) * params.page_size).limit(params.page_size)
        result = await self.db.execute(stmt)
        clarifications = result.scalars().all()

        return list(clarifications), total

    async def get_clarification(
        self, clarification_id: str, user: UserContext
    ) -> Optional[ClarificationRequest]:
        """Get a specific clarification request."""
        clarification = await self.db.get(ClarificationRequest, clarification_id)
        if not clarification:
            return None

        case = await self.get_case(clarification.case_id, user)
        if not case:
            return None

        return clarification

    async def respond_clarification(
        self, clarification_id: str, request: ClarificationRequestUpdate, user: UserContext
    ) -> ClarificationRequest:
        """Respond to a clarification request (Institution Rep)."""
        clarification = await self.get_clarification(clarification_id, user)
        if not clarification:
            raise ValueError("Clarification not found")

        if clarification.status != ClarificationStatus.PENDING:
            raise ValueError("Clarification already responded")

        case = await self.db.get(DepositCase, clarification.case_id)
        if user.institution_id != case.institution_id and not access_control.require_permission(user, "clarification:respond"):
            raise PermissionError("Cannot respond to clarification for another institution")

        clarification.response = request.response
        clarification.status = ClarificationStatus.RESPONDED
        clarification.responded_by = user.user_id
        clarification.resolved_at = datetime.now(timezone.utc)

        old_status = case.status
        case.status = CaseStatus.UNDER_SCRUTINY

        await self.db.flush()

        await audit_service.log_event(
            db=self.db,
            entity_type="clarification_request",
            entity_id=clarification.id,
            action=AuditAction.CLARIFICATION_RESPONSE,
            actor_id=user.user_id,
            old_values={"status": ClarificationStatus.PENDING.value},
            new_values={"status": ClarificationStatus.RESPONDED.value, "response": request.response},
        )

        await self._log_case_event(
            case.id, "clarification_responded", user.user_id, old_status, case.status,
            {"clarification_id": clarification.id}
        )

        return clarification

    async def update_clarification_status(
        self, clarification_id: str, new_status: ClarificationStatus, user: UserContext
    ) -> ClarificationRequest:
        """Update clarification status (Scrutiny Officer - resolve/reopen)."""
        clarification = await self.get_clarification(clarification_id, user)
        if not clarification:
            raise ValueError("Clarification not found")

        if new_status == ClarificationStatus.RESOLVED:
            if clarification.status != ClarificationStatus.RESPONDED:
                raise ValueError("Can only resolve responded clarifications")
        elif new_status == ClarificationStatus.PENDING:
            if clarification.status != ClarificationStatus.RESPONDED:
                raise ValueError("Can only reopen responded clarifications")
        else:
            raise ValueError("Invalid status transition")

        old_status = clarification.status
        clarification.status = new_status

        if new_status == ClarificationStatus.RESOLVED:
            clarification.resolved_at = datetime.now(timezone.utc)

        await self.db.flush()

        await audit_service.log_event(
            db=self.db,
            entity_type="clarification_request",
            entity_id=clarification.id,
            action=AuditAction.CLARIFICATION_RESPONSE,
            actor_id=user.user_id,
            old_values={"status": old_status.value},
            new_values={"status": new_status.value},
        )

        return clarification
