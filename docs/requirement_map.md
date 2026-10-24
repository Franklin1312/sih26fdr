# SIH26265 - Requirement Map

**Document Version:** 1.0  
**Date:** 2024  
**Status:** Draft  

This document maps every Problem Statement (PS) requirement to a specific screen, backend rule, and test case. This ensures traceability from requirements to implementation.

---

## 1. Core Workflow Requirements

| PS Requirement ID | Description | Frontend Screen | Backend Rule/Service | Test Case |
|-------------------|-------------|-----------------|---------------------|-----------|
| **PS-01** | Institution representative can register a new security deposit/FDR case | `/institution/dashboard` → "Register Deposit" wizard | `CaseService.create_case()` + `validation_engine.validate_submission()` | `test_create_case_draft` |
| **PS-02** | Multi-step guided submission wizard (4 steps) | `/institution/wizard/step1` → step2 → step3 → step4 | `WizardService` with step validation | `test_wizard_step_validation` |
| **PS-03** | Completeness check validates required fields/documents before submit | Wizard step 3 review screen | `ValidationEngine.check_completeness()` using `rules.yaml` document_requirements | `test_completeness_check_missing_docs` |
| **PS-04** | Case submission moves status DRAFT → SUBMITTED | Wizard step 4 submit button | `CaseService.submit_case()` with transition validation | `test_submit_case_transition` |
| **PS-05** | Scrutiny officer reviews case, records observations | `/scrutiny/queue` → case detail | `CaseService.transition_case_status()` + `access_control.can_transition_case_status()` | `test_scrutiny_review` |
| **PS-06** | Scrutiny officer can request clarification with specific reasons | `/scrutiny/case/{id}/clarify` | `CaseService.create_clarification()` + `ClarificationRequest` model | `test_create_clarification` |
| **PS-07** | Institution responds to clarification, preserves history | `/institution/case/{id}/clarifications` | `CaseService.respond_clarification()` | `test_respond_clarification` |
| **PS-08** | Case moves through explicit states: DRAFT → SUBMITTED → UNDER_SCRUTINY → CLARIFICATION_PENDING → CLEARANCE_QUEUE → CLEARED → RELEASE_REQUESTED → REVIEW → FINAL_DECISION → RELEASED | Status badge on all case views | `VALID_TRANSITIONS` in `enums.py` + `access_control.can_transition_case_status()` | `test_all_valid_transitions` |
| **PS-09** | Invalid state transitions are rejected | Backend validation | `can_transition()` function + API returns 400 | `test_invalid_transition_rejected` |

---

## 2. Document Management Requirements

| PS Requirement ID | Description | Frontend Screen | Backend Rule/Service | Test Case |
|-------------------|-------------|-----------------|---------------------|-----------|
| **PS-10** | Private document upload with validation | `/institution/case/{id}/documents/upload` | `FileStorageService.upload()` + `validation_engine.validate_file()` | `test_upload_document` |
| **PS-11** | File validation: MIME type, size limit (10MB), virus scan stub | Upload component | `FileStorageService.validate_upload()` | `test_file_validation` |
| **PS-12** | Document versioning: replace preserves original, increments version | Document history panel | `DepositEvidence.version`, `replaced_by_id`, `replaces` relationship | `test_document_versioning` |
| **PS-13** | OCR text extraction (advisory only) | Document viewer with OCR text | `OCRService.extract_text()` + model fields `ocr_text`, `ocr_confidence` | `test_ocr_extraction` |
| **PS-14** | Validation flags from OCR/extraction shown to reviewer | Document detail with flags | `DepositEvidence.validation_flags`, `extracted_data` | `test_validation_flags` |
| **PS-15** | Watermarked demo documents | All demo uploads | `FileStorageService.add_watermark()` | `test_demo_watermark` |

---

## 3. Clearance & Release Requirements

