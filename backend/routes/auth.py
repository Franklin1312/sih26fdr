"""Login and refresh routes for demo and production accounts."""

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.config import get_settings
from backend.database import get_db
from backend.models import User
from backend.services.auth import auth_service, create_access_token, verify_password

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
        valid = form.password == "demo" and user.id in {
            "inst_rep_1", "scrutiny_1", "clearance_1", "authority_1", "admin_1"
        }
        token = f"demo:{user.id}"
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
    if not valid:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    return {"access_token": token, "refresh_token": token, "token_type": "bearer"}


@router.post("/refresh")
async def refresh_token(request: RefreshRequest):
    try:
        await auth_service.get_current_user(f"Bearer {request.refresh_token}")
    except ValueError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")
    return {"access_token": request.refresh_token, "refresh_token": request.refresh_token, "token_type": "bearer"}
