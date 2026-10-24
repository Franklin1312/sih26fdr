"""Unit tests for ValidationEngine anomaly detection."""

import pytest
from datetime import date
from unittest.mock import MagicMock

from backend.services.validation import ValidationEngine, ValidationResult


class TestValidationEngine:
    """Tests for ValidationEngine."""

    @pytest.fixture
    def engine(self):
        return ValidationEngine()

    def test_validate_step1_data_valid(self, engine):
        data = {
            "deposit_type": "security_deposit",
            "deposit_method": "fdr_rpgf",
            "amount": "100000",
            "currency": "INR",
            "instrument_number": "FDR12345",
            "issuing_bank": "State Bank of India",
        }
        result = engine.validate_step1_data(data)
        assert result.is_valid is True
        assert len(result.errors) == 0

    def test_validate_step1_data_missing_fields(self, engine):
        data = {"deposit_type": "security_deposit"}
        result = engine.validate_step1_data(data)
        assert result.is_valid is False
        assert len(result.errors) > 0
        assert any("amount" in e for e in result.errors)
    def test_validate_step1_data_invalid_amount(self, engine):
        data = {
            "deposit_type": "security_deposit",
            "deposit_method": "fdr_rpgf",
            "amount": "not_a_number",
            "currency": "INR",
            "instrument_number": "FDR12345",
            "issuing_bank": "State Bank of India",
        }
        result = engine.validate_step1_data(data)
        assert result.is_valid is False
        assert any("Invalid amount" in e for e in result.errors)

    def test_validate_step1_data_negative_amount(self, engine):
        data = {"deposit_type": "security_deposit", "deposit_method": "fdr_rpgf", "amount": "-1000", "currency": "INR", "instrument_number": "FDR12345", "issuing_bank": "State Bank of India"}
        result = engine.validate_step1_data(data)
        assert result.is_valid is False
        assert any("positive" in e for e in result.errors)

    def test_validate_step1_data_invalid_currency(self, engine):
        data = {"deposit_type": "security_deposit", "deposit_method": "fdr_rpgf", "amount": "100000", "currency": "JPY", "instrument_number": "FDR12345", "issuing_bank": "State Bank of India"}
        result = engine.validate_step1_data(data)
        assert result.is_valid is True
        assert any("Unusual currency" in w for w in result.warnings)

    def test_validate_step1_data_invalid_combination(self, engine):
        data = {"deposit_type": "fdr", "deposit_method": "rtgs", "amount": "100000", "currency": "INR", "instrument_number": "FDR12345", "issuing_bank": "State Bank of India"}
        result = engine.validate_step1_data(data)
        assert result.is_valid is False
        assert any("Invalid method" in e for e in result.errors)

    def test_validate_step2_data(self, engine):
        data = {"documents": [{"document_type": "fdr_original"}, {"document_type": "bank_guarantee"}]}
        result = engine.validate_step2_data(data)
        assert result.is_valid is True

    def test_validate_step2_data_missing_type(self, engine):
        data = {"documents": [{"document_type": "fdr_original"}, {}]}
        result = engine.validate_step2_data(data)
        assert result.is_valid is True
        assert any("missing document_type" in w for w in result.warnings)

    def test_validate_step3_data(self, engine):
        data = {"confirmed": True, "terms_accepted": True}
        result = engine.validate_step3_data(data)
        assert result.is_valid is True

    def test_validate_step3_data_missing(self, engine):
        data = {"confirmed": False, "terms_accepted": True}
        result = engine.validate_step3_data(data)
        assert result.is_valid is False
        assert any("Must confirm" in e for e in result.errors)

    def test_dates_match_same_format(self, engine):
        assert engine._dates_match("15/01/2024", "15/01/2024") is True
        assert engine._dates_match("2024-01-15", "2024-01-15") is True

    def test_dates_match_different_format(self, engine):
        assert engine._dates_match("15/01/2024", "2024-01-15") is True
        assert engine._dates_match("15-01-2024", "2024-01-15") is True
        assert engine._dates_match("15 Jan 2024", "2024-01-15") is True
        assert engine._dates_match("15 January 2024", "2024-01-15") is True

    def test_dates_no_match(self, engine):
        assert engine._dates_match("15/01/2024", "16/01/2024") is False
        assert engine._dates_match("2024-01-15", "2024-02-15") is False

    def test_amounts_match_within_tolerance(self, engine):
        assert engine._amounts_match(100000, 100000) is True
        assert engine._amounts_match(100000, 102000) is True
        assert engine._amounts_match(100000, 98000) is True
        assert engine._amounts_match(100000, 105000) is True

    def test_amounts_match_outside_tolerance(self, engine):
        assert engine._amounts_match(100000, 110000) is False
        assert engine._amounts_match(100000, 90000) is False

    def test_amounts_match_zero(self, engine):
        assert engine._amounts_match(0, 0) is True
        assert engine._amounts_match(0, 100) is False

    def test_detect_anomalies_no_case(self, engine):
        flags = engine.detect_anomalies(None, [])
        assert flags == {}

    def test_detect_anomalies_no_evidence(self, engine):
        case = MagicMock()
        case.maturity_date = date(2024, 1, 15)
        case.instrument_date = date(2024, 1, 10)
        case.amount = 100000
        case.id = "case-1"
        flags = engine.detect_anomalies(case, [])
        assert flags == {}

    def test_detect_anomalies_date_mismatch(self, engine):
        case = MagicMock()
        case.maturity_date = date(2024, 1, 15)
        case.instrument_date = date(2024, 1, 10)
        case.amount = 100000
        case.id = "case-1"
        evidence = MagicMock()
        evidence.extracted_data = {"dates": ["20/01/2024"], "amounts": [], "references": []}
        evidence.ocr_confidence = 90.0
        flags = engine.detect_anomalies(case, [evidence])
        assert "date_mismatch" in flags
        assert len(flags["date_mismatch"]) > 0
        assert flags["date_mismatch"][0]["field"] == "maturity_date"

    def test_detect_anomalies_amount_mismatch(self, engine):
        case = MagicMock()
        case.maturity_date = date(2024, 1, 15)
        case.instrument_date = date(2024, 1, 10)
        case.amount = 100000
        case.id = "case-1"
        evidence = MagicMock()
        evidence.extracted_data = {"dates": [], "amounts": [150000.0], "references": []}
        evidence.ocr_confidence = 90.0
        flags = engine.detect_anomalies(case, [evidence])
        assert "amount_mismatch" in flags
        assert len(flags["amount_mismatch"]) > 0
        assert flags["amount_mismatch"][0]["difference_pct"] == 50.0

    def test_generate_validation_flags_no_anomalies(self, engine):
        case = MagicMock()
        case.maturity_date = date(2024, 1, 15)
        case.instrument_date = None
        case.amount = 100000
        case.id = "case-1"
        evidence = MagicMock()
        evidence.extracted_data = {"dates": ["15/01/2024"], "amounts": [100000.0], "references": []}
        evidence.ocr_confidence = 90.0
        result = engine.generate_validation_flags(case, [evidence])
        assert result["advisory"] is False

    def test_generate_validation_flags_with_anomalies(self, engine):
        case = MagicMock()
        case.maturity_date = date(2024, 1, 15)
        case.amount = 100000
        case.id = "case-1"
        evidence = MagicMock()
        evidence.extracted_data = {"dates": ["20/01/2024"], "amounts": [150000.0], "references": []}
        evidence.ocr_confidence = 90.0
        result = engine.generate_validation_flags(case, [evidence])
        assert result["advisory"] is True
        assert "flags" in result
        assert "note" in result
        assert "ADVISORY ONLY" in result["note"]

    def test_get_avg_confidence(self, engine):
        ev1 = MagicMock(); ev1.ocr_confidence = 80.0
        ev2 = MagicMock(); ev2.ocr_confidence = 90.0
        ev3 = MagicMock(); ev3.ocr_confidence = None
        avg = engine._get_avg_confidence([ev1, ev2, ev3])
        assert avg == 85.0
    def test_get_avg_confidence_none(self, engine):
        ev1 = MagicMock(); ev1.ocr_confidence = None
        ev2 = MagicMock(); ev2.ocr_confidence = None
        avg = engine._get_avg_confidence([ev1, ev2])
        assert avg == 0.0
