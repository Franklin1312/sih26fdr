"""Common Pydantic schemas."""

from datetime import datetime
from typing import Any, Generic, List, Optional, TypeVar
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class TimestampMixin(BaseModel):
    """Mixin for created/updated timestamps."""
    created_at: datetime
    updated_at: Optional[datetime] = None


class IDMixin(BaseModel):
    """Mixin for UUID id field."""
    id: str


class PaginationParams(BaseModel):
    """Pagination query parameters."""
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.page_size

    @property
    def limit(self) -> int:
        return self.page_size


class PaginatedResponse(BaseModel, Generic[TypeVar("T")]):
    """Paginated response wrapper."""
    items: List[TypeVar("T")]
    total: int
    page: int
    page_size: int
    total_pages: int


class ErrorResponse(BaseModel):
    """Standard error response."""
    error: str
    status_code: int
    detail: Optional[str] = None


class SuccessResponse(BaseModel):
    """Standard success response."""
    message: str
    data: Optional[Any] = None