"""Tamper-evident hash-chained audit log service - Minimal version."""

import hashlib
import json
import logging
import os
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from uuid import uuid4

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat, PrivateFormat, NoEncryption, load_pem_private_key

from backend.config import get_settings
from backend.models import AuditLog
from backend.models.enums import AuditAction

settings = get_settings()
logger = logging.getLogger("sih26psfdr.audit")

CHECKPOINT_INTERVAL = settings.audit_checkpoint_interval
CHECKPOINT_KEY_PATH = settings.audit_checkpoint_key_path


class AuditService:
    def __init__(self):
        self._checkpoint_key: Optional[Ed25519PrivateKey] = None

    async def initialize(self):
        key_path = os.path.expanduser(CHECKPOINT_KEY_PATH)
        os.makedirs(os.path.dirname(key_path), exist_ok=True)
        if os.path.exists(key_path):
            try:
                with open(key_path, "rb") as f:
                    key_data = f.read()
                self._checkpoint_key = load_pem_private_key(key_data, password=None)
                logger.info("Loaded existing checkpoint key")
            except Exception as e:
                logger.warning(f"Failed to load checkpoint key: {e}, generating new one")
                self._checkpoint_key = Ed25519PrivateKey.generate()
        else:
            self._checkpoint_key = Ed25519PrivateKey.generate()
        logger.info("Audit service initialized")

    def _compute_hash(self, prev_hash: str, entity_type: str, entity_id: str, action: str, actor_id: str, old_values: Optional[dict], new_values: Optional[dict], timestamp: str) -> str:
        data = f"{prev_hash}|{entity_type}|{entity_id}|{action}|{actor_id}|{json.dumps(old_values, sort_keys=True)}|{json.dumps(new_values, sort_keys=True)}|{timestamp}"
        return hashlib.sha256(data.encode()).hexdigest()

    async def log_event(self, db: AsyncSession, entity_type: str, entity_id: str, action: AuditAction, actor_id: str, old_values: Optional[dict] = None, new_values: Optional[dict] = None) -> AuditLog:
        prev_result = await db.execute(select(AuditLog.hash).order_by(AuditLog.sequence.desc()).limit(1))
        prev_hash = prev_result.scalar() or "0" * 64
        seq_result = await db.execute(select(func.coalesce(func.max(AuditLog.sequence), 0)))
        sequence = (seq_result.scalar() or 0) + 1
        timestamp = datetime.now(timezone.utc).isoformat()
        hash_value = self._compute_hash(prev_hash, entity_type, entity_id, action.value, actor_id, old_values, new_values, timestamp)
        audit_log = AuditLog(id=str(uuid4()), entity_type=entity_type, entity_id=entity_id, action=action, actor_id=actor_id, old_values=old_values, new_values=new_values, timestamp=datetime.now(timezone.utc), hash=hash_value, prev_hash=prev_hash, sequence=sequence)
        db.add(audit_log)
        await db.flush()
        return audit_log

    async def verify_chain(self, db: AsyncSession) -> Dict[str, Any]:
        result = await db.execute(select(AuditLog).order_by(AuditLog.sequence.asc()))
        logs = result.scalars().all()
        if not logs:
            return {"chain_valid": True, "total_records": 0, "verified_records": 0, "first_hash": "", "last_hash": "", "tampered_records": [], "message": "Empty chain"}
        verified = 0
        tampered = []
        expected_prev = "0" * 64
        for log in logs:
            timestamp = log.timestamp.isoformat()
            computed_hash = self._compute_hash(log.prev_hash, log.entity_type, log.entity_id, log.action.value, log.actor_id, log.old_values, log.new_values, timestamp)
            prev_ok = log.prev_hash == expected_prev
            hash_ok = log.hash == computed_hash
            if not prev_ok or not hash_ok:
                tampered.append(log.id)
                logger.warning(f"Tampered record detected: {log.id}")
            else:
                verified += 1
            expected_prev = log.hash
        chain_valid = len(tampered) == 0
        return {"chain_valid": chain_valid, "total_records": len(logs), "verified_records": verified, "first_hash": logs[0].hash, "last_hash": logs[-1].hash, "tampered_records": tampered, "message": "Chain is valid" if chain_valid else f"Chain compromised: {len(tampered)} tampered record(s)"}

    async def get_events(self, db: AsyncSession, entity_type: Optional[str] = None, entity_id: Optional[str] = None, action: Optional[AuditAction] = None, actor_id: Optional[str] = None, date_from: Optional[datetime] = None, date_to: Optional[datetime] = None, limit: int = 50, offset: int = 0) -> List[AuditLog]:
        query = select(AuditLog).order_by(AuditLog.sequence.desc())
        if entity_type: query = query.where(AuditLog.entity_type == entity_type)
        if entity_id: query = query.where(AuditLog.entity_id == entity_id)
        if action: query = query.where(AuditLog.action == action)
        if actor_id: query = query.where(AuditLog.actor_id == actor_id)
        if date_from: query = query.where(AuditLog.timestamp >= date_from)
        if date_to: query = query.where(AuditLog.timestamp <= date_to)
        query = query.limit(limit).offset(offset)
        result = await db.execute(query)
        return result.scalars().all()

    async def count_events(self, db: AsyncSession) -> int:
        result = await db.execute(select(func.count(AuditLog.id)))
        return result.scalar() or 0


audit_service = AuditService()