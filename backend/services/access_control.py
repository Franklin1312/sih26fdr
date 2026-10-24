"""Role-based access control service - Core permissions."""

import logging
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Set

from backend.models.enums import UserRole

logger = logging.getLogger("sih26psfdr.access_control")


# Role permissions mapping
ROLE_PERMISSIONS: Dict[UserRole, Set[str]] = {
    UserRole.INSTITUTION_REP: {
        "case:create",
        "case:read_own",
        "case:update_draft",
        "evidence:upload",
        "evidence:read_own",
        "evidence:read",
        "evidence:delete_own",
        "clarification:respond",
        "release:request_own",
        "dashboard:view_own",
    },
    UserRole.SCRUTINY_OFFICER: {
        "case:read_assigned",
        "case:review",
        "clarification:request",
        "clearance:prepare",
        "dashboard:view_assigned",
        "evidence:read_assigned",
        "evidence:read",
    },
    UserRole.CLEARANCE_OFFICER: {
        "clearance:record",
        "clearance:read_assigned",
        "dashboard:view_clearance",
        "evidence:read_assigned",
        "evidence:read",
    },
    UserRole.APPROVAL_BUREAU: {
        "release:read_fdr_rpgf",
        "release:decide_fdr_rpgf",
        "evidence:read_all",
        "evidence:read",
        "evidence:upload_authority",
        "dashboard:view_all",
    },
    UserRole.COUNCIL: {
        "release:read_rtgs",
        "release:decide_rtgs",
        "evidence:read_all",
        "evidence:read",
        "evidence:upload_authority",
        "dashboard:view_all",
    },
    UserRole.COMPETENT_AUTHORITY: {
        "release:decide",
        "release:read_all",
        "case:finalize",
        "dashboard:view_all",
        "evidence:read_all",
        "evidence:read",
        "evidence:upload_authority",
    },
    UserRole.SYSTEM_ADMIN: {
        "system:manage",
        "user:manage",
        "config:manage",
        "audit:read",
    },
}

ROLE_DESCRIPTIONS: Dict[UserRole, str] = {
    UserRole.INSTITUTION_REP: "Institution representative - manage own deposit cases",
    UserRole.SCRUTINY_OFFICER: "Scrutiny officer - review cases, request clarifications",
    UserRole.CLEARANCE_OFFICER: "Clearance officer - record clearance outcomes",
    UserRole.APPROVAL_BUREAU: "Approval Bureau - FDR/RPGF authority decisions only",
    UserRole.COUNCIL: "Council - RTGS authority decisions only",
    UserRole.COMPETENT_AUTHORITY: "Competent authority - final release decisions",
    UserRole.SYSTEM_ADMIN: "System administrator - system management only",
}

VALID_ROLES = frozenset(ROLE_PERMISSIONS.keys())


@dataclass
class UserContext:
    """User context for authorization decisions."""
    user_id: str
    email: str
    full_name: str
    roles: Set[UserRole] = field(default_factory=set)
    institution_id: Optional[str] = None

    def has_role(self, role: UserRole) -> bool:
        """Return true only for an explicitly assigned role."""
        return role in self.roles

    def has_permission(self, permission: str) -> bool:
        """Check if user has a specific permission."""
        for role in self.roles:
            permissions = ROLE_PERMISSIONS.get(role, set())
            if permission in permissions:
                return True
        return False

    def has_any_permission(self, permissions: List[str]) -> bool:
        """Check if user has any of the given permissions."""
        return any(self.has_permission(p) for p in permissions)

    def has_all_permissions(self, permissions: List[str]) -> bool:
        """Check if user has all of the given permissions."""
        return all(self.has_permission(p) for p in permissions)


