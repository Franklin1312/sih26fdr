#!/usr/bin/env python3
"""Seed Demo Data Script - Creates synthetic institutions, users, cases, and documents."""

import asyncio
import sys
from datetime import datetime, timezone, timedelta
from decimal import Decimal
from pathlib import Path
from uuid import uuid4

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.config import get_settings
from backend.database import init_db, get_db_context
from backend.models import (
    Institution,
    User,
    DepositCase,
    DepositEvidence,
    CaseEvent,
    ClarificationRequest,
    ClearanceTask,
    ReleaseRequest,
    LifecycleDate,
)
from backend.models.enums import (
    UserRole,
    DepositType,
    DepositMethod,
    CaseStatus,
    ClarificationStatus,
    ClearanceStatus,
    ReleaseRequestType,
    ReleaseDecision,
    LifecycleDateType,
    AuditAction,
)
from backend.services.rule_engine import get_rule_engine
from backend.services.audit_service import audit_service
from backend.services.file_storage import get_file_storage
from backend.services.auth import hash_password


def generate_tracking_ref(deposit_type: DepositType) -> str:
    """Generate a unique tracking reference."""
    prefix_map = {
        DepositType.SECURITY_DEPOSIT: "SD",
        DepositType.FDR: "FDR",
        DepositType.RPGF: "RPGF",
        DepositType.BANK_GUARANTEE: "BG",
    }
    prefix = prefix_map.get(deposit_type, "CASE")
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    return f"{prefix}-{timestamp}-{str(uuid4())[:8].upper()}"


async def seed_institutions(db: AsyncSession, rule_engine) -> list:
    """Create demo institutions."""
    institutions = []
    for inst_data in rule_engine.get_demo_institutions():
        inst = await db.get(Institution, inst_data["id"])
        if not inst:
            inst = Institution(
                id=inst_data["id"],
                name=inst_data["name"],
                code=inst_data["code"],
                contact_email=f"admin@{inst_data['email_domain']}",
                address=inst_data.get("address", "Demo Address"),
                institution_type=inst_data.get("type", "unknown"),
                is_active=True,
            )
            db.add(inst)
            print(f"Created institution: {inst.name} ({inst.code})")
        elif inst.institution_type == "unknown":
            inst.institution_type = inst_data.get("type", "unknown")
        institutions.append(inst)
    await db.flush()
    return institutions


async def seed_users(db: AsyncSession, rule_engine) -> list:
    """Create demo users."""
    users = []
    for user_data in rule_engine.get_demo_users():
        user = await db.get(User, user_data["id"])
        if not user:
            role = UserRole(user_data["role"])
            user = User(
                id=user_data["id"],
                email=user_data["email"],
                full_name=user_data["full_name"],
                role=role,
                institution_id=user_data.get("institution_id"),
                is_active=True,
                password_hash=hash_password("demo12345"),
            )
            db.add(user)
            print(f"Created user: {user.full_name} ({user.role.value})")
        users.append(user)
    await db.flush()
    return users


