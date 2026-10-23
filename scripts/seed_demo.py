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
                contact_email=inst_data["contact_email"],
                address=inst_data["address"],
                is_active=True,
            )
            db.add(inst)
            print(f"Created institution: {inst.name} ({inst.code})")
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
    """Create demo cases from scenarios."""
    cases = []
    inst_reps = [u for u in users if u.role == UserRole.INSTITUTION_REP]
    scrutiny_officers = [u for u in users if u.role == UserRole.SCRUTINY_OFFICER]
    
    for i, scenario in enumerate(rule_engine.get_demo_case_scenarios()):
        inst_id = "inst_1"
        if "DEC001" in scenario.get("instrument_number", ""):
            inst_id = "inst_1"
        elif "STI002" in scenario.get("instrument_number", ""):
            inst_id = "inst_2"
        elif "TP003" in scenario.get("instrument_number", ""):
            inst_id = "inst_3"
        
        creator = next((u for u in inst_reps if u.institution_id == inst_id), inst_reps[0] if inst_reps else None)
        if not creator:
            continue
        
        deposit_type = DepositType(scenario["deposit_type"])
        deposit_method = DepositMethod(scenario["deposit_method"])
        
        maturity_date = None
        if scenario.get("maturity_date_offset_days"):
            maturity_date = datetime.now(timezone.utc) + timedelta(days=scenario["maturity_date_offset_days"])
        
        case = DepositCase(
            id=str(uuid4()),
            tracking_ref=generate_tracking_ref(deposit_type),
            institution_id=inst_id,
            assigned_officer_id=None,
            deposit_type=deposit_type,
            deposit_method=deposit_method,
            amount=Decimal(str(scenario["amount"])),
            currency="INR",
            instrument_number=scenario["instrument_number"],
            issuing_bank=scenario["issuing_bank"],
            maturity_date=maturity_date,
            aicte_clause_ref="6.46" if deposit_type == DepositType.SECURITY_DEPOSIT else None,
            status=CaseStatus.DRAFT,
            is_demo=True,
        )
        
        db.add(case)
        await db.flush()
        
        await create_lifecycle_dates(db, case, rule_engine)
        
        event = CaseEvent(
            id=str(uuid4()),
            case_id=case.id,
            event_type="case_created",
            actor_id=creator.id,
            old_status=None,
            new_status=CaseStatus.DRAFT,
            details={"tracking_ref": case.tracking_ref},
        )
        db.add(event)
        
        await audit_service.log_event(
            db=db,
            entity_type="deposit_case",
            entity_id=case.id,
            action=AuditAction.CREATE,
            actor_id=creator.id,
            new_values={"tracking_ref": case.tracking_ref, "status": CaseStatus.DRAFT.value},
        )
        
        cases.append(case)
        print(f"Created case: {case.tracking_ref} ({case.deposit_type.value}/{case.deposit_method.value})")
    
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
        required_docs = rule_engine.get_all_required_documents(
            case.deposit_type.value,
            case.deposit_method.value,
            {"amount": float(case.amount), "institution_age": 5}
        )
        
        for doc_type in required_docs:
            evidence = DepositEvidence(
                id=str(uuid4()),
                case_id=case.id,
                document_type=doc_type,
                file_path=f"/data/uploads/demo/{case.id}/{doc_type}.pdf",
                original_filename=f"DEMO_{doc_type}_{case.tracking_ref}.pdf",
                file_size=1024 * 100,
                mime_type="application/pdf",
                uploaded_by=creator.id,
                ocr_text=f"DEMO OCR TEXT FOR {doc_type.upper()} - This is synthetic demo data",
                ocr_confidence=0.95,
                validation_flags={"demo": True, "watermarked": True},
                extracted_data={"demo": True},
                version=1,
            )
            db.add(evidence)
        
        print(f"Created {len(required_docs)} evidence documents for case {case.tracking_ref}")
    
    await db.flush()