class AccessControlService:
    """RBAC service for authorization decisions."""

    def __init__(self):
        self._user_contexts: Dict[str, UserContext] = {}

    def register_user(self, user: "UserResponse") -> UserContext:
        """Register a user context from UserResponse or CurrentUserResponse."""
        from backend.schemas.institution import UserResponse
        roles = {user.role} if user.role else set()
        # Handle both UserResponse (has id) and CurrentUserResponse (has user_id)
        user_id = getattr(user, 'id', getattr(user, 'user_id', None))
        if not user_id:
            raise ValueError("User object must have 'id' or 'user_id' attribute")
        context = UserContext(
            user_id=user_id,
            email=user.email,
            full_name=user.full_name,
            roles=roles,
            institution_id=user.institution_id,
        )
        self._user_contexts[user_id] = context
        logger.info("Registered user context: %s with roles %s", user_id, sorted(r.value for r in roles))
        return context

    def get_user_context(self, user_id: str) -> Optional[UserContext]:
        """Get user context by ID."""
        return self._user_contexts.get(user_id)

    def require_permission(self, user: UserContext, permission: str) -> bool:
        """Check if user has permission, log denial if not."""
        allowed = user.has_permission(permission)
        if not allowed:
            logger.warning(
                "Access denied: user=%s permission=%s roles=%s",
                user.user_id,
                permission,
                sorted(r.value for r in user.roles),
            )
        return allowed

    def require_role(self, user: UserContext, role: UserRole) -> bool:
        """Check if user has role, log denial if not."""
        allowed = user.has_role(role)
        if not allowed:
            logger.warning(
                "Access denied: user=%s required_role=%s roles=%s",
                user.user_id,
                role.value,
                sorted(r.value for r in user.roles),
            )
        return allowed

    def require_any_permission(self, user: UserContext, permissions: List[str]) -> bool:
        """Check if user has any of the permissions."""
        return user.has_any_permission(permissions)

    def require_all_permissions(self, user: UserContext, permissions: List[str]) -> bool:
        """Check if user has all of the permissions."""
        return user.has_all_permissions(permissions)

    def get_user_context(self, user_id: str) -> Optional[UserContext]:
        """Get registered user context by user ID."""
        return self._user_contexts.get(user_id)

    def list_roles(self) -> List[Dict[str, Any]]:
        """List all roles with descriptions and permissions."""
        return [
            {
                "role": role.value,
                "description": ROLE_DESCRIPTIONS.get(role, ""),
                "permissions": sorted(ROLE_PERMISSIONS.get(role, set())),
            }
            for role in ROLE_PERMISSIONS
        ]

    def can_access_case(self, user: UserContext, case_institution_id: str, case_assigned_officer_id: Optional[str], case_status: Optional[str] = None) -> bool:
        """Check if user can access a specific case."""
        # Institution rep can only access own institution's cases
        if UserRole.INSTITUTION_REP in user.roles:
            return user.institution_id == case_institution_id
        
        # Scrutiny/clearance officers can access assigned cases
        if UserRole.SCRUTINY_OFFICER in user.roles or UserRole.CLEARANCE_OFFICER in user.roles:
            # Allow scrutiny officers to access SUBMITTED cases to claim them
            if UserRole.SCRUTINY_OFFICER in user.roles and case_status == "submitted":
                return True
            # Allow clearance officers to access CLEARANCE_QUEUE cases
            if UserRole.CLEARANCE_OFFICER in user.roles and case_status == "clearance_queue":
                return True
            return case_assigned_officer_id == user.user_id
        
        # Route authorities can access cases for their decision responsibility.
        if user.roles & {UserRole.COMPETENT_AUTHORITY, UserRole.APPROVAL_BUREAU, UserRole.COUNCIL}:
            return True
        
        return False

    def can_transition_case_status(
        self, user: UserContext, from_status: str, to_status: str, case_institution_id: str
    ) -> bool:
        """Check if user can perform a case status transition."""
        from backend.models.enums import CaseStatus, can_transition
        
        try:
            from_enum = CaseStatus(from_status)
            to_enum = CaseStatus(to_status)
        except ValueError:
            return False
        
        # Check if transition is valid
        if not can_transition(from_enum, to_enum):
            return False
        
        # Check role-based permissions for specific transitions
        transition_permissions = {
            (CaseStatus.DRAFT, CaseStatus.SUBMITTED): ["case:create"],
            (CaseStatus.SUBMITTED, CaseStatus.UNDER_SCRUTINY): ["case:review"],
            (CaseStatus.UNDER_SCRUTINY, CaseStatus.CLARIFICATION_PENDING): ["clarification:request"],
            (CaseStatus.CLARIFICATION_PENDING, CaseStatus.UNDER_SCRUTINY): ["clarification:respond"],
            (CaseStatus.UNDER_SCRUTINY, CaseStatus.CLEARANCE_QUEUE): ["clearance:prepare"],
            (CaseStatus.CLEARANCE_QUEUE, CaseStatus.CLEARED): ["clearance:record"],
            (CaseStatus.CLEARED, CaseStatus.RELEASE_REQUESTED): ["release:request_own"],
            (CaseStatus.RELEASE_REQUESTED, CaseStatus.FDR_RPGF_REVIEW): ["release:decide", "release:decide_fdr_rpgf"],
            (CaseStatus.RELEASE_REQUESTED, CaseStatus.RTGS_REVIEW): ["release:decide", "release:decide_rtgs"],
            (CaseStatus.RELEASE_REQUESTED, CaseStatus.SD_REFUND_REVIEW): ["release:decide"],
            (CaseStatus.FDR_RPGF_REVIEW, CaseStatus.FINAL_DECISION): ["release:decide", "release:decide_fdr_rpgf"],
            (CaseStatus.RTGS_REVIEW, CaseStatus.FINAL_DECISION): ["release:decide", "release:decide_rtgs"],
            (CaseStatus.SD_REFUND_REVIEW, CaseStatus.FINAL_DECISION): ["release:decide"],
            (CaseStatus.FINAL_DECISION, CaseStatus.RELEASED): ["release:decide", "release:decide_fdr_rpgf", "release:decide_rtgs"],
            (CaseStatus.FINAL_DECISION, CaseStatus.REJECTED): ["release:decide", "release:decide_fdr_rpgf", "release:decide_rtgs"],
        }
        
        required_perms = transition_permissions.get((from_enum, to_enum), [])
        if not required_perms:
            return False
        
        return self.require_any_permission(user, required_perms)


# Module-level singleton
access_control = AccessControlService()
