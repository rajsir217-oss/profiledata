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
            # event_date is stored as naive datetime (no timezone), assumed to be PST/PDT
            # Convert UTC now to PST for accurate comparison
            # PST is UTC-8, PDT is UTC-7 (we'll use UTC-8 to be conservative)
            from datetime import timezone
            utc_now = datetime.utcnow().replace(tzinfo=timezone.utc)
            pst_now = utc_now.astimezone(timezone(timedelta(hours=-8)))  # PST
            pst_cutoff = pst_now - timedelta(hours=grace_period_hours)
            
            # Convert back to naive datetime for comparison with stored event_date
            adjusted_cutoff_time = pst_cutoff.replace(tzinfo=None)
            
            context.log("info", f"📊 Using PST-adjusted cutoff time: {adjusted_cutoff_time.isoformat()} (UTC: {cutoff_time.isoformat()})")
            
            query = {
                "status": "active",
                "event_date": {"$ne": None, "$lt": adjusted_cutoff_time}
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
            
            context.log("info", f"📊 Poll Auto-Close Summary: {polls_closed} closed out of {polls_checked} expired (using PST timezone)")
            
            # Check for polls that were incorrectly closed and reopen them
            if not dry_run and polls_checked > 0:
                try:
                    now = datetime.utcnow()
                    # Convert to PST for comparison with stored event_date
                    utc_now = now.replace(tzinfo=timezone.utc)
                    pst_now = utc_now.astimezone(timezone(timedelta(hours=-8)))
                    
                    # Look for polls closed in the last 48 hours with future event dates
                    recent_cutoff = now - timedelta(hours=48)
                    future_cutoff = pst_now + timedelta(hours=1)  # 1 hour from now in PST
                    
                    query = {
                        "status": "closed",
                        "closed_at": {"$gte": recent_cutoff},
                        "closed_reason": "auto_closed_event_passed",
                        "event_date": {"$gt": future_cutoff.replace(tzinfo=None)}  # Compare with naive datetime
                    }
                    
                    incorrectly_closed = await db.polls.find(query).to_list(length=None)
                    
                    if incorrectly_closed:
                        context.log("info", f"🔧 Found {len(incorrectly_closed)} polls to reopen (timezone fix)")
                        
                        for poll in incorrectly_closed:
                            poll_id = str(poll["_id"])
                            poll_title = poll.get("title", "Untitled")
                            event_date = poll.get("event_date")
                            
                            result = await db.polls.update_one(
                                {"_id": poll["_id"]},
                                {
                                    "$set": {
                                        "status": "active",
                                        "updated_at": datetime.utcnow(),
                                        "reopened_at": datetime.utcnow(),
                                        "reopened_reason": "timezone_mismatch_fix"
                                    },
                                    "$unset": {
                                        "closed_at": "",
                                        "closed_reason": ""
                                    }
                                }
                            )
                            
                            if result.modified_count > 0:
                                context.log("info", f"✅ Reopened poll: {poll_title} (event: {event_date})")
                            else:
                                context.log("warning", f"⚠️ Failed to reopen poll: {poll_title}")
                    else:
                        context.log("info", "🔧 No incorrectly closed polls found")
                        
                except Exception as e:
                    context.log("error", f"❌ Error reopening polls: {str(e)}")
            
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
