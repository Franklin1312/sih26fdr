"""Rule Engine Service - Loads and provides access to configurable business rules."""

import ast
import copy
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
        current_dir = Path(__file__).parent.parent.parent  # backend/services -> backend -> project_root
        config_path = current_dir / "config" / "rules.yaml"
        if config_path.exists():
            return str(config_path)

        cwd_path = Path.cwd() / "config" / "rules.yaml"
        if cwd_path.exists():
            return str(cwd_path)

        settings = get_settings()
        if "sqlite" in settings.database_url:
            db_path = Path(settings.database_url.replace("sqlite+aiosqlite:///", "").replace("sqlite:///", ""))
            project_root = db_path.parent.parent
            config_path = project_root / "config" / "rules.yaml"
            if config_path.exists():
                return str(config_path)

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

    # Release checklists (new structure)
    def get_release_checklist(self, request_type: str, deposit_method: str) -> List[str]:
        """Get release checklist for a request type and deposit method."""
        key = f"{request_type}_{deposit_method}"
        checklist = self.get(f"release_checklists.{key}")
        if not checklist:
            return []
        mandatory_keys = [item["key"] for item in checklist.get("mandatory", [])]
        conditional_keys = [item["key"] for item in checklist.get("conditional", [])]
        return mandatory_keys + conditional_keys

    def get_release_checklist_items(self, request_type: str, deposit_method: str) -> List[Dict[str, Any]]:
        """Get full release checklist items with metadata."""
        key = f"{request_type}_{deposit_method}"
        checklist = self.get(f"release_checklists.{key}")
        if not checklist:
            return []
        items = []
        for item in checklist.get("mandatory", []):
            value = copy.deepcopy(item)
            value["mandatory"] = True
            items.append(value)
        for item in checklist.get("conditional", []):
            value = copy.deepcopy(item)
            value["mandatory"] = False
            items.append(value)
        return items

    def get_release_checklist_config(self, request_type: str, deposit_method: str) -> Dict[str, Any]:
        """Get full checklist config including deadline and review_path."""
        key = f"{request_type}_{deposit_method}"
        return self.get(f"release_checklists.{key}", {})

    def get_all_checklist_keys(self) -> List[str]:
        """Get all available checklist template keys."""
        checklists = self.get("release_checklists", {})
        return list(checklists.keys())

    # Clearance tasks
    def get_clearance_tasks(self) -> List[Dict[str, Any]]:
        """Get all clearance task configurations."""
        return self.get("clearance_tasks", [])

    def get_mandatory_clearance_types(self) -> List[str]:
        """Get list of mandatory clearance types."""
        tasks = self.get_clearance_tasks()
        return [task["type"] for task in tasks if task.get("mandatory", True)]

    # Date types
    def get_date_types(self) -> List[Dict[str, Any]]:
        """Get all date type configurations."""
        return self.get("date_types", [])

    def get_date_type_config(self, key: str) -> Dict[str, Any]:
        """Get configuration for a specific date type."""
        for dt in self.get_date_types():
            if dt.get("key") == key:
                return dt
        return {}

    # Alert configuration
    def get_alert_advance_days(self) -> List[int]:
        return self.get("alerts.advance_days", [30, 15, 7, 1])

    def get_alert_dedupe_hours(self) -> int:
        return self.get("alerts.dedupe_window_hours", 24)

    def get_alert_channels(self) -> List[str]:
        return self.get("alerts.channels", ["in_app", "email_simulated"])

    def get_alert_template(self, template_name: str) -> Dict[str, str]:
        """Return a normalized alert template.

        Older configurations used a single string.  Keeping that input readable
        avoids a scheduler crash while the structured subject/body contract is
        used everywhere else.
        """
        template = self.get(f"alerts.templates.{template_name}", {})
        if isinstance(template, str):
            return {"subject": "Lifecycle alert: {case_number}", "body": template, "urgency": "medium"}
        if not isinstance(template, dict):
            return {"subject": "Lifecycle alert: {case_number}", "body": "{date_type}", "urgency": "medium"}
        return {
            "subject": str(template.get("subject", "Lifecycle alert: {case_number}")),
            "body": str(template.get("body", "{date_type}")),
            "urgency": str(template.get("urgency", "medium")),
        }

    # Review paths
    def get_review_path_config(self, path_key: str) -> Dict[str, Any]:
        return self.get(f"review_paths.{path_key}", {})

    def get_review_path_for_method(self, deposit_method: str) -> str:
        """Map deposit method to review path."""
        mapping = {
            "fdr_rpgf": "fdr_rpgf",
            "rtgs": "rtgs",
            "security_deposit_refund": "sd_refund",
        }
        return mapping.get(deposit_method, "fdr_rpgf")

    # Validation rules
    def get_max_file_size_mb(self) -> int:
        return self.get("validation_rules.file.max_size_mb", 10)

    def get_allowed_mime_types(self) -> List[str]:
        return self.get("validation_rules.file.allowed_mime_types", [
            "application/pdf",
            "image/jpeg",
            "image/png",
            "image/tiff",
        ])

    def is_watermark_demo_enabled(self) -> bool:
        return self.get("validation_rules.file.watermark_demo", True)

    def get_document_requirements(self, deposit_type: str, deposit_method: Optional[str] = None) -> List[str]:
        """Return flat submission requirements for a deposit type/method.

        This deliberately returns a list: the wizard validation contract is a
        flat list of document types, not a release-checklist mapping.
        """
        type_key = getattr(deposit_type, "value", deposit_type)
        method_key = getattr(deposit_method, "value", deposit_method)
        requirements = self.get("validation_rules.document_requirements", {})
        if not isinstance(requirements, dict):
            return []
        value = None
        if method_key:
            value = requirements.get(str(method_key).upper()) or requirements.get(str(method_key).lower())
        value = value or requirements.get(type_key) or requirements.get(str(type_key).upper()) or requirements.get(str(type_key).lower())
        if isinstance(value, dict):
            value = value.get(method_key) or value.get("default", [])
        return list(value) if isinstance(value, list) else []

    # Demo data
    def get_demo_institutions(self) -> List[Dict[str, Any]]:
        return self.get("demo.institutions", [])

    def get_demo_users(self) -> List[Dict[str, Any]]:
        return self.get("demo.users", [])

    def get_demo_cases(self) -> List[Dict[str, Any]]:
        return self.get("demo.cases", [])

    def get_seeded_discrepancies(self) -> List[Dict[str, Any]]:
        return self.get("demo.seeded_discrepancies", [])

    # Institution types
    def get_institution_types(self) -> List[str]:
        return self.get("institution_types", [])

    # Role permissions
    def get_role_permissions(self, role: str) -> List[str]:
        return self.get(f"role_permissions.{role}", [])

    # Condition evaluation
    def evaluate_condition(self, condition: str, case_data: Dict[str, Any]) -> bool:
        """Evaluate a small, data-only condition without mutating its text."""
        try:
            normalized = condition.replace(" true", " True").replace(" false", " False")
            tree = ast.parse(normalized, mode="eval")
            allowed = (ast.Expression, ast.BoolOp, ast.And, ast.Or, ast.Not, ast.UnaryOp,
                       ast.Compare, ast.Eq, ast.NotEq, ast.In, ast.NotIn, ast.Gt, ast.GtE,
                       ast.Lt, ast.LtE, ast.Name, ast.Load, ast.Constant, ast.List, ast.Tuple)
            if any(not isinstance(node, allowed) for node in ast.walk(tree)):
                return False
            return bool(eval(compile(tree, "<rule>", "eval"), {"__builtins__": {}}, dict(case_data)))
        except Exception:
            return False


# Module-level singleton
@lru_cache
def get_rule_engine() -> RuleEngine:
    """Get cached rule engine instance."""
    return RuleEngine()
