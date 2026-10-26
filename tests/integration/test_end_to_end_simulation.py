"""Regression coverage for the nine-step demo simulation."""

from datetime import datetime, timezone, timedelta

import pytest


PDF_FILE = ("simulation.pdf", b"%PDF-1.4\n% simulated workflow evidence\n", "application/pdf")


ROLE_BY_USER = {
    "user_test_rep": "institution_rep",
    "scrutiny_1": "scrutiny_officer",
    "clearance_1": "clearance_officer",
    "approval_bureau_1": "approval_bureau",
    "council_1": "council",
    "authority_1": "competent_authority",
}


def _headers(user_id: str) -> dict[str, str]:
    # The isolated integration database uses registered test principals rather
    # than the application's fixed demo-account IDs.
    return {"Authorization": f"Bearer {user_id}:{ROLE_BY_USER[user_id]}"}


async def _upload(client, case_id: str, user_id: str, document_type: str):
    return await client.post(
        "/api/v1/cases/evidence",
        headers=_headers(user_id),
        data={"case_id": case_id, "document_type": document_type},
        files={"file": PDF_FILE},
    )


@pytest.mark.asyncio
async def test_fdr_simulation_reaches_council_sanction_with_audit_history(
    client, test_db, demo_institution, demo_user
):
    """Every persona handoff completes through final simulated NOC output."""
    from backend.models import User
    from backend.models.enums import UserRole
    from backend.services.access_control import access_control
    from backend.schemas.institution import CurrentUserResponse

    test_db.add(demo_institution)
    test_db.add(demo_user)
    for user_id, role in (
        ("scrutiny_1", UserRole.SCRUTINY_OFFICER),
        ("clearance_1", UserRole.CLEARANCE_OFFICER),
        ("approval_bureau_1", UserRole.APPROVAL_BUREAU),
        ("council_1", UserRole.COUNCIL),
        ("authority_1", UserRole.COMPETENT_AUTHORITY),
    ):
        test_db.add(User(
            id=user_id,
            email=f"{user_id}@demo.example",
            full_name=user_id,
            role=role,
            is_active=True,
            password_hash="demo",
        ))
    await test_db.flush()
    for user in (demo_user,):
        access_control.register_user(CurrentUserResponse(
            user_id=user.id, email=user.email, full_name=user.full_name,
            role=user.role, institution_id=user.institution_id, is_active=True,
        ))
    for user_id, role in (
        ("scrutiny_1", UserRole.SCRUTINY_OFFICER),
        ("clearance_1", UserRole.CLEARANCE_OFFICER),
        ("approval_bureau_1", UserRole.APPROVAL_BUREAU),
        ("council_1", UserRole.COUNCIL),
        ("authority_1", UserRole.COMPETENT_AUTHORITY),
    ):
        access_control.register_user(CurrentUserResponse(
            user_id=user_id, email=f"{user_id}@demo.example", full_name=user_id,
            role=role, institution_id=None, is_active=True,
        ))

    create = await client.post("/api/v1/cases", headers=_headers(demo_user.id), json={
        "institution_id": demo_institution.id, "deposit_type": "fdr",
        "deposit_method": "fdr_rpgf", "amount": "1500000.00", "currency": "INR",
        "instrument_number": "FDR-E2E-001", "issuing_bank": "State Bank of India",
        "instrument_date": datetime.now(timezone.utc).date().isoformat(),
        "maturity_date": (datetime.now(timezone.utc) + timedelta(days=365 * 8)).date().isoformat(),
    })
    assert create.status_code == 201, create.text
    case_id = create.json()["id"]

    for document_type in ("fdr_original", "payment_proof", "loa_eoa"):
        response = await _upload(client, case_id, demo_user.id, document_type)
        assert response.status_code == 201, response.text
    assert (await client.post(f"/api/v1/wizard/{case_id}/step3", headers=_headers(demo_user.id), json={"confirmed": True, "terms_accepted": True})).status_code == 200
    assert (await client.post(f"/api/v1/wizard/{case_id}/submit", headers=_headers(demo_user.id))).json()["success"] is True

    claim = await client.post(f"/api/v1/scrutiny/cases/{case_id}/claim", headers=_headers("scrutiny_1"))
    assert claim.status_code == 200, claim.text
    scrutiny_detail = await client.get(f"/api/v1/scrutiny/cases/{case_id}", headers=_headers("scrutiny_1"))
    assert scrutiny_detail.status_code == 200, scrutiny_detail.text
    assert {document["document_type"] for document in scrutiny_detail.json()["documents"]} >= {
        "fdr_original", "payment_proof", "loa_eoa",
    }
    clarification = await client.post(f"/api/v1/scrutiny/cases/{case_id}/clarifications", headers=_headers("scrutiny_1"), json={"case_id": case_id, "question": "Correct the evidence"})
    assert clarification.status_code == 200, clarification.text
    response = await client.post(f"/api/v1/clarifications/{clarification.json()['id']}/respond", headers=_headers(demo_user.id), json={"response": "Corrected evidence supplied"})
    assert response.status_code == 200, response.text
    response = await client.post(f"/api/v1/scrutiny/cases/{case_id}/review", headers=_headers("scrutiny_1"), json={"new_status": "clearance_queue", "reason": "Scrutiny complete"})
    assert response.status_code == 200, response.text

    claim = await client.post(f"/api/v1/clearance/cases/{case_id}/claim", headers=_headers("clearance_1"), json={})
    assert claim.status_code == 200, claim.text
    queue = await client.get("/api/v1/clearance/queue", headers=_headers("clearance_1"))
    assert queue.status_code == 200, queue.text
    tasks = queue.json()["items"][0]["clearance_tasks"]
    assert len(tasks) == 3
    for task in tasks:
        response = await client.post(f"/api/v1/clearance/tasks/{task['id']}/complete", headers=_headers("clearance_1"), json={"evidence": "SIM-CLEARANCE-EVIDENCE", "notes": "Passed"})
        assert response.status_code == 200, response.text

    for document_type in ("bank_certificate", "request_letter", "affidavit"):
        response = await _upload(client, case_id, demo_user.id, document_type)
        assert response.status_code == 201, response.text
    release = await client.post("/api/v1/release/request", headers=_headers(demo_user.id), json={"case_id": case_id, "request_type": "maturity"})
    assert release.status_code == 200, release.text
    decision = await client.post(f"/api/v1/release/cases/{case_id}/decide", headers=_headers("authority_1"), json={"final_decision": "release", "decision_reasoning": "All simulated requirements complete"})
    assert decision.status_code == 200, decision.text
    noc = await _upload(client, case_id, "approval_bureau_1", "approval_bureau_noc")
    assert noc.status_code == 201, noc.text
    noc_stage = await client.get(f"/api/v1/cases/{case_id}", headers=_headers(demo_user.id))
    assert noc_stage.json()["status"] == "noc_issued"
    council_sanction = await _upload(client, case_id, "council_1", "council_sanction_order")
    assert council_sanction.status_code == 201, council_sanction.text

    final_case = await client.get(f"/api/v1/cases/{case_id}", headers=_headers(demo_user.id))
    assert final_case.status_code == 200
    assert final_case.json()["status"] == "sanctioned"
    audit = await client.get(f"/api/v1/audit/cases/{case_id}", headers=_headers(demo_user.id))
    assert audit.status_code == 200
    assert audit.json()
