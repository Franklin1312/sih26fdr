"""Unit tests for RuleEngine."""

import pytest
from backend.services.rule_engine import RuleEngine


class TestRuleEngine:
    """Tests for RuleEngine service."""

    def test_load_rules(self):
        """Test that rules load correctly from YAML."""
        engine = RuleEngine("config/rules.yaml")

        # Check release checklists
        assert "maturity_fdr_rpgf" in engine.get_all_checklist_keys()
        assert "maturity_rtgs" in engine.get_all_checklist_keys()
        assert "refund_security_deposit_refund" in engine.get_all_checklist_keys()
        assert "replacement_fdr_rpgf" in engine.get_all_checklist_keys()

        # Check clearance tasks
        clearance_tasks = engine.get_clearance_tasks()
        assert len(clearance_tasks) == 3
        types = [t["type"] for t in clearance_tasks]
        assert "financial" in types
        assert "legal" in types
        assert "technical" in types

        # Check mandatory clearance types
        mandatory = engine.get_mandatory_clearance_types()
        assert set(mandatory) == {"financial", "legal", "technical"}

        # Check review paths
        assert engine.get_review_path_for_method("fdr_rpgf") == "fdr_rpgf"
        assert engine.get_review_path_for_method("rtgs") == "rtgs"
        assert engine.get_review_path_for_method("security_deposit_refund") == "sd_refund"

    def test_date_types(self):
        """Test date type configuration."""
        engine = RuleEngine("config/rules.yaml")

        date_types = engine.get_date_types()
        assert len(date_types) == 5
        keys = [dt["key"] for dt in date_types]
        assert "fdr_maturity" in keys
        assert "security_deposit_term" in keys
        assert "administrative_deadline" in keys
        assert "renewal_due" in keys
        assert "replacement_due" in keys

        # Check FDR maturity config
        fdr_config = engine.get_date_type_config("fdr_maturity")
        assert fdr_config["triggers_alert"] is True
        assert 30 in fdr_config["advance_days"]

    def test_alert_config(self):
        """Test alert configuration."""
        engine = RuleEngine("config/rules.yaml")

        lead_days = engine.get_alert_advance_days()
        assert lead_days == [30, 15, 7, 1]

        dedupe = engine.get_alert_dedupe_hours()
        assert dedupe == 24

        channels = engine.get_alert_channels()
        assert "in_app" in channels
        assert "email_simulated" in channels

        template = engine.get_alert_template("upcoming")
        assert "{date_type}" in template
        assert "{days}" in template

    def test_release_checklists(self):
        """Test release checklist templates."""
        engine = RuleEngine("config/rules.yaml")

        # FDR/RPGF maturity
        checklist = engine.get_release_checklist("maturity", "fdr_rpgf")
        assert "fdr_matured_confirmed" in checklist
        assert "request_letter" in checklist
        assert "affidavit_6" in checklist
        assert "fdr_original" in checklist
        assert "payment_evidence" in checklist
        assert "latest_loa_eoa" in checklist
        assert "pgrc_clearance" in checklist
        assert "vigilance_clearance" in checklist
        assert "government_noc" in checklist
        assert "bank_noc" in checklist
        assert len(checklist) == 10

        # RTGS maturity
        checklist = engine.get_release_checklist("maturity", "rtgs")
        assert "rtgs_funds_received_confirmed" in checklist
        assert "request_letter" in checklist
        assert "affidavit_6" in checklist
        assert "payment_evidence" in checklist
        assert "latest_loa_eoa" in checklist
        assert "pgrc_clearance" in checklist
        assert "vigilance_clearance" in checklist
        assert "government_noc" in checklist
        assert "bank_noc" in checklist
        assert len(checklist) == 9

        # Security deposit refund
        checklist = engine.get_release_checklist("refund", "security_deposit_refund")
        assert "term_completed_verified" in checklist
        assert "no_dues_certificate" in checklist
        assert "request_letter" in checklist
        assert "affidavit_6" in checklist
        assert "latest_loa_eoa" in checklist
        assert "pgrc_clearance" in checklist
        assert "government_noc" in checklist
        assert len(checklist) == 7

        # Check full checklist config
        config = engine.get_release_checklist_config("maturity", "fdr_rpgf")
        assert config["review_path"] == "fdr_rpgf"
        assert config["deadline_days"] == 15

        # Check checklist items with metadata
        items = engine.get_release_checklist_items("maturity", "fdr_rpgf")
        assert len(items) == 10
        mandatory_items = [i for i in items if i.get("mandatory")]
        conditional_items = [i for i in items if not i.get("mandatory")]
        assert len(mandatory_items) == 8
        assert len(conditional_items) == 2

    def test_validation_rules(self):
        """Test validation rules."""
        engine = RuleEngine("config/rules.yaml")

        max_size = engine.get_max_file_size_mb()
        assert max_size == 10

        mime_types = engine.get_allowed_mime_types()
        assert "application/pdf" in mime_types
        assert "image/jpeg" in mime_types
        assert "image/png" in mime_types
        assert "image/tiff" in mime_types

        watermark = engine.is_watermark_demo_enabled()
        assert watermark is True

        # Document requirements per deposit type
        fdr_docs = engine.get_document_requirements("FDR")
        assert "fdr_original" in fdr_docs
        assert "payment_evidence" in fdr_docs
        assert "loa_eoa" in fdr_docs

        rtgs_docs = engine.get_document_requirements("RTGS")
        assert "rtgs_receipt" in rtgs_docs
        assert "payment_evidence" in rtgs_docs
        assert "loa_eoa" in rtgs_docs

        sd_docs = engine.get_document_requirements("SECURITY_DEPOSIT")
        assert "term_completion_certificate" in sd_docs
        assert "no_dues_certificate" in sd_docs
        assert "loa_eoa" in sd_docs

    def test_demo_data(self):
        """Test demo data configuration."""
        engine = RuleEngine("config/rules.yaml")

        institutions = engine.get_demo_institutions()
        assert len(institutions) == 4
        assert institutions[0]["code"] == "DEC001"

        users = engine.get_demo_users()
        assert len(users) == 6
        roles = {u["role"] for u in users}
        assert "institution_rep" in roles
        assert "scrutiny_officer" in roles
        assert "clearance_officer" in roles
        assert "competent_authority" in roles
        assert "system_admin" in roles

        cases = engine.get_demo_cases()
        assert len(cases) == 6
        # Check case numbers
        case_numbers = {c["case_number"] for c in cases}
        assert "FDR-2024-0001" in case_numbers
        assert "RTGS-2024-0002" in case_numbers
        assert "SD-2024-0003" in case_numbers

        # Check seeded discrepancies
        discrepancies = engine.get_seeded_discrepancies()
        assert len(discrepancies) == 3

    def test_institution_types(self):
        """Test institution types list."""
        engine = RuleEngine("config/rules.yaml")
        types = engine.get_institution_types()
        assert "engineering" in types
        assert "management" in types
        assert "government" in types
        assert "government_aided" in types
        assert "private_unaided" in types

    def test_role_permissions(self):
        """Test role permissions."""
        engine = RuleEngine("config/rules.yaml")

        inst_rep_perms = engine.get_role_permissions("INSTITUTION_REP")
        assert "case:create" in inst_rep_perms
        assert "document:upload" in inst_rep_perms

        scrutiny_perms = engine.get_role_permissions("SCRUTINY_OFFICER")
        assert "case:read_assigned" in scrutiny_perms
        assert "clarification:request" in scrutiny_perms

        clearance_perms = engine.get_role_permissions("CLEARANCE_OFFICER")
        assert "clearance:read_queue" in clearance_perms
        assert "clearance:complete" in clearance_perms

        authority_perms = engine.get_role_permissions("COMPETENT_AUTHORITY")
        assert "release:decide" in authority_perms

        admin_perms = engine.get_role_permissions("SYSTEM_ADMIN")
        assert "*" in admin_perms

    def test_condition_evaluation(self):
        """Test condition evaluation."""
        engine = RuleEngine("config/rules.yaml")

        # Test simple condition
        case_data = {"institution_type": "government"}
        result = engine.evaluate_condition("institution_type == 'government' or institution_type == 'government_aided'", case_data)
        assert result is True

        case_data = {"institution_type": "private_unaided"}
        result = engine.evaluate_condition("institution_type == 'government' or institution_type == 'government_aided'", case_data)
        assert result is False

        # Test numeric comparison
        case_data = {"amount": 5000000}
        result = engine.evaluate_condition("amount > 1000000", case_data)
        assert result is True
