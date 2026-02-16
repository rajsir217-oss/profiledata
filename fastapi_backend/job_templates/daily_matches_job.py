"""
Daily Matches Notification Job
=================================
Sends SMS notifications to users about new daily matches.
Runs every day at 9:00 AM local time.
"""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, List

from .base import JobTemplate, JobExecutionContext, JobResult
from services.notification_service import NotificationService
from models.notification_models import NotificationChannel, NotificationPriority

logger = logging.getLogger(__name__)


class DailyMatchesJob(JobTemplate):
    """Job for sending daily matches notifications"""
    
    template_type = "daily_matches"
    template_name = "Daily Matches Notification"
    template_description = "Send SMS notifications about new daily matches"
    category = "engagement"
    icon = "🌅"
    estimated_duration = "5-15 minutes"
    resource_usage = "medium"
    risk_level = "low"
    
    def __init__(self):
        pass
    
    def validate_params(self, params: Dict[str, Any]) -> tuple[bool, str]:
        """Validate job parameters"""
        # No specific validation needed for this job
        return True, None
    
    def get_default_params(self) -> Dict[str, Any]:
        """Get default parameters"""
        return {
            "batch_size": 100,
            "dry_run": False,
            "min_matches": 1,
            "max_age_days": 30
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
            "min_matches": {
                "type": "integer",
                "label": "Minimum Matches",
                "description": "Minimum matches required to send notification",
                "default": 1,
                "min": 0,
                "max": 10
            },
            "max_age_days": {
                "type": "integer",
                "label": "Max User Age (days)",
                "description": "Only notify users who joined within this many days",
                "default": 30,
                "min": 1,
                "max": 365
            }
        }
    
    async def execute(self, context: JobExecutionContext) -> JobResult:
        """Execute the daily matches job"""
        params = context.params
        db = context.db
        
        batch_size = params.get("batch_size", 100)
        dry_run = params.get("dry_run", False)
        min_matches = params.get("min_matches", 1)
        max_age_days = params.get("max_age_days", 30)
        
        logger.info(f"🌅 Starting daily matches job")
        logger.info(f"   Batch size: {batch_size}")
        logger.info(f"   Dry run: {dry_run}")
        logger.info(f"   Min matches: {min_matches}")
        logger.info(f"   Max age: {max_age_days} days")
        
        try:
            # Calculate date range for active users
            max_created_date = datetime.utcnow() - timedelta(days=max_age_days)
            
            # Find users with new matches
            users_with_matches = await self._find_users_with_matches(
                db, min_matches, max_created_date
            )
            
            total_users = len(users_with_matches)
            logger.info(f"📊 Found {total_users} users with new matches")
            
            if total_users == 0:
                return JobResult(
                    status="success",
                    message="No users found with new matches",
                    records_processed=0,
                    records_affected=0
                )
            
            # Process in batches
            notification_service = NotificationService(db)
            notifications_sent = 0
            notifications_failed = 0
            
            for i in range(0, total_users, batch_size):
                batch = users_with_matches[i:i + batch_size]
                
                logger.info(f"📦 Processing batch {i//batch_size + 1}/{(total_users + batch_size - 1)//batch_size}")
                
                for user_data in batch:
                    try:
                        if not dry_run:
                            # Queue notification
                            await notification_service.queue_notification(
                                username=user_data["username"],
                                trigger="daily_matches",
                                channels=["sms"],  # SMS only for daily matches
                                template_data={
                                    "match_count": user_data["match_count"],
                                    "matches": user_data["matches"][:3],  # Top 3 matches
                                    "total_matches": user_data["total_matches"]
                                },
                                priority="medium"
                            )
                            notifications_sent += 1
                        else:
                            logger.info(f"   📝 Dry run: Would send daily_matches SMS to {user_data['username']}")
                            notifications_sent += 1
                            
                    except Exception as e:
                        logger.error(f"❌ Failed to queue notification for {user_data.get('username')}: {e}")
                        notifications_failed += 1
                
                # Small delay between batches
                if i + batch_size < total_users:
                    await asyncio.sleep(1)
            
            return JobResult(
                status="success",
                message=f"Processed {total_users} users with daily matches",
                records_processed=total_users,
                records_affected=notifications_sent,
                details={
                    "notifications_sent": notifications_sent,
                    "notifications_failed": notifications_failed,
                    "dry_run": dry_run
                }
            )
            
        except Exception as e:
            logger.error(f"❌ Daily matches job failed: {e}", exc_info=True)
            return JobResult(
                status="failed",
                message=f"Job failed: {str(e)}",
                records_processed=0,
                records_affected=0,
                errors=[str(e)]
            )
    
    async def _find_users_with_matches(self, db, min_matches: int, max_created_date: datetime) -> List[Dict]:
        """Find users who have new matches"""
        
        # This would integrate with your matching algorithm
        # For now, we'll use a placeholder implementation
        
        # Get active users who joined within the time window
        pipeline = [
            {
                "$match": {
                    "status": "active",
                    "createdAt": {"$gte": max_created_date}
                }
            },
            {
                "$project": {
                    "username": 1,
                    "firstName": 1,
                    "createdAt": 1
                }
            }
        ]
        
        users = await db.users.aggregate(pipeline).to_list(length=1000)
        
        users_with_matches = []
        
        for user in users:
            # TODO: Integrate with actual matching algorithm
            # For demo purposes, we'll simulate finding matches
            
            # Simulate finding matches for active users
            match_count = min_matches + (hash(user["username"]) % 5)  # Random 1-5 matches
            
            if match_count >= min_matches:
                # Create mock match data
                matches = []
                for i in range(min(3, match_count)):
                    matches.append({
                        "username": f"match_{user['username']}_{i}",
                        "firstName": f"Match{i}",
                        "age": 25 + (hash(user["username"]) % 15),
                        "location": "New York, NY",
                        "occupation": "Software Engineer"
                    })
                
                users_with_matches.append({
                    "username": user["username"],
                    "firstName": user.get("firstName", user["username"]),
                    "match_count": match_count,
                    "total_matches": match_count,
                    "matches": matches
                })
        
        return users_with_matches


# Job registration for scheduler
def register_daily_matches_job():
    """Register this job with the job scheduler"""
    return {
        "name": "daily_matches",
        "template": DailyMatchesJob,
        "schedule": "0 9 * * *",  # Daily at 9:00 AM
        "enabled": True,
        "description": "Send daily matches notifications to users"
    }
