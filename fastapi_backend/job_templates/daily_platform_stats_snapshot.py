"""
Daily Platform Stats Snapshot Job Template

Creates daily statistics snapshots from activity_logs.
Runs daily at 00:05 UTC to capture previous day's activity.
"""

from datetime import datetime, timedelta
from typing import Dict, Any, Tuple, Optional
from database import get_database
from .base import JobTemplate, JobExecutionContext, JobResult


async def execute(job_params: Dict[str, Any]) -> Dict[str, Any]:
    """
    Create/update daily snapshot for previous day.
    
    Parameters:
        job_params: Dict (unused for this job)
    
    Returns:
        Dict with execution results
    """
    db = await get_database()
    
    # Calculate previous day's date
    today = datetime.utcnow()
    yesterday = today - timedelta(days=1)
    date_str = yesterday.strftime("%Y-%m-%d")
    
    # Time filter for activity_logs (previous day UTC)
    day_start = yesterday.replace(hour=0, minute=0, second=0, microsecond=0)
    day_end = yesterday.replace(hour=23, minute=59, second=59, microsecond=999999)
    time_filter = {"timestamp": {"$gte": day_start, "$lte": day_end}}
    
    try:
        # 1. Searches
        searches = await db.activity_logs.count_documents({
            "action_type": "search_performed",
            **time_filter
        })
        
        # 2. Profile Views
        profile_views = await db.activity_logs.count_documents({
            "action_type": "profile_viewed",
            **time_filter
        })
        
        # 3. Favorited
        favorited = await db.activity_logs.count_documents({
            "action_type": "favorite_added",
            **time_filter
        })
        
        # 4. Shortlisted
        shortlisted = await db.activity_logs.count_documents({
            "action_type": "shortlist_added",
            **time_filter
        })
        
        # 5. Messages Sent
        messages_sent = await db.activity_logs.count_documents({
            "action_type": "message_sent",
            **time_filter
        })
        
        # 6. Active Members (users who logged in on this day)
        active_members = await db.users.count_documents({
            "accountStatus": "active",
            "security.last_login_at": {"$gte": day_start, "$lte": day_end}
        })
        
        # 7. Upsert to platform_stats_daily
        daily_doc = {
            "_id": date_str,
            "date": date_str,
            "searches": searches,
            "profileViews": profile_views,
            "favorited": favorited,
            "shortlisted": shortlisted,
            "messagesSent": messages_sent,
            "activeMembers": active_members,
            "createdAt": day_start,
            "updatedAt": day_end
        }
        
        await db.platform_stats_daily.update_one(
            {"_id": date_str},
            {"$set": daily_doc},
            upsert=True
        )
        
        # 8. Update all_time snapshot with delta
        all_time_doc = await db.platform_stats_all_time.find_one({"_id": "all_time"})
        
        if all_time_doc:
            # Update existing
            await db.platform_stats_all_time.update_one(
                {"_id": "all_time"},
                {
                    "$inc": {
                        "searches": searches,
                        "profileViews": profile_views,
                        "favorited": favorited,
                        "shortlisted": shortlisted,
                        "messagesSent": messages_sent
                    },
                    "$set": {
                        "activeMembers": await db.users.count_documents({
                            "accountStatus": "active",
                            "security.last_login_at": {"$exists": True, "$ne": None}
                        }),
                        "updatedAt": datetime.utcnow()
                    }
                }
            )
        else:
            # Create new all_time snapshot
            await db.platform_stats_all_time.insert_one({
                "_id": "all_time",
                "searches": searches,
                "profileViews": profile_views,
                "favorited": favorited,
                "shortlisted": shortlisted,
                "messagesSent": messages_sent,
                "activeMembers": await db.users.count_documents({
                    "accountStatus": "active",
                    "security.last_login_at": {"$exists": True, "$ne": None}
                }),
                "createdAt": datetime.utcnow(),
                "updatedAt": datetime.utcnow()
            })
        
        return {
            "status": "success",
            "date": date_str,
            "snapshot": {
                "searches": searches,
                "profileViews": profile_views,
                "favorited": favorited,
                "shortlisted": shortlisted,
                "messagesSent": messages_sent,
                "activeMembers": active_members
            },
            "message": f"Daily snapshot created for {date_str}"
        }
        
    except Exception as e:
        return {
            "status": "error",
            "date": date_str,
            "error": str(e),
            "message": f"Failed to create daily snapshot for {date_str}"
        }


# Job metadata for Dynamic Scheduler
JOB_METADATA = {
    "name": "Daily Platform Stats Snapshot",
    "description": "Creates daily statistics snapshots from activity_logs for the previous day",
    "parameters": {},
    "default_schedule": {
        "type": "interval",
        "value": 86400  # 24 hours in seconds
    },
    "timeout": 300  # 5 minutes
}


class DailyPlatformStatsSnapshotTemplate(JobTemplate):
    """Job template for daily platform stats snapshot creation"""
    
    template_type = "daily_platform_stats_snapshot"
    template_name = "Daily Platform Stats Snapshot"
    template_description = "Creates daily statistics snapshots from activity_logs for the previous day"
    category = "maintenance"
    icon = "📊"
    estimated_duration = "2-5 minutes"
    resource_usage = "low"
    risk_level = "low"
    
    async def execute(self, context: JobExecutionContext) -> JobResult:
        """Execute the daily snapshot job"""
        try:
            result = await execute(context.parameters)
            if result.get("status") == "success":
                return JobResult(
                    status="success",
                    message=result.get("message", "Daily snapshot created successfully"),
                    details=result.get("snapshot", {}),
                    records_affected=1
                )
            else:
                return JobResult(
                    status="failed",
                    message=result.get("message", "Failed to create daily snapshot"),
                    errors=[result.get("error", "Unknown error")]
                )
        except Exception as e:
            return JobResult(
                status="failed",
                message=f"Job execution failed: {str(e)}",
                errors=[str(e)]
            )
    
    def validate_params(self, params: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        """No parameters required for this job"""
        return True, None
    
    def get_schema(self) -> Dict[str, Any]:
        """Return JSON schema for parameters (no parameters)"""
        return {
            "type": "object",
            "properties": {},
            "required": []
        }
