"""
Poll Auto-Close Job Template
Automatically closes polls when their event date/time has passed.
"""

from datetime import datetime, timedelta
from typing import Dict, Any
import logging
from .base import JobTemplate, JobResult, JobExecutionContext

logger = logging.getLogger(__name__)


class PollAutoCloseTemplate(JobTemplate):
    """
    Job template for automatically closing polls when event date/time has passed.
    Runs periodically to check for expired polls and update their status to 'closed'.
    """
    
    # Template metadata (required for registry)
    template_type = "poll_auto_close"
    template_name = "Poll Auto-Close"
    template_description = "Automatically close polls when their event date/time has passed"
    category = "maintenance"
    icon = "📊"
    estimated_duration = "1-2 minutes"
    resource_usage = "low"
    risk_level = "low"
    
    def get_schema(self) -> Dict[str, Any]:
        return {
            "dry_run": {
                "type": "boolean",
                "label": "Dry Run",
                "description": "If true, only log what would be closed without actually closing",
                "default": False
            },
            "grace_period_hours": {
                "type": "integer",
                "label": "Grace Period (Hours)",
                "description": "Hours after event time before auto-closing (default: 0)",
                "default": 0,
                "min": 0,
                "max": 48
            }
        }
    
    def validate_params(self, params: Dict[str, Any]) -> tuple:
        """Validate job parameters"""
        grace_period = params.get("grace_period_hours", 0)
        if not isinstance(grace_period, int) or grace_period < 0 or grace_period > 48:
            return False, "grace_period_hours must be an integer between 0 and 48"
        return True, None
    
    def get_default_params(self) -> Dict[str, Any]:
        """Get default parameters"""
        return {
            "dry_run": False,
            "grace_period_hours": 0
        }
    
    async def execute(self, context: JobExecutionContext) -> JobResult:
        """
        Execute the poll auto-close job.
        
        1. Find all active polls with event_date in the past
        2. Close them automatically
        3. Log results
        """
        start_time = datetime.utcnow()
        
        db = context.db
        params = context.parameters or {}
        
        dry_run = params.get("dry_run", False)
        grace_period_hours = params.get("grace_period_hours", 0)
        
        if db is None:
            return JobResult(
                status="failed",
                message="Database connection not available",
                duration_seconds=(datetime.utcnow() - start_time).total_seconds()
            )
        
        polls_checked = 0
        polls_closed = 0
        errors = []
        
        try:
            # Calculate cutoff time (now minus grace period)
            cutoff_time = datetime.utcnow() - timedelta(hours=grace_period_hours)
            
            context.log("info", f"📊 Checking for polls with event_date before {cutoff_time.isoformat()}")
            
            # Find active polls with event_date in the past
            # We need to handle polls that have event_date set
            query = {
                "status": "active",
                "event_date": {"$ne": None, "$lt": cutoff_time}
            }
            
            expired_polls = await db.polls.find(query).to_list(length=None)
            polls_checked = len(expired_polls)
            
            context.log("info", f"📋 Found {polls_checked} expired polls to close")
            
            for poll in expired_polls:
                poll_id = str(poll["_id"])
                poll_title = poll.get("title", "Untitled")
                event_date = poll.get("event_date")
                
                try:
                    if dry_run:
                        context.log("info", f"🧪 [DRY RUN] Would close poll: {poll_title} (event: {event_date})")
                        polls_closed += 1
                    else:
                        # Update poll status to closed
                        result = await db.polls.update_one(
                            {"_id": poll["_id"]},
                            {
                                "$set": {
                                    "status": "closed",
                                    "closed_at": datetime.utcnow(),
                                    "closed_reason": "auto_closed_event_passed"
                                }
                            }
                        )
                        
                        if result.modified_count > 0:
                            polls_closed += 1
                            context.log("info", f"✅ Closed poll: {poll_title} (event: {event_date})")
                        else:
                            context.log("warning", f"⚠️ Failed to close poll: {poll_title}")
                            
                except Exception as e:
                    error_msg = f"Error closing poll {poll_title}: {str(e)}"
                    errors.append(error_msg)
                    context.log("error", f"❌ {error_msg}")
            
            context.log("info", f"📊 Poll Auto-Close Summary: {polls_closed} closed out of {polls_checked} expired")
            
            return JobResult(
                status="success" if len(errors) == 0 else "partial",
                message=f"Closed {polls_closed} of {polls_checked} expired polls",
                records_processed=polls_checked,
                records_affected=polls_closed,
                details={
                    "polls_checked": polls_checked,
                    "polls_closed": polls_closed,
                    "dry_run": dry_run,
                    "grace_period_hours": grace_period_hours
                },
                errors=errors,
                duration_seconds=(datetime.utcnow() - start_time).total_seconds()
            )
            
        except Exception as e:
            context.log("error", f"❌ Poll auto-close job failed: {e}")
            return JobResult(
                status="failed",
                message=f"Poll auto-close job failed: {str(e)}",
                errors=[str(e)],
                duration_seconds=(datetime.utcnow() - start_time).total_seconds()
            )
