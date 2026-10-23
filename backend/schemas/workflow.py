"""Workflow schemas (clarification, clearance, release, lifecycle)."""

from datetime import datetime
from typing import Optional, Dict, Any, List

from pydantic import BaseModel, ConfigDict, Field

from backend.models.enums import (
    ClarificationStatus,
    ClearanceStatus,
    ReleaseRequestType,
    ReleaseDecision,
    LifecycleDateType,
)
from backend.schemas.common import IDMixin, TimestampMixin


class ClarificationRequestBase(BaseModel):
    """Base clarification request fields."""
    question: str = Field(..., min_length=1)
    response: Optional[str] = None


class ClarificationRequestCreate(ClarificationRequestBase):
    """Schema for creating a clarification request."""
    case_id: str


class ClarificationRequestResponse(ClarificationRequestBase, IDMixin, TimestampMixin):
    """Clarification request response schema."""
    case_id: str
    requested_by: str
    responded_by: Optional[str] = None
    status: ClarificationStatus
    resolved_at: Optional[datetime] = None
    requested_by_user: Optional["UserResponse"] = None
    responded_by_user: Optional["UserResponse"] = None

    model_config = ConfigDict(from_attributes=True)


class ClarificationRequestUpdate(BaseModel):
    """Schema for updating a clarification request (response)."""
    response: str = Field(..., min_length=1)


class ClearanceTaskBase(BaseModel):
    """Base clearance task fields."""
    clearance_type: str = Field(..., min_length=1, max_length=100)
    evidence: Optional[str] = None
    notes: Optional[str] = None


class ClearanceTaskCreate(ClearanceTaskBase):
    """Schema for creating a clearance task."""
    case_id: str
    assigned_to: str


class ClearanceTaskUpdate(BaseModel):
    """Schema for updating a clearance task."""
    status: Optional[ClearanceStatus] = None
    evidence: Optional[str] = None
    notes: Optional[str] = None


class ClearanceTaskResponse(ClearanceTaskBase, IDMixin, TimestampMixin):
    """Clearance task response schema."""
    case_id: str
    assigned_to: str
    status: ClearanceStatus
    completed_at: Optional[datetime] = None
    assigned_to_user: Optional["UserResponse"] = None

    model_config = ConfigDict(from_attributes=True)


class ReleaseRequestBase(BaseModel):
    """Base release request fields."""
    request_type: ReleaseRequestType
    checklist_data: Optional[Dict[str, bool]] = None


class ReleaseRequestCreate(ReleaseRequestBase):
    """Schema for creating a release request."""
    case_id: str


class ReleaseRequestUpdate(BaseModel):
    """Schema for updating a release request (decision)."""
    final_decision: Optional[ReleaseDecision] = None
    decision_reasoning: Optional[str] = None
    checklist_data: Optional[Dict[str, bool]] = None


class ReleaseRequestResponse(ReleaseRequestBase, IDMixin, TimestampMixin):
    """Release request response schema."""
    case_id: str
    created_by: str
    decided_by: Optional[str] = None
    review_path: Optional[str] = None
    final_decision: Optional[ReleaseDecision] = None
    decision_reasoning: Optional[str] = None
    status: str
    decided_at: Optional[datetime] = None
    created_by_user: Optional["UserResponse"] = None
    decided_by_user: Optional["UserResponse"] = None

    model_config = ConfigDict(from_attributes=True)


class LifecycleDateBase(BaseModel):
    """Base lifecycle date fields."""
    date_type: LifecycleDateType
    date_value: datetime
    description: Optional[str] = None


class LifecycleDateCreate(LifecycleDateBase):
    """Schema for creating a lifecycle date."""
    case_id: str


class LifecycleDateUpdate(BaseModel):
    """Schema for updating a lifecycle date."""
    date_value: Optional[datetime] = None
    description: Optional[str] = None
    alert_sent: Optional[bool] = None
    alert_sent_at: Optional[datetime] = None
    alert_lead_days: Optional[int] = None


class LifecycleDateResponse(LifecycleDateBase, IDMixin, TimestampMixin):
    """Lifecycle date response schema."""
    case_id: str
    alert_sent: bool
    alert_sent_at: Optional[datetime] = None
    alert_lead_days: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)


# Forward reference
from backend.schemas.institution import UserResponse

ClarificationRequestResponse.model_rebuild()
ClearanceTaskResponse.model_rebuild()
ReleaseRequestResponse.model_rebuild()
LifecycleDateResponse.model_rebuild()