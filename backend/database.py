"""Database configuration and session management."""

from contextlib import asynccontextmanager
from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import inspect

from backend.config import get_settings

settings = get_settings()

# Ensure data directory exists
_ = settings.data_path

# Create async engine
engine = create_async_engine(
    settings.database_url,
    echo=settings.debug,
    future=True,
    pool_pre_ping=True,
)

# Session factory
async_session_maker = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


class Base(DeclarativeBase):
    """Base class for all models."""
    pass


# Import models to register them with Base metadata (after Base is defined)
import backend.models  # noqa: F401,E402


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependency for getting DB session."""
    async with async_session_maker() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


@asynccontextmanager
async def get_db_context() -> AsyncGenerator[AsyncSession, None]:
    """Context manager for getting DB session outside of FastAPI dependencies."""
    async with async_session_maker() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db() -> None:
    """Initialize database tables."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        if settings.database_url.startswith("sqlite"):
            await conn.run_sync(_apply_sqlite_compat_columns)


def _apply_sqlite_compat_columns(connection) -> None:
    """Add fields introduced after a local SQLite database was first created."""
    inspector = inspect(connection)
    additions = {
        "institutions": {"institution_type": "VARCHAR(50) NOT NULL DEFAULT 'unknown'"},
        "deposit_cases": {
            "instrument_date": "DATETIME",
            "term_end_date": "DATETIME",
        },
        "deposit_evidence": {
            "file_hash": "VARCHAR(64)",
            "is_deleted": "BOOLEAN NOT NULL DEFAULT 0",
            "is_demo": "BOOLEAN NOT NULL DEFAULT 0",
        },
        "release_requests": {"updated_at": "DATETIME DEFAULT CURRENT_TIMESTAMP"},
    }
    for table, columns in additions.items():
        if not inspector.has_table(table):
            continue
        existing = {column["name"] for column in inspector.get_columns(table)}
        for name, declaration in columns.items():
            if name not in existing:
                connection.exec_driver_sql(
                    f'ALTER TABLE "{table}" ADD COLUMN "{name}" {declaration}'
                )


async def close_db() -> None:
    """Close database connections."""
    await engine.dispose()
