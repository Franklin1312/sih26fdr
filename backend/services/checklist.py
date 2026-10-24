"""Checklist Engine Service - Generates and evaluates conditional checklists."""

from typing import Any, Dict, List, Optional

from backend.services.rule_engine import get_rule_engine


class ChecklistItem:
    """Represents a single checklist item."""

    def __init__(
        self,
        key: str,
        label: str,
        mandatory: bool = True,
        condition: Optional[str] = None,
        category: Optional[str] = None,
    ):
        self.key = key
        self.label = label
        self.mandatory = mandatory
        self.condition = condition
        self.category = category

    def to_dict(self) -> Dict[str, Any]:
        return {
            "key": self.key,
            "label": self.label,
            "mandatory": self.mandatory,
            "condition": self.condition,
            "category": self.category,
        }


class ChecklistEngine:
    """Service for generating and evaluating conditional checklists."""

    def generate_checklist(
        self,
        request_type: str,
        deposit_method: str,
        case_data: Optional[Dict[str, Any]] = None,
    ) -> List[ChecklistItem]:
        """
        Generate a conditional checklist based on request type and deposit method.
        
        Args:
            request_type: e.g., 'maturity', 'early_release', 'refund'
            deposit_method: e.g., 'fdr_rpgf', 'rtgs', 'security_deposit_refund'
            case_data: Optional case data for evaluating conditions
            
        Returns:
            List of ChecklistItem objects
        """
        case_data = case_data or {}
        checklist_keys = self.rule_engine.get_release_checklist(request_type, deposit_method)
        
        # Get conditional checklist rules
        conditional_rules = self.rule_engine.get("release_checklists.conditional", [])
        
        items = []
        for key in checklist_keys:
            # Check if this item has conditional rules
            item_config = self._get_item_config(key, conditional_rules, case_data)
            
            # Evaluate condition if present
            if item_config.get("condition"):
                if not self._evaluate_condition(item_config["condition"], case_data):
                    continue  # Skip this item if condition not met
            
            item = ChecklistItem(
                key=key,
                label=item_config.get("label", key.replace("_", " ").title()),
                mandatory=item_config.get("mandatory", True),
                condition=item_config.get("condition"),
                category=item_config.get("category"),
            )
            items.append(item)
        
        return items

    def _get_item_config(
        self,
        key: str,
        conditional_rules: List[Dict[str, Any]],
        case_data: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Get configuration for a checklist item, checking conditional rules."""
        # Default config
        config = {
            "label": key.replace("_", " ").title(),
            "mandatory": True,
            "category": "general",
        }
        
        # Check conditional rules
        for rule in conditional_rules:
            if rule.get("item_key") == key:
                condition = rule.get("condition")
                if condition:
                    if self._evaluate_condition(condition, case_data):
                        config.update(rule.get("when_true", {}))
                    else:
                        config.update(rule.get("when_false", {}))
                else:
                    config.update(rule.get("config", {}))
                break
        
        return config

    def _evaluate_condition(self, condition: str, case_data: Dict[str, Any]) -> bool:
        """Safely evaluate a condition string against case data."""
        try:
            eval_condition = condition
            for key, value in case_data.items():
                if isinstance(value, str):
                    eval_condition = eval_condition.replace(key, f"'{value}'")
                else:
                    eval_condition = eval_condition.replace(key, str(value))
            
            allowed_names = {"True": True, "False": False, "None": None}
            return eval(eval_condition, {"__builtins__": {}}, allowed_names)
        except Exception:
            return False

    def evaluate_checklist(
        self,
        checklist_data: Dict[str, bool],
        request_type: str,
        deposit_method: str,
        case_data: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Evaluate if all mandatory checklist items are satisfied.
        
        Returns:
            Dict with 'passed', 'mandatory_count', 'completed_count', 'missing_items'
        """
        case_data = case_data or {}
        items = self.generate_checklist(request_type, deposit_method, case_data)
        
        mandatory_items = [item for item in items if item.mandatory]
        missing_items = []
        completed_count = 0
        
        for item in mandatory_items:
            if checklist_data.get(item.key) is True:
                completed_count += 1
            else:
                missing_items.append(item.key)
        
        return {
            "passed": len(missing_items) == 0,
            "mandatory_count": len(mandatory_items),
            "completed_count": completed_count,
            "missing_items": missing_items,
            "items": [item.to_dict() for item in items],
        }

    def get_checklist_template(
        self,
        request_type: str,
        deposit_method: str,
    ) -> List[str]:
        """Get raw checklist template keys from rules.yaml."""
        return self.rule_engine.get_release_checklist(request_type, deposit_method)


# Module-level singleton
_checklist_engine: Optional[ChecklistEngine] = None


def get_checklist_engine() -> ChecklistEngine:
    """Get cached checklist engine instance."""
    global _checklist_engine
    if _checklist_engine is None:
        _checklist_engine = ChecklistEngine()
    return _checklist_engine