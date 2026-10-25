"""Wizard routes - Multi-step submission flow."""

from typing import Any, Dict, List
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status, Header
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db
from backend.services.auth import auth_service
from backend.services.access_control import access_control, UserContext
from backend.services.wizard import WizardService, WizardState
from backend.services.validation import validation_engine, ValidationResult
from backend.schemas.wizard import (
    WizardStep1Request,
    WizardStep1Response,
    WizardStep2Request,
    WizardStep2Response,
    WizardStep3Request,
    WizardStep3Response,
    WizardStep4Response,
    WizardStateResponse,
    WizardCreateRequest,
    WizardCreateResponse,
)
from backend.schemas.institution import CurrentUserResponse

router = APIRouter(prefix="/wizard", tags=["wizard"])


async def get_current_user(authorization: str = Header(None)):
    try:
        user = await auth_service.get_current_user(authorization)
        return user
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


async def get_wizard_service(db: AsyncSession = Depends(get_db)) -> WizardService:
    return WizardService(db)


@router.post("/create", response_model=WizardCreateResponse, status_code=status.HTTP_201_CREATED)
async def create_wizard_session(
    request: WizardCreateRequest,
    wizard_service: WizardService = Depends(get_wizard_service),
    user: UserContext = Depends(get_user_context),
):
    """Create a new draft case and start wizard session."""
    if not user.has_permission("case:create"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission denied")

    try:
        case = await wizard_service.create_draft_case(user, request.institution_id)
        return WizardCreateResponse(
            case_id=case.id,
            tracking_ref=case.tracking_ref or "pending",
            current_step=WizardState.STEP_1,
            message="Wizard session created. Start with Step 1: Case Details.",
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))


@router.get("/{case_id}/state", response_model=WizardStateResponse)
async def get_wizard_state(
    case_id: str,
    wizard_service: WizardService = Depends(get_wizard_service),
    user: UserContext = Depends(get_user_context),
):
    """Get current wizard state for a case."""
    state = await wizard_service.get_wizard_state(case_id, user)
    if "error" in state:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=state["error"])
    return WizardStateResponse(**state)


@router.post("/{case_id}/step1", response_model=WizardStep1Response)
async def submit_step1(
    case_id: str,
    request: WizardStep1Request,
    wizard_service: WizardService = Depends(get_wizard_service),
    user: UserContext = Depends(get_user_context),
):
    """Submit Step 1: Case Details."""
    if not user.has_permission("case:update_draft"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission denied")

    data = request.model_dump()
    data["deposit_type"] = request.deposit_type.value
    data["deposit_method"] = request.deposit_method.value

    result = await wizard_service.validate_step1(case_id, data, user)

    if not result.is_valid:
        return WizardStep1Response(success=False, errors=result.errors, warnings=result.warnings)

    return WizardStep1Response(success=True, warnings=result.warnings)


@router.post("/{case_id}/step2", response_model=WizardStep2Response)
async def submit_step2(
    case_id: str,
    request: WizardStep2Request,
    wizard_service: WizardService = Depends(get_wizard_service),
    user: UserContext = Depends(get_user_context),
):
    """Submit Step 2: Documents (metadata only - files uploaded via evidence routes)."""
    if not user.has_permission("evidence:upload"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission denied")

    data = request.model_dump()
    result = await wizard_service.validate_step2(case_id, data, user)

    if not result.is_valid:
        return WizardStep2Response(success=False, errors=result.errors, warnings=result.warnings)

    return WizardStep2Response(success=True, warnings=result.warnings)


@router.post("/{case_id}/step3", response_model=WizardStep3Response)
async def submit_step3(
    case_id: str,
    request: WizardStep3Request,
    wizard_service: WizardService = Depends(get_wizard_service),
    user: UserContext = Depends(get_user_context),
):
    """Submit Step 3: Review & Completeness Check (PS-03)."""
    if not user.has_permission("case:update_draft"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission denied")

    data = request.model_dump()
    result = await wizard_service.validate_step3(case_id, data, user)

    completeness_check = {
        "passed": result.is_valid,
        "missing_mandatory": result.missing_mandatory,
        "missing_conditional": result.missing_conditional,
        "warnings": result.warnings,
    }

    if not result.is_valid:
        return WizardStep3Response(
            success=False,
            completeness_check=completeness_check,
            errors=result.errors,
            warnings=result.warnings,
            missing_mandatory=result.missing_mandatory,
            missing_conditional=result.missing_conditional,
        )

    return WizardStep3Response(
        success=True,
        completeness_check=completeness_check,
        warnings=result.warnings,
        missing_mandatory=result.missing_mandatory,
        missing_conditional=result.missing_conditional,
    )


@router.post("/{case_id}/submit", response_model=WizardStep4Response)
async def submit_wizard(
    case_id: str,
    wizard_service: WizardService = Depends(get_wizard_service),
    user: UserContext = Depends(get_user_context),
):
    """Step 4: Submit case (DRAFT -> SUBMITTED)."""
    if not user.has_permission("case:create"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission denied")

    try:
        case = await wizard_service.submit_case(case_id, user)
        return WizardStep4Response(
            success=True,
            case_id=case.id,
            tracking_ref=case.tracking_ref,
            status=case.status.value,
        )
    except ValueError as e:
        return WizardStep4Response(success=False, errors=[str(e)])
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))