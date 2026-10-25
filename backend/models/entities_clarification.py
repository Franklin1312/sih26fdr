"""Domain models - Clarification and Clearance entities."""

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
    JSON,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.database import Base
from backend.models.enums import (
    ClarificationStatus,
    ClearanceStatus,
)


class ClarificationRequest(Base):
    """Clarification requests during scrutiny."""
    __tablename__ = "clarification_requests"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    case_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("deposit_cases.id", ondelete="CASCADE"), nullable=False, index=True
    )
    requested_by: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=False)
    responded_by: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    question: Mapped[str] = mapped_column(Text, nullable=False)
    response: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[ClarificationStatus] = mapped_column(Enum(ClarificationStatus), default=ClarificationStatus.PENDING, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    case: Mapped["DepositCase"] = relationship("DepositCase", back_populates="clarifications", lazy="selectin")
    requested_by_user: Mapped["User"] = relationship("User", foreign_keys=[requested_by], back_populates="clarification_requests", lazy="selectin")
    responded_by_user: Mapped[Optional["User"]] = relationship("User", foreign_keys=[responded_by], back_populates="clarification_responses", lazy="selectin")

    def __repr__(self) -> str:
        return f"<ClarificationRequest(id={self.id}, case_id={self.case_id}, status={self.status})>"


class ClearanceTask(Base):
    """Clearance tracking tasks."""
    __tablename__ = "clearance_tasks"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    case_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("deposit_cases.id", ondelete="CASCADE"), nullable=False, index=True
    )
    clearance_type: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    assigned_to: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=False, index=True)
    status: Mapped[ClearanceStatus] = mapped_column(Enum(ClearanceStatus), default=ClearanceStatus.PENDING, nullable=False)
    evidence: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    case: Mapped["DepositCase"] = relationship("DepositCase", back_populates="clearances", lazy="selectin")
    assigned_to_user: Mapped["User"] = relationship("User", back_populates="clearance_tasks", lazy="selectin")

    __table_args__ = (
        Index("ix_clearance_tasks_case_type", "case_id", "clearance_type"),
    )

    def __repr__(self) -> str:
        return f"<ClearanceTask(id={self.id}, case_id={self.case_id}, type={self.clearance_type}, status={self.status})>"