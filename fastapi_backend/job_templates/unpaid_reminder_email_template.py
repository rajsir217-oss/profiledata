"""
Unpaid Members Email Reminder Job Template
Sends bulk email reminders to unpaid members
"""

import asyncio
import logging
from datetime import datetime
from typing import Dict, Any, List, Tuple

from .base import JobTemplate, JobExecutionContext, JobResult
from config import settings

logger = logging.getLogger(__name__)


class UnpaidReminderEmailTemplate(JobTemplate):
    """Job template for sending email reminders to unpaid members"""
    
    # Template metadata
    template_type = "unpaid_reminder_email"
    template_name = "Unpaid Members Email Reminder"
    template_description = "Send bulk email reminders to unpaid contribution members"
    category = "contributions"
    icon = "💰"
    estimated_duration = "5-10 minutes"
    resource_usage = "medium"
    risk_level = "low"
    
    def __init__(self):
        pass
    
    def validate_params(self, params: Dict[str, Any]) -> Tuple[bool, str]:
        """Validate job parameters"""
        return True, None
    
    def get_default_params(self) -> Dict[str, Any]:
        """Get default parameters"""
        return {
            "dry_run": False,
            "test_mode": False,
            "batch_size": 100
        }
    
    def get_schema(self) -> Dict[str, Any]:
        """Get parameter schema for UI"""
        return {
            "dry_run": {
                "type": "boolean",
                "label": "Dry Run",
                "description": "Test without sending actual emails",
                "default": False
            },
            "test_mode": {
                "type": "boolean",
                "label": "Test Mode",
                "description": "Send all emails to test address instead of actual recipients",
                "default": False
            },
            "batch_size": {
                "type": "integer",
                "label": "Batch Size",
                "description": "Number of users to process per batch",
                "default": 100,
                "min": 1,
                "max": 500
            }
        }
    
    async def execute(self, context: JobExecutionContext) -> JobResult:
        """Execute the unpaid members email reminder job using shared service."""
        from services.contribution_reminders import send_bulk_reminders

        params = context.parameters
        db = context.db

        dry_run = params.get("dry_run", False)
        test_mode = params.get("test_mode", False)
        batch_size = params.get("batch_size", 100)

        context.log("info", f"💰 Starting unpaid members email reminder job")
        context.log("info", f"   Dry run: {dry_run}")
        context.log("info", f"   Test mode: {test_mode}")
        context.log("info", f"   Batch size: {batch_size}")

        async def _progress(level: str, msg: str):
            context.log(level, msg)

        try:
            summary = await send_bulk_reminders(
                db,
                channel="email",
                custom_message="",
                admin_username=f"scheduler:{context.job_name}",
                dry_run=dry_run,
                test_mode=test_mode,
                batch_size=batch_size,
                progress_callback=_progress,
            )

            sent_count = summary.get("sentCount", 0)
            failed_count = summary.get("failedCount", 0)
            total = summary.get("total", 0)
            errors = summary.get("errors", [])

            status = "success" if failed_count == 0 else ("partial" if sent_count > 0 else "failed")
            return JobResult(
                status=status,
                message=summary.get("message", f"Processed {total} unpaid members"),
                records_processed=total,
                records_affected=sent_count,
                details={
                    "sent": sent_count,
                    "failed": failed_count,
                    "dry_run": dry_run,
                    "test_mode": test_mode,
                },
                errors=errors[:10],
            )
        except Exception as e:
            context.log("error", f"❌ Unpaid members email reminder job failed: {e}")
            return JobResult(
                status="failed",
                message=f"Job failed: {str(e)}",
                errors=[str(e)],
            )
