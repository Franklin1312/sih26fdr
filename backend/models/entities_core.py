"""Domain models - Core entities (Institution, User)."""

from datetime import datetime
from typing import Optional, List
from uuid import uuid4

from sqlalchemy import (
    String,
    Text,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Boolean,
    Integer,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.database import Base
from backend.models.enums import UserRole


class Institution(Base):
    """Institution/Organization entity."""
    __tablename__ = "institutions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    contact_email: Mapped[str] = mapped_column(String(255), nullable=False)
    address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    users: Mapped[List["User"]] = relationship("User", back_populates="institution", lazy="selectin")
    cases: Mapped[List["DepositCase"]] = relationship("DepositCase", back_populates="institution", lazy="selectin")

    def __repr__(self) -> str:
        return f"<Institution(id={self.id}, name={self.name}, code={self.code})>"


class User(Base):
    """User account with role-based access."""
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), nullable=False, index=True)
    institution_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("institutions.id", ondelete="SET NULL"), nullable=True, index=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    password_hash: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    last_login: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    institution: Mapped[Optional["Institution"]] = relationship("Institution", back_populates="users", lazy="selectin")
    assigned_cases: Mapped[List["DepositCase"]] = relationship("DepositCase", back_populates="assigned_officer", lazy="selectin")
    clarification_requests: Mapped[List["ClarificationRequest"]] = relationship("ClarificationRequest", foreign_keys="ClarificationRequest.requested_by", back_populates="requested_by_user", lazy="selectin")
    clarification_responses: Mapped[List["ClarificationRequest"]] = relationship("ClarificationRequest", foreign_keys="ClarificationRequest.responded_by", back_populates="responded_by_user", lazy="selectin")
    clearance_tasks: Mapped[List["ClearanceTask"]] = relationship("ClearanceTask", back_populates="assigned_to_user", lazy="selectin")
    release_requests: Mapped[List["ReleaseRequest"]] = relationship("ReleaseRequest", foreign_keys="ReleaseRequest.created_by", back_populates="created_by_user", lazy="selectin")
    release_decisions: Mapped[List["ReleaseRequest"]] = relationship("ReleaseRequest", foreign_keys="ReleaseRequest.decided_by", back_populates="decided_by_user", lazy="selectin")
    audit_logs: Mapped[List["AuditLog"]] = relationship("AuditLog", back_populates="actor", lazy="selectin")

    def __repr__(self) -> str:
        return f"<User(id={self.id}, email={self.email}, role={self.role})>"