| PS Requirement ID | Description | Frontend Screen | Backend Rule/Service | Test Case |
|-------------------|-------------|-----------------|---------------------|-----------|
| **PS-16** | Separate clearance tasks per type (financial, legal, technical) | `/clearance/queue` → task detail | `ClearanceTask` model + `CaseService._create_default_clearance_tasks()` | `test_clearance_tasks_created` |
| **PS-17** | Clearance tasks block release until all CLEARED | Release request blocked UI | `CaseService.transition_case_status()` checks all clearances | `test_clearance_blocks_release` |
| **PS-18** | Dual release paths: FDR/RPGF vs RTGS vs Security Deposit Refund | Authority dashboard shows path | `DepositMethod` enum + `CaseService._create_release_review_task()` routing | `test_dual_release_paths` |
| **PS-19** | Conditional release checklist based on request type + deposit method | Authority review with checklist | `ChecklistEngine.generate_checklist()` from `rules.yaml` release_checklists | `test_dynamic_checklist` |
| **PS-20** | Final decision recorded with reasoning (RELEASE/REJECT/RETURN) | Authority decision modal | `ReleaseRequest.final_decision`, `decision_reasoning`, `decided_by` | `test_final_decision_recording` |
| **PS-21** | Separate date tracking: FDR maturity, AICTE term end, admin deadlines | Dashboard upcoming dates | `LifecycleDate` model with `LifecycleDateType` enum | `test_lifecycle_dates_created` |
| **PS-22** | Configurable alert lead days (30, 15, 7, 1, 0) | Alert notifications | `AlertScheduler` + `rules.yaml` alerts.lead_days | `test_alert_scheduler` |
| **PS-23** | Renewal/replacement links to prior instrument, preserves history | Renewal/Replacement wizard | `DepositCase.parent_case_id` self-referential FK | `test_renewal_links_parent` |
---

## 4. Access Control & Security Requirements

| PS Requirement ID | Description | Frontend Screen | Backend Rule/Service | Test Case |
|-------------------|-------------|-----------------|---------------------|-----------|
| **PS-24** | Role-based permissions: Institution Rep, Scrutiny Officer, Clearance Officer, Competent Authority, System Admin | Role-specific dashboards | `ROLE_PERMISSIONS` in `access_control.py` | `test_role_permissions` |
| **PS-25** | Institution-level data isolation | All screens | `access_control.can_access_case()` + middleware | `test_institution_isolation` |
| **PS-26** | JWT authentication (production) / Demo token (development) | Login page | `AuthService` with DEMO_MODE toggle | `test_auth_modes` |
| **PS-27** | Audit trail: hash-chained, tamper-evident | Admin audit viewer | `AuditService` with SHA256 chain + Ed25519 checkpoints | `test_audit_chain_integrity` |
| **PS-28** | Demo mode: synthetic data, labeled, no real PII | All demo data | `is_demo` flag on all entities + `DEMO_MODE` config | `test_demo_data_labeled` |

---

## 5. Dashboard & Reporting Requirements

| PS Requirement ID | Description | Frontend Screen | Backend Rule/Service | Test Case |
|-------------------|-------------|-----------------|---------------------|-----------|
| **PS-29** | Institution Rep dashboard: Register deposit, Needs my action, Track case, Upcoming deadlines | `/institution/dashboard` | `CaseService.get_dashboard_stats()` + `DepositCaseDashboardStats` schema | `test_institution_dashboard` |
| **PS-30** | Officer work queue: Assigned cases, Pending clearances, Clarification cases, Overdue | `/scrutiny/queue`, `/clearance/queue` | `CaseService.list_cases()` with role filters | `test_officer_queues` |
| **PS-31** | Authority dashboard: Release decisions, Final authority actions | `/authority/dashboard` | `CaseService.list_cases()` with authority filter | `test_authority_dashboard` |
| **PS-32** | Dashboard counts match underlying records | All dashboards | `CaseService.get_dashboard_stats()` aggregates from DB | `test_dashboard_accuracy` |

---

## 6. Demo & Testing Requirements

