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


def create_access_token(user_id: str, roles: List[str], expires_delta: Optional[timedelta] = None) -> str:
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

    async def authenticate_demo(self, user_id: str, roles: List[str]) -> "CurrentUserResponse":
        """Authenticate a demo user (DEMO_MODE only)."""
        from backend.schemas.institution import CurrentUserResponse, UserRole
        
        if not DEMO_MODE:
            raise ValueError("Demo authentication not available outside DEMO_MODE")
        
        # Validate role
        try:
            role_enum = UserRole(roles[0]) if roles else UserRole.INSTITUTION_REP
        except ValueError:
            role_enum = UserRole.INSTITUTION_REP
        
        # Create or get demo user
        if user_id not in self.demo_users:
            self.demo_users[user_id] = {
                "user_id": user_id,
                "email": f"{user_id}@demo.sih26265",
                "full_name": user_id.replace("_", " ").title(),
                "role": role_enum,
                "institution_id": None,
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
            # Demo mode: token format is "user_id:role1,role2"
            try:
                if ":" in token:
                    user_id, roles_str = token.split(":", 1)
                    roles = [r.strip() for r in roles_str.split(",") if r.strip()]
                else:
                    user_id = token
                    roles = ["institution_rep"]
                return await self.authenticate_demo(user_id, roles)
            except Exception:
                raise ValueError("Invalid demo token format")
        else:
            # Production mode: JWT
            return await self.authenticate_jwt(token)


# Module-level singleton
auth_service = AuthService()