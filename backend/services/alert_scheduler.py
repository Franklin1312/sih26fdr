"""Alert Scheduler Service - Automated lifecycle date monitoring and notifications."""

import logging
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Dict, Any
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from backend.config import get_settings
from backend.database import get_db_context
from backend.models import LifecycleDate, DepositCase, Institution
from backend.models.enums import LifecycleDateType, AuditAction
from backend.services.rule_engine import get_rule_engine
from backend.services.audit_service import audit_service

settings = get_settings()
logger = logging.getLogger("sih26psfdr.alert_scheduler")


class AlertSchedulerService:
    """Service for scheduling and running automated alert checks."""

    def __init__(self):
        self.scheduler = AsyncIOScheduler()
        self.rule_engine = get_rule_engine()
        self._is_running = False

    async def start(self) -> None:
        """Start the alert scheduler."""
        if self._is_running:
            logger.warning("Alert scheduler already running")
            return

        interval_hours = settings.alert_check_interval_hours
        self.scheduler.add_job(
            self.check_and_send_alerts,
            trigger=IntervalTrigger(hours=interval_hours),
            id="alert_check",
            name="Check lifecycle dates and send alerts",
            replace_existing=True,
        )
        self.scheduler.start()
        self._is_running = True
        logger.info(f"Alert scheduler started with {interval_hours}h interval")

    async def stop(self) -> None:
        """Stop the alert scheduler."""
        if not self._is_running:
            return

        self.scheduler.shutdown(wait=True)
        self._is_running = False
        logger.info("Alert scheduler stopped")
    async def check_and_send_alerts(self) -> int:
        """
        Check for due alerts and send them.
        This is the main job function called by the scheduler.
        """
        logger.info("Running scheduled alert check...")
        async with get_db_context() as db:
            return await self._check_and_send_alerts(db)

    async def _check_and_send_alerts(self, db: AsyncSession) -> int:
        """Check for due alerts and send them (internal method with db session)."""
        now = datetime.now(timezone.utc)
        lead_days = self.rule_engine.get_alert_advance_days()
        dedupe_hours = self.rule_engine.get_alert_dedupe_hours()

        logger.info(f"Checking alerts as of {now.isoformat()}")
        logger.info(f"Alert lead days: {lead_days}")
        logger.info(f"Deduplication window: {dedupe_hours}h")

        alerts_sent = 0

        for lead_day in lead_days:
            target_date = now + timedelta(days=lead_day)
            window_start = target_date.replace(hour=0, minute=0, second=0, microsecond=0)
            window_end = window_start.replace(hour=23, minute=59, second=59, microsecond=999999)

            result = await db.execute(
                select(LifecycleDate).where(
                    and_(
                        LifecycleDate.date_value >= window_start,
                        LifecycleDate.date_value <= window_end,
                        LifecycleDate.alert_sent == False,  # noqa: E712
                    )
                )
            )
            due_dates = result.scalars().all()

            for ld in due_dates:
                if ld.alert_sent_at:
                    time_since_last = now - ld.alert_sent_at
                    if time_since_last < timedelta(hours=dedupe_hours):
                        logger.debug(f"Skipping alert for {ld.id} - sent {time_since_last} ago (dedupe: {dedupe_hours}h)")
                        continue

                case_result = await db.execute(
                    select(DepositCase).where(DepositCase.id == ld.case_id)
                )
                case = case_result.scalar_one_or_none()

                if not case:
                    logger.warning(f"Case {ld.case_id} not found for lifecycle date {ld.id}")
                    continue

                inst_result = await db.execute(
                    select(Institution).where(Institution.id == case.institution_id)
                )
                institution = inst_result.scalar_one_or_none()

                template_map = {
                    LifecycleDateType.FDR_MATURITY: "maturity_approaching",
                    LifecycleDateType.AICTE_TERM_END: "term_ending",
                    LifecycleDateType.RENEWAL_DUE: "term_ending",
                    LifecycleDateType.ADMIN_DEADLINE: "overdue_clearance",
                }
                template_name = template_map.get(ld.date_type, "maturity_approaching")
                template = self.rule_engine.get_alert_template(template_name)

                subject = template.get("subject", "Alert").format(
                    case_number=case.tracking_ref,
                    institution=institution.name if institution else "Unknown",
                    date_type=ld.date_type.value,
                    days=lead_day,
                    date=ld.date_value.strftime("%Y-%m-%d"),
                )
                body = template.get("body", "").format(
                    case_number=case.tracking_ref,
                    institution=institution.name if institution else "Unknown",
                    date_type=ld.date_type.value,
                    days=lead_day,
                    date=ld.date_value.strftime("%Y-%m-%d"),
                    amount=f"{case.amount:,.2f}" if case.amount else "N/A",
                )

                logger.info(f"ALERT TRIGGERED:")
                logger.info(f"  Case: {case.tracking_ref}")
                logger.info(f"  Institution: {institution.name if institution else 'Unknown'}")
                logger.info(f"  Date Type: {ld.date_type.value}")
                logger.info(f"  Due Date: {ld.date_value.date()}")
                logger.info(f"  Lead Days: {lead_day}")
                logger.info(f"  Subject: {subject}")
                logger.info(f"  Urgency: {template.get('urgency', 'medium')}")

                await self._create_notification(db, case, ld, subject, body, template.get("urgency", "medium"))

                ld.alert_sent = True
                ld.alert_sent_at = now
                ld.alert_lead_days = lead_day

                alerts_sent += 1

            await db.flush()

        logger.info(f"Alert check complete! Sent {alerts_sent} alert(s).")
        return alerts_sent
    async def _create_notification(
        self,
        db: AsyncSession,
        case: DepositCase,
        lifecycle_date: LifecycleDate,
        subject: str,
        body: str,
        urgency: str,
    ) -> None:
        """Create an in-app notification record (stored in audit log for now)."""
        await audit_service.log_event(
            db=db,
            entity_type="alert_notification",
            entity_id=lifecycle_date.id,
            action=AuditAction.ALERT_SENT,
            actor_id="admin_1",
            old_values=None,
            new_values={
                "case_id": case.id,
                "case_number": case.tracking_ref,
                "lifecycle_date_id": lifecycle_date.id,
                "date_type": lifecycle_date.date_type.value,
                "subject": subject,
                "body": body,
                "urgency": urgency,
                "lead_days": lifecycle_date.alert_lead_days,
            },
        )

    async def run_manual_check(self) -> int:
        """Manually trigger an alert check (for testing/admin)."""
        logger.info("Manual alert check triggered")
        async with get_db_context() as db:
            return await self._check_and_send_alerts(db)

    def get_status(self) -> Dict[str, Any]:
        """Get scheduler status."""
        jobs = []
        for job in self.scheduler.get_jobs():
            jobs.append({
                "id": job.id,
                "name": job.name,
                "next_run": job.next_run_time.isoformat() if job.next_run_time else None,
            })
        return {
            "running": self._is_running,
            "interval_hours": settings.alert_check_interval_hours,
            "jobs": jobs,
        }


# Module-level singleton
_alert_scheduler: Optional[AlertSchedulerService] = None


def get_alert_scheduler() -> AlertSchedulerService:
    """Get cached alert scheduler instance."""
    global _alert_scheduler
    if _alert_scheduler is None:
        _alert_scheduler = AlertSchedulerService()
    return _alert_scheduler
