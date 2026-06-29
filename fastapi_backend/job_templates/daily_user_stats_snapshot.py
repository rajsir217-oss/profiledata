"""
Daily User Stats Snapshot Job Template

Creates daily statistics snapshots for each user.
Runs daily at 00:10 UTC to capture previous day's activity.
Calculates: days active, profile views, favorites by, shortlists by, unique conversations.
"""

import logging
from datetime import datetime, timedelta
from typing import Dict, Any, Tuple, Optional
from .base import JobTemplate, JobExecutionContext, JobResult

logger = logging.getLogger(__name__)


class UserStatsDailySnapshotTemplate(JobTemplate):
    """Job template for daily user stats snapshot creation"""
    
    template_type = "user_stats_daily_snapshot"
    template_name = "User Stats Daily Snapshot"
    template_description = "Creates daily statistics snapshots for all users (days active, views, favorites, shortlists, messages)"
    category = "maintenance"
    icon = "👤"
    estimated_duration = "5-15 minutes"
    resource_usage = "medium"
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
        """Execute the daily snapshot job for all users"""
        db = context.db

        # Use today's date (not yesterday) to capture current state immediately
        today = datetime.utcnow()
        date_str = today.strftime("%Y-%m-%d")
        day_start = today.replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = today.replace(hour=23, minute=59, second=59, microsecond=999999)
        
        try:
            # Get all active users
            users_cursor = db.users.find({"accountStatus": "active"}, {"username": 1, "createdAt": 1})
            users = await users_cursor.to_list(length=None)
            
            total_users = len(users)
            processed = 0
            errors = []
            user_details = []  # Collect per-user details for execution result
            
            for user in users:
                username = user.get("username")
                created_at = user.get("createdAt")
                
                try:
                    # 1. Days Active (inception to now, not just previous day)
                    if created_at:
                        # Handle both datetime and string formats for createdAt
                        if isinstance(created_at, str):
                            created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
                        days_active = (today - created_at).days
                    else:
                        days_active = 0

                    # 2. Profile Views (current count)
                    views_count = await db.profile_views.count_documents({"profileUsername": username})

                    # 3. Favorites By (current count)
                    fav_by_count = await db.favorites.count_documents({"favoriteUsername": username})

                    # 4. Shortlists By (current count)
                    short_by_count = await db.shortlists.count_documents({"shortlistedUsername": username})

                    # 5. Unique Conversations (current count)
                    unique_conversations = len(await db.messages.distinct("to_username", {"from_username": username}))

                    # Get previous snapshot to preserve historical maximums
                    prev_snapshot = await db.user_stats_daily.find_one(
                        {"username": username},
                        sort=[("date", -1)]
                    )

                    # Use max of current and previous values (historical maximum)
                    prev_stats = prev_snapshot.get("stats", {}) if prev_snapshot else {}
                    max_views = max(views_count, prev_stats.get("profileViews", 0))
                    max_fav = max(fav_by_count, prev_stats.get("favoritedBy", 0))
                    max_short = max(short_by_count, prev_stats.get("shortlistedBy", 0))
                    max_conv = max(unique_conversations, prev_stats.get("uniqueConversations", 0))

                    # Log detailed metrics for this user
                    logger.info(
                        f"📊 [{processed + 1}/{total_users}] {username}: "
                        f"daysActive={days_active}, "
                        f"profileViews={max_views} (current={views_count}), "
                        f"favoritedBy={max_fav} (current={fav_by_count}), "
                        f"shortlistedBy={max_short} (current={short_by_count}), "
                        f"uniqueConversations={max_conv} (current={unique_conversations})"
                    )

                    # Upsert to user_stats_daily with historical maximums
                    daily_doc = {
                        "username": username,
                        "date": date_str,
                        "stats": {
                            "daysActive": days_active,
                            "profileViews": max_views,
                            "favoritedBy": max_fav,
                            "shortlistedBy": max_short,
                            "uniqueConversations": max_conv
                        },
                        "createdAt": day_start,
                        "updatedAt": datetime.utcnow()
                    }

                    await db.user_stats_daily.update_one(
                        {"username": username, "date": date_str},
                        {"$set": daily_doc},
                        upsert=True
                    )
                    
                    processed += 1
                    
                except Exception as e:
                    errors.append(f"Failed to process user {username}: {str(e)}")
            
            return JobResult(
                status="success",
                message=f"Daily user stats snapshot created for {date_str} - {processed}/{total_users} users processed",
                details={
                    "date": date_str,
                    "total_users": total_users,
                    "processed": processed,
                    "errors": errors[:10],  # Limit error details
                    "userDetails": user_details[:20]  # Include first 20 users for detailed view
                },
                records_affected=processed
            )
            
        except Exception as e:
            return JobResult(
                status="failed",
                message=f"Failed to create daily user stats snapshot for {date_str}: {str(e)}",
                errors=[str(e)]
            )
