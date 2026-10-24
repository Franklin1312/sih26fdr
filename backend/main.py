"""FastAPI application entry point."""

import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from backend.config import get_settings, validate_startup_config
from backend.database import init_db, close_db
from backend.services.auth import validate_startup_config as validate_auth_config
from backend.services.audit_service import audit_service
from backend.services.access_control import access_control
from backend.services.alert_scheduler import get_alert_scheduler
from backend.routes import institutions, users, cases, evidence, wizard, clarification, scrutiny, clearance, release, auth, audit

settings = get_settings()

logging.basicConfig(
    level=logging.INFO if not settings.debug else logging.DEBUG,
    format="%(asctime)s %(name)s %(levelname)s %(message)s",
)
logger = logging.getLogger("sih26psfdr")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    logger.info("Starting SIH26265 Security Deposit / FDR Management Portal...")
    
    # Validate configuration
    validate_startup_config(settings)
    validate_auth_config()
    
    # Initialize database
    await init_db()
    logger.info("Database initialized")
    
    # Initialize audit service
    await audit_service.initialize()
    logger.info("Audit service initialized")
    
    # Create demo data
    await create_demo_data()
    logger.info("Demo data created")
    
    # Initialize access control with demo users
    from backend.schemas.institution import UserResponse, UserRole
    from datetime import datetime, timezone
    demo_users = [
        UserResponse(id="inst_rep_1", email="inst_rep_1@demo.example", full_name="Rajesh Sharma", role=UserRole.INSTITUTION_REP, institution_id="inst_1", is_active=True, created_at=datetime.now(timezone.utc), updated_at=datetime.now(timezone.utc)),
        UserResponse(id="inst_rep_2", email="inst_rep_2@demo.example", full_name="Priya Nair", role=UserRole.INSTITUTION_REP, institution_id="inst_2", is_active=True, created_at=datetime.now(timezone.utc), updated_at=datetime.now(timezone.utc)),
        UserResponse(id="inst_rep_3", email="inst_rep_3@demo.example", full_name="Suresh Kumar", role=UserRole.INSTITUTION_REP, institution_id="inst_3", is_active=True, created_at=datetime.now(timezone.utc), updated_at=datetime.now(timezone.utc)),
        UserResponse(id="inst_rep_4", email="inst_rep_4@demo.example", full_name="Anita Das", role=UserRole.INSTITUTION_REP, institution_id="inst_4", is_active=True, created_at=datetime.now(timezone.utc), updated_at=datetime.now(timezone.utc)),
        UserResponse(id="scrutiny_1", email="scrutiny_1@demo.example", full_name="Scrutiny Officer 1", role=UserRole.SCRUTINY_OFFICER, is_active=True, created_at=datetime.now(timezone.utc), updated_at=datetime.now(timezone.utc)),
        UserResponse(id="clearance_1", email="clearance_1@demo.example", full_name="Clearance Officer 1", role=UserRole.CLEARANCE_OFFICER, is_active=True, created_at=datetime.now(timezone.utc), updated_at=datetime.now(timezone.utc)),
        UserResponse(id="authority_1", email="authority_1@demo.example", full_name="Competent Authority 1", role=UserRole.COMPETENT_AUTHORITY, is_active=True, created_at=datetime.now(timezone.utc), updated_at=datetime.now(timezone.utc)),
        UserResponse(id="approval_bureau_1", email="approval_bureau_1@demo.example", full_name="Approval Bureau 1", role=UserRole.APPROVAL_BUREAU, is_active=True, created_at=datetime.now(timezone.utc), updated_at=datetime.now(timezone.utc)),
        UserResponse(id="council_1", email="council_1@demo.example", full_name="Council Authority 1", role=UserRole.COUNCIL, is_active=True, created_at=datetime.now(timezone.utc), updated_at=datetime.now(timezone.utc)),
        UserResponse(id="admin_1", email="admin_1@demo.example", full_name="System Admin 1", role=UserRole.SYSTEM_ADMIN, is_active=True, created_at=datetime.now(timezone.utc), updated_at=datetime.now(timezone.utc)),
    ]
    for user in demo_users:
        access_control.register_user(user)
    logger.info("Demo users registered")

    # Start alert scheduler
    alert_scheduler = get_alert_scheduler()
    await alert_scheduler.start()
    logger.info("Alert scheduler started")

    yield

    logger.info("Shutting down SIH26265...")
    await alert_scheduler.stop()
    logger.info("Alert scheduler stopped")
    await close_db()


