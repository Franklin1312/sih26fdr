"""Integration tests for Cases API endpoints."""

import pytest
from httpx import AsyncClient
from decimal import Decimal
from datetime import datetime, timezone, timedelta
from uuid import uuid4


class TestCasesAPI:
    """Tests for /api/v1/cases endpoints."""
    
    @pytest.mark.asyncio
    async def test_create_case_draft(self, client: AsyncClient, test_db, demo_institution, demo_user):
        """Test creating a deposit case in DRAFT status."""
        # Add demo data to test database
        test_db.add(demo_institution)
        test_db.add(demo_user)
        await test_db.flush()
        
        # Register user in access control
        from backend.services.access_control import access_control
        from backend.schemas.institution import CurrentUserResponse
        access_control.register_user(CurrentUserResponse(
            user_id=demo_user.id,
            email=demo_user.email,
            full_name=demo_user.full_name,
            role=demo_user.role,
            institution_id=demo_user.institution_id,
            is_active=True,
        ))
        
        case_data = {
            "institution_id": demo_institution.id,
            "deposit_type": "fdr",
            "deposit_method": "fdr_rpgf",
            "amount": "5000000.00",
            "currency": "INR",
            "instrument_number": "FDR-TEST-001",
            "issuing_bank": "State Bank of India",
            "maturity_date": (datetime.now(timezone.utc) + timedelta(days=30)).isoformat(),
            "aicte_clause_ref": "6.46",
        }
        
        headers = {"Authorization": f"Bearer {demo_user.id}:institution_rep"}
        response = await client.post("/api/v1/cases", json=case_data, headers=headers)
        
        assert response.status_code == 201
        data = response.json()
        assert data["status"] == "draft"
        assert data["deposit_type"] == "fdr"
        assert data["deposit_method"] == "fdr_rpgf"
        assert data["instrument_number"] == "FDR-TEST-001"
        assert "tracking_ref" in data
        assert data["tracking_ref"].startswith("FDR-")

    @pytest.mark.asyncio
    async def test_list_cases(self, client: AsyncClient, test_db, demo_institution, demo_user):
        """Test listing deposit cases."""
        # Add demo data to test database
        test_db.add(demo_institution)
        test_db.add(demo_user)
        
        # Create a case directly
        from backend.models import DepositCase
        from backend.models.enums import DepositType, DepositMethod, CaseStatus
        case = DepositCase(
            id=str(uuid4()),
            tracking_ref=f"FDR-TEST-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}",
            institution_id=demo_institution.id,
            deposit_type=DepositType.FDR,
            deposit_method=DepositMethod.FDR_RPGF,
            amount=Decimal("5000000"),
            currency="INR",
            instrument_number="FDR-TEST-002",
            issuing_bank="State Bank of India",
            maturity_date=datetime.now(timezone.utc) + timedelta(days=30),
            aicte_clause_ref="6.46",
            status=CaseStatus.DRAFT,
            is_demo=True,
        )
        test_db.add(case)
        await test_db.flush()
        
        # Register user in access control
        from backend.services.access_control import access_control
        from backend.schemas.institution import CurrentUserResponse
        access_control.register_user(CurrentUserResponse(
            user_id=demo_user.id,
            email=demo_user.email,
            full_name=demo_user.full_name,
            role=demo_user.role,
            institution_id=demo_user.institution_id,
            is_active=True,
        ))
        
        headers = {"Authorization": f"Bearer {demo_user.id}:institution_rep"}
        response = await client.get("/api/v1/cases", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        assert data["total"] >= 1
        assert len(data["items"]) >= 1
        # Find our case in the list
        case_ids = [item["id"] for item in data["items"]]
        assert case.id in case_ids

    @pytest.mark.asyncio
    async def test_get_case_detail(self, client: AsyncClient, test_db, demo_institution, demo_user):
        """Test getting a deposit case by ID with details."""
        # Add demo data to test database
        test_db.add(demo_institution)
        test_db.add(demo_user)
        
        # Create a case directly
        from backend.models import DepositCase
        from backend.models.enums import DepositType, DepositMethod, CaseStatus
        case = DepositCase(
            id=str(uuid4()),
            tracking_ref=f"FDR-TEST-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}",
            institution_id=demo_institution.id,
            deposit_type=DepositType.FDR,
            deposit_method=DepositMethod.FDR_RPGF,
            amount=Decimal("5000000"),
            currency="INR",
            instrument_number="FDR-TEST-003",
            issuing_bank="State Bank of India",
            maturity_date=datetime.now(timezone.utc) + timedelta(days=30),
            aicte_clause_ref="6.46",
            status=CaseStatus.DRAFT,
            is_demo=True,
        )
        test_db.add(case)
        await test_db.flush()
        
        # Register user in access control
        from backend.services.access_control import access_control
        from backend.schemas.institution import CurrentUserResponse
        access_control.register_user(CurrentUserResponse(
            user_id=demo_user.id,
            email=demo_user.email,
            full_name=demo_user.full_name,
            role=demo_user.role,
            institution_id=demo_user.institution_id,
            is_active=True,
        ))
        
        headers = {"Authorization": f"Bearer {demo_user.id}:institution_rep"}
        response = await client.get(f"/api/v1/cases/{case.id}", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == case.id
        assert data["tracking_ref"] == case.tracking_ref
        assert data["status"] == "draft"
        assert "evidence" in data
        assert "events" in data
        assert "clarifications" in data
        assert "clearances" in data
        assert "release_requests" in data
        assert "lifecycle_dates" in data

    @pytest.mark.asyncio
    async def test_get_case_not_found(self, client: AsyncClient, test_db, demo_institution, demo_user):
        """Test getting a non-existent case returns 404."""
        test_db.add(demo_institution)
        test_db.add(demo_user)
        await test_db.flush()
        
        # Register user in access control
        from backend.services.access_control import access_control
        from backend.schemas.institution import CurrentUserResponse
        access_control.register_user(CurrentUserResponse(
            user_id=demo_user.id,
            email=demo_user.email,
            full_name=demo_user.full_name,
            role=demo_user.role,
            institution_id=demo_user.institution_id,
            is_active=True,
        ))
        
        headers = {"Authorization": f"Bearer {demo_user.id}:institution_rep"}
        response = await client.get("/api/v1/cases/non-existent-id", headers=headers)
        
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_create_case_invalid_institution(self, client: AsyncClient, test_db, demo_user):
        """Test creating a case with non-existent institution returns 400."""
        test_db.add(demo_user)
        await test_db.flush()
        
        # Register user in access control
        from backend.services.access_control import access_control
        from backend.schemas.institution import CurrentUserResponse
        access_control.register_user(CurrentUserResponse(
            user_id=demo_user.id,
            email=demo_user.email,
            full_name=demo_user.full_name,
            role=demo_user.role,
            institution_id=demo_user.institution_id,
            is_active=True,
        ))
        
        case_data = {
            "institution_id": "non-existent",
            "deposit_type": "fdr",
            "deposit_method": "fdr_rpgf",
            "amount": "5000000.00",
            "currency": "INR",
            "instrument_number": "FDR-TEST-004",
            "issuing_bank": "State Bank of India",
            "maturity_date": (datetime.now(timezone.utc) + timedelta(days=30)).isoformat(),
            "aicte_clause_ref": "6.46",
        }
        
        headers = {"Authorization": f"Bearer {demo_user.id}:institution_rep"}
        response = await client.post("/api/v1/cases", json=case_data, headers=headers)
        
        # Should fail validation - institution doesn't exist
        assert response.status_code in [400, 404]
