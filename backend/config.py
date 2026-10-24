"""Application configuration using Pydantic Settings."""

import os
from functools import lru_cache
from pathlib import Path
from typing import List, Optional

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Application
    app_env: str = Field(default="development", alias="APP_ENV")
    debug: bool = Field(default=True, alias="DEBUG")
    secret_key: str = Field(default="", alias="SECRET_KEY")
    jwt_secret: str = Field(default="", alias="JWT_SECRET")
    jwt_algorithm: str = Field(default="HS256", alias="JWT_ALGORITHM")
    access_token_expire_minutes: int = Field(default=60, alias="ACCESS_TOKEN_EXPIRE_MINUTES")

    # Demo mode
    demo_mode: bool = Field(default=True, alias="DEMO_MODE")

    # Database
    database_url: str = Field(default="sqlite+aiosqlite:///./data/sih26265.db", alias="DATABASE_URL")

    # Redis
    redis_url: str = Field(default="redis://localhost:6379/0", alias="REDIS_URL")

    # File storage
    upload_dir: str = Field(default="./data/uploads", alias="UPLOAD_DIR")
    max_upload_size_mb: int = Field(default=10, alias="MAX_UPLOAD_SIZE_MB")

    # OCR
    ocr_enabled: bool = Field(default=False, alias="OCR_ENABLED")
    tesseract_cmd: str = Field(default="tesseract", alias="TESSERACT_CMD")

    # Alerts
    alert_check_interval_hours: int = Field(default=24, alias="ALERT_CHECK_INTERVAL_HOURS")
    alert_lead_days: str = Field(default="30,15,7,1,0", alias="ALERT_LEAD_DAYS")

    # Audit
    audit_checkpoint_interval: int = Field(default=100, alias="AUDIT_CHECKPOINT_INTERVAL")
    audit_checkpoint_key_path: str = Field(default="./data/audit_checkpoint_key.pem", alias="AUDIT_CHECKPOINT_KEY_PATH")

    # Email
    smtp_host: str = Field(default="localhost", alias="SMTP_HOST")
    smtp_port: int = Field(default=1025, alias="SMTP_PORT")
    smtp_user: str = Field(default="", alias="SMTP_USER")
    smtp_password: str = Field(default="", alias="SMTP_PASSWORD")
    email_from: str = Field(default="noreply@sih26265.demo", alias="EMAIL_FROM")

    # CORS
    cors_allow_origins: str = Field(default="http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000", alias="CORS_ALLOW_ORIGINS")
    cors_allow_credentials: bool = Field(default=True, alias="CORS_ALLOW_CREDENTIALS")

    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.cors_allow_origins.split(",") if o.strip()]

    @property
    def alert_lead_days_list(self) -> List[int]:
        return [int(d.strip()) for d in self.alert_lead_days.split(",") if d.strip()]

    @property
    def is_production(self) -> bool:
        return self.app_env.lower() == "production"

    @property
    def upload_path(self) -> Path:
        path = Path(self.upload_dir)
        path.mkdir(parents=True, exist_ok=True)
        return path

    @property
    def data_path(self) -> Path:
        """Get the data directory path, creating it if needed."""
        # Extract directory from database_url
        db_url = self.database_url
        if db_url.startswith("sqlite"):
            # Extract path from sqlite:///./data/sih26265.db
            db_path = db_url.replace("sqlite+aiosqlite:///", "").replace("sqlite:///", "")
            if db_path.startswith("./"):
                db_path = db_path[2:]
            path = Path(db_path).parent
            path.mkdir(parents=True, exist_ok=True)
        return path


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()


# Validate critical settings at import time (will be called during startup)
def validate_startup_config(settings: Settings) -> None:
    """Validate security-critical configuration at startup."""
    if settings.is_production:
        if not settings.secret_key or len(settings.secret_key) < 32:
            raise RuntimeError("SECRET_KEY must be at least 32 characters in production")
        if not settings.jwt_secret or len(settings.jwt_secret) < 32:
            raise RuntimeError("JWT_SECRET must be at least 32 characters in production")
        if settings.demo_mode:
            raise RuntimeError("DEMO_MODE must be false in production")
    else:
        # Development warnings
        if settings.demo_mode:
            print("WARNING: DEMO_MODE is enabled. Not suitable for production.")
        if len(settings.secret_key) < 32:
            print("WARNING: SECRET_KEY is short; use 32+ chars for production.")
        if len(settings.jwt_secret) < 32:
            print("WARNING: JWT_SECRET is short; use 32+ chars for production.")
