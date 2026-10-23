"""Wizard schemas for multi-step submission flow."""

from datetime import datetime
from typing import Any, Dict, List, Optional
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from backend.models.enums import DepositType, DepositMethod
from backend.schemas.common import IDMixin


class WizardStep1Request(BaseModel):
    """Step 1: Case Details request."""
    deposit_type: DepositType
    deposit_method: DepositMethod
    amount: Decimal = Field(..., gt=0, max_digits=15, decimal_places=2)
    currency: str = Field(default="INR", min_length=3, max_length=3)
    instrument_number: str = Field(..., min_length=1, max_length=100)
    issuing_bank: str = Field(..., min_length=1, max_length=255)
    maturity_date: Optional[datetime] = None
    aicte_clause_ref: Optional[str] = Field(default=None, max_length=100)

    model_config = ConfigDict(from_attributes=True)


class WizardStep1Response(BaseModel):
    """Step 1: Case Details response."""
    success: bool
    errors: List[str] = []
    warnings: List[str] = []


class WizardStep2Document(BaseModel):
    """Document entry for step 2."""
    document_type: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None


class WizardStep2Request(BaseModel):
    """Step 2: Documents request."""
    documents: List[WizardStep2Document] = []


class WizardStep2Response(BaseModel):
    """Step 2: Documents response."""
    success: bool
    errors: List[str] = []
    warnings: List[str] = []


class WizardStep3Request(BaseModel):
    """Step 3: Review & Confirmation request."""
    confirmed: bool = False
    terms_accepted: bool = False


class WizardStep3Response(BaseModel):
    """Step 3: Review & Completeness Check response."""
    success: bool
    completeness_check: Dict[str, Any]
    errors: List[str] = []
    warnings: List[str] = []
    missing_mandatory: List[str] = []
    missing_conditional: List[Dict[str, Any]] = []


class WizardStep4Response(BaseModel):
    """Step 4: Submit response."""
    success: bool
    case_id: Optional[str] = None
    tracking_ref: Optional[str] = None
    status: Optional[str] = None
    errors: List[str] = []


class WizardStateResponse(BaseModel):
    """Current wizard state."""
    case_id: str
    tracking_ref: Optional[str] = None
    current_step: str
    deposit_type: str
    deposit_method: str
    amount: float
    currency: str
    instrument_number: str
    issuing_bank: str
    maturity_date: Optional[str] = None
    aicte_clause_ref: Optional[str] = None
    uploaded_documents: List[Dict[str, Any]] = []
    required_documents: Dict[str, Any] = {}
    missing_mandatory: List[str] = []
    missing_conditional: List[str] = []


class WizardCreateRequest(BaseModel):
    """Request to create a new wizard session."""
    institution_id: str


class WizardCreateResponse(BaseModel):
    """Response after creating wizard session."""
    case_id: str
    tracking_ref: str
    current_step: str
    message: str