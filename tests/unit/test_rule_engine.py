"""Unit tests for RuleEngine."""

import pytest
from backend.services.rule_engine import RuleEngine


class TestRuleEngine:
    """Tests for RuleEngine service."""
    
    def test_load_rules(self):
        """Test that rules load correctly from YAML."""
        engine = RuleEngine("config/rules.yaml")
        
        # Check routing rules
        assert engine.get_scrutiny_assignment_strategy() == "round_robin"
        assert engine.get_scrutiny_auto_assign() is True
        assert engine.get_scrutiny_max_cases() == 50
        
        # Check clearance assignment
        assert engine.get_clearance_assignment_strategy() == "by_type"
        assert engine.get_clearance_default_officer("financial_verification") == "clearance_1"
        
        # Check authority assignment
        assert engine.get_authority_assignment_strategy() == "by_method"
        assert engine.get_authority_for_method("fdr_rpgf") == "authority_1"
        assert engine.get_authority_for_method("rtgs") == "authority_1"
        assert engine.get_authority_for_method("security_deposit_refund") == "authority_1"
    
    def test_deadlines(self):
        """Test deadline configuration."""
        engine = RuleEngine("config/rules.yaml")
        
        scrutiny = engine.get_scrutiny_deadlines()
        assert scrutiny["initial_review_days"] == 5
        assert scrutiny["clarification_response_days"] == 7
        assert scrutiny["max_clarification_rounds"] == 3
        
        clearance = engine.get_clearance_deadlines()
        assert clearance["financial_verification_days"] == 10
        assert clearance["parallel_processing"] is True
        
        release = engine.get_release_decision_deadlines()
        assert release["fdr_rpgf_review_days"] == 15
        
        assert engine.get_case_total_max_days() == 120
    
    def test_document_requirements(self):
        """Test document requirements per deposit type/method."""
        engine = RuleEngine("config/rules.yaml")
        
        # Security deposit FDR/RPGF
        docs = engine.get_required_documents("security_deposit", "fdr_rpgf")
        assert "fdr_certificate" in docs
        assert "bank_confirmation_letter" in docs
        assert "board_resolution" in docs
        assert "latest_loa_eoa" in docs
        assert "audited_financial_statements" in docs
        
        # Conditional documents
        conditional = engine.get_conditional_documents("security_deposit", "fdr_rpgf")
        assert len(conditional) == 2
        
        # Test conditional evaluation
        case_data = {"amount": 6000000, "institution_age": 2}
        all_docs = engine.get_all_required_documents("security_deposit", "fdr_rpgf", case_data)
        assert "independent_valuation_report" in all_docs
        assert "promoter_guarantee" in all_docs
        
        # Security deposit RTGS
        docs = engine.get_required_documents("security_deposit", "rtgs")
        assert "rtgs_remittance_proof" in docs
        assert "bank_confirmation_letter" in docs
    
    def test_release_checklists(self):
        """Test release checklist templates."""
        engine = RuleEngine("config/rules.yaml")
        
        # FDR/RPGF maturity
        checklist = engine.get_release_checklist("maturity", "fdr_rpgf")
        assert "fdr_matured_confirmed" in checklist
        assert "competent_authority_approval" in checklist
        assert len(checklist) == 7
        
        # RTGS maturity
        checklist = engine.get_release_checklist("maturity", "rtgs")
        assert "rtgs_funds_received_confirmed" in checklist
        assert len(checklist) == 5
        
        # Security deposit refund
        checklist = engine.get_release_checklist("refund", "security_deposit_refund")
        assert "term_completed_verified" in checklist
        assert "no_dues_certificate_verified" in checklist
    
    def test_alert_config(self):
        """Test alert configuration."""
        engine = RuleEngine("config/rules.yaml")
        
        lead_days = engine.get_alert_lead_days()
        assert lead_days == [30, 15, 7, 1, 0]
        
        channels = engine.get_alert_channels()
        assert channels["email"] is True
        assert channels["in_app"] is True
        assert channels["webhook"] is False
        
        template = engine.get_alert_template("maturity_approaching")
        assert template["subject"] == "FDR Maturity Approaching - Action Required"
        assert template["urgency"] == "high"
    
    def test_validation_rules(self):
        """Test validation rules."""
        engine = RuleEngine("config/rules.yaml")
        
        amount_val = engine.get_field_validation("amount")
        assert amount_val["min"] == 1000
        assert amount_val["max"] == 1000000000
        assert amount_val["currency"] == "INR"
        
        instrument_val = engine.get_field_validation("instrument_number")
        assert instrument_val["pattern"] == "^[A-Z0-9\\-]+$"
        
        cross_field = engine.get_cross_field_validations()
        assert len(cross_field) == 3
        assert cross_field[0]["name"] == "maturity_after_creation"
    
    def test_demo_data(self):
        """Test demo data configuration."""
        engine = RuleEngine("config/rules.yaml")
        
        institutions = engine.get_demo_institutions()
        assert len(institutions) == 3
        assert institutions[0]["code"] == "DEC001"
        
        users = engine.get_demo_users()
        assert len(users) == 8
        roles = {u["role"] for u in users}
        assert "institution_rep" in roles
        assert "scrutiny_officer" in roles
        assert "clearance_officer" in roles
        assert "competent_authority" in roles
        assert "system_admin" in roles
        
        scenarios = engine.get_demo_case_scenarios()
        assert len(scenarios) == 5
        assert scenarios[0]["name"] == "Standard FDR Maturity"
        assert scenarios[2]["clarification_scenario"] is not None