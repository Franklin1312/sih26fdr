"""Domain models - Deposit evidence and case events."""

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
from backend.models.enums import CaseStatus


class DepositEvidence(Base):
    """Documents uploaded for a deposit case."""
    __tablename__ = "deposit_evidence"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    case_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("deposit_cases.id", ondelete="CASCADE"), nullable=False, index=True
    )
    document_type: Mapped[str] = mapped_column(String(100), nullable=False)
    file_path: Mapped[str] = mapped_column(String(500), nullable=False)
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    file_size: Mapped[int] = mapped_column(Integer, nullable=False)
    mime_type: Mapped[str] = mapped_column(String(100), nullable=False)
    uploaded_by: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=False)

    # OCR and validation
    ocr_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    ocr_confidence: Mapped[Optional[float]] = mapped_column(nullable=True)
    validation_flags: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    extracted_data: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    # Versioning
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    replaced_by_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("deposit_evidence.id", ondelete="SET NULL"), nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    case: Mapped["DepositCase"] = relationship("DepositCase", back_populates="evidence", lazy="selectin")
    uploaded_by_user: Mapped["User"] = relationship("User", lazy="selectin")
    replaced_by: Mapped[Optional["DepositEvidence"]] = relationship("DepositEvidence", remote_side=[id], back_populates="replaces", lazy="selectin")
    replaces: Mapped[Optional["DepositEvidence"]] = relationship("DepositEvidence", back_populates="replaced_by", lazy="selectin")

    def __repr__(self) -> str:
        return f"<DepositEvidence(id={self.id}, case_id={self.case_id}, type={self.document_type})>"


class CaseEvent(Base):
    """Audit trail for case status changes and key actions."""
    __tablename__ = "case_events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    case_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("deposit_cases.id", ondelete="CASCADE"), nullable=False, index=True
    )
    event_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    actor_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=False)
    old_status: Mapped[Optional[CaseStatus]] = mapped_column(Enum(CaseStatus), nullable=True)
    new_status: Mapped[Optional[CaseStatus]] = mapped_column(Enum(CaseStatus), nullable=True)
    details: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    case: Mapped["DepositCase"] = relationship("DepositCase", back_populates="events", lazy="selectin")
    actor: Mapped["User"] = relationship("User", lazy="selectin")

    def __repr__(self) -> str:
        return f"<CaseEvent(id={self.id}, case_id={self.case_id}, type={self.event_type})>"