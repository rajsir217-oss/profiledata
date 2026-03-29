"""
Poll Auto-Close Job Template
Automatically closes polls when their event date/time has passed.
"""

from datetime import datetime, timedelta, timezone
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
        start_time = datetime.now(timezone.utc)
        
        db = context.db
        params = context.parameters or {}
        
        dry_run = params.get("dry_run", False)
        grace_period_hours = params.get("grace_period_hours", 0)
        
        if db is None:
            return JobResult(
                status="failed",
                message="Database connection not available",
                duration_seconds=(datetime.now(timezone.utc) - start_time).total_seconds()
            )
        
        polls_checked = 0
        polls_closed = 0
        errors = []
        
        try:
            # Calculate cutoff time (now minus grace period) - use UTC
            cutoff_time = datetime.now(timezone.utc) - timedelta(hours=grace_period_hours)
            
            context.log("info", f"📊 Checking for polls that should be closed (cutoff: {cutoff_time.isoformat()})")
            
            # Get all active polls and check them individually
            # We need to combine date+time+timezone for accurate comparison
            active_polls = await db.polls.find({"status": "active"}).to_list(length=None)
            
            expired_polls = []
            for poll in active_polls:
                should_close = False
                
                # Check end_date + end_time first (priority)
                end_date = poll.get("end_date")
                end_time = poll.get("end_time")
                end_timezone = poll.get("end_timezone", "America/Los_Angeles")
                
                if end_date and end_time:
                    try:
                        import pytz
                        from datetime import time as dt_time
                        
                        # Combine date and time in poll's timezone
                        date_part = end_date.date() if isinstance(end_date, datetime) else end_date
                        time_parts = end_time.split(':')
                        hour = int(time_parts[0])
                        minute = int(time_parts[1]) if len(time_parts) > 1 else 0
                        
                        tz = pytz.timezone(end_timezone)
                        end_datetime = datetime.combine(date_part, dt_time(hour, minute))
                        end_datetime = tz.localize(end_datetime)
                        end_datetime_utc = end_datetime.astimezone(timezone.utc)
                        
                        if end_datetime_utc < cutoff_time:
                            should_close = True
                    except Exception as e:
                        context.log("warning", f"Error parsing end_date/end_time for poll {poll.get('title')}: {e}")
                        # Fall back to date-only comparison
                        if end_date and end_date < cutoff_time:
                            should_close = True
                elif end_date and end_date < cutoff_time:
                    # No end_time, use date-only comparison
                    should_close = True
                elif poll.get("event_date") and poll.get("event_date") < cutoff_time:
                    # Fall back to event_date if no end_date
                    should_close = True
                
                if should_close:
                    expired_polls.append(poll)
            
            polls_checked = len(expired_polls)
            
            context.log("info", f"📋 Found {polls_checked} expired polls to close")
            
            for poll in expired_polls:
                poll_id = str(poll["_id"])
                poll_title = poll.get("title", "Untitled")
                end_date = poll.get("end_date")
                event_date = poll.get("event_date")
                closing_reason = "auto_closed_event_passed"
                
                if end_date and event_date:
                    closing_reason = "auto_closed_end_date_passed"
                elif end_date:
                    closing_reason = "auto_closed_end_date_passed"
                else:
                    closing_reason = "auto_closed_event_passed"
                
                try:
                    if dry_run:
                        context.log("info", f"🧪 [DRY RUN] Would close poll: {poll_title} (end_date: {end_date}, event_date: {event_date})")
                        polls_closed += 1
                    else:
                        # Update poll status to closed
                        result = await db.polls.update_one(
                            {"_id": poll["_id"]},
                            {
                                "$set": {
                                    "status": "closed",
                                    "closed_at": datetime.now(timezone.utc),
                                    "closed_reason": closing_reason
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
            
            context.log("info", f"📊 Poll Auto-Close Summary: {polls_closed} closed out of {polls_checked} expired (using UTC timezone)")
            
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
                duration_seconds=(datetime.now(timezone.utc) - start_time).total_seconds()
            )
            
        except Exception as e:
            context.log("error", f"❌ Poll auto-close job failed: {e}")
            return JobResult(
                status="failed",
                message=f"Poll auto-close job failed: {str(e)}",
                errors=[str(e)],
                duration_seconds=(datetime.now(timezone.utc) - start_time).total_seconds()
            )
