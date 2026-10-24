"""Domain models - Release Request and Lifecycle Date entities."""

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
    ReleaseRequestType,
    ReleaseDecision,
    LifecycleDateType,
)


class ReleaseRequest(Base):
    """Release/refund request processing."""
    __tablename__ = "release_requests"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    case_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("deposit_cases.id", ondelete="CASCADE"), nullable=False, index=True
    )
    created_by: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=False)
    decided_by: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    request_type: Mapped[ReleaseRequestType] = mapped_column(Enum(ReleaseRequestType), nullable=False)
    review_path: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    checklist_data: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    final_decision: Mapped[Optional[ReleaseDecision]] = mapped_column(Enum(ReleaseDecision), nullable=True)
    decision_reasoning: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="pending", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    decided_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    case: Mapped["DepositCase"] = relationship("DepositCase", back_populates="release_requests", lazy="selectin")
    created_by_user: Mapped["User"] = relationship("User", foreign_keys=[created_by], back_populates="release_requests", lazy="selectin")
    decided_by_user: Mapped[Optional["User"]] = relationship("User", foreign_keys=[decided_by], back_populates="release_decisions", lazy="selectin")

    def __repr__(self) -> str:
        return f"<ReleaseRequest(id={self.id}, case_id={self.case_id}, type={self.request_type})>"


class LifecycleDate(Base):
    """Lifecycle dates for alerts and monitoring."""
    __tablename__ = "lifecycle_dates"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    case_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("deposit_cases.id", ondelete="CASCADE"), nullable=False, index=True
    )
    date_type: Mapped[LifecycleDateType] = mapped_column(Enum(LifecycleDateType), nullable=False, index=True)
    date_value: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    alert_sent: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    alert_sent_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    alert_lead_days: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    case: Mapped["DepositCase"] = relationship("DepositCase", back_populates="lifecycle_dates", lazy="selectin")

    __table_args__ = (
        Index("ix_lifecycle_dates_case_type", "case_id", "date_type"),
        Index("ix_lifecycle_dates_value_alert", "date_value", "alert_sent"),
    )

    def __repr__(self) -> str:
        return f"<LifecycleDate(id={self.id}, case_id={self.case_id}, type={self.date_type}, date={self.date_value})>"
