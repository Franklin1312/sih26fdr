#!/usr/bin/env python3
"""Verify Audit Chain Script - Validates the integrity of the audit log chain."""

import asyncio
import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from backend.config import get_settings
from backend.database import init_db, get_db_context
from backend.services.audit_service import audit_service


async def main():
    """Main verification function."""
    print("=" * 60)
    print("SIH26265 - Audit Chain Verification")
    print("=" * 60)
    
    await init_db()
    print("Database initialized")
    
    await audit_service.initialize()
    print("Audit service initialized")
    
    async with get_db_context() as db:
        print("\n--- Verifying Audit Chain ---")
        result = await audit_service.verify_chain(db)
        
        print(f"\nChain Valid: {result['chain_valid']}")
        print(f"Total Records: {result['total_records']}")
        print(f"Verified Records: {result['verified_records']}")
        print(f"First Hash: {result['first_hash']}")
        print(f"Last Hash: {result['last_hash']}")
        
        if result['tampered_records']:
            print(f"\nWARNING  TAMPERED RECORDS DETECTED: {len(result['tampered_records'])}")
            for record_id in result['tampered_records']:
                print(f"  - {record_id}")
        else:
            print("\nOK No tampered records detected")
        
        print(f"\nMessage: {result['message']}")
        
        # Also verify checkpoints
        print("\n--- Verifying Checkpoints ---")
        # Get all audit logs to find checkpoints
        from backend.models import AuditLog
        from sqlalchemy import select
        
        checkpoint_result = await db.execute(
            select(AuditLog).where(AuditLog.is_checkpoint == True).order_by(AuditLog.sequence.asc())
        )
        checkpoints = checkpoint_result.scalars().all()
        
        if checkpoints:
            print(f"Found {len(checkpoints)} checkpoint(s)")
            # Verify each checkpoint signature
            from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey
            from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat
            
            public_key = audit_service._checkpoint_key.public_key()
            public_key_bytes = public_key.public_bytes(Encoding.RAW, PublicFormat.RAW)
            
            for cp in checkpoints:
                try:
                    # Verify signature
                    public_key.verify(
                        bytes.fromhex(cp.checkpoint_signature),
                        cp.hash.encode()
                    )
                    print(f"  OK Checkpoint {cp.sequence} (hash: {cp.hash[:16]}...) - VALID")
                except Exception as e:
                    print(f"  FAIL Checkpoint {cp.sequence} (hash: {cp.hash[:16]}...) - INVALID: {e}")
        else:
            print("No checkpoints found")
        
        print("\n" + "=" * 60)
        print("Audit verification complete!")
        print("=" * 60)
        
        # Exit with error code if chain is invalid
        if not result['chain_valid']:
            sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())