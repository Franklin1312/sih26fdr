"""Domain models - Deposit case entity."""

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
    DepositType,
    DepositMethod,
    CaseStatus,
)


class DepositCase(Base):
    """Core deposit case entity."""
    __tablename__ = "deposit_cases"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    tracking_ref: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    institution_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("institutions.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    assigned_officer_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )

    # Deposit details
    deposit_type: Mapped[DepositType] = mapped_column(Enum(DepositType), nullable=False)
    deposit_method: Mapped[DepositMethod] = mapped_column(Enum(DepositMethod), nullable=False)
    amount: Mapped[float] = mapped_column(nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="INR", nullable=False)
    instrument_number: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    instrument_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    issuing_bank: Mapped[str] = mapped_column(String(255), nullable=False)
    maturity_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    term_end_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    aicte_clause_ref: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    # Explicit, evidence-backed Clause 6.46 circumstances.  These are facts
    # supplied for a case, never inferred from a generic institution label.
    regulatory_context: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)

    # Status workflow
    status: Mapped[CaseStatus] = mapped_column(Enum(CaseStatus), default=CaseStatus.DRAFT, nullable=False, index=True)
    previous_status: Mapped[Optional[CaseStatus]] = mapped_column(Enum(CaseStatus), nullable=True)

    # Metadata
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    submitted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    closed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    institution: Mapped["Institution"] = relationship("Institution", back_populates="cases", lazy="selectin")
    assigned_officer: Mapped[Optional["User"]] = relationship("User", back_populates="assigned_cases", lazy="selectin")
    evidence: Mapped[List["DepositEvidence"]] = relationship("DepositEvidence", back_populates="case", lazy="selectin")
    events: Mapped[List["CaseEvent"]] = relationship("CaseEvent", back_populates="case", lazy="selectin")
    clarifications: Mapped[List["ClarificationRequest"]] = relationship("ClarificationRequest", back_populates="case", lazy="selectin")
    clearances: Mapped[List["ClearanceTask"]] = relationship("ClearanceTask", back_populates="case", lazy="selectin")
    release_requests: Mapped[List["ReleaseRequest"]] = relationship("ReleaseRequest", back_populates="case", lazy="selectin")
    lifecycle_dates: Mapped[List["LifecycleDate"]] = relationship("LifecycleDate", back_populates="case", lazy="selectin")
    parent_case_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("deposit_cases.id", ondelete="SET NULL"), nullable=True, index=True
    )
    parent_case: Mapped[Optional["DepositCase"]] = relationship("DepositCase", remote_side=[id], back_populates="child_cases", lazy="selectin")
    child_cases: Mapped[List["DepositCase"]] = relationship("DepositCase", back_populates="parent_case", lazy="selectin")

    __table_args__ = (
        Index("ix_deposit_cases_institution_status", "institution_id", "status"),
        Index("ix_deposit_cases_assigned_status", "assigned_officer_id", "status"),
    )

    def __repr__(self) -> str:
        return f"<DepositCase(id={self.id}, ref={self.tracking_ref}, status={self.status})>"

    @property
    def case_number(self) -> str:
        """Compatibility alias used by queue and release response schemas."""
        return self.tracking_ref
