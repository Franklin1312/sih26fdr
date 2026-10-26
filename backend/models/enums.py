"""Domain models - enums and base."""

import enum


class UserRole(str, enum.Enum):
    """User roles in the system."""
    INSTITUTION_REP = "institution_rep"
    SCRUTINY_OFFICER = "scrutiny_officer"
    CLEARANCE_OFFICER = "clearance_officer"
    APPROVAL_BUREAU = "approval_bureau"
    COUNCIL = "council"
    COMPETENT_AUTHORITY = "competent_authority"
    SYSTEM_ADMIN = "system_admin"


class DepositType(str, enum.Enum):
    """Types of deposits."""
    SECURITY_DEPOSIT = "security_deposit"
    FDR = "fdr"
    RPGF = "rpgf"
    BANK_GUARANTEE = "bank_guarantee"


class DepositMethod(str, enum.Enum):
    """Deposit methods determining release path."""
    FDR_RPGF = "fdr_rpgf"
    RTGS = "rtgs"
    SECURITY_DEPOSIT_REFUND = "security_deposit_refund"


class CaseStatus(str, enum.Enum):
    """Case workflow statuses."""
    DRAFT = "draft"
    SUBMITTED = "submitted"
    UNDER_SCRUTINY = "under_scrutiny"
    CLARIFICATION_PENDING = "clarification_pending"
    CLEARANCE_QUEUE = "clearance_queue"
    CLEARED = "cleared"
    RELEASE_REQUESTED = "release_requested"
    FDR_RPGF_REVIEW = "fdr_rpgf_review"
    RTGS_REVIEW = "rtgs_review"
    SD_REFUND_REVIEW = "sd_refund_review"
    FINAL_DECISION = "final_decision"
    NOC_ISSUED = "noc_issued"
    SANCTIONED = "sanctioned"
    RELEASED = "released"
    REJECTED = "rejected"
    CLOSED = "closed"


class ClarificationStatus(str, enum.Enum):
    """Clarification request statuses."""
    PENDING = "pending"
    RESPONDED = "responded"
    RESOLVED = "resolved"


class ClearanceStatus(str, enum.Enum):
    """Clearance task statuses."""
    PENDING = "pending"
    CLEARED = "cleared"
    FLAGGED = "flagged"


class ReleaseRequestType(str, enum.Enum):
    """Types of release requests."""
    MATURITY = "maturity"
    EARLY_RELEASE = "early_release"
    REPLACEMENT = "replacement"
    RENEWAL = "renewal"
    REFUND = "refund"


class ReleaseDecision(str, enum.Enum):
    """Final release decisions."""
    RELEASE = "release"
    REJECT = "reject"
    RETURN_FOR_CORRECTION = "return_for_correction"


class LifecycleDateType(str, enum.Enum):
    """Types of lifecycle dates."""
    FDR_MATURITY = "fdr_maturity"
    AICTE_TERM_END = "aicte_term_end"
    ADMIN_DEADLINE = "admin_deadline"
    RENEWAL_DUE = "renewal_due"


class AuditAction(str, enum.Enum):
    """Audit log actions."""
    CREATE = "create"
    UPDATE = "update"
    DELETE = "delete"
    STATUS_CHANGE = "status_change"
    DOCUMENT_UPLOAD = "document_upload"
    DOCUMENT_REPLACE = "document_replace"
    CLARIFICATION_REQUEST = "clarification_request"
    CLARIFICATION_RESPONSE = "clarification_response"
    CLEARANCE_RECORD = "clearance_record"
    RELEASE_DECISION = "release_decision"
    ROLE_ASSIGN = "role_assign"
    CONFIG_CHANGE = "config_change"
    ALERT_SENT = "alert_sent"
    CLEARANCE_CASE_CLAIMED = "clearance_case_claimed"
    CLEARANCE_ALL_CLEARED = "clearance_all_cleared"
    RELEASE_REQUESTED = "release_requested"
    RELEASE_DECIDED = "release_decided"


# Valid status transitions
VALID_TRANSITIONS: dict[CaseStatus, list[CaseStatus]] = {
    CaseStatus.DRAFT: [CaseStatus.SUBMITTED],
    CaseStatus.SUBMITTED: [CaseStatus.UNDER_SCRUTINY, CaseStatus.REJECTED],
    CaseStatus.UNDER_SCRUTINY: [
        CaseStatus.CLARIFICATION_PENDING,
        CaseStatus.CLEARANCE_QUEUE,
        CaseStatus.REJECTED,
    ],
    CaseStatus.CLARIFICATION_PENDING: [CaseStatus.UNDER_SCRUTINY, CaseStatus.REJECTED],
    CaseStatus.CLEARANCE_QUEUE: [CaseStatus.CLEARED, CaseStatus.REJECTED],
    CaseStatus.CLEARED: [CaseStatus.RELEASE_REQUESTED],
    CaseStatus.RELEASE_REQUESTED: [
        CaseStatus.FDR_RPGF_REVIEW,
        CaseStatus.RTGS_REVIEW,
        CaseStatus.SD_REFUND_REVIEW,
        CaseStatus.REJECTED,
    ],
    CaseStatus.FDR_RPGF_REVIEW: [CaseStatus.FINAL_DECISION],
    CaseStatus.RTGS_REVIEW: [CaseStatus.FINAL_DECISION],
    CaseStatus.SD_REFUND_REVIEW: [CaseStatus.FINAL_DECISION],
    CaseStatus.FINAL_DECISION: [CaseStatus.NOC_ISSUED, CaseStatus.REJECTED, CaseStatus.CLOSED],
    CaseStatus.NOC_ISSUED: [CaseStatus.SANCTIONED, CaseStatus.REJECTED, CaseStatus.CLOSED],
    CaseStatus.SANCTIONED: [CaseStatus.CLOSED],
    CaseStatus.RELEASED: [CaseStatus.CLOSED],
    CaseStatus.REJECTED: [CaseStatus.CLOSED],
    CaseStatus.CLOSED: [],
}


def can_transition(from_status: CaseStatus, to_status: CaseStatus) -> bool:
    """Check if a status transition is valid."""
    return to_status in VALID_TRANSITIONS.get(from_status, [])
