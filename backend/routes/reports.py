"""Scoped management reports."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db
from backend.models import DepositCase
from backend.models.enums import CaseStatus, UserRole
from backend.routes.cases import get_user_context
from backend.schemas.reports import ReportCaseRow, ReportsSummary
from backend.services.access_control import UserContext

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/summary", response_model=ReportsSummary)
async def get_reports_summary(
    db: AsyncSession = Depends(get_db),
    user: UserContext = Depends(get_user_context),
) -> ReportsSummary:
    """Return the operational reports visible to the authenticated persona."""
    query = select(DepositCase).options(
        selectinload(DepositCase.institution),
        selectinload(DepositCase.evidence),
    )
    if UserRole.INSTITUTION_REP in user.roles:
        query = query.where(DepositCase.institution_id == user.institution_id)
    elif UserRole.SCRUTINY_OFFICER in user.roles or UserRole.CLEARANCE_OFFICER in user.roles:
        query = query.where(DepositCase.assigned_officer_id == user.user_id)

    result = await db.execute(query.order_by(DepositCase.maturity_date.asc(), DepositCase.created_at.desc()))
    cases = result.scalars().unique().all()
    now = datetime.now(timezone.utc)
    rows: list[ReportCaseRow] = []

    pending_statuses = {
        CaseStatus.SUBMITTED,
        CaseStatus.UNDER_SCRUTINY,
        CaseStatus.CLARIFICATION_PENDING,
    }
    intervention_statuses = {
        CaseStatus.CLARIFICATION_PENDING,
        CaseStatus.REJECTED,
        CaseStatus.CLEARANCE_QUEUE,
    }

    for case in cases:
        maturity = case.maturity_date
        if maturity and maturity.tzinfo is None:
            maturity = maturity.replace(tzinfo=timezone.utc)
        days = int((maturity - now).total_seconds() // 86400) if maturity else None
        missing = [] if case.evidence else ["Evidence package"]
        reason = None
        if case.status == CaseStatus.CLARIFICATION_PENDING:
            reason = "Institution clarification is pending"
        elif case.status == CaseStatus.CLEARANCE_QUEUE:
            reason = "Clearance action is pending"
        elif case.status == CaseStatus.REJECTED:
            reason = "Case was rejected and needs review"
        elif days is not None and days < 0 and case.status not in {
            CaseStatus.RELEASED,
            CaseStatus.CLOSED,
        }:
            reason = "Instrument maturity date has passed"

        rows.append(
            ReportCaseRow(
                case_id=case.id,
                case_number=case.tracking_ref,
                institution_name=case.institution.name if case.institution else "Unknown institution",
                instrument_number=case.instrument_number,
                amount=float(case.amount),
                status=case.status.value,
                maturity_date=maturity,
                days_to_maturity=days,
                missing_documents=missing,
                requires_intervention=reason is not None,
                intervention_reason=reason,
            )
        )

    return ReportsSummary(
        generated_at=now,
        total_cases=len(rows),
        total_amount=sum(row.amount for row in rows),
        pending_verification=sum(case.status in pending_statuses for case in cases),
        upcoming_maturities=sum(
            row.days_to_maturity is not None and 0 <= row.days_to_maturity <= 30
            for row in rows
        ),
        missing_documents=sum(bool(row.missing_documents) for row in rows),
        requiring_intervention=sum(row.requires_intervention for row in rows),
        cases=rows,
    )
