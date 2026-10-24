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
from backend.routes import institutions, users, cases, evidence, wizard, clarification, scrutiny, clearance, release, auth

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
        UserResponse(id="inst_rep_1", email="inst_rep_1@demo.example", full_name="Institution Rep 1", role=UserRole.INSTITUTION_REP, institution_id="inst_1", is_active=True, created_at=datetime.now(timezone.utc), updated_at=datetime.now(timezone.utc)),
        UserResponse(id="scrutiny_1", email="scrutiny_1@demo.example", full_name="Scrutiny Officer 1", role=UserRole.SCRUTINY_OFFICER, is_active=True, created_at=datetime.now(timezone.utc), updated_at=datetime.now(timezone.utc)),
        UserResponse(id="clearance_1", email="clearance_1@demo.example", full_name="Clearance Officer 1", role=UserRole.CLEARANCE_OFFICER, is_active=True, created_at=datetime.now(timezone.utc), updated_at=datetime.now(timezone.utc)),
        UserResponse(id="authority_1", email="authority_1@demo.example", full_name="Competent Authority 1", role=UserRole.COMPETENT_AUTHORITY, is_active=True, created_at=datetime.now(timezone.utc), updated_at=datetime.now(timezone.utc)),
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

# CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",  # Vite dev server
        "http://localhost:3000",  # Alternative React dev server
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=settings.cors_allow_credentials,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
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
    """Create demo institutions and users in the database."""
    from backend.database import get_db_context
    from backend.models import Institution, User
    from backend.models.enums import UserRole
    from datetime import datetime, timezone
    
    async with get_db_context() as db:
        # Create demo institution
        inst = await db.get(Institution, "inst_1")
        if not inst:
            inst = Institution(
                id="inst_1",
                name="Demo Engineering College",
                code="DEC001",
                contact_email="principal@dec.edu.in",
                address="123 Demo Street, Demo City",
                institution_type="engineering",
                is_active=True,
            )
            db.add(inst)
        
        # Create demo users
        demo_users_data = [
            ("inst_rep_1", "inst_rep_1@demo.example", "Institution Rep 1", UserRole.INSTITUTION_REP, "inst_1"),
            ("scrutiny_1", "scrutiny_1@demo.example", "Scrutiny Officer 1", UserRole.SCRUTINY_OFFICER, None),
            ("clearance_1", "clearance_1@demo.example", "Clearance Officer 1", UserRole.CLEARANCE_OFFICER, None),
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
                    password_hash="demo_hash_placeholder",  # Demo mode - no real hashing needed
                )
                db.add(user)
        
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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
