"""Regression tests for route-specific conditional release checklist rules."""

from backend.services.checklist import ChecklistEngine
from backend.services.rule_engine import RuleEngine


def _engine() -> ChecklistEngine:
    engine = ChecklistEngine()
    engine.rule_engine = RuleEngine("config/rules.yaml")
    return engine


def test_non_applicable_conditional_items_do_not_become_mandatory():
    items = _engine().generate_checklist(
        "maturity", "fdr_rpgf", {"institution_type": "engineering", "bank_requires_noc": False}
    )
    keys = {item.key for item in items}
    assert "government_noc" not in keys
    assert "bank_noc" not in keys
    assert all(item.mandatory for item in items)


def test_applicable_conditional_item_is_visible_but_preserves_its_metadata():
    items = _engine().generate_checklist(
        "maturity", "fdr_rpgf", {"institution_type": "government", "bank_requires_noc": False}
    )
    government_noc = next(item for item in items if item.key == "government_noc")
    assert government_noc.mandatory is False
    assert government_noc.condition == "institution_type in ['government', 'government_aided']"
