"""Wizard Service - Multi-step submission flow."""

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.models import (
    DepositCase,
    Institution,
    User,
    DepositEvidence,
    CaseEvent,
)
from backend.models.enums import (
    CaseStatus,
    DepositType,
    DepositMethod,
    AuditAction,
)
from backend.services.validation import validation_engine, ValidationResult
from backend.services.audit_service import audit_service
from backend.services.access_control import access_control, UserContext

logger = logging.getLogger("sih26psfdr.wizard")


class WizardState:
    """Wizard step states."""
    STEP_1 = "step_1"  # Case Details
    STEP_2 = "step_2"  # Documents
    STEP_3 = "step_3"  # Review & Completeness Check
    STEP_4 = "step_4"  # Submit


class WizardService:
    """Service for managing the multi-step submission wizard."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_case_for_wizard(self, case_id: str, user: UserContext) -> Optional[DepositCase]:
        """Get case for wizard, checking permissions."""
        case = await self.db.get(DepositCase, case_id)
        if not case:
            return None

        # Check access
        if not access_control.can_access_case(
            user, case.institution_id, case.assigned_officer_id, case.status.value
        ):
            return None

        # Only allow wizard on DRAFT cases
        if case.status != CaseStatus.DRAFT:
            return None

        return case

    async def create_draft_case(self, user: UserContext, institution_id: str) -> DepositCase:
        """Create a new draft case for the wizard."""
        institution = await self.db.get(Institution, institution_id)
        if not institution:
            raise ValueError("Institution not found")

        if not user.has_permission("case:create"):
            raise PermissionError("Cannot create a deposit case")
        if user.institution_id and user.institution_id != institution_id:
            raise PermissionError("Cannot create a case for another institution")

        if user.institution_id != institution_id and not access_control.require_permission(user, "case:create"):
            raise PermissionError("Cannot create case for another institution")

        # Create minimal draft case
        case = DepositCase(
            tracking_ref=f"DRAFT-{uuid4().hex[:12].upper()}",
            institution_id=institution_id,
            deposit_type=DepositType.FDR,  # Placeholder
            deposit_method=DepositMethod.FDR_RPGF,  # Placeholder
            amount=0,  # Placeholder
            currency="INR",
            instrument_number="",  # Placeholder
            issuing_bank="",  # Placeholder
            maturity_date=None,
            aicte_clause_ref=None,
            status=CaseStatus.DRAFT,
            is_demo=False,
        )

        self.db.add(case)
        await self.db.flush()

        await audit_service.log_event(
            db=self.db,
            entity_type="deposit_case",
            entity_id=case.id,
            action=AuditAction.CREATE,
            actor_id=user.user_id,
            new_values={"status": CaseStatus.DRAFT.value, "wizard_created": True},
        )

        return case

    async def validate_step1(self, case_id: str, data: Dict[str, Any], user: UserContext) -> ValidationResult:
        """Validate and save Step 1: Case Details."""
        case = await self.get_case_for_wizard(case_id, user)
        if not case:
            return ValidationResult(is_valid=False, errors=["Case not found or not accessible"])

        # Validate data
        result = validation_engine.validate_step1_data(data)
        if not result.is_valid:
            return result

        # Update case with step 1 data
        case.deposit_type = DepositType(data["deposit_type"])
        case.deposit_method = DepositMethod(data["deposit_method"])
        case.amount = data["amount"]
        case.currency = data.get("currency", "INR")
        case.instrument_number = data["instrument_number"]
        case.instrument_date = datetime.fromisoformat(data["instrument_date"].replace("Z", "+00:00")) if data.get("instrument_date") else None
        case.issuing_bank = data["issuing_bank"]

        if data.get("maturity_date"):
            from datetime import datetime
            case.maturity_date = datetime.fromisoformat(data["maturity_date"].replace("Z", "+00:00"))

        case.aicte_clause_ref = data.get("aicte_clause_ref")
        case.term_end_date = datetime.fromisoformat(data["term_end_date"].replace("Z", "+00:00")) if data.get("term_end_date") else None

        await self.db.flush()

        await audit_service.log_event(
            db=self.db,
            entity_type="deposit_case",
            entity_id=case.id,
            action=AuditAction.UPDATE,
            actor_id=user.user_id,
            new_values={"wizard_step": WizardState.STEP_1, **data},
        )

        return ValidationResult(is_valid=True)

    async def validate_step2(self, case_id: str, data: Dict[str, Any], user: UserContext) -> ValidationResult:
        """Validate and save Step 2: Documents."""
        case = await self.get_case_for_wizard(case_id, user)
        if not case:
            return ValidationResult(is_valid=False, errors=["Case not found or not accessible"])

        # Validate data structure
        result = validation_engine.validate_step2_data(data)
        # Documents are uploaded separately via evidence routes
        # This step just confirms document types provided

        await audit_service.log_event(
            db=self.db,
            entity_type="deposit_case",
            entity_id=case.id,
            action=AuditAction.UPDATE,
            actor_id=user.user_id,
            new_values={"wizard_step": WizardState.STEP_2, "document_types": [d.get("document_type") for d in data.get("documents", [])]},
        )

        return result

    async def validate_step3(
        self, case_id: str, data: Dict[str, Any], user: UserContext
    ) -> ValidationResult:
        """Validate Step 3: Review & Completeness Check (PS-03)."""
        case = await self.get_case_for_wizard(case_id, user)
        if not case:
            return ValidationResult(is_valid=False, errors=["Case not found or not accessible"])

        # Validate confirmation
        result = validation_engine.validate_step3_data(data)
        if not result.is_valid:
            return result

        # Fetch uploaded documents
        stmt = select(DepositEvidence).where(
            DepositEvidence.case_id == case_id,
            DepositEvidence.is_deleted == False,
        )
        result_docs = await self.db.execute(stmt)
        documents = result_docs.scalars().all()

        # Convert to dicts for validation
        uploaded_docs = [
            {"document_type": doc.document_type} for doc in documents
        ]

        # Get institution for conditional checks
        institution = await self.db.get(Institution, case.institution_id)

        # Run completeness check (PS-03)
        completeness = validation_engine.validate_case_completeness(
            case, [doc["document_type"] for doc in uploaded_docs]
        )

        if not completeness.is_valid:
            return ValidationResult(
                is_valid=False,
                missing_mandatory=completeness.missing_mandatory,
                missing_conditional=completeness.missing_conditional,
                errors=[f"Missing mandatory documents: {', '.join(completeness.missing_mandatory)}"],
                warnings=completeness.warnings,
            )

        await audit_service.log_event(
            db=self.db,
            entity_type="deposit_case",
            entity_id=case.id,
            action=AuditAction.UPDATE,
            actor_id=user.user_id,
            new_values={
                "wizard_step": WizardState.STEP_3,
                "completeness_check": "passed",
                "mandatory_docs_found": len(uploaded_docs) - len(completeness.missing_mandatory),
                "conditional_docs_missing": len(completeness.missing_conditional),
            },
        )

        from backend.models import CaseEvent
        self.db.add(CaseEvent(
            case_id=case.id,
            event_type="wizard_review_confirmed",
            actor_id=user.user_id,
            details={"confirmed": True, "terms_accepted": True},
        ))
        await self.db.flush()

        return ValidationResult(
            is_valid=True,
            warnings=completeness.warnings,
            missing_conditional=completeness.missing_conditional,
        )

    async def submit_case(self, case_id: str, user: UserContext) -> DepositCase:
        """Step 4: Submit case (DRAFT -> SUBMITTED)."""
        case = await self.get_case_for_wizard(case_id, user)
        if not case:
            raise ValueError("Case not found or not accessible")

        # Verify case has required data
        if not all([case.deposit_type, case.deposit_method, case.amount, case.instrument_number, case.issuing_bank]):
            raise ValueError("Case data incomplete - complete all wizard steps first")

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

        evidence_result = await self.db.execute(select(DepositEvidence).where(
            DepositEvidence.case_id == case_id,
            DepositEvidence.is_deleted.is_(False),
            DepositEvidence.replaced_by_id.is_(None),
        ))
        completeness = validation_engine.validate_case_completeness(
            case, [item.document_type for item in evidence_result.scalars().all()]
        )
        if not completeness.is_valid:
            raise ValueError("Missing mandatory documents: " + ", ".join(completeness.missing_mandatory))

        # Generate tracking reference if not set
        if not case.tracking_ref:
            from backend.services.case_service import CaseService
            case_service = CaseService(self.db)
            case.tracking_ref = await case_service._generate_tracking_ref(case.deposit_type)

        # Transition to SUBMITTED
        old_status = case.status
        case.status = CaseStatus.SUBMITTED
        case.submitted_at = datetime.now(timezone.utc)

        await self.db.flush()

        # Create lifecycle dates if not exist
        from backend.services.case_service import CaseService
        case_service = CaseService(self.db)
        await case_service._create_lifecycle_dates(case)

        await audit_service.log_event(
            db=self.db,
            entity_type="deposit_case",
            entity_id=case.id,
            action=AuditAction.STATUS_CHANGE,
            actor_id=user.user_id,
            old_values={"status": old_status.value},
            new_values={"status": CaseStatus.SUBMITTED.value, "submitted_at": case.submitted_at.isoformat()},
        )

        # Log case event
        event = CaseEvent(
            case_id=case.id,
            event_type="case_submitted",
            actor_id=user.user_id,
            old_status=old_status,
            new_status=CaseStatus.SUBMITTED,
            details={"wizard_completed": True},
        )
        self.db.add(event)

        return case

    async def get_wizard_state(self, case_id: str, user: UserContext) -> Dict[str, Any]:
        """Get current wizard state for a case."""
        case = await self.get_case_for_wizard(case_id, user)
        if not case:
            return {"error": "Case not found or not accessible"}

        # Check uploaded documents
        stmt = select(DepositEvidence).where(
            DepositEvidence.case_id == case_id,
            DepositEvidence.is_deleted == False,
        )
        result = await self.db.execute(stmt)
        documents = result.scalars().all()

        uploaded_doc_types = {doc.document_type for doc in documents}

        # Get required documents
        institution = await self.db.get(Institution, case.institution_id)
        required = validation_engine.get_required_documents(
            case.deposit_type,
            case.deposit_method,
            institution,
            float(case.amount) if case.amount else None,
        )

        # Determine current step
        step = WizardState.STEP_1
        if case.instrument_number and case.issuing_bank:
            step = WizardState.STEP_2
        if uploaded_doc_types:
            step = WizardState.STEP_3

        step1_completed = bool(case.instrument_number and case.issuing_bank and case.amount and case.amount > 0)
        step2_completed = bool(uploaded_doc_types)
        step3_result = await self.db.execute(select(CaseEvent.id).where(
            CaseEvent.case_id == case_id,
            CaseEvent.event_type == "wizard_review_confirmed",
            CaseEvent.details["confirmed"].as_boolean().is_(True),
            CaseEvent.details["terms_accepted"].as_boolean().is_(True),
        ).limit(1))
        step3_completed = step3_result.scalar_one_or_none() is not None
        return {
            "case_id": case.id,
            "tracking_ref": case.tracking_ref,
            "current_step": step,
            "deposit_type": case.deposit_type.value,
            "deposit_method": case.deposit_method.value,
            "amount": float(case.amount) if case.amount else 0,
            "currency": case.currency,
            "instrument_number": case.instrument_number,
            "instrument_date": case.instrument_date.isoformat() if case.instrument_date else None,
            "issuing_bank": case.issuing_bank,
            "maturity_date": case.maturity_date.isoformat() if case.maturity_date else None,
            "term_end_date": case.term_end_date.isoformat() if case.term_end_date else None,
            "aicte_clause_ref": case.aicte_clause_ref,
            "uploaded_documents": [
                {
                    "id": doc.id,
                    "document_type": doc.document_type,
                    "version": doc.version,
                    "file_name": doc.file_name,
                }
                for doc in documents
            ],
            "required_documents": required,
            "missing_mandatory": [
                dt for dt in required["mandatory"] if dt not in uploaded_doc_types
            ],
            "missing_conditional": [
                dt for dt in required["conditional"] if dt not in uploaded_doc_types
            ],
            "step1_completed": step1_completed,
            "step2_completed": step2_completed,
            "step3_completed": step3_completed,
            "can_submit": step1_completed and step3_completed and not any(
                dt not in uploaded_doc_types for dt in required["mandatory"]
            ),
        }