| PS Requirement ID | Description | Frontend Screen | Backend Rule/Service | Test Case |
|-------------------|-------------|-----------------|---------------------|-----------|
| **PS-33** | Synthetic institutions, users, cases, documents | N/A (backend) | `scripts/seed_demo.py` using `rules.yaml` demo config | `test_seed_demo` |
| **PS-34** | Repeatable demo script with simulated external responses | Demo script runner | `scripts/run_demo.py` (future) | `test_demo_script` |
| **PS-35** | Reset/replay capability | Admin panel | `scripts/reset_demo.py` | `test_reset_demo` |
| **PS-36** | All demo data visibly labeled | All screens | `is_demo=True` flag, watermarked docs | `test_demo_labeling` |

---

## 7. Configuration & Guardrails Requirements

| PS Requirement ID | Description | Frontend Screen | Backend Rule/Service | Test Case |
|-------------------|-------------|-----------------|---------------------|-----------|
| **PS-37** | Unconfirmed internal routing/deadlines configurable (not hardcoded) | Admin config page | `RuleEngine` loads from `config/rules.yaml` | `test_configurable_rules` |
| **PS-38** | Document checklists conditional on deposit method, request type, circumstances | Authority review | `ChecklistEngine` + `rules.yaml` release_checklists | `test_conditional_checklists` |
| **PS-39** | OCR/validation/anomaly findings are advisory only (human authority) | Review screens show "Advisory" badges | UI labels + backend never auto-approves | `test_advisory_only` |
| **PS-40** | No live bank verification without authorized integration | N/A | Stub service in `bank_verification.py` | `test_bank_verification_stub` |
| **PS-41** | No AICTE integration without approved access | N/A | Stub service in `aicte_integration.py` | `test_aicte_integration_stub` |

---

## 8. Traceability Matrix Summary

| Category | Requirements | Screens | Backend Rules | Tests |
|----------|-------------|---------|---------------|-------|
| Core Workflow | 9 | 4 | 5 | 9 |
| Document Management | 6 | 2 | 4 | 6 |
| Clearance & Release | 8 | 3 | 6 | 8 |
| Access Control & Security | 5 | 1 | 4 | 5 |
| Dashboard & Reporting | 4 | 4 | 2 | 4 |
| Demo & Testing | 4 | 1 | 3 | 4 |
| Configuration & Guardrails | 5 | 1 | 4 | 5 |
| **TOTAL** | **41** | **16** | **28** | **41** |

---

## 9. Implementation Status Tracking

| Phase | Requirements Covered | Implementation Status |
|-------|---------------------|----------------------|
| Phase 0 | PS-37, PS-33, PS-35 | ✅ Complete (rules.yaml, seed_demo.py, reset_demo.py) |
| Phase 1 | PS-24, PS-25, PS-10, PS-29 | 🟡 Partial (models done, routes/services needed) |
| Phase 2 | PS-01 to PS-09, PS-06, PS-07 | 🟡 Partial (state machine done, wizard/clarification routes needed) |
| Phase 3 | PS-16 to PS-20 | 🟡 Partial (models done, clearance/release routes needed) |
| Phase 4 | PS-21, PS-22, PS-23 | 🟡 Partial (models done, alert scheduler needed) |
| Phase 5 | PS-13, PS-14, PS-39 | ❌ Not started (OCR, validation engine, anomaly detector) |
| Phase 6 | PS-29 to PS-32, PS-34, PS-36 | ❌ Not started (Streamlit frontend) |

---

## 10. Notes

1. **All unconfirmed internal routing and deadlines** are in `config/rules.yaml` - NOT hardcoded
2. **Demo data only** - all institutions, users, cases, documents are synthetic and labeled
3. **Human authority preserved** - OCR, validation rules, anomaly scores are advisory only
4. **Separate dates tracked** - FDR maturity, AICTE term, admin deadlines are distinct
5. **Audit trail immutable** - hash-chained with Ed25519 checkpoint signatures

---

*End of Requirement Map*