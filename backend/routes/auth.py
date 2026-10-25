from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from jose import JWTError
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.config import get_settings
from backend.database import get_db
from backend.models import User
from backend.services.auth import create_access_token, decode_token, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


class RefreshRequest(BaseModel):
    refresh_token: str


@router.post("/login")
async def login(
    form: OAuth2PasswordRequestForm = Depends(), db: AsyncSession = Depends(get_db)
):
    settings = get_settings()
    result = await db.execute(select(User).where(User.email == form.username, User.is_active.is_(True)))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    if settings.demo_mode:
        valid = form.password in ("demo", "demo12345")
        token = f"demo:{user.id}"
        refresh_token_val = f"demo:refresh:{user.id}"
    else:
        valid = bool(user.password_hash and verify_password(form.password, user.password_hash))
        token = create_access_token(
            user.id,
            [user.role.value],
            claims={
                "email": user.email,
                "full_name": user.full_name,
                "institution_id": user.institution_id,
            },
        )
        refresh_token_val = create_access_token(
            user.id,
            [user.role.value],
            expires_delta=timedelta(days=7),
            claims={"token_type": "refresh"},
        )
    if not valid:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    return {"access_token": token, "refresh_token": refresh_token_val, "token_type": "bearer"}


@router.post("/refresh")
async def refresh_token(request: RefreshRequest, db: AsyncSession = Depends(get_db)):
    if request.refresh_token.startswith("demo:refresh:"):
        user_id = request.refresh_token.removeprefix("demo:refresh:")
        result = await db.execute(select(User).where(User.id == user_id, User.is_active.is_(True)))
        user = result.scalar_one_or_none()
        if not user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")
        return {
            "access_token": f"demo:{user.id}",
            "refresh_token": f"demo:refresh:{user.id}",
            "token_type": "bearer",
        }

    try:
        payload = decode_token(request.refresh_token)
        if payload.get("token_type") != "refresh" or not payload.get("sub"):
            raise ValueError("Invalid refresh token type")
        result = await db.execute(
            select(User).where(User.id == payload["sub"], User.is_active.is_(True))
        )
        user = result.scalar_one_or_none()
        if not user:
            raise ValueError("Inactive or unknown user")
        new_token = create_access_token(
            user.id,
            [user.role.value],
            claims={
                "email": user.email,
                "full_name": user.full_name,
                "institution_id": user.institution_id,
            },
        )
        return {
            "access_token": new_token,
            "refresh_token": request.refresh_token,
            "token_type": "bearer",
        }
    except (ValueError, JWTError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")
