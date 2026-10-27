"""Clearance and Release specific schemas."""

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field

from backend.models.enums import (
    CaseStatus,
    ClearanceStatus,
    ReleaseDecision,
    ReleaseRequestType,
)
from backend.schemas.common import IDMixin, TimestampMixin
from backend.schemas.institution import UserResponse
from backend.schemas.evidence import DepositEvidenceResponse
from backend.schemas.workflow import ClearanceTaskResponse, ReleaseRequestResponse


class ClearanceQueueItem(BaseModel):
    """Single case item in clearance queue."""
    case_id: str
    case_number: str
    institution_name: str
    deposit_type: str
    deposit_method: str
    amount: float
    status: CaseStatus
    assigned_officer_id: Optional[str] = None
    clearance_tasks: List[ClearanceTaskResponse] = []
    created_at: datetime
    submitted_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class ClearanceQueueResponse(BaseModel):
    """Paginated clearance queue response."""
    items: List[ClearanceQueueItem]
    total: int
    page: int
    page_size: int


class ClearanceTaskDetail(ClearanceTaskResponse):
    """Clearance task with case context."""
    case_number: str
    institution_name: str
    deposit_type: str
    deposit_method: str
    documents: List[DepositEvidenceResponse] = []


class ClearanceTaskUpdateRequest(BaseModel):
    """Request to update a clearance task."""
    status: Optional[ClearanceStatus] = None
    evidence: Optional[str] = None
    notes: Optional[str] = None


class ClearanceClaimRequest(BaseModel):
    """Request to claim a clearance case."""
    pass  # Simple claim - officer assigns themselves


class ClearanceCompleteRequest(BaseModel):
    """Request to complete a clearance task."""
    evidence: str = Field(..., min_length=1, description="Linked evidence ID or evidence reference")
    notes: Optional[str] = None


class ReleaseQueueItem(BaseModel):
    """Single case item in release queue (authority view)."""
    case_id: str
    case_number: str
    institution_name: str
    deposit_type: str
    deposit_method: str
    amount: float
    status: CaseStatus
    review_path: str
    request_type: ReleaseRequestType
    requested_by: str
    requested_at: datetime
    deadline_days: int
    deadline_at: Optional[datetime] = None
    checklist_progress: Dict[str, Any] = {}

    model_config = ConfigDict(from_attributes=True)


class ReleaseQueueResponse(BaseModel):
    """Paginated release queue response."""
    items: List[ReleaseQueueItem]
    total: int
    page: int
    page_size: int


class ReleaseChecklistItem(BaseModel):
    """Single checklist item for release."""
    key: str
    label: str
    mandatory: bool
    condition: Optional[str] = None
    category: Optional[str] = None
    document_type: Optional[str] = None
    completed: bool = False


class ReleaseChecklistResponse(BaseModel):
    """Release checklist response with progress."""
    request_type: ReleaseRequestType
    deposit_method: str
    items: List[ReleaseChecklistItem]
    passed: bool
    mandatory_count: int
    completed_count: int
    missing_items: List[str]


class ReleaseDetailResponse(ReleaseRequestResponse):
    """Release request with case context and checklist."""
    case_number: str
    institution_name: str
    deposit_type: str
    deposit_method: str
    amount: float
    case_status: CaseStatus
    checklist: ReleaseChecklistResponse


class ReleaseRequestCreateRequest(BaseModel):
    """Request to create a release request (Institution)."""
    case_id: str
    request_type: ReleaseRequestType
    reason: Optional[str] = None


class ReleaseDecisionRequest(BaseModel):
    """Request to decide on a release (Authority)."""
    final_decision: ReleaseDecision
    decision_reasoning: str = Field(..., min_length=1)
    checklist_data: Optional[Dict[str, bool]] = None


class ReleaseDecisionResponse(BaseModel):
    """Response after release decision."""
    release_request: ReleaseRequestResponse
    case_status: CaseStatus
    message: str


class ClearanceHistoryItem(BaseModel):
    """Clearance history event."""
    task_id: str
    clearance_type: str
    status: ClearanceStatus
    evidence: Optional[str] = None
    notes: Optional[str] = None
    completed_at: Optional[datetime] = None
    officer_name: Optional[str] = None


class ClearanceHistoryResponse(BaseModel):
    """Clearance history for a case."""
    case_id: str
    case_number: str
    current_status: CaseStatus
    tasks: List[ClearanceHistoryItem]
    all_cleared: bool
