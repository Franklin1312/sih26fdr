"""Validation Engine - Rule-based validation from config/rules.yaml."""

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Set, Tuple
from uuid import uuid4

from backend.config import get_settings
from backend.services.rule_engine import get_rule_engine
from backend.models.enums import DepositType, DepositMethod

logger = logging.getLogger("sih26psfdr.validation")


class ValidationResult:
    """Result of a validation check."""

    def __init__(
        self,
        is_valid: bool,
        missing_mandatory: List[str] = None,
        missing_conditional: List[Dict[str, Any]] = None,
        warnings: List[str] = None,
        errors: List[str] = None,
    ):
        self.is_valid = is_valid
        self.missing_mandatory = missing_mandatory or []
        self.missing_conditional = missing_conditional or []
        self.warnings = warnings or []
        self.errors = errors or []

    def to_dict(self) -> Dict[str, Any]:
        return {
            "is_valid": self.is_valid,
            "missing_mandatory": self.missing_mandatory,
            "missing_conditional": self.missing_conditional,
            "warnings": self.warnings,
            "errors": self.errors,
        }


class ValidationEngine:
    """Engine for validating case submissions against configurable rules."""

    def __init__(self):
        self.settings = get_settings()

    def get_required_documents(
        self,
        deposit_type: DepositType,
        deposit_method: DepositMethod,
        institution: Optional[Any] = None,
        amount: Optional[float] = None,
    ) -> Dict[str, Any]:
        rules = get_rule_engine().get_document_requirements()
        type_key = deposit_type.value
        method_key = deposit_method.value

        type_rules = rules.get(type_key, {})
        method_rules = type_rules.get(method_key, {})

        mandatory = method_rules.get("mandatory", [])
        conditional = method_rules.get("conditional", [])

        evaluated_conditional = []
        for cond in conditional:
            condition = cond.get("condition", "")
            documents = cond.get("documents", [])

            if self._evaluate_condition(condition, institution, amount):
                evaluated_conditional.extend(documents)

        return {
            "mandatory": mandatory,
            "conditional": evaluated_conditional,
            "all_required": list(set(mandatory + evaluated_conditional)),
        }

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

            if "institution_age" in condition and institution is not None:
                if hasattr(institution, "created_at") and institution.created_at:
                    age_years = (
                        datetime.now(timezone.utc) - institution.created_at
                    ).days / 365.25
                    if "<" in condition:
                        threshold = float(condition.split("<")[1].strip())
                        return age_years < threshold
                    if ">" in condition:
                        threshold = float(condition.split(">")[1].strip())
                        return age_years > threshold

            return False
        except Exception as e:
            logger.warning(f"Failed to evaluate condition '{condition}': {e}")
            return False

    def validate_completeness(
        self,
        deposit_type: DepositType,
        deposit_method: DepositMethod,
        uploaded_documents: List[Dict[str, Any]],
        institution: Optional[Any] = None,
        amount: Optional[float] = None,
    ) -> ValidationResult:
        required = self.get_required_documents(
            deposit_type, deposit_method, institution, amount
        )

        uploaded_types = {doc.get("document_type", "") for doc in uploaded_documents}

        missing_mandatory = [
            doc_type for doc_type in required["mandatory"] if doc_type not in uploaded_types
        ]

        missing_conditional = [
            doc_type for doc_type in required["conditional"] if doc_type not in uploaded_types
        ]

        conditional_details = []
        for doc_type in missing_conditional:
            for cond in get_rule_engine().get_document_requirements().get(deposit_type.value, {}).get(deposit_method.value, {}).get("conditional", []):
                if doc_type in cond.get("documents", []):
                    if self._evaluate_condition(cond.get("condition", ""), institution, amount):
                        conditional_details.append({
                            "document_type": doc_type,
                            "condition": cond.get("condition", ""),
                            "reason": f"Conditional requirement: {cond.get('condition', '')}"
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


validation_engine = ValidationEngine()
