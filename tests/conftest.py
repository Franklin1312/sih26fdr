"""Pytest configuration and fixtures."""

import asyncio
import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from backend.config import Settings
from backend.database import Base, get_db
from backend.main import app
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
    AuditLog,
)
from backend.models.enums import UserRole, DepositType, DepositMethod, CaseStatus
from backend.services.auth import hash_password
from httpx import AsyncClient
from httpx._transports.asgi import ASGITransport


@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="session")
async def test_engine():
    """Create a test database engine."""
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        echo=False,
        poolclass=StaticPool,
        connect_args={"check_same_thread": False},
    )
    
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    yield engine
    
    await engine.dispose()


@pytest.fixture(scope="function")
async def test_db(test_engine) -> AsyncSession:
    """Create a test database session."""
    async_session = async_sessionmaker(
        test_engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autoflush=False,
    )
    
    async with async_session() as session:
        yield session
        await session.rollback()


@pytest.fixture(scope="function")
async def client(test_db):
    """Create a test client with overridden database dependency."""
    def override_get_db():
        yield test_db
    
    app.dependency_overrides[get_db] = override_get_db
    
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as ac:
        yield ac
    
    app.dependency_overrides.clear()


@pytest.fixture
def demo_institution():
    """Create a demo institution."""
    return Institution(
        id="inst_test",
        name="Test Engineering College",
        code="TEC001",
        contact_email="test@tec.edu.in",
        address="123 Test Street",
        is_active=True,
    )


@pytest.fixture
def demo_user(demo_institution):
    """Create a demo institution rep user."""
    return User(
        id="user_test_rep",
        email="rep@test.example",
        full_name="Test Rep",
        role=UserRole.INSTITUTION_REP,
        institution_id=demo_institution.id,
        is_active=True,
        password_hash=hash_password("demo12345"),
    )


@pytest.fixture
def demo_scrutiny_user():
    """Create a demo scrutiny officer user."""
    return User(
        id="user_test_scrutiny",
        email="scrutiny@test.example",
        full_name="Test Scrutiny Officer",
        role=UserRole.SCRUTINY_OFFICER,
        is_active=True,
        password_hash=hash_password("demo12345"),
    )


@pytest.fixture
def demo_case(demo_institution, demo_user):
    """Create a demo deposit case."""
    from datetime import datetime, timezone, timedelta
    from decimal import Decimal
    from uuid import uuid4
    
    return DepositCase(
        id=str(uuid4()),
        tracking_ref=f"FDR-TEST-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}",
        institution_id=demo_institution.id,
        deposit_type=DepositType.FDR,
        deposit_method=DepositMethod.FDR_RPGF,
        amount=Decimal("5000000"),
        currency="INR",
        instrument_number="FDR-TEST-001",
        issuing_bank="State Bank of India",
        maturity_date=datetime.now(timezone.utc) + timedelta(days=30),
        aicte_clause_ref="6.46",
        status=CaseStatus.DRAFT,
        is_demo=True,
    )