async def seed_cases(db: AsyncSession, rule_engine, users: list, institutions: list) -> list:
    """Create demo cases from new demo.cases configuration."""
    cases = []
    inst_reps = [u for u in users if u.role == UserRole.INSTITUTION_REP]
    scrutiny_officers = [u for u in users if u.role == UserRole.SCRUTINY_OFFICER]
    clearance_officers = [u for u in users if u.role == UserRole.CLEARANCE_OFFICER]
    authority_users = [u for u in users if u.role == UserRole.COMPETENT_AUTHORITY]

    for scenario in rule_engine.get_demo_cases():
        existing_result = await db.execute(
            select(DepositCase).where(DepositCase.tracking_ref == scenario["case_number"])
        )
        existing_case = existing_result.scalar_one_or_none()
        if existing_case:
            cases.append(existing_case)
            continue
        inst_id = scenario["institution_id"]
        creator = next((u for u in inst_reps if u.institution_id == inst_id), inst_reps[0] if inst_reps else None)
        if not creator:
            continue

        deposit_type = DepositType(scenario["deposit_type"])
        deposit_method = DepositMethod(scenario["deposit_method"])

        maturity_date = None
        if scenario.get("maturity_date"):
            maturity_date = datetime.fromisoformat(scenario["maturity_date"]).replace(tzinfo=timezone.utc)

        case = DepositCase(
            id=str(uuid4()),
            tracking_ref=scenario["case_number"],
            institution_id=inst_id,
            assigned_officer_id=None,
            deposit_type=deposit_type,
            deposit_method=deposit_method,
            amount=Decimal(str(scenario["amount"])),
            currency="INR",
            instrument_number=f"{deposit_type.value}-{scenario['case_number'].split('-')[-1]}",
            issuing_bank="Demo Bank Ltd.",
            maturity_date=maturity_date,
            aicte_clause_ref="6.46" if deposit_type == DepositType.SECURITY_DEPOSIT else None,
            status=CaseStatus(scenario["status"]),
            is_demo=True,
        )

        db.add(case)
        await db.flush()

        await create_lifecycle_dates(db, case, rule_engine)

        # Create clearance tasks based on clearance list in scenario
        clearance_types = scenario.get("clearances", [])
        if clearance_types:
            for clr_type in clearance_types:
                clr_officer = clearance_officers[0] if clearance_officers else None
                task = ClearanceTask(
                    id=str(uuid4()),
                    case_id=case.id,
                    clearance_type=clr_type,
                    assigned_to=clr_officer.id if clr_officer else None,
                    status=ClearanceStatus.CLEARED if scenario["status"] in ["RELEASED", "RTGS_REVIEW", "CLEARED"] else ClearanceStatus.PENDING,
                    completed_at=datetime.now(timezone.utc) if scenario["status"] in ["RELEASED", "RTGS_REVIEW", "CLEARED"] else None,
                )
                db.add(task)

        # Create release request if in release workflow
        if scenario.get("release_decision") and scenario["status"] in ["RELEASED", "RTGS_REVIEW", "RELEASE_REQUESTED", "FDR_RPGF_REVIEW", "SD_REFUND_REVIEW"]:
            review_path = rule_engine.get_review_path_for_method(deposit_method.value)
            review_status_map = {
                "fdr_rpgf": CaseStatus.FDR_RPGF_REVIEW,
                "rtgs": CaseStatus.RTGS_REVIEW,
                "sd_refund": CaseStatus.SD_REFUND_REVIEW,
            }
            review_status = review_status_map.get(review_path, CaseStatus.RELEASE_REQUESTED)

            release_request = ReleaseRequest(
                id=str(uuid4()),
                case_id=case.id,
                created_by=creator.id,
                request_type=ReleaseRequestType.MATURITY,
                review_path=review_path,
                status="decided" if scenario["status"] == "RELEASED" else "pending",
                checklist_data={item: True for item in rule_engine.get_release_checklist("maturity", case.deposit_method.value)},
            )
            if scenario["status"] == "RELEASED":
                release_request.final_decision = ReleaseDecision.RELEASE
                release_request.decided_by = authority_users[0].id if authority_users else creator.id
                release_request.decided_at = datetime.now(timezone.utc)
                release_request.decision_reasoning = "All clearances completed, documents verified, authority approves release."

            db.add(release_request)

        event = CaseEvent(
            id=str(uuid4()),
            case_id=case.id,
            event_type="case_created",
            actor_id=creator.id,
            old_status=None,
            new_status=CaseStatus(scenario["status"]),
            details={"tracking_ref": case.tracking_ref},
        )
        db.add(event)

        await audit_service.log_event(
            db=db,
            entity_type="deposit_case",
            entity_id=case.id,
            action=AuditAction.CREATE,
            actor_id=creator.id,
            new_values={"tracking_ref": case.tracking_ref, "status": scenario["status"]},
        )

        # Handle clarifications if present
        if scenario.get("clarifications"):
            for clr_data in scenario["clarifications"]:
                requested_by = next((u for u in scrutiny_officers if u.id == clr_data["requested_by"]), scrutiny_officers[0] if scrutiny_officers else None)
                responded_by = creator
                clr = ClarificationRequest(
                    id=str(uuid4()),
                    case_id=case.id,
                    requested_by=requested_by.id if requested_by else creator.id,
                    question=clr_data["reason"],
                    status=ClarificationStatus(clr_data["status"]),
                    responded_by=responded_by.id if clr_data["status"] != "pending" else None,
                    resolved_at=datetime.now(timezone.utc) if clr_data["status"] != "pending" else None,
                )
                db.add(clr)

        cases.append(case)
        print(f"Created case: {case.tracking_ref} ({case.deposit_type.value}/{case.deposit_method.value}) status={case.status.value}")

    await db.flush()
    return cases


