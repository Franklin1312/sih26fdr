"""Institution and User schemas."""

from datetime import datetime
from typing import Optional, List
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from backend.models.enums import UserRole
from backend.schemas.common import IDMixin, TimestampMixin


class InstitutionBase(BaseModel):
    """Base institution fields."""
    name: str = Field(..., min_length=1, max_length=255)
    code: str = Field(..., min_length=1, max_length=50)
    contact_email: EmailStr
    address: Optional[str] = None
    institution_type: str = "unknown"


class InstitutionCreate(InstitutionBase):
    """Schema for creating an institution."""
    pass


class InstitutionUpdate(BaseModel):
    """Schema for updating an institution."""
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    contact_email: Optional[EmailStr] = None
    address: Optional[str] = None
    institution_type: Optional[str] = None
    is_active: Optional[bool] = None


class InstitutionResponse(InstitutionBase, IDMixin, TimestampMixin):
    """Institution response schema."""
    is_active: bool

    model_config = ConfigDict(from_attributes=True)


class InstitutionWithStats(InstitutionResponse):
    """Institution with case statistics."""
    total_cases: int = 0
    active_cases: int = 0
    released_cases: int = 0


class UserBase(BaseModel):
    """Base user fields."""
    email: EmailStr
    full_name: str = Field(..., min_length=1, max_length=255)
    role: UserRole
    institution_id: Optional[str] = None


class UserCreate(UserBase):
    """Schema for creating a user."""
    password: str = Field(..., min_length=8, max_length=128)


class UserUpdate(BaseModel):
    """Schema for updating a user."""
    full_name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    role: Optional[UserRole] = None
    institution_id: Optional[str] = None
    is_active: Optional[bool] = None
    password: Optional[str] = Field(default=None, min_length=8, max_length=128)


class UserResponse(UserBase, IDMixin, TimestampMixin):
    """User response schema."""
    is_active: bool
    last_login: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class UserWithInstitution(UserResponse):
    """User with institution details."""
    institution: Optional[InstitutionResponse] = None


class CurrentUserResponse(BaseModel):
    """Current authenticated user response."""
    user_id: str
    email: str
    full_name: str
    role: UserRole
    institution_id: Optional[str] = None
    institution_name: Optional[str] = None
    is_authenticated: bool = True

    @property
    def roles(self) -> List[UserRole]:
        """Compatibility for route policies that check a role collection."""
        return [self.role]
