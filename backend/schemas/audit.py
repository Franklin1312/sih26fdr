"""Audit Log schemas."""

from datetime import datetime
from typing import Optional, Dict, Any, List

from pydantic import BaseModel, ConfigDict, Field

from backend.models.enums import AuditAction
from backend.schemas.common import IDMixin, PaginationParams


class AuditLogBase(BaseModel):
    """Base audit log fields."""
    entity_type: str = Field(..., min_length=1, max_length=50)
    entity_id: str = Field(..., min_length=1, max_length=36)
    action: AuditAction
    actor_id: str = Field(..., min_length=1, max_length=36)
    old_values: Optional[Dict[str, Any]] = None
    new_values: Optional[Dict[str, Any]] = None


class AuditLogCreate(AuditLogBase):
    """Schema for creating an audit log entry."""
    pass


class AuditLogResponse(AuditLogBase, IDMixin):
    """Audit log response schema."""
    timestamp: datetime
    hash: str
    prev_hash: str
    sequence: int
    is_checkpoint: bool
    checkpoint_signature: Optional[str] = None
    checkpoint_key_id: Optional[str] = None
    actor: Optional["UserResponse"] = None

    model_config = ConfigDict(from_attributes=True)


class AuditLogQueryParams(PaginationParams):
    """Query parameters for audit logs."""
    entity_type: Optional[str] = None
    entity_id: Optional[str] = None
    action: Optional[AuditAction] = None
    actor_id: Optional[str] = None
    date_from: Optional[datetime] = None
    date_to: Optional[datetime] = None


class AuditChainVerificationResult(BaseModel):
    """Result of audit chain verification."""
    chain_valid: bool
    total_records: int
    verified_records: int
    first_hash: str
    last_hash: str
    tampered_records: List[str]
    message: str


class AuditCheckpointResponse(BaseModel):
    """Audit checkpoint response."""
    sequence: int
    hash: str
    signature: str
    key_id: str
    created_at: datetime


class AuditCheckpointVerificationResult(BaseModel):
    """Result of audit checkpoint verification."""
    checkpoints_valid: bool
    total_checkpoints: int
    verified_checkpoints: int
    failed_checkpoints: List[str]
    message: str


# Forward reference
from backend.schemas.institution import UserResponse

AuditLogResponse.model_rebuild()