"""Domain models - Audit Log entity."""

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
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.database import Base
from backend.models.enums import AuditAction


class AuditLog(Base):
    """Tamper-evident hash-chained audit log."""
    __tablename__ = "audit_logs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    entity_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    entity_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    action: Mapped[AuditAction] = mapped_column(Enum(AuditAction), nullable=False)
    actor_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=False, index=True)
    old_values: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    new_values: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)

    # Hash chain
    hash: Mapped[str] = mapped_column(String(64), nullable=False)
    prev_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    sequence: Mapped[int] = mapped_column(Integer, unique=True, nullable=False)  # Not primary key, just unique

    # Checkpoint signature
    is_checkpoint: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    checkpoint_signature: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    checkpoint_key_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)

    # Relationships
    actor: Mapped["User"] = relationship("User", back_populates="audit_logs", lazy="selectin")

    __table_args__ = (
        Index("ix_audit_logs_entity", "entity_type", "entity_id"),
        Index("ix_audit_logs_actor_time", "actor_id", "timestamp"),
        UniqueConstraint("sequence", name="uq_audit_logs_sequence"),
    )

    def __repr__(self) -> str:
        return f"<AuditLog(seq={self.sequence}, entity={self.entity_type}:{self.entity_id}, action={self.action})>"