async def create_lifecycle_dates(db: AsyncSession, case: DepositCase, rule_engine):
    """Create lifecycle dates for a case."""
    dates_to_create = []

    if case.maturity_date:
        dates_to_create.append(LifecycleDate(
            id=str(uuid4()),
            case_id=case.id,
            date_type=LifecycleDateType.FDR_MATURITY,
            date_value=case.maturity_date,
            alert_lead_days=30,
            description="FDR maturity date - initiate release process",
        ))

    aicte_term_end = datetime.now(timezone.utc) + timedelta(days=5*365)
    dates_to_create.append(LifecycleDate(
        id=str(uuid4()),
        case_id=case.id,
        date_type=LifecycleDateType.AICTE_TERM_END,
        date_value=aicte_term_end,
        alert_lead_days=90,
        description="AICTE approval term end - review deposit requirement",
    ))

    if case.deposit_type == DepositType.FDR and case.maturity_date:
        renewal_due = case.maturity_date - timedelta(days=365)
        if renewal_due > datetime.now(timezone.utc):
            dates_to_create.append(LifecycleDate(
                id=str(uuid4()),
                case_id=case.id,
                date_type=LifecycleDateType.RENEWAL_DUE,
                date_value=renewal_due,
                alert_lead_days=60,
                description="FDR renewal due - prepare renewal documentation",
            ))

    for date_obj in dates_to_create:
        db.add(date_obj)

    await db.flush()


async def seed_evidence(db: AsyncSession, cases: list, users: list):
    """Create demo evidence/documents for cases."""
    inst_reps = [u for u in users if u.role == UserRole.INSTITUTION_REP]

    for case in cases:
        creator = next((u for u in inst_reps if u.institution_id == case.institution_id), inst_reps[0] if inst_reps else None)
        if not creator:
            continue

        rule_engine = get_rule_engine()
        required_docs = list(rule_engine.get_document_requirements(case.deposit_type.value))
        is_release_case = case.status in {
            CaseStatus.FDR_RPGF_REVIEW, CaseStatus.RTGS_REVIEW,
            CaseStatus.SD_REFUND_REVIEW, CaseStatus.RELEASED,
        }
        if is_release_case:
            required_docs.extend(
                item.get("document_type")
                for item in rule_engine.get_release_checklist_items("maturity", case.deposit_method.value)
                if item.get("document_type")
            )
            route_doc = {
                DepositMethod.FDR_RPGF: "approval_bureau_noc",
                DepositMethod.RTGS: "council_sanction_order",
            }.get(case.deposit_method)
            if route_doc:
                required_docs.append(route_doc)
        required_docs = sorted(set(required_docs))

        for doc_type in required_docs:
            existing_result = await db.execute(
                select(DepositEvidence.id).where(
                    DepositEvidence.case_id == case.id,
                    DepositEvidence.document_type == doc_type,
                    DepositEvidence.is_deleted.is_(False),
                ).limit(1)
            )
            if existing_result.scalar_one_or_none():
                continue
            file_meta = await get_file_storage().upload_file(
                case_id=case.id,
                file_content=get_file_storage().create_demo_pdf(doc_type.replace("_", " ").title(), case.tracking_ref),
                original_filename=f"DEMO_{doc_type}_{case.tracking_ref}.pdf",
                mime_type="application/pdf",
                document_type=doc_type,
            )
            evidence = DepositEvidence(
                id=str(uuid4()),
                case_id=case.id,
                document_type=doc_type,
                file_path=file_meta["relative_path"],
                original_filename=f"DEMO_{doc_type}_{case.tracking_ref}.pdf",
                file_size=file_meta["file_size"],
                mime_type="application/pdf",
                uploaded_by=creator.id,
                file_hash=file_meta["file_hash"],
                ocr_text=file_meta.get("ocr_text"),
                ocr_confidence=file_meta.get("ocr_confidence"),
                validation_flags=file_meta.get("validation_flags"),
                extracted_data=file_meta.get("extracted_data"),
                version=1,
                is_demo=True,
            )
            db.add(evidence)

        print(f"Created {len(required_docs)} evidence documents for case {case.tracking_ref}")


