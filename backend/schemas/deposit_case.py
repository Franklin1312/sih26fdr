"""Deposit Case schemas."""

from datetime import datetime
from typing import Optional, List, Dict, Any
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, EmailStr, computed_field

from backend.models.enums import (
    DepositType,
    DepositMethod,
    CaseStatus,
    ReleaseRequestType,
    ReleaseDecision,
    LifecycleDateType,
)
from backend.schemas.common import IDMixin, TimestampMixin, PaginationParams


class DepositCaseBase(BaseModel):
    """Base deposit case fields."""
    deposit_type: DepositType
    deposit_method: DepositMethod
    amount: Decimal = Field(..., gt=0, max_digits=15, decimal_places=2)
    currency: str = Field(default="INR", min_length=3, max_length=3)
    instrument_number: str = Field(..., min_length=1, max_length=100)
    instrument_date: Optional[datetime] = None
    issuing_bank: str = Field(..., min_length=1, max_length=255)
    maturity_date: Optional[datetime] = None
    term_end_date: Optional[datetime] = None
    aicte_clause_ref: Optional[str] = Field(default=None, max_length=100)
    regulatory_context: Dict[str, bool] = Field(default_factory=dict)


class DepositCaseCreate(DepositCaseBase):
    """Schema for creating a deposit case."""
    institution_id: str


class DepositCaseUpdate(BaseModel):
    """Schema for updating a deposit case (draft only)."""
    deposit_type: Optional[DepositType] = None
    deposit_method: Optional[DepositMethod] = None
    amount: Optional[Decimal] = Field(default=None, gt=0, max_digits=15, decimal_places=2)
    currency: Optional[str] = Field(default=None, min_length=3, max_length=3)
    instrument_number: Optional[str] = Field(default=None, min_length=1, max_length=100)
    instrument_date: Optional[datetime] = None
    issuing_bank: Optional[str] = Field(default=None, min_length=1, max_length=255)
    maturity_date: Optional[datetime] = None
    term_end_date: Optional[datetime] = None
    aicte_clause_ref: Optional[str] = Field(default=None, max_length=100)
    regulatory_context: Optional[Dict[str, bool]] = None


class DepositCaseStatusUpdate(BaseModel):
    """Schema for status transition."""
    new_status: CaseStatus
    reason: Optional[str] = None
    details: Optional[Dict[str, Any]] = None


class DepositCaseResponse(DepositCaseBase, IDMixin, TimestampMixin):
    """Deposit case response schema."""
    tracking_ref: str
    institution_id: str
    assigned_officer_id: Optional[str] = None
    status: CaseStatus
    previous_status: Optional[CaseStatus] = None
    is_demo: bool
    submitted_at: Optional[datetime] = None
    closed_at: Optional[datetime] = None
    parent_case_id: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

    @computed_field
    @property
    def case_number(self) -> str:
        return self.tracking_ref


class DepositCaseDetail(DepositCaseResponse):
    """Deposit case with related data."""
    institution: Optional["InstitutionResponse"] = None
    assigned_officer: Optional["UserResponse"] = None
    evidence: List["DepositEvidenceResponse"] = []
    events: List["CaseEventResponse"] = []
    clarifications: List["ClarificationRequestResponse"] = []
    clearances: List["ClearanceTaskResponse"] = []
    release_requests: List["ReleaseRequestResponse"] = []
    lifecycle_dates: List["LifecycleDateResponse"] = []

    @computed_field
    @property
    def documents(self) -> List["DepositEvidenceResponse"]:
        return [document for document in self.evidence if not document.is_deleted]

    model_config = ConfigDict(from_attributes=True)


class DepositCaseListParams(PaginationParams):
    """Query parameters for listing deposit cases."""
    status: Optional[CaseStatus] = None
    deposit_type: Optional[DepositType] = None
    deposit_method: Optional[DepositMethod] = None
    institution_id: Optional[str] = None
    assigned_officer_id: Optional[str] = None
    search: Optional[str] = None
    date_from: Optional[datetime] = None
    date_to: Optional[datetime] = None


class DepositCaseDashboardStats(BaseModel):
    """Dashboard statistics for deposit cases."""
    total: int
    by_status: Dict[str, int]
    by_type: Dict[str, int]
    by_method: Dict[str, int]
    pending_my_action: int
    overdue_clearances: int
    upcoming_maturities: int
    total_amount: float = 0
    overdue_count: int = 0
    upcoming_maturity_count: int = 0


# Forward references
from backend.schemas.institution import InstitutionResponse, UserResponse
from backend.schemas.evidence import DepositEvidenceResponse, CaseEventResponse
from backend.schemas.workflow import (
    ClarificationRequestResponse,
    ClearanceTaskResponse,
    ReleaseRequestResponse,
    LifecycleDateResponse,
)

DepositCaseDetail.model_rebuild()
