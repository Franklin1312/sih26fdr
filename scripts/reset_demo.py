#!/usr/bin/env python3
"""Reset Demo Data Script - Clears all demo data and re-seeds from scratch."""

import asyncio
import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from backend.config import get_settings
from backend.database import init_db, get_db_context
from backend.models import (
    Institution,
    User,
    DepositCase,
    DepositEvidence,
    CaseEvent,
    ClarificationRequest,
    ClearanceTask,
    ReleaseRequest,
    LifecycleDate,
    AuditLog,
)
from backend.services.audit_service import audit_service


async def clear_all_data(db: AsyncSession):
    """Delete all data from all tables in correct order (respecting FK constraints)."""
    print("Clearing all demo data...")
    
    # Order matters due to foreign key constraints
    tables_to_clear = [
        (AuditLog, "Audit logs"),
        (LifecycleDate, "Lifecycle dates"),
        (ReleaseRequest, "Release requests"),
        (ClearanceTask, "Clearance tasks"),
        (ClarificationRequest, "Clarification requests"),
        (CaseEvent, "Case events"),
        (DepositEvidence, "Evidence documents"),
        (DepositCase, "Deposit cases"),
        (User, "Users"),
        (Institution, "Institutions"),
    ]
    
    for model, name in tables_to_clear:
        result = await db.execute(delete(model))
        print(f"  Cleared {name}: {result.rowcount} rows")
    
    await db.flush()
    print("All data cleared.")


async def reset_audit_service():
    """Reset audit service (regenerate checkpoint key)."""
    import os
    from backend.config import get_settings
    
    settings = get_settings()
    key_path = settings.audit_checkpoint_key_path
    
    if os.path.exists(key_path):
        os.remove(key_path)
        print(f"Removed audit checkpoint key: {key_path}")
    
    # Reinitialize audit service
    await audit_service.initialize()
    print("Audit service reinitialized with new checkpoint key.")


async def main():
    """Main reset function."""
    print("=" * 60)
    print("SIH26265 - Resetting Demo Data")
    print("=" * 60)
    
    # Confirm with user
    confirm = input("This will DELETE ALL DATA. Continue? (yes/no): ").strip().lower()
    if confirm != "yes":
        print("Aborted.")
        return
    
    await init_db()
    print("Database initialized")
    
    async with get_db_context() as db:
        await clear_all_data(db)
    
    await reset_audit_service()
    
    print("\n" + "=" * 60)
    print("Demo data reset complete!")
    print("=" * 60)
    print("Run 'python scripts/seed_demo.py' to re-seed demo data.")


if __name__ == "__main__":
    asyncio.run(main())