async def advance_case_workflow(db: AsyncSession, case: DepositCase, users: list, rule_engine):
    """Advance a case through the full workflow for demo purposes."""
    scrutiny_officers = [u for u in users if u.role == UserRole.SCRUTINY_OFFICER]
    clearance_officers = [u for u in users if u.role == UserRole.CLEARANCE_OFFICER]
    authority_users = [u for u in users if u.role == UserRole.COMPETENT_AUTHORITY]

    scrutiny = scrutiny_officers[0] if scrutiny_officers else None
    clearance = clearance_officers[0] if clearance_officers else None
    authority = authority_users[0] if authority_users else None

    if not all([scrutiny, clearance, authority]):
        print("Missing required roles for workflow advancement")
        return

    # Submit for scrutiny
    old_status = case.status
    case.status = CaseStatus.SUBMITTED
    event = CaseEvent(id=str(uuid4()), case_id=case.id, event_type="case_submitted", actor_id=scrutiny.id, old_status=old_status, new_status=CaseStatus.SUBMITTED)
    db.add(event)
    await db.flush()

    case.status = CaseStatus.UNDER_SCRUTINY
    event = CaseEvent(id=str(uuid4()), case_id=case.id, event_type="scrutiny_started", actor_id=scrutiny.id, old_status=CaseStatus.SUBMITTED, new_status=CaseStatus.UNDER_SCRUTINY)
    db.add(event)
    await db.flush()

    case.status = CaseStatus.CLEARANCE_QUEUE
    event = CaseEvent(id=str(uuid4()), case_id=case.id, event_type="scrutiny_completed", actor_id=scrutiny.id, old_status=CaseStatus.UNDER_SCRUTINY, new_status=CaseStatus.CLEARANCE_QUEUE)
    db.add(event)
    await db.flush()

    # Create clearance tasks
    for clr_type in ["financial", "legal", "technical"]:
        task = ClearanceTask(id=str(uuid4()), case_id=case.id, clearance_type=clr_type, assigned_to=clearance.id, status=ClearanceStatus.CLEARED, completed_at=datetime.now(timezone.utc))
        db.add(task)

    case.status = CaseStatus.CLEARED
    event = CaseEvent(id=str(uuid4()), case_id=case.id, event_type="all_clearances_completed", actor_id=clearance.id, old_status=CaseStatus.CLEARANCE_QUEUE, new_status=CaseStatus.CLEARED)
    db.add(event)
    await db.flush()

    # Create release request
    review_path = rule_engine.get_review_path_for_method(case.deposit_method.value)
    review_status_map = {
        "fdr_rpgf": CaseStatus.FDR_RPGF_REVIEW,
        "rtgs": CaseStatus.RTGS_REVIEW,
        "sd_refund": CaseStatus.SD_REFUND_REVIEW,
    }
    review_status = review_status_map.get(review_path, CaseStatus.RELEASE_REQUESTED)

    release_request = ReleaseRequest(
        id=str(uuid4()),
        case_id=case.id,
        created_by=case.assigned_officer_id or scrutiny.id,
        request_type=ReleaseRequestType.MATURITY,
        review_path=review_path,
        status="pending",
        checklist_data={item: True for item in rule_engine.get_release_checklist("maturity", case.deposit_method.value)},
    )
    db.add(release_request)

    old_status = case.status
    case.status = CaseStatus.RELEASE_REQUESTED
    event = CaseEvent(id=str(uuid4()), case_id=case.id, event_type="release_requested", actor_id=scrutiny.id, old_status=old_status, new_status=CaseStatus.RELEASE_REQUESTED)
    db.add(event)

    case.status = review_status
    event = CaseEvent(id=str(uuid4()), case_id=case.id, event_type=f"{review_path}_review_started", actor_id=authority.id, old_status=CaseStatus.RELEASE_REQUESTED, new_status=review_status)
    db.add(event)

    case.status = CaseStatus.FINAL_DECISION
    release_request.final_decision = ReleaseDecision.RELEASE
    release_request.decided_by = authority.id
    release_request.decided_at = datetime.now(timezone.utc)
    release_request.decision_reasoning = "All clearances completed, documents verified, authority approves release."
    release_request.status = "decided"

    event = CaseEvent(id=str(uuid4()), case_id=case.id, event_type="final_decision", actor_id=authority.id, old_status=review_status, new_status=CaseStatus.FINAL_DECISION, details={"decision": ReleaseDecision.RELEASE.value})
    db.add(event)

    case.status = CaseStatus.RELEASED
    case.closed_at = datetime.now(timezone.utc)
    event = CaseEvent(id=str(uuid4()), case_id=case.id, event_type="released", actor_id=authority.id, old_status=CaseStatus.FINAL_DECISION, new_status=CaseStatus.RELEASED)
    db.add(event)

    await db.flush()
    print(f"Advanced case {case.tracking_ref} to RELEASED")


async def main():
    """Main seeding function."""
    print("=" * 60)
    print("SIH26265 - Seeding Demo Data")
    print("=" * 60)

    await init_db()
    print("Database initialized")

    await audit_service.initialize()
    print("Audit service initialized")

    rule_engine = get_rule_engine()

    async with get_db_context() as db:
        print("\n--- Creating Institutions ---")
        institutions = await seed_institutions(db, rule_engine)

        print("\n--- Creating Users ---")
        users = await seed_users(db, rule_engine)

        print("\n--- Creating Cases ---")
        cases = await seed_cases(db, rule_engine, users, institutions)

        print("\n--- Creating Evidence ---")
        await seed_evidence(db, cases, users)

        print("\n" + "=" * 60)
        print("Demo data seeding complete!")
        print("=" * 60)
        print(f"Institutions: {len(institutions)}")
        print(f"Users: {len(users)}")
        print(f"Cases: {len(cases)}")
        print("\nDemo credentials (password: demo12345):")
        for u in users:
            print(f"  {u.email} ({u.role.value})")


if __name__ == "__main__":
    asyncio.run(main())
