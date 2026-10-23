"""Rule Engine Service - Loads and provides access to configurable business rules."""

import os
from pathlib import Path
from typing import Any, Dict, List, Optional
from functools import lru_cache

import yaml

from backend.config import get_settings


class RuleEngine:
    """Service for loading and accessing configurable business rules from YAML."""
    
    def __init__(self, config_path: Optional[str] = None):
        self.config_path = config_path or self._get_default_config_path()
        self._rules: Dict[str, Any] = {}
        self._load_rules()
    
    def _get_default_config_path(self) -> str:
        """Get default config file path."""
        # Try to find config/rules.yaml relative to the project root
        # Start from current file location and go up to find project root
        current_dir = Path(__file__).parent.parent.parent  # backend/services -> backend -> project_root
        config_path = current_dir / "config" / "rules.yaml"
        if config_path.exists():
            return str(config_path)
        
        # Fallback: try current working directory
        cwd_path = Path.cwd() / "config" / "rules.yaml"
        if cwd_path.exists():
            return str(cwd_path)
        
        # Fallback: try settings database_url parent (for sqlite)
        settings = get_settings()
        if "sqlite" in settings.database_url:
            db_path = Path(settings.database_url.replace("sqlite+aiosqlite:///", "").replace("sqlite:///", ""))
            project_root = db_path.parent.parent
            config_path = project_root / "config" / "rules.yaml"
            if config_path.exists():
                return str(config_path)
        
        # Last resort: return the expected path even if it doesn't exist
        return str(current_dir / "config" / "rules.yaml")
    
    def _load_rules(self) -> None:
        """Load rules from YAML file."""
        if os.path.exists(self.config_path):
            with open(self.config_path, "r", encoding="utf-8") as f:
                self._rules = yaml.safe_load(f) or {}
        else:
            self._rules = {}
    
    def reload(self) -> None:
        """Reload rules from file."""
        self._load_rules()
    
    def get(self, key: str, default: Any = None) -> Any:
        """Get a rule value by dot-notation key (e.g., 'routing.scrutiny_assignment.strategy')."""
        keys = key.split(".")
        value = self._rules
        for k in keys:
            if isinstance(value, dict) and k in value:
                value = value[k]
            else:
                return default
        return value
