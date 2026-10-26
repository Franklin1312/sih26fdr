"""Tamper-evident hash-chained audit log service - Minimal version."""

import hashlib
import json
import logging
import os
from datetime import UTC, date, datetime
from decimal import Decimal
from enum import Enum
from typing import Any, cast
from uuid import UUID, uuid4

from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from cryptography.hazmat.primitives.serialization import (
    Encoding,
    PublicFormat,
    load_pem_private_key,
)
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.config import get_settings
from backend.models import AuditLog
from backend.models.enums import AuditAction

settings = get_settings()
logger = logging.getLogger("sih26psfdr.audit")

CHECKPOINT_INTERVAL = settings.audit_checkpoint_interval
CHECKPOINT_KEY_PATH = settings.audit_checkpoint_key_path


class AuditService:
    def __init__(self):
        self._checkpoint_key: Ed25519PrivateKey | None = None

    async def initialize(self):
        key_path = os.path.expanduser(CHECKPOINT_KEY_PATH)
        os.makedirs(os.path.dirname(key_path), exist_ok=True)
        if os.path.exists(key_path):
            try:
                with open(key_path, "rb") as f:
                    key_data = f.read()
                loaded_key = load_pem_private_key(key_data, password=None)
                if isinstance(loaded_key, Ed25519PrivateKey):
                    self._checkpoint_key = loaded_key
                    logger.info("Loaded existing checkpoint key")
                else:
                    logger.warning("Existing checkpoint key is not Ed25519, generating new one")
                    self._checkpoint_key = Ed25519PrivateKey.generate()
            except Exception as e:
                logger.warning(f"Failed to load checkpoint key: {e}, generating new one")
                self._checkpoint_key = Ed25519PrivateKey.generate()
        else:
            self._checkpoint_key = Ed25519PrivateKey.generate()
            os.makedirs(os.path.dirname(key_path), exist_ok=True)
            from cryptography.hazmat.primitives.serialization import (
                Encoding,
                NoEncryption,
                PrivateFormat,
            )
            with open(key_path, "wb") as f:
                f.write(self._checkpoint_key.private_bytes(Encoding.PEM, PrivateFormat.PKCS8, NoEncryption()))
        logger.info("Audit service initialized")

    def _json_serializer(self, obj: Any) -> Any:
        """Custom JSON serializer for non-serializable types."""
        if isinstance(obj, (datetime, date)):
            return obj.isoformat()
        if isinstance(obj, Decimal):
            return float(obj)
        if isinstance(obj, UUID):
            return str(obj)
        if isinstance(obj, Enum):
            return obj.value
        if isinstance(obj, (set, frozenset)):
            return sorted(list(obj), key=str)
        if isinstance(obj, (bytes, bytearray)):
            return obj.hex()
        if hasattr(obj, "model_dump") and callable(obj.model_dump):
            return obj.model_dump()
        if hasattr(obj, "__dict__"):
            return obj.__dict__
        return str(obj)

    def _sanitize_json_dict(self, data: dict[str, Any] | None) -> dict[str, Any] | None:
        """Convert non-JSON-serializable objects (datetime, UUID, Enum, etc.) to JSON-safe primitives."""
        if data is None:
            return None
        res = json.loads(json.dumps(data, default=self._json_serializer))
        return cast(dict[str, Any], res)

    def _compute_hash(self, prev_hash: str, entity_type: str, entity_id: str, action: str, actor_id: str, old_values: dict | None, new_values: dict | None, timestamp: str) -> str:
        data = f"{prev_hash}|{entity_type}|{entity_id}|{action}|{actor_id}|{json.dumps(old_values, sort_keys=True, default=self._json_serializer)}|{json.dumps(new_values, sort_keys=True, default=self._json_serializer)}|{timestamp}"
        return hashlib.sha256(data.encode()).hexdigest()

    def _format_timestamp(self, dt: datetime) -> str:
        """Format timestamp consistently for hashing - no microseconds, UTC."""
        dt = dt.replace(microsecond=0)
        # Handle both naive and timezone-aware datetimes
        if dt.tzinfo is not None:
            return dt.isoformat().replace("+00:00", "Z")
        else:
            return dt.isoformat() + "Z"

    async def log_event(self, db: AsyncSession, entity_type: str, entity_id: str, action: AuditAction, actor_id: str, old_values: dict | None = None, new_values: dict | None = None) -> AuditLog:
        prev_result = await db.execute(select(AuditLog.hash).order_by(AuditLog.sequence.desc()).limit(1))
        prev_hash = prev_result.scalar() or "0" * 64
        seq_result = await db.execute(select(func.coalesce(func.max(AuditLog.sequence), 0)))
        sequence = (seq_result.scalar() or 0) + 1
        timestamp_dt = datetime.now(UTC).replace(microsecond=0)
        timestamp = self._format_timestamp(timestamp_dt)
        sanitized_old = self._sanitize_json_dict(old_values)
        sanitized_new = self._sanitize_json_dict(new_values)
        hash_value = self._compute_hash(prev_hash, entity_type, entity_id, action.value, actor_id, sanitized_old, sanitized_new, timestamp)
        audit_log = AuditLog(id=str(uuid4()), entity_type=entity_type, entity_id=entity_id, action=action, actor_id=actor_id, old_values=sanitized_old, new_values=sanitized_new, timestamp=timestamp_dt, hash=hash_value, prev_hash=prev_hash, sequence=sequence)
        if CHECKPOINT_INTERVAL > 0 and sequence % CHECKPOINT_INTERVAL == 0 and self._checkpoint_key:
            audit_log.is_checkpoint = True
            audit_log.checkpoint_signature = self._checkpoint_key.sign(hash_value.encode()).hex()
            audit_log.checkpoint_key_id = hashlib.sha256(
                self._checkpoint_key.public_key().public_bytes(Encoding.Raw, PublicFormat.Raw)
            ).hexdigest()[:16]
        db.add(audit_log)
        await db.flush()
        return audit_log

    async def verify_chain(self, db: AsyncSession) -> dict[str, Any]:
        result = await db.execute(select(AuditLog).order_by(AuditLog.sequence.asc()))
        logs = result.scalars().all()
        if not logs:
            return {"chain_valid": True, "total_records": 0, "verified_records": 0, "first_hash": "", "last_hash": "", "tampered_records": [], "message": "Empty chain"}
        verified = 0
        tampered = []
        expected_prev = "0" * 64
        for log in logs:
            timestamp = self._format_timestamp(log.timestamp)
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

    async def get_events(self, db: AsyncSession, entity_type: str | None = None, entity_id: str | None = None, action: AuditAction | None = None, actor_id: str | None = None, date_from: datetime | None = None, date_to: datetime | None = None, limit: int = 50, offset: int = 0) -> list[AuditLog]:
        query = select(AuditLog).order_by(AuditLog.sequence.desc())
        if entity_type:
            query = query.where(AuditLog.entity_type == entity_type)
        if entity_id:
            query = query.where(AuditLog.entity_id == entity_id)
        if action:
            query = query.where(AuditLog.action == action)
        if actor_id:
            query = query.where(AuditLog.actor_id == actor_id)
        if date_from:
            query = query.where(AuditLog.timestamp >= date_from)
        if date_to:
            query = query.where(AuditLog.timestamp <= date_to)
        query = query.limit(limit).offset(offset)
        result = await db.execute(query)
        return list(result.scalars().all())

    async def count_events(self, db: AsyncSession) -> int:
        result = await db.execute(select(func.count(AuditLog.id)))
        return result.scalar() or 0


audit_service = AuditService()
