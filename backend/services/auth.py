"""Authentication and authorization service."""

import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any, List
from uuid import uuid4

from jose import jwt, JWTError
from passlib.context import CryptContext

from backend.config import get_settings
from backend.models.enums import UserRole

logger = logging.getLogger("sih26psfdr.auth")

settings = get_settings()

# Password hashing
# Use bcrypt with compatible settings; fallback to sha256_crypt for demo mode if bcrypt fails
try:
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    # Test bcrypt works
    pwd_context.hash("test")
except Exception:
    logger.warning("bcrypt backend unavailable, falling back to sha256_crypt")
    pwd_context = CryptContext(schemes=["sha256_crypt"], deprecated="auto")

# Demo mode
DEMO_MODE = settings.demo_mode

# Known unsafe defaults
_UNSAFE_DEFAULTS = {"change-me", "secret", "development", "changeme", ""}


def _is_unsafe_default(secret: str) -> bool:
    return secret in _UNSAFE_DEFAULTS or not secret or len(secret) < 32


def validate_startup_config() -> None:
    """Validate security-critical configuration at startup."""
    if settings.is_production:
        if _is_unsafe_default(settings.secret_key):
            raise RuntimeError("SECRET_KEY must be set to a strong value (32+ chars) in production")
        if _is_unsafe_default(settings.jwt_secret):
            raise RuntimeError("JWT_SECRET must be set to a strong value (32+ chars) in production")
        if DEMO_MODE:
            raise RuntimeError("DEMO_MODE must be false in production")
    else:
        if DEMO_MODE:
            logger.warning("DEMO_MODE is enabled. Unsafe defaults permitted for demonstration only.")
        if _is_unsafe_default(settings.secret_key):
            logger.warning("SECRET_KEY is missing or uses an unsafe default; set a strong SECRET_KEY before production deployment.")
        if _is_unsafe_default(settings.jwt_secret):
            logger.warning("JWT_SECRET is missing or uses an unsafe default; set a strong JWT_SECRET before production deployment.")


def hash_password(password: str) -> str:
    """Hash a password."""
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash."""
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(
    user_id: str, roles: List[str], expires_delta: Optional[timedelta] = None,
    claims: Optional[Dict[str, Any]] = None,
) -> str:
    """Create a signed JWT access token."""
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)
    
    payload = {
        "sub": user_id,
        "roles": roles,
        "iat": datetime.now(timezone.utc),
        "exp": expire,
    }
    payload.update(claims or {})
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_token(token: str) -> Dict[str, Any]:
    """Decode and validate a JWT token."""
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        return payload
    except JWTError as exc:
        raise ValueError(f"Invalid token: {exc}")


class AuthService:
    """Authentication service for demo and production modes."""

    def __init__(self):
        self.demo_users: Dict[str, Dict[str, Any]] = {}

    async def authenticate_demo(self, user_id: str) -> "CurrentUserResponse":
        """Resolve an explicitly provisioned demo principal; roles are never token supplied."""
        from backend.schemas.institution import CurrentUserResponse, UserRole
        
        if not DEMO_MODE:
            raise ValueError("Demo authentication not available outside DEMO_MODE")
        
        account_roles = {
            "inst_rep_1": UserRole.INSTITUTION_REP,
            "scrutiny_1": UserRole.SCRUTINY_OFFICER,
            "clearance_1": UserRole.CLEARANCE_OFFICER,
            "clearance_2": UserRole.CLEARANCE_OFFICER,
            "clearance_3": UserRole.CLEARANCE_OFFICER,
            "approval_bureau_1": UserRole.APPROVAL_BUREAU,
            "council_1": UserRole.COUNCIL,
            "authority_1": UserRole.COMPETENT_AUTHORITY,
            "admin_1": UserRole.SYSTEM_ADMIN,
        }
        demo_institutions = {
            "inst_rep_1": ("inst_1", "Apex Institute of Technology"),
            "inst_rep_2": ("inst_2", "National Medical College"),
            "inst_rep_3": ("inst_3", "City Polytechnic Institute"),
            "inst_rep_4": ("inst_4", "Eastern Management School"),
        }
        role_enum = account_roles.get(user_id)
        if role_enum is None:
            raise ValueError("Unknown demo account")
        institution_id, institution_name = demo_institutions.get(user_id, (None, None))
        self.demo_users[user_id] = {
            "user_id": user_id,
            "email": f"{user_id}@demo.example",
            "full_name": user_id.replace("_", " ").title(),
            "role": role_enum,
            # Each demo representative must retain their own tenant.  The old
            # hard-coded inst_1 value made every persona look like Apex and
            # overwrote the access-control context on /users/me.
            "institution_id": institution_id,
            "institution_name": institution_name,
            "is_authenticated": True,
        }
        
        return CurrentUserResponse(**self.demo_users[user_id])

    async def authenticate_jwt(self, token: str) -> "CurrentUserResponse":
        """Authenticate using JWT token."""
        from backend.schemas.institution import CurrentUserResponse, UserRole
        
        payload = decode_token(token)
        user_id = payload.get("sub")
        roles = payload.get("roles", [])
        
        if not user_id:
            raise ValueError("Token missing subject")
        
        role = UserRole(roles[0]) if roles else UserRole.INSTITUTION_REP
        
        return CurrentUserResponse(
            user_id=user_id,
            email=payload.get("email", f"{user_id}@sih26265"),
            full_name=payload.get("full_name", user_id),
            role=role,
            institution_id=payload.get("institution_id"),
            institution_name=payload.get("institution_name"),
            is_authenticated=True,
        )

    async def get_current_user(self, authorization: Optional[str]) -> "CurrentUserResponse":
        """Get current user from authorization header."""
        if not authorization:
            raise ValueError("Missing authentication credentials")
        
        parts = authorization.split()
        if len(parts) != 2 or parts[0].lower() != "bearer":
            raise ValueError("Invalid authentication scheme")
        
        token = parts[1]
        
        if DEMO_MODE:
            if token.startswith("demo:"):
                return await self.authenticate_demo(token.removeprefix("demo:"))
            # Compatibility for in-process demo clients: only accept the legacy
            # user:role form when the server already has that exact principal/role.
            user_id, separator, role_value = token.rpartition(":")
            from backend.services.access_control import access_control
            context = access_control.get_user_context(user_id) if separator else None
            if context and any(role.value == role_value for role in context.roles):
                from backend.schemas.institution import CurrentUserResponse
                role = next(role for role in context.roles if role.value == role_value)
                return CurrentUserResponse(
                    user_id=context.user_id,
                    email=context.email,
                    full_name=context.full_name,
                    role=role,
                    institution_id=context.institution_id,
                )
            raise ValueError("Invalid demo token format")
        else:
            # Production mode: JWT
            return await self.authenticate_jwt(token)


# Module-level singleton
auth_service = AuthService()
