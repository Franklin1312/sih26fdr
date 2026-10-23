"""Domain models package."""

from backend.models.enums import (
    UserRole,
    DepositType,
    DepositMethod,
    CaseStatus,
    ClarificationStatus,
    ClearanceStatus,
    ReleaseRequestType,
    ReleaseDecision,
    LifecycleDateType,
    AuditAction,
    VALID_TRANSITIONS,
    can_transition,
)
from backend.models.entities_core import (
    Institution,
    User,
)
from backend.models.entities_case import (
    DepositCase,
)
from backend.models.entities_evidence import (
    DepositEvidence,
    CaseEvent,
)
from backend.models.entities_clarification import (
    ClarificationRequest,
    ClearanceTask,
)
from backend.models.entities_release import (
    ReleaseRequest,
    LifecycleDate,
)
from backend.models.entities_audit import (
    AuditLog,
)

__all__ = [
    # Enums
    "UserRole",
    "DepositType",
    "DepositMethod",
    "CaseStatus",
    "ClarificationStatus",
    "ClearanceStatus",
    "ReleaseRequestType",
    "ReleaseDecision",
    "LifecycleDateType",
    "AuditAction",
    "VALID_TRANSITIONS",
    "can_transition",
    # Entities
    "Institution",
    "User",
    "DepositCase",
    "DepositEvidence",
    "CaseEvent",
    "ClarificationRequest",
    "ClearanceTask",
    "ReleaseRequest",
    "LifecycleDate",
    "AuditLog",
]