async def advance_case_workflow(db: AsyncSession, case: DepositCase, users: list, rule_engine):
    """Advance a case through some workflow steps for demo."""
    scrutiny_officers = [u for u in users if u.role == UserRole.SCRUTINY_OFFICER]
    clearance_officers = [u for u in users if u.role == UserRole.CLEARANCE_OFFICER]
    authorities = [u for u in users if u.role == UserRole.COMPETENT_AUTHORITY]
    
    if not scrutiny_officers or not clearance_officers or not authorities:
        return
    
    scrutiny = scrutiny_officers[0]
    clearance = clearance_officers[0]
    authority = authorities[0]
    
    case.status = CaseStatus.SUBMITTED
    case.submitted_at = datetime.now(timezone.utc)
    case.assigned_officer_id = scrutiny.id
    
    event = CaseEvent(
        id=str(uuid4()),
        case_id=case.id,
        event_type="case_submitted",
        actor_id=scrutiny.id,
        old_status=CaseStatus.DRAFT,
        new_status=CaseStatus.SUBMITTED,
    )
    db.add(event)
    
    await audit_service.log_event(
        db=db, entity_type="deposit_case", entity_id=case.id,
        action=AuditAction.STATUS_CHANGE, actor_id=scrutiny.id,
        old_values={"status": CaseStatus.DRAFT.value},
        new_values={"status": CaseStatus.SUBMITTED.value},
    )
    
    case.status = CaseStatus.UNDER_SCRUTINY
    event = CaseEvent(
        id=str(uuid4()),
        case_id=case.id,
        event_type="scrutiny_started",
        actor_id=scrutiny.id,
        old_status=CaseStatus.SUBMITTED,
        new_status=CaseStatus.UNDER_SCRUTINY,
    )
    db.add(event)
    
    scenario = next((s for s in rule_engine.get_demo_case_scenarios() 
                     if s["instrument_number"] == case.instrument_number), None)
    
    if scenario and scenario.get("clarification_scenario"):
        case.status = CaseStatus.CLARIFICATION_PENDING
        clarification = ClarificationRequest(
            id=str(uuid4()),
            case_id=case.id,
            requested_by=scrutiny.id,
            question=scenario["clarification_scenario"]["question"],
            status=ClarificationStatus.PENDING,
        )
        db.add(clarification)
        
        event = CaseEvent(
            id=str(uuid4()),
            case_id=case.id,
            event_type="clarification_requested",
            actor_id=scrutiny.id,
            old_status=CaseStatus.UNDER_SCRUTINY,
            new_status=CaseStatus.CLARIFICATION_PENDING,
            details={"question": scenario["clarification_scenario"]["question"]},
        )
        db.add(event)
        
        inst_rep = next((u for u in users if u.institution_id == case.institution_id and u.role == UserRole.INSTITUTION_REP), None)
        if inst_rep:
            clarification.status = ClarificationStatus.RESPONDED
            clarification.responded_by = inst_rep.id
            clarification.response = f"Provided the missing {scenario['clarification_scenario']['missing_doc']} document."
            clarification.resolved_at = datetime.now(timezone.utc)
            
            case.status = CaseStatus.UNDER_SCRUTINY
            event = CaseEvent(
                id=str(uuid4()),
                case_id=case.id,
                event_type="clarification_responded",
                actor_id=inst_rep.id,
                old_status=CaseStatus.CLARIFICATION_PENDING,
                new_status=CaseStatus.UNDER_SCRUTINY,
            )
            db.add(event)
    
    case.status = CaseStatus.CLEARANCE_QUEUE
    event = CaseEvent(
        id=str(uuid4()),
        case_id=case.id,
        event_type="clearance_queue",
        actor_id=scrutiny.id,
        old_status=CaseStatus.UNDER_SCRUTINY,
        new_status=CaseStatus.CLEARANCE_QUEUE,
    )
    db.add(event)
    
    clearance_types = [
        ("financial_verification", "Financial document verification"),
        ("legal_compliance", "Legal compliance check"),
        ("technical_verification", "Technical document verification"),
    ]
    
    for clr_type, desc in clearance_types:
        task = ClearanceTask(
            id=str(uuid4()),
            case_id=case.id,
            clearance_type=clr_type,
            assigned_to=clearance.id,
            status=ClearanceStatus.CLEARED,
            notes=desc,
            completed_at=datetime.now(timezone.utc),
        )
        db.add(task)
    
    case.status = CaseStatus.CLEARED
    event = CaseEvent(
        id=str(uuid4()),
        case_id=case.id,
        event_type="cleared",
        actor_id=clearance.id,
        old_status=CaseStatus.CLEARANCE_QUEUE,
        new_status=CaseStatus.CLEARED,
    )
    db.add(event)
    
    case.status = CaseStatus.RELEASE_REQUESTED
    
    review_path_map = {
        DepositMethod.FDR_RPGF: "fdr_rpgf",
        DepositMethod.RTGS: "rtgs",
        DepositMethod.SECURITY_DEPOSIT_REFUND: "sd_refund",
    }
    review_path = review_path_map.get(case.deposit_method, "fdr_rpgf")
    
    review_status_map = {
        "fdr_rpgf": CaseStatus.FDR_RPGF_REVIEW,
        "rtgs": CaseStatus.RTGS_REVIEW,
        "sd_refund": CaseStatus.SD_REFUND_REVIEW,
    }
    review_status = review_status_map.get(review_path, CaseStatus.FDR_RPGF_REVIEW)
    
    release_request = ReleaseRequest(
        id=str(uuid4()),
        case_id=case.id,
        created_by=clearance.id,
        request_type=ReleaseRequestType.MATURITY,
        review_path=review_path,
        status="pending",
        checklist_data={item: True for item in rule_engine.get_release_checklist("maturity", case.deposit_method.value)},
    )
    db.add(release_request)
    
    event = CaseEvent(
        id=str(uuid4()),
        case_id=case.id,
        event_type="release_requested",
        actor_id=clearance.id,
        old_status=CaseStatus.CLEARED,
        new_status=CaseStatus.RELEASE_REQUESTED,
    )
    db.add(event)
    
    case.status = review_status
    event = CaseEvent(
        id=str(uuid4()),
        case_id=case.id,
        event_type=f"{review_path}_review_started",
        actor_id=authority.id,
        old_status=CaseStatus.RELEASE_REQUESTED,
        new_status=review_status,
    )
    db.add(event)
    
    case.status = CaseStatus.FINAL_DECISION
    release_request.final_decision = ReleaseDecision.RELEASE
    release_request.decided_by = authority.id
    release_request.decided_at = datetime.now(timezone.utc)
    release_request.decision_reasoning = "All clearances completed, documents verified, authority approves release."
    release_request.status = "decided"
    
    event = CaseEvent(
        id=str(uuid4()),
        case_id=case.id,
        event_type="final_decision",
        actor_id=authority.id,
        old_status=review_status,
        new_status=CaseStatus.FINAL_DECISION,
        details={"decision": ReleaseDecision.RELEASE.value},
    )
    db.add(event)
    
    case.status = CaseStatus.RELEASED
    case.closed_at = datetime.now(timezone.utc)
    
    event = CaseEvent(
        id=str(uuid4()),
        case_id=case.id,
        event_type="released",
        actor_id=authority.id,
        old_status=CaseStatus.FINAL_DECISION,
        new_status=CaseStatus.RELEASED,
    )
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
        
        print("\n--- Advancing Workflow (First Case Only) ---")
        if cases:
            await advance_case_workflow(db, cases[0], users, rule_engine)
        
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