app = FastAPI(
    title="SIH26265 Security Deposit / FDR Management Portal",
    description="End-to-end management of security deposits and FDRs for AICTE",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS — single unified middleware (dev + config-driven origins merged)
app.add_middleware(
    CORSMiddleware,
    allow_origins=list(set([
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
    ] + settings.cors_origins_list)),
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept", "*"],
)


# Global exception handler
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": exc.detail, "status_code": exc.status_code},
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled exception: %s", exc)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"error": "Internal server error", "status_code": 500},
    )


@app.get("/health", tags=["system"])
async def health():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "service": "sih26265-fdr-portal",
        "version": "0.1.0",
    }


async def create_demo_data():
    """Create demo institutions, users, and realistic FDR cases in the database."""
    from backend.database import get_db_context
    from backend.models import Institution, User, DepositCase, LifecycleDate, DepositEvidence
    from backend.models.enums import UserRole, DepositType, DepositMethod, CaseStatus, LifecycleDateType
    from datetime import datetime, timezone, timedelta
    from uuid import uuid4

    now = datetime.now(timezone.utc)

    async with get_db_context() as db:
        # ── Institutions ──────────────────────────────────────────────────────
        institutions_data = [
            ("inst_1", "Apex Institute of Technology", "AIT001", "principal@ait.edu.in", "Sector 14, Gurugram, Haryana", "engineering", "inst_rep_1"),
            ("inst_2", "National Medical College", "NMC002", "principal@nmc.edu.in", "Civil Lines, Nagpur, Maharashtra", "medical", "inst_rep_2"),
            ("inst_3", "City Polytechnic Institute", "CPI003", "principal@cpi.edu.in", "MG Road, Bengaluru, Karnataka", "polytechnic", "inst_rep_3"),
            ("inst_4", "Eastern Management School", "EMS004", "principal@ems.edu.in", "Park Street, Kolkata, West Bengal", "management", "inst_rep_4"),
        ]
        for inst_id, name, code, email, address, inst_type, _ in institutions_data:
            inst = await db.get(Institution, inst_id)
            if not inst:
                inst = Institution(
                    id=inst_id,
                    name=name,
                    code=code,
                    contact_email=email,
                    address=address,
                    institution_type=inst_type,
                    is_active=True,
                )
                db.add(inst)

        # ── Users ─────────────────────────────────────────────────────────────
        demo_users_data = [
            ("inst_rep_1", "inst_rep_1@demo.example", "Rajesh Sharma", UserRole.INSTITUTION_REP, "inst_1"),
            ("inst_rep_2", "inst_rep_2@demo.example", "Priya Nair", UserRole.INSTITUTION_REP, "inst_2"),
            ("inst_rep_3", "inst_rep_3@demo.example", "Suresh Kumar", UserRole.INSTITUTION_REP, "inst_3"),
            ("inst_rep_4", "inst_rep_4@demo.example", "Anita Das", UserRole.INSTITUTION_REP, "inst_4"),
            ("scrutiny_1", "scrutiny_1@demo.example", "Scrutiny Officer 1", UserRole.SCRUTINY_OFFICER, None),
            ("clearance_1", "clearance_1@demo.example", "Clearance Officer 1", UserRole.CLEARANCE_OFFICER, None),
            ("approval_bureau_1", "approval_bureau_1@demo.example", "Approval Bureau 1", UserRole.APPROVAL_BUREAU, None),
            ("council_1", "council_1@demo.example", "Council Authority 1", UserRole.COUNCIL, None),
            ("authority_1", "authority_1@demo.example", "Competent Authority 1", UserRole.COMPETENT_AUTHORITY, None),
            ("admin_1", "admin_1@demo.example", "System Admin 1", UserRole.SYSTEM_ADMIN, None),
        ]
        for user_id, email, full_name, role, institution_id in demo_users_data:
            user = await db.get(User, user_id)
            if not user:
                user = User(
                    id=user_id,
                    email=email,
                    full_name=full_name,
                    role=role,
                    institution_id=institution_id,
                    is_active=True,
                    password_hash="demo_hash_placeholder",
                )
                db.add(user)

        await db.flush()

        # ── Demo Cases ────────────────────────────────────────────────────────
        # Case 1: inst_1 — Active FDR maturing in 22 days (will trigger alert)
        case1_id = "case_demo_001"
        c1 = await db.get(DepositCase, case1_id)
        if not c1:
            maturity_1 = now + timedelta(days=22)
            c1 = DepositCase(
                id=case1_id,
                tracking_ref="FDR-2025-0001",
                institution_id="inst_1",
                deposit_type=DepositType.FDR,
                deposit_method=DepositMethod.FDR_RPGF,
                amount=500000.00,
                currency="INR",
                instrument_number="SBI/FDR/2024/00123",
                instrument_date=now - timedelta(days=365),
                issuing_bank="State Bank of India, New Delhi",
                maturity_date=maturity_1,
                status=CaseStatus.CLEARED,
                is_demo=True,
            )
            db.add(c1)
            db.add(LifecycleDate(
                id=str(uuid4()),
                case_id=case1_id,
                date_type=LifecycleDateType.FDR_MATURITY,
                date_value=maturity_1,
                alert_lead_days=30,
                description="FDR maturity — 22 days remaining",
                alert_sent=False,
            ))

        # Case 2: inst_2 — OVERDUE FDR (maturity passed 15 days ago, no release)
        case2_id = "case_demo_002"
        c2 = await db.get(DepositCase, case2_id)
        if not c2:
            maturity_2 = now - timedelta(days=15)
            c2 = DepositCase(
                id=case2_id,
                tracking_ref="FDR-2024-0089",
                institution_id="inst_2",
                deposit_type=DepositType.FDR,
                deposit_method=DepositMethod.FDR_RPGF,
                amount=750000.00,
                currency="INR",
                instrument_number="PNB/FDR/2023/04567",
                instrument_date=now - timedelta(days=380),
                issuing_bank="Punjab National Bank, Mumbai",
                maturity_date=maturity_2,
                status=CaseStatus.SUBMITTED,
                assigned_officer_id="scrutiny_1",
                submitted_at=now - timedelta(days=20),
                is_demo=True,
            )
            db.add(c2)

        # Case 3: inst_3 — In CLEARANCE_QUEUE
        case3_id = "case_demo_003"
        c3 = await db.get(DepositCase, case3_id)
        if not c3:
            maturity_3 = now + timedelta(days=60)
            c3 = DepositCase(
                id=case3_id,
                tracking_ref="SD-2025-0012",
                institution_id="inst_3",
                deposit_type=DepositType.SECURITY_DEPOSIT,
                deposit_method=DepositMethod.SECURITY_DEPOSIT_REFUND,
                amount=300000.00,
                currency="INR",
                instrument_number="DD/CANARA/2024/7890",
                instrument_date=now - timedelta(days=90),
                issuing_bank="Canara Bank, Bengaluru",
                maturity_date=maturity_3,
                status=CaseStatus.CLEARANCE_QUEUE,
                submitted_at=now - timedelta(days=10),
                is_demo=True,
            )
            db.add(c3)

        # Case 4: inst_4 — RELEASED (historical, shows full lifecycle)
        case4_id = "case_demo_004"
        c4 = await db.get(DepositCase, case4_id)
        if not c4:
            c4 = DepositCase(
                id=case4_id,
                tracking_ref="FDR-2024-0055",
                institution_id="inst_4",
                deposit_type=DepositType.FDR,
                deposit_method=DepositMethod.RTGS,
                amount=1000000.00,
                currency="INR",
                instrument_number="HDFC/FDR/2023/11111",
                instrument_date=now - timedelta(days=400),
                issuing_bank="HDFC Bank, Kolkata",
                maturity_date=now - timedelta(days=60),
                status=CaseStatus.RELEASED,
                submitted_at=now - timedelta(days=120),
                closed_at=now - timedelta(days=30),
                is_demo=True,
            )
            db.add(c4)

        # Case 5: inst_1 — DRAFT (institution rep has started but not submitted)
        case5_id = "case_demo_005"
        c5 = await db.get(DepositCase, case5_id)
        if not c5:
            c5 = DepositCase(
                id=case5_id,
                tracking_ref="FDR-2025-0042",
                institution_id="inst_1",
                deposit_type=DepositType.FDR,
                deposit_method=DepositMethod.FDR_RPGF,
                amount=250000.00,
                currency="INR",
                instrument_number="BOB/FDR/2025/00999",
                instrument_date=now - timedelta(days=5),
                issuing_bank="Bank of Baroda, Gurugram",
                maturity_date=now + timedelta(days=365),
                status=CaseStatus.DRAFT,
                is_demo=True,
            )
            db.add(c5)

        # Case 6: inst_2 — RELEASE_REQUESTED (in final decision queue)
        case6_id = "case_demo_006"
        c6 = await db.get(DepositCase, case6_id)
        if not c6:
            c6 = DepositCase(
                id=case6_id,
                tracking_ref="FDR-2024-0101",
                institution_id="inst_2",
                deposit_type=DepositType.RPGF,
                deposit_method=DepositMethod.FDR_RPGF,
                amount=600000.00,
                currency="INR",
                instrument_number="SBI/RPGF/2023/55678",
                instrument_date=now - timedelta(days=700),
                issuing_bank="State Bank of India, Nagpur",
                maturity_date=now - timedelta(days=30),
                status=CaseStatus.FDR_RPGF_REVIEW,
                submitted_at=now - timedelta(days=90),
                is_demo=True,
            )
            db.add(c6)

        # ── Demo Evidences ──────────────────────────────────────────────────
        demo_evidences = [
            ("ev_demo_001", "case_demo_001", "fdr_copy", "SBI_FDR_Receipt_00123.pdf", 245800, "inst_rep_1", "SBI/FDR/2024/00123", 500000.0, True),
            ("ev_demo_002", "case_demo_002", "fdr_copy", "PNB_Term_Deposit_04567.pdf", 198400, "inst_rep_2", "PNB/FDR/2023/04567", 750000.0, False),
            ("ev_demo_003", "case_demo_003", "joint_lien_letter", "Canara_Lien_Letter_7890.pdf", 312000, "inst_rep_3", "DD/CANARA/2024/7890", 1200000.0, True),
            ("ev_demo_004", "case_demo_004", "fdr_copy", "HDFC_Fixed_Deposit_11111.pdf", 185600, "inst_rep_4", "HDFC/FDR/2023/11111", 1000000.0, False),
            ("ev_demo_005", "case_demo_005", "bank_endorsement", "Axis_Bank_Endorsement_9999.pdf", 220000, "inst_rep_1", "AXIS/FDR/2024/99999", 500000.0, False),
            ("ev_demo_006", "case_demo_006", "rpgf_deed", "SBI_RPGF_Security_Deed.pdf", 410000, "inst_rep_2", "SBI/RPGF/2023/55678", 600000.0, False),
        ]
        for evid, cid, dtype, fname, fsize, uploader, inst_no, amt, verified in demo_evidences:
            ev = await db.get(DepositEvidence, evid)
            if not ev:
                db.add(DepositEvidence(
                    id=evid,
                    case_id=cid,
                    document_type=dtype,
                    original_filename=fname,
                    file_path=f"demo/{fname}",
                    file_size=fsize,
                    mime_type="application/pdf",
                    file_hash=f"hash_{evid}_{cid}",
                    uploaded_by=uploader,
                    ocr_text=f"AICTE REGULATORY DEPOSIT - INSTRUMENT #{inst_no}\nISSUED IN FAVOR OF MEMBER SECRETARY, AICTE\nPRINCIPAL: INR {amt:,.2f}",
                    ocr_confidence=0.97,
                    validation_flags={"bank_verified": verified, "bank_verification_ref": f"SFMS/AICTE/{inst_no.replace('/', '-')}" if verified else None, "has_discrepancy": False},
                    version=1,
                    is_demo=True,
                ))

        await db.flush()



@app.get("/", tags=["system"])
async def root():
    return {
        "service": "sih26265-fdr-portal",
        "version": "0.1.0",
        "docs": "/docs",
        "health": "/health",
    }


# Include route modules
app.include_router(auth.router, prefix="/api/v1")
app.include_router(institutions.router, prefix="/api/v1/institutions", tags=["institutions"])
app.include_router(users.router, prefix="/api/v1", tags=["users"])
app.include_router(cases.router, prefix="/api/v1/cases", tags=["cases"])
app.include_router(evidence.router, prefix="/api/v1/cases/evidence", tags=["evidence"])
app.include_router(wizard.router, prefix="/api/v1", tags=["wizard"])
app.include_router(clarification.router, prefix="/api/v1", tags=["clarifications"])
app.include_router(scrutiny.router, prefix="/api/v1", tags=["scrutiny"])
app.include_router(clearance.router, prefix="/api/v1", tags=["clearance"])
app.include_router(release.router, prefix="/api/v1", tags=["release"])
app.include_router(audit.router, prefix="/api/v1", tags=["audit"])



if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