# Routing rules
    def get_scrutiny_assignment_strategy(self) -> str:
        return self.get("routing.scrutiny_assignment.strategy", "round_robin")
    
    def get_scrutiny_auto_assign(self) -> bool:
        return self.get("routing.scrutiny_assignment.auto_assign_on_submit", True)
    
    def get_scrutiny_max_cases(self) -> int:
        return self.get("routing.scrutiny_assignment.max_cases_per_officer", 50)
    
    def get_clearance_assignment_strategy(self) -> str:
        return self.get("routing.clearance_assignment.strategy", "by_type")
    
    def get_clearance_default_officer(self, clearance_type: str) -> Optional[str]:
        return self.get(f"routing.clearance_assignment.default_officers.{clearance_type}")
    
    def get_authority_assignment_strategy(self) -> str:
        return self.get("routing.authority_assignment.strategy", "by_method")
    
    def get_authority_for_method(self, method: str) -> Optional[str]:
        mapping = {
            "fdr_rpgf": "fdr_rpgf_authority",
            "rtgs": "rtgs_authority",
            "security_deposit_refund": "sd_refund_authority",
        }
        key = mapping.get(method)
        if key:
            return self.get(f"routing.authority_assignment.{key}")
        return None
    
    # Deadline rules
    def get_scrutiny_deadlines(self) -> Dict[str, int]:
        return self.get("deadlines.scrutiny", {
            "initial_review_days": 5,
            "clarification_response_days": 7,
            "max_clarification_rounds": 3,
            "escalation_days": 15,
        })
    
    def get_clearance_deadlines(self) -> Dict[str, Any]:
        return self.get("deadlines.clearance", {
            "financial_verification_days": 10,
            "legal_compliance_days": 10,
            "technical_verification_days": 10,
            "parallel_processing": True,
            "escalation_days": 20,
        })
    
    def get_release_decision_deadlines(self) -> Dict[str, int]:
        return self.get("deadlines.release_decision", {
            "fdr_rpgf_review_days": 15,
            "rtgs_review_days": 10,
            "sd_refund_review_days": 10,
            "escalation_days": 30,
        })
    
    def get_case_total_max_days(self) -> int:
        return self.get("deadlines.case_total_max_days", 120)
    
    # Document requirements
    def get_required_documents(self, deposit_type: str, deposit_method: str) -> List[str]:
        """Get mandatory document types for a deposit type/method combination."""
        return self.get(f"document_requirements.{deposit_type}.{deposit_method}.mandatory", [])
    
    def get_conditional_documents(self, deposit_type: str, deposit_method: str) -> List[Dict[str, Any]]:
        """Get conditional document requirements."""
        return self.get(f"document_requirements.{deposit_type}.{deposit_method}.conditional", [])
    
    def get_all_required_documents(self, deposit_type: str, deposit_method: str, case_data: Dict[str, Any]) -> List[str]:
        """Get all required documents including conditional ones evaluated against case data."""
        mandatory = self.get_required_documents(deposit_type, deposit_method)
        conditional = self.get_conditional_documents(deposit_type, deposit_method)
        
        for cond in conditional:
            condition = cond.get("condition", "")
            if self._evaluate_condition(condition, case_data):
                mandatory.extend(cond.get("documents", []))
        
        return list(set(mandatory))  # Deduplicate
    
    def _evaluate_condition(self, condition: str, case_data: Dict[str, Any]) -> bool:
        """Safely evaluate a condition string against case data."""
        try:
            for key, value in case_data.items():
                if isinstance(value, str):
                    condition = condition.replace(key, f"'{value}'")
                else:
                    condition = condition.replace(key, str(value))
            allowed_names = {"True": True, "False": False, "None": None}
            return eval(condition, {"__builtins__": {}}, allowed_names)
        except Exception:
            return False
    
    # Release checklists
    def get_release_checklist(self, request_type: str, deposit_method: str) -> List[str]:
        """Get release checklist for a request type and deposit method."""
        key = f"{request_type}_{deposit_method}"
        return self.get(f"release_checklists.{key}", [])
    
    def get_all_checklist_keys(self) -> List[str]:
        """Get all available checklist template keys."""
        checklists = self.get("release_checklists", {})
        return list(checklists.keys())
    
    # Alert configuration
    def get_alert_lead_days(self) -> List[int]:
        return self.get("alerts.lead_days", [30, 15, 7, 1, 0])
    
    def get_alert_channels(self) -> Dict[str, bool]:
        return self.get("alerts.channels", {"email": True, "in_app": True, "webhook": False})
    
    def get_alert_template(self, template_name: str) -> Dict[str, Any]:
        return self.get(f"alerts.templates.{template_name}", {})
    
    # Validation rules
    def get_field_validation(self, field_name: str) -> Dict[str, Any]:
        return self.get(f"validation.fields.{field_name}", {})
    
    def get_cross_field_validations(self) -> List[Dict[str, Any]]:
        return self.get("validation.cross_field", [])
    
    # File validation rules
    def get_max_file_size_mb(self) -> int:
        return self.get("file_validation.max_file_size_mb", 10)

    def get_allowed_mime_types(self) -> List[str]:
        return self.get("file_validation.allowed_mime_types", [
            "application/pdf",
            "image/jpeg",
            "image/png",
            "image/tiff",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/vnd.ms-excel",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ])

    def is_virus_scan_enabled(self) -> bool:
        return self.get("file_validation.virus_scan_enabled", False)

    def is_versioning_enabled(self) -> bool:
        return self.get("file_validation.versioning_enabled", True)

    # Demo data
    def get_demo_institutions(self) -> List[Dict[str, Any]]:
        return self.get("demo.institutions", [])
    
    def get_demo_users(self) -> List[Dict[str, Any]]:
        return self.get("demo.users", [])
    
    def get_demo_case_scenarios(self) -> List[Dict[str, Any]]:
        return self.get("demo.case_scenarios", [])


# Module-level singleton
@lru_cache
def get_rule_engine() -> RuleEngine:
    """Get cached rule engine instance."""
    return RuleEngine()