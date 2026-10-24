"""Deposit Evidence and Case Event schemas."""

from datetime import datetime
from typing import Optional, Dict, Any, List

from pydantic import BaseModel, ConfigDict, Field

from backend.schemas.common import IDMixin, TimestampMixin, PaginationParams, PaginatedResponse


class DepositEvidenceBase(BaseModel):
    """Base deposit evidence fields."""
    document_type: str = Field(..., min_length=1, max_length=100)
    original_filename: str = Field(..., min_length=1, max_length=255)
    file_size: int = Field(..., gt=0)
    mime_type: str = Field(..., min_length=1, max_length=100)


class DepositEvidenceCreate(DepositEvidenceBase):
    """Schema for creating deposit evidence."""
    case_id: str


class DepositEvidenceUpdate(BaseModel):
    """Schema for updating deposit evidence metadata."""
    document_type: Optional[str] = Field(default=None, min_length=1, max_length=100)


class DepositEvidenceResponse(DepositEvidenceBase, IDMixin, TimestampMixin):
    """Deposit evidence response schema."""
    case_id: str
    uploaded_by: str
    file_path: str
    version: int
    file_hash: Optional[str] = None
    is_deleted: bool = False
    ocr_text: Optional[str] = None
    ocr_confidence: Optional[float] = None
    validation_flags: Optional[Dict[str, Any]] = None
    extracted_data: Optional[Dict[str, Any]] = None
    replaced_by_id: Optional[str] = None
    uploaded_by_user: Optional["UserResponse"] = None

    model_config = ConfigDict(from_attributes=True)


class DepositEvidenceUploadResponse(DepositEvidenceBase, IDMixin, TimestampMixin):
    """Response for evidence upload."""
    case_id: str
    uploaded_by: str
    file_hash: str
    version: int
    replaced_id: Optional[str] = None
    ocr_text: Optional[str] = None
    ocr_confidence: Optional[float] = None
    validation_flags: Optional[Dict[str, Any]] = None
    extracted_data: Optional[Dict[str, Any]] = None

    model_config = ConfigDict(from_attributes=True)


class DepositEvidenceListResponse(PaginatedResponse[DepositEvidenceResponse]):
    """Paginated list of evidence documents."""
    pass


class DepositEvidenceDownloadResponse(BaseModel):
    """Response for download token generation."""
    download_token: str
    filename: str
    expires_in: int


class DepositEvidenceReplaceResponse(DepositEvidenceBase, IDMixin, TimestampMixin):
    """Response for evidence replacement."""
    case_id: str
    uploaded_by: str
    file_hash: str
    version: int
    previous_version_id: str

    model_config = ConfigDict(from_attributes=True)


class CaseEventBase(BaseModel):
    """Base case event fields."""
    event_type: str = Field(..., min_length=1, max_length=50)
    old_status: Optional[str] = None
    new_status: Optional[str] = None
    details: Optional[Dict[str, Any]] = None


class CaseEventResponse(CaseEventBase, IDMixin):
    """Case event response schema."""
    case_id: str
    actor_id: str
    created_at: datetime
    actor: Optional["UserResponse"] = None

    model_config = ConfigDict(from_attributes=True)


class FileUploadResponse(BaseModel):
    """Response for file upload."""
    evidence_id: str
    file_path: str
    original_filename: str
    file_size: int
    mime_type: str


# Forward reference
from backend.schemas.institution import UserResponse

DepositEvidenceResponse.model_rebuild()
CaseEventResponse.model_rebuild()
