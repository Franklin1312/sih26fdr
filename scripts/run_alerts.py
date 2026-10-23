#!/usr/bin/env python3
"""Run Alerts Script - Manually triggers alert checks for lifecycle dates."""

import asyncio
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from backend.config import get_settings
from backend.database import init_db, get_db_context
from backend.models import LifecycleDate, DepositCase, Institution
from backend.models.enums import LifecycleDateType
from backend.services.rule_engine import get_rule_engine
from sqlalchemy import select, and_


async def check_and_send_alerts(db, rule_engine):
    """Check for due alerts and send them."""
    now = datetime.now(timezone.utc)
    lead_days = rule_engine.get_alert_lead_days()
    
    print(f"Checking alerts as of {now.isoformat()}")
    print(f"Alert lead days: {lead_days}")
    
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
                    LifecycleDate.alert_sent == False,
                )
            )
        )
        due_dates = result.scalars().all()
        
        for ld in due_dates:
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
            institution = inst_result.scalar_one_or_none()
            
            # Get alert template
            template_map = {
                LifecycleDateType.FDR_MATURITY: "maturity_approaching",
                LifecycleDateType.AICTE_TERM_END: "term_ending",
                LifecycleDateType.RENEWAL_DUE: "term_ending",
                LifecycleDateType.ADMIN_DEADLINE: "overdue_clearance",
            }
            template_name = template_map.get(ld.date_type, "maturity_approaching")
            template = rule_engine.get_alert_template(template_name)
            
            # In demo mode, just log the alert
            print(f"\nALERT TRIGGERED:")
            print(f"  Case: {case.tracking_ref}")
            print(f"  Institution: {institution.name if institution else 'Unknown'}")
            print(f"  Date Type: {ld.date_type.value}")
            print(f"  Due Date: {ld.date_value.date()}")
            print(f"  Lead Days: {lead_day}")
            print(f"  Template: {template_name}")
            print(f"  Subject: {template.get('subject', 'N/A')}")
            print(f"  Urgency: {template.get('urgency', 'medium')}")
            
            # Mark alert as sent
            ld.alert_sent = True
            ld.alert_sent_at = now
            ld.alert_lead_days = lead_day
            
            alerts_sent += 1
    
    await db.flush()
    return alerts_sent


async def main():
    """Main function."""
    print("=" * 60)
    print("SIH26265 - Running Alert Checks")
    print("=" * 60)
    
    await init_db()
    print("Database initialized")
    
    rule_engine = get_rule_engine()
    
    async with get_db_context() as db:
        alerts_sent = await check_and_send_alerts(db, rule_engine)
        
        print("\n" + "=" * 60)
        print(f"Alert check complete! Sent {alerts_sent} alert(s).")
        print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())