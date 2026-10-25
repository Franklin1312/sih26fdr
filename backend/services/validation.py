"""Validation Engine - Rule-based validation from config/rules.yaml."""

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from backend.config import get_settings
from backend.services.rule_engine import get_rule_engine
from backend.models.enums import DepositType, DepositMethod

logger = logging.getLogger("sih26psfdr.validation")

class ValidationResult:
    """Result of a validation check."""

    def __init__(self, is_valid: bool, missing_mandatory=None, missing_conditional=None, warnings=None, errors=None):
        self.is_valid = is_valid
        self.missing_mandatory = missing_mandatory or []
        self.missing_conditional = missing_conditional or []
        self.warnings = warnings or []
        self.errors = errors or []
    def to_dict(self): return {"is_valid": self.is_valid, "missing_mandatory": self.missing_mandatory, "missing_conditional": self.missing_conditional, "warnings": self.warnings, "errors": self.errors}

class ValidationEngine:
    """Engine for validating case submissions against configurable rules."""
    def __init__(self): self.settings = get_settings()
    def get_required_documents(self, deposit_type, deposit_method, institution=None, amount=None):
        engine = get_rule_engine()
        mandatory = engine.get_document_requirements(deposit_type, deposit_method)
        conditional_rules = engine.get("validation_rules.conditional_document_requirements", [])
        evaluated = []
        context = {
            "amount": amount,
            "institution_type": getattr(getattr(institution, "institution_type", None), "value", getattr(institution, "institution_type", None)),
        }
        for cond in conditional_rules:
            condition = cond.get("condition", ""); docs = cond.get("documents", [])
            if engine.evaluate_condition(condition, context): evaluated.extend(docs)
        return {"mandatory": mandatory, "conditional": evaluated, "conditional_rules": conditional_rules, "all_required": list(dict.fromkeys(mandatory + evaluated))}
    def _evaluate_condition(
        self,
        condition: str,
        institution: Optional[Any],
        amount: Optional[float],
    ) -> bool:
        if not condition:
            return False

        try:
            if "amount" in condition and amount is not None:
                if ">" in condition:
                    threshold = float(condition.split(">")[1].strip())
                    return amount > threshold
                if "<" in condition:
                    threshold = float(condition.split("<")[1].strip())
                    return amount < threshold
                if ">=" in condition:
                    threshold = float(condition.split(">=")[1].strip())
                    return amount >= threshold
                if "<=" in condition:
                    threshold = float(condition.split("<=")[1].strip())
                    return amount <= threshold
        except (ValueError, IndexError):
            pass

        if "institution_type" in condition and institution is not None:
            inst_type = condition.split("=")[-1].strip().strip('"')
            actual = getattr(institution, 'institution_type', None)
            return getattr(actual, "value", actual) == inst_type

        return False

    def validate_case_completeness(
        self,
        case: Any,
        uploaded_documents: List[str],
    ) -> ValidationResult:
        required = self.get_required_documents(
            case.deposit_type,
            case.deposit_method,
            case.institution,
            case.amount,
        )

        uploaded_set = set(uploaded_documents)
        required_set = set(required["all_required"])

        missing_mandatory = [d for d in required["mandatory"] if d not in uploaded_set]
        missing_conditional = [d for d in required["conditional"] if d not in uploaded_set]

        conditional_details = []
        for doc in missing_conditional:
            for cond in required.get("conditional_rules", []):
                if doc in cond.get("documents", []):
                    conditional_details.append({
                        "document": doc,
                        "condition": cond.get("condition", ""),
                    })
                    break

        is_valid = len(missing_mandatory) == 0

        warnings = []
        if missing_conditional:
            warnings.append(f"{len(missing_conditional)} conditional document(s) missing but may be required")

        return ValidationResult(
            is_valid=is_valid,
            missing_mandatory=missing_mandatory,
            missing_conditional=conditional_details,
            warnings=warnings,
        )

    def validate_step1_data(self, data: Dict[str, Any]) -> ValidationResult:
        errors = []
        warnings = []

        required_fields = [
            "deposit_type",
            "deposit_method",
            "amount",
            "currency",
            "instrument_number",
            "issuing_bank",
        ]

        for field in required_fields:
            if not data.get(field):
                errors.append(f"Missing required field: {field}")

        amount = data.get("amount")
        if amount is not None:
            try:
                amount_val = float(amount)
                if amount_val <= 0:
                    errors.append("Amount must be positive")
                if amount_val > 1e12:
                    warnings.append("Amount exceeds typical limits")
            except (ValueError, TypeError):
                errors.append("Invalid amount format")

        currency = data.get("currency", "INR")
        if currency not in ["INR", "USD", "EUR"]:
            warnings.append(f"Unusual currency: {currency}")

        deposit_type = data.get("deposit_type")
        deposit_method = data.get("deposit_method")
        valid_combinations = {
            DepositType.SECURITY_DEPOSIT: [DepositMethod.FDR_RPGF, DepositMethod.RTGS, DepositMethod.SECURITY_DEPOSIT_REFUND],
            DepositType.FDR: [DepositMethod.FDR_RPGF],
            DepositType.RPGF: [DepositMethod.FDR_RPGF],
            DepositType.BANK_GUARANTEE: [DepositMethod.FDR_RPGF],
        }
        if deposit_type and deposit_method:
            try:
                dt = DepositType(deposit_type)
                dm = DepositMethod(deposit_method)
                if dm not in valid_combinations.get(dt, []):
                    errors.append(f"Invalid method {deposit_method} for type {deposit_type}")
            except ValueError:
                errors.append("Invalid deposit type or method")

        return ValidationResult(
            is_valid=len(errors) == 0,
            errors=errors,
            warnings=warnings,
        )
    def validate_step2_data(self, data: Dict[str, Any]) -> ValidationResult:
        warnings = []
        documents = data.get("documents", [])
        if not isinstance(documents, list):
            warnings.append("Documents should be a list")
            return ValidationResult(is_valid=True, warnings=warnings)
        for i, doc in enumerate(documents):
            if not doc.get("document_type"):
                warnings.append(f"Document {i}: missing document_type")
        return ValidationResult(is_valid=True, warnings=warnings)

    def validate_step3_data(self, data: Dict[str, Any]) -> ValidationResult:
        errors = []
        if not data.get("confirmed"):
            errors.append("Must confirm review before submission")
        if not data.get("terms_accepted"):
            errors.append("Must accept terms and conditions")
        return ValidationResult(is_valid=len(errors) == 0, errors=errors)
    # --- Anomaly Detection (Advisory Only) ---

    def detect_anomalies(
        self,
        case: Any,
        evidence_list: List[Any],
    ) -> Dict[str, Any]:
        """
        Detect anomalies between OCR extracted data and entered case data.
        All findings are ADVISORY ONLY - never used for automatic decisions.
        Human reviewers must explicitly acknowledge any flags.
        """
        flags = {
            "date_mismatch": [],
            "amount_mismatch": [],
            "duplicate_reference": [],
        }

        if not case:
            return {}

        all_dates = []
        all_amounts = []
        all_references = []
        
        for evidence in evidence_list:
            if evidence.extracted_data:
                all_dates.extend(evidence.extracted_data.get("dates", []))
                all_amounts.extend(evidence.extracted_data.get("amounts", []))
                all_references.extend(evidence.extracted_data.get("references", []))

        if hasattr(case, 'maturity_date') and case.maturity_date:
            entered_date = case.maturity_date.strftime("%d/%m/%Y") if hasattr(case.maturity_date, 'strftime') else str(case.maturity_date)
            for ocr_date in all_dates:
                if not self._dates_match(entered_date, ocr_date):
                    flags["date_mismatch"].append({
                        "field": "maturity_date",
                        "entered": entered_date,
                        "extracted": ocr_date,
                        "confidence": self._get_avg_confidence(evidence_list),
                    })

        if hasattr(case, 'instrument_date') and case.instrument_date:
            entered_date = case.instrument_date.strftime("%d/%m/%Y") if hasattr(case.instrument_date, 'strftime') else str(case.instrument_date)
            for ocr_date in all_dates:
                if not self._dates_match(entered_date, ocr_date):
                    flags["date_mismatch"].append({
                        "field": "instrument_date",
                        "entered": entered_date,
                        "extracted": ocr_date,
                        "confidence": self._get_avg_confidence(evidence_list),
                    })

        if hasattr(case, 'amount') and case.amount:
            entered_amount = float(case.amount)
            for ocr_amount in all_amounts:
                if not self._amounts_match(entered_amount, ocr_amount):
                    flags["amount_mismatch"].append({
                        "field": "amount",
                        "entered": entered_amount,
                        "extracted": ocr_amount,
                        "difference_pct": abs(entered_amount - ocr_amount) / entered_amount * 100,
                        "confidence": self._get_avg_confidence(evidence_list),
                    })

        for ref in all_references:
            if self._check_duplicate_reference(ref, case.id):
                flags["duplicate_reference"].append({
                    "reference": ref,
                    "confidence": self._get_avg_confidence(evidence_list),
                })

        # Filter out empty categories
        result = {k: v for k, v in flags.items() if v}
        return result if result else {}
    def _dates_match(self, entered: str, extracted: str) -> bool:
        try:
            entered_norm = self._normalize_date(entered)
            extracted_norm = self._normalize_date(extracted)
            return entered_norm == extracted_norm
        except Exception:
            return False

    def _normalize_date(self, date_str: str) -> str:
        date_str = date_str.strip()
        for fmt in ["%d/%m/%Y", "%d-%m-%Y", "%Y-%m-%d", "%d %b %Y", "%d %B %Y"]:
            try:
                return datetime.strptime(date_str, fmt).strftime("%Y-%m-%d")
            except ValueError:
                continue
        return date_str

    def _amounts_match(self, entered: float, extracted: float, tolerance_pct: float = 5.0) -> bool:
        if entered == 0: return extracted == 0
        diff_pct = abs(entered - extracted) / abs(entered) * 100
        return diff_pct <= tolerance_pct

    def _check_duplicate_reference(self, reference: str, current_case_id: str) -> bool:
        rule_engine = get_rule_engine()
        discrepancies = rule_engine.get_seeded_discrepancies()
        for disc in discrepancies:
            if disc.get("reference") == reference:
                return True
        return False

    def _get_avg_confidence(self, evidence_list: List[Any]) -> float:
        confidences = []
        for ev in evidence_list:
            if ev.ocr_confidence is not None:
                confidences.append(ev.ocr_confidence)
        return sum(confidences) / len(confidences) if confidences else 0.0

    def generate_validation_flags(
        self,
        case: Any,
        evidence_list: List[Any],
    ) -> Dict[str, Any]:
        """Generate validation flags for a case based on OCR anomalies."""
        anomalies = self.detect_anomalies(case, evidence_list)
        # Check if any anomalies were found (non-empty lists in flags)
        has_anomalies = any(anomalies.values()) if anomalies else False
        if not has_anomalies:
            return {"advisory": False}
        return {
            "advisory": True,
            "flags": anomalies,
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "note": "All flags are ADVISORY ONLY. Human review required.",
        }


validation_engine = ValidationEngine()
