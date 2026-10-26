#!/usr/bin/env python3
"""Run Alerts Script - Manually triggers alert checks for lifecycle dates."""

import asyncio
import sys
from datetime import UTC, datetime, timedelta
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import and_, select

from backend.database import get_db_context, init_db
from backend.models import DepositCase, Institution, LifecycleDate
from backend.models.enums import LifecycleDateType
from backend.services.rule_engine import get_rule_engine


async def check_and_send_alerts(db, rule_engine):
    """Check for due alerts and send them."""
    now = datetime.now(UTC)
    lead_days = rule_engine.get_alert_advance_days()


    # Calculate date thresholds for each lead day
    alerts_sent = 0

    for lead_day in lead_days:
        target_date = now + timedelta(days=lead_day)
        # Check for lifecycle dates within a small window around target_date
        window_start = target_date.replace(hour=0, minute=0, second=0, microsecond=0)
        window_end = window_start.replace(hour=23, minute=59, second=59, microsecond=999999)

        result = await db.execute(
            select(LifecycleDate).where(
                and_(
                    LifecycleDate.date_value >= window_start,
                    LifecycleDate.date_value <= window_end,
                )
            )
        )
        due_dates = result.scalars().all()

        for ld in due_dates:
            # A lifecycle date may emit one reminder per configured lead day;
            # suppress only a duplicate invocation for this same lead day.
            if ld.alert_sent_at and ld.alert_lead_days == lead_day and now - ld.alert_sent_at < timedelta(hours=rule_engine.get_alert_dedupe_hours()):
                continue
            # Get case and institution info
            case_result = await db.execute(
                select(DepositCase).where(DepositCase.id == ld.case_id)
            )
            case = case_result.scalar_one_or_none()

            if not case:
                continue

            inst_result = await db.execute(
                select(Institution).where(Institution.id == case.institution_id)
            )
            inst_result.scalar_one_or_none()

            # Get alert template
            template_map = {
                LifecycleDateType.FDR_MATURITY: "maturity_approaching",
                LifecycleDateType.AICTE_TERM_END: "term_ending",
                LifecycleDateType.RENEWAL_DUE: "term_ending",
                LifecycleDateType.ADMIN_DEADLINE: "overdue_clearance",
            }
            template_name = template_map.get(ld.date_type, "maturity_approaching")
            rule_engine.get_alert_template(template_name)

            # In demo mode, just log the alert

            # Mark the lead-day reminder as sent after rendering the normalized
            # structured template.
            ld.alert_sent = True
            ld.alert_sent_at = now
            ld.alert_lead_days = lead_day

            alerts_sent += 1

    await db.flush()
    return alerts_sent


async def main():
    """Main function."""

    await init_db()

    rule_engine = get_rule_engine()

    async with get_db_context() as db:
        await check_and_send_alerts(db, rule_engine)



if __name__ == "__main__":
    asyncio.run(main())
