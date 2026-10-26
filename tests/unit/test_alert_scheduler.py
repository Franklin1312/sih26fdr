"""Unit tests for AlertSchedulerService."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from backend.services.alert_scheduler import AlertSchedulerService


class TestAlertSchedulerService:
    """Tests for AlertSchedulerService."""

    @pytest.fixture
    def scheduler(self):
        """Create a scheduler instance with mocked dependencies."""
        with patch('backend.services.alert_scheduler.get_settings') as mock_settings, \
             patch('backend.services.alert_scheduler.get_rule_engine') as mock_rule_engine, \
             patch('backend.services.alert_scheduler.get_db_context') as mock_db_context, \
             patch('backend.services.alert_scheduler.audit_service') as mock_audit:

            mock_settings.return_value.alert_check_interval_hours = 24
            mock_rule_engine.return_value.get_alert_advance_days.return_value = [30, 15, 7, 1]
            mock_rule_engine.return_value.get_alert_dedupe_hours.return_value = 24
            mock_rule_engine.return_value.get_alert_template.return_value = {
                "subject": "Test Alert: {case_number}",
                "body": "Alert for {case_number}",
                "urgency": "medium"
            }

            # Mock database context
            mock_db = AsyncMock()
            mock_db.execute = AsyncMock()
            mock_db.flush = AsyncMock()
            mock_db_context.return_value.__aenter__ = AsyncMock(return_value=mock_db)
            mock_db_context.return_value.__aexit__ = AsyncMock(return_value=None)

            mock_audit.log_event = AsyncMock()

            scheduler = AlertSchedulerService()
            yield scheduler

    def test_initialization(self, scheduler):
        """Test scheduler initializes correctly."""
        assert scheduler._is_running is False
        assert scheduler.scheduler is not None
        assert scheduler.rule_engine is not None

    @pytest.mark.asyncio
    async def test_start_stop(self, scheduler):
        """Test starting and stopping the scheduler."""
        # Start
        await scheduler.start()
        assert scheduler._is_running is True
        assert len(scheduler.scheduler.get_jobs()) == 1
        job = scheduler.scheduler.get_jobs()[0]
        assert job.id == "alert_check"

        # Stop
        await scheduler.stop()
        assert scheduler._is_running is False

    @pytest.mark.asyncio
    async def test_start_already_running(self, scheduler):
        """Test starting when already running logs warning."""
        await scheduler.start()
        with patch('backend.services.alert_scheduler.logger') as mock_logger:
            await scheduler.start()
            mock_logger.warning.assert_called_with("Alert scheduler already running")

    def test_get_status(self, scheduler):
        """Test getting scheduler status."""
        status = scheduler.get_status()
        assert status["running"] is False
        assert status["interval_hours"] == 24
        assert status["jobs"] == []

    @pytest.mark.asyncio
    async def test_run_manual_check_no_due_dates(self, scheduler):
        """Test manual check when no dates are due."""
        # Mock no due dates
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = []
        scheduler._db_execute = AsyncMock(return_value=mock_result)

        with patch('backend.services.alert_scheduler.get_db_context') as mock_db_context:
            mock_db = AsyncMock()
            mock_db.execute = AsyncMock(return_value=mock_result)
            mock_db.flush = AsyncMock()
            mock_db_context.return_value.__aenter__ = AsyncMock(return_value=mock_db)
            mock_db_context.return_value.__aexit__ = AsyncMock(return_value=None)

            result = await scheduler.run_manual_check()
            assert result == 0

    @pytest.mark.asyncio
    async def test_check_and_send_alerts_logs_correctly(self, scheduler):
        """Test that alert check logs the expected information."""
        with patch('backend.services.alert_scheduler.logger') as mock_logger, \
             patch('backend.services.alert_scheduler.get_db_context') as mock_db_context:

            mock_result = MagicMock()
            mock_result.scalars.return_value.all.return_value = []
            mock_db = AsyncMock()
            mock_db.execute = AsyncMock(return_value=mock_result)
            mock_db.flush = AsyncMock()
            mock_db_context.return_value.__aenter__ = AsyncMock(return_value=mock_db)
            mock_db_context.return_value.__aexit__ = AsyncMock(return_value=None)

            await scheduler.check_and_send_alerts()

            # Verify logging calls
            log_calls = [call[0][0] for call in mock_logger.info.call_args_list]
            assert any("Running scheduled alert check" in call for call in log_calls)
            assert any("Alert lead days: [30, 15, 7, 1]" in call for call in log_calls)
            assert any("Deduplication window: 24h" in call for call in log_calls)
            assert any("Alert check complete" in call for call in log_calls)
