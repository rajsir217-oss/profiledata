"""
Login Reminder Job
==================
Sends SMS notifications to users who haven't logged in recently.
Runs weekly to re-engage inactive users.
"""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, List

from .base import JobTemplate, JobExecutionContext, JobResult
from services.notification_service import NotificationService
from models.notification_models import NotificationChannel, NotificationPriority

logger = logging.getLogger(__name__)


class LoginReminderJob(JobTemplate):
    """Job for sending login reminders to inactive users"""
    
    template_type = "login_reminder"
    template_name = "Login Reminder"
    template_description = "Send login reminders to inactive users"
    category = "engagement"
    icon = "🔄"
    estimated_duration = "5-15 minutes"
    resource_usage = "low"
    risk_level = "low"
    
    def __init__(self):
        pass
    
    def validate_params(self, params: Dict[str, Any]) -> tuple[bool, str]:
        """Validate job parameters"""
        inactive_days = params.get("inactive_days", [7, 14, 30])
        if not isinstance(inactive_days, list) or not all(isinstance(d, int) and 1 <= d <= 90 for d in inactive_days):
            return False, "inactive_days must be a list of integers between 1 and 90"
        
        return True, None
    
    def get_default_params(self) -> Dict[str, Any]:
        """Get default parameters"""
        return {
            "batch_size": 100,
            "dry_run": False,
            "inactive_days": [7, 14, 30],  # 1 week, 2 weeks, 1 month
            "min_login_count": 1,
            "exclude_recent": True
        }
    
    def get_schema(self) -> Dict[str, Any]:
        """Get parameter schema for UI"""
        return {
            "batch_size": {
                "type": "integer",
                "label": "Batch Size",
                "description": "Number of users to process per batch",
                "default": 100,
                "min": 1,
                "max": 500
            },
            "dry_run": {
                "type": "boolean",
                "label": "Dry Run",
                "description": "Test without sending actual notifications",
                "default": False
            },
            "inactive_days": {
                "type": "array",
                "label": "Inactive Days",
                "description": "Days of inactivity to check",
                "default": [7, 14, 30],
                "items": {
                    "type": "integer",
                    "min": 1,
                    "max": 90
                }
            },
            "min_login_count": {
                "type": "integer",
                "label": "Minimum Login Count",
                "description": "Minimum times user must have logged in before",
                "default": 1,
                "min": 1,
                "max": 10
            },
            "exclude_recent": {
                "type": "boolean",
                "label": "Exclude Recent",
                "description": "Exclude users who received reminder in last 30 days",
                "default": True
            }
        }
    
    async def execute(self, context: JobExecutionContext) -> JobResult:
        """Execute the login reminder job"""
        params = context.params
        db = context.db
        
        batch_size = params.get("batch_size", 100)
        dry_run = params.get("dry_run", False)
        inactive_days = params.get("inactive_days", [7, 14, 30])
        min_login_count = params.get("min_login_count", 1)
        exclude_recent = params.get("exclude_recent", True)
        
        logger.info(f"🔄 Starting login reminder job")
        logger.info(f"   Batch size: {batch_size}")
        logger.info(f"   Dry run: {dry_run}")
        logger.info(f"   Inactive days: {inactive_days}")
        logger.info(f"   Min login count: {min_login_count}")
        logger.info(f"   Exclude recent: {exclude_recent}")
        
        try:
            # Find inactive users
            inactive_users = await self._find_inactive_users(
                db, inactive_days, min_login_count, exclude_recent
            )
            
            total_users = len(inactive_users)
            logger.info(f"📊 Found {total_users} inactive users")
            
            if total_users == 0:
                return JobResult(
                    status="success",
                    message="No inactive users found",
                    records_processed=0,
                    records_affected=0
                )
            
            # Process in batches
            notification_service = NotificationService(db)
            notifications_sent = 0
            notifications_failed = 0
            
            for i in range(0, total_users, batch_size):
                batch = inactive_users[i:i + batch_size]
                
                logger.info(f"📦 Processing batch {i//batch_size + 1}/{(total_users + batch_size - 1)//batch_size}")
                
                for user_data in batch:
                    try:
                        if not dry_run:
                            await notification_service.queue_notification(
                                username=user_data["username"],
                                trigger="login_reminder",
                                channels=["sms"],
                                template_data={
                                    "days_inactive": user_data["days_inactive"],
                                    "last_login_date": user_data["last_login_date"],
                                    "new_matches_count": user_data.get("new_matches_count", 0),
                                    "unread_messages_count": user_data.get("unread_messages_count", 0)
                                },
                                priority="medium"
                            )
                            notifications_sent += 1
                        else:
                            logger.info(f"   📝 Dry run: Would send login_reminder SMS to {user_data['username']}")
                            notifications_sent += 1
                            
                    except Exception as e:
                        logger.error(f"❌ Failed to queue notification for {user_data.get('username')}: {e}")
                        notifications_failed += 1
                
                # Small delay between batches
                if i + batch_size < total_users:
                    await asyncio.sleep(1)
            
            return JobResult(
                status="success",
                message=f"Processed {total_users} inactive users",
                records_processed=total_users,
                records_affected=notifications_sent,
                details={
                    "notifications_sent": notifications_sent,
                    "notifications_failed": notifications_failed,
                    "dry_run": dry_run,
                    "inactive_days": inactive_days
                }
            )
            
        except Exception as e:
            logger.error(f"❌ Login reminder job failed: {e}", exc_info=True)
            return JobResult(
                status="failed",
                message=f"Job failed: {str(e)}",
                records_processed=0,
                records_affected=0
            )
    
    async def _find_inactive_users(self, db, inactive_days: List[int], min_login_count: int, exclude_recent: bool) -> List[Dict]:
        """Find users who haven't logged in recently"""
        
        today = datetime.utcnow()
        inactive_users = []
        
        # Get recent notification recipients to exclude
        excluded_users = set()
        if exclude_recent:
            recent_notifications = await db.notification_queue.find({
                "trigger": "login_reminder",
                "createdAt": {"$gte": today - timedelta(days=30)},
                "status": "sent"
            }).to_list(length=1000)
            
            for notif in recent_notifications:
                excluded_users.add(notif["username"])
        
        # Check each inactive period
        for days in inactive_days:
            cutoff_date = today - timedelta(days=days)
            
            # Find users whose last login was before cutoff
            pipeline = [
                {
                    "$match": {
                        "status": "active",
                        "lastLogin": {"$lt": cutoff_date},
                        "username": {"$nin": list(excluded_users)}
                    }
                },
                {
                    "$project": {
                        "username": 1,
                        "firstName": 1,
                        "lastLogin": 1,
                        "loginCount": {"$ifNull": ["$loginCount", 0]}
                    }
                },
                {
                    "$match": {
                        "loginCount": {"$gte": min_login_count}
                    }
                }
            ]
            
            users = await db.users.aggregate(pipeline).to_list(length=500)
            
            for user in users:
                days_inactive = (today - user["lastLogin"]).days
                
                # Check for new matches and unread messages
                new_matches_count = await self._get_new_matches_count(db, user["username"])
                unread_messages_count = await self._get_unread_messages_count(db, user["username"])
                
                inactive_users.append({
                    "username": user["username"],
                    "firstName": user.get("firstName", user["username"]),
                    "days_inactive": days_inactive,
                    "last_login_date": user["lastLogin"].strftime("%Y-%m-%d"),
                    "login_count": user["loginCount"],
                    "new_matches_count": new_matches_count,
                    "unread_messages_count": unread_messages_count
                })
                
                # Add to excluded users to avoid duplicates
                excluded_users.add(user["username"])
        
        return inactive_users
    
    async def _get_new_matches_count(self, db, username: str) -> int:
        """Get count of new matches since last login"""
        try:
            user = await db.users.find_one({"username": username})
            if not user:
                return 0
            
            last_login = user.get("lastLogin")
            if not last_login:
                return 0
            
            # Count matches created since last login
            count = await db.matches.count_documents({
                "participants": username,
                "createdAt": {"$gte": last_login}
            })
            
            return count
        except Exception:
            return 0
    
    async def _get_unread_messages_count(self, db, username: str) -> int:
        """Get count of unread messages"""
        try:
            count = await db.messages.count_documents({
                "recipient": username,
                "read": False
            })
            
            return count
        except Exception:
            return 0


# Job registration for scheduler
def register_login_reminder_job():
    """Register this job with the job scheduler"""
    return {
        "name": "login_reminder",
        "template": LoginReminderJob,
        "schedule": "0 10 * * 1",  # Weekly on Monday at 10:00 AM
        "enabled": True,
        "description": "Send login reminders to inactive users"
    }
