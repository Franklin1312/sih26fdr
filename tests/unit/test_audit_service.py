"""Unit tests for AuditService JSON serialization and hash chain integrity."""

import json
from datetime import UTC, date, datetime
from decimal import Decimal
from enum import Enum
from uuid import UUID, uuid4

import pytest

from backend.services.audit_service import AuditService


class SampleEnum(str, Enum):
    STEP_1 = "step_1"


def test_json_serializer_types():
    service = AuditService()
    now = datetime(2026, 10, 26, 12, 30, 0, tzinfo=UTC)
    today = date(2026, 10, 26)
    uid = uuid4()

    data = {
        "datetime": now,
        "date": today,
        "decimal": Decimal("100.50"),
        "uuid": uid,
        "enum": SampleEnum.STEP_1,
        "set": {"b", "a"},
        "bytes": b"hello",
    }

    serialized = json.loads(json.dumps(data, default=service._json_serializer))
    assert serialized["datetime"] == now.isoformat()
    assert serialized["date"] == today.isoformat()
    assert serialized["decimal"] == 100.50
    assert serialized["uuid"] == str(uid)
    assert serialized["enum"] == "step_1"
    assert serialized["set"] == ["a", "b"]
    assert serialized["bytes"] == b"hello".hex()


def test_sanitize_json_dict():
    service = AuditService()
    data = {
        "step": SampleEnum.STEP_1,
        "timestamp": datetime(2026, 1, 1, 0, 0, 0),
        "amount": Decimal("50000.00"),
    }
    clean = service._sanitize_json_dict(data)
    assert clean is not None
    assert clean["step"] == "step_1"
    assert clean["timestamp"] == "2026-01-01T00:00:00"
    assert clean["amount"] == 50000.0
    # Confirm it can be dumped with standard json.dumps without error
    dumped = json.dumps(clean)
    assert "step_1" in dumped


def test_compute_hash_deterministic():
    service = AuditService()
    now = datetime(2026, 10, 26, 12, 0, 0)
    old_vals = {"key": "old", "created_at": now}
    new_vals = {"key": "new", "amount": Decimal("123.45")}

    hash1 = service._compute_hash("0" * 64, "case", "123", "UPDATE", "user-1", old_vals, new_vals, "2026-10-26T12:00:00Z")
    hash2 = service._compute_hash("0" * 64, "case", "123", "UPDATE", "user-1", old_vals, new_vals, "2026-10-26T12:00:00Z")
    assert hash1 == hash2
    assert len(hash1) == 64
