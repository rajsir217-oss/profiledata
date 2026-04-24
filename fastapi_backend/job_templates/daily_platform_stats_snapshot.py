"""
Daily Platform Stats Snapshot Job Template

Creates daily statistics snapshots from activity_logs.
Runs daily at 00:05 UTC to capture previous day's activity.
"""

from datetime import datetime, timedelta
from typing import Dict, Any, Tuple, Optional
from .base import JobTemplate, JobExecutionContext, JobResult


class PlatformStatsDailySnapshotTemplate(JobTemplate):
    """Job template for daily platform stats snapshot creation"""
    
    template_type = "platform_stats_daily_snapshot"
    template_name = "Platform Stats Daily Snapshot"
    template_description = "Creates daily statistics snapshots from activity_logs for the previous day"
    category = "maintenance"
    icon = "📊"
    estimated_duration = "2-5 minutes"
    resource_usage = "low"
    risk_level = "low"
    
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
    
    async def execute(self, context: JobExecutionContext) -> JobResult:
        """Execute the daily snapshot job"""
        db = context.db
        
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
            
            # 3. Favorited - query favorites collection
            favorited = await db.favorites.count_documents({
                "createdAt": {"$gte": day_start, "$lte": day_end}
            })
            
            # 4. Shortlisted - query shortlists collection
            shortlisted = await db.shortlists.count_documents({
                "createdAt": {"$gte": day_start, "$lte": day_end}
            })
            
            # 5. Messages Sent - query messages collection
            messages_sent = await db.messages.count_documents({
                "createdAt": {"$gte": day_start, "$lte": day_end}
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
            
            # Calculate all-time active members (separate await)
            all_time_active_members = await db.users.count_documents({
                "accountStatus": "active",
                "security.last_login_at": {"$exists": True, "$ne": None}
            })
            
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
                            "activeMembers": all_time_active_members,
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
                    "activeMembers": all_time_active_members,
                    "createdAt": datetime.utcnow(),
                    "updatedAt": datetime.utcnow()
                })
            
            return JobResult(
                status="success",
                message=f"Daily snapshot created for {date_str}",
                details={
                    "searches": searches,
                    "profileViews": profile_views,
                    "favorited": favorited,
                    "shortlisted": shortlisted,
                    "messagesSent": messages_sent,
                    "activeMembers": active_members
                },
                records_affected=1
            )
            
        except Exception as e:
            return JobResult(
                status="failed",
                message=f"Failed to create daily snapshot for {date_str}: {str(e)}",
                errors=[str(e)]
            )
