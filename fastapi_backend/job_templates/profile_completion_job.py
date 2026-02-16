"""
Profile Completion Reminder Job
================================
Sends SMS notifications to users with incomplete profiles.
Runs every 30 days to encourage profile completion.
"""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, List

from .base import JobTemplate, JobExecutionContext, JobResult
from services.notification_service import NotificationService
from models.notification_models import NotificationChannel, NotificationPriority

logger = logging.getLogger(__name__)


class ProfileCompletionJob(JobTemplate):
    """Job for sending profile completion reminders"""
    
    template_type = "profile_completion"
    template_name = "Profile Completion Reminder"
    template_description = "Send profile completion reminders to users"
    category = "engagement"
    icon = "📝"
    estimated_duration = "5-10 minutes"
    resource_usage = "low"
    risk_level = "low"
    
    def __init__(self):
        pass
    
    def validate_params(self, params: Dict[str, Any]) -> tuple[bool, str]:
        """Validate job parameters"""
        completion_threshold = params.get("completion_threshold", 70)
        if not isinstance(completion_threshold, int) or completion_threshold < 0 or completion_threshold > 100:
            return False, "completion_threshold must be an integer between 0 and 100"
        
        return True, None
    
    def get_default_params(self) -> Dict[str, Any]:
        """Get default parameters"""
        return {
            "batch_size": 100,
            "dry_run": False,
            "completion_threshold": 70,  # Only notify if < 70% complete
            "min_age_days": 1,  # Don't bother brand new users
            "max_age_days": 90,  # Focus on newer users
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
            "completion_threshold": {
                "type": "integer",
                "label": "Completion Threshold (%)",
                "description": "Only notify users with completion below this percentage",
                "default": 70,
                "min": 0,
                "max": 100
            },
            "min_age_days": {
                "type": "integer",
                "label": "Min Account Age (days)",
                "description": "Minimum days since account creation",
                "default": 1,
                "min": 1,
                "max": 30
            },
            "max_age_days": {
                "type": "integer",
                "label": "Max Account Age (days)",
                "description": "Maximum days since account creation",
                "default": 90,
                "min": 1,
                "max": 365
            },
            "exclude_recent": {
                "type": "boolean",
                "label": "Exclude Recent",
                "description": "Exclude users who received reminder in last 30 days",
                "default": True
            }
        }
    
    async def execute(self, context: JobExecutionContext) -> JobResult:
        """Execute the profile completion job"""
        params = context.params
        db = context.db
        
        batch_size = params.get("batch_size", 100)
        dry_run = params.get("dry_run", False)
        completion_threshold = params.get("completion_threshold", 70)
        min_age_days = params.get("min_age_days", 1)
        max_age_days = params.get("max_age_days", 90)
        exclude_recent = params.get("exclude_recent", True)
        
        logger.info(f"📝 Starting profile completion job")
        logger.info(f"   Batch size: {batch_size}")
        logger.info(f"   Dry run: {dry_run}")
        logger.info(f"   Completion threshold: {completion_threshold}%")
        logger.info(f"   Account age: {min_age_days}-{max_age_days} days")
        logger.info(f"   Exclude recent: {exclude_recent}")
        
        try:
            # Find users with incomplete profiles
            incomplete_users = await self._find_incomplete_users(
                db, completion_threshold, min_age_days, max_age_days, exclude_recent
            )
            
            total_users = len(incomplete_users)
            logger.info(f"📊 Found {total_users} users with incomplete profiles")
            
            if total_users == 0:
                return JobResult(
                    status="success",
                    message="No users with incomplete profiles found",
                    records_processed=0,
                    records_affected=0
                )
            
            # Process in batches
            notification_service = NotificationService(db)
            notifications_sent = 0
            notifications_failed = 0
            
            for i in range(0, total_users, batch_size):
                batch = incomplete_users[i:i + batch_size]
                
                logger.info(f"📦 Processing batch {i//batch_size + 1}/{(total_users + batch_size - 1)//batch_size}")
                
                for user_data in batch:
                    try:
                        if not dry_run:
                            await notification_service.queue_notification(
                                username=user_data["username"],
                                trigger="profile_complete",
                                channels=["sms"],
                                template_data={
                                    "completion_percentage": user_data["completion_percentage"],
                                    "missing_fields": user_data["missing_fields"],
                                    "suggested_fields": user_data["suggested_fields"],
                                    "profile_url": "https://l3v3lmatches.com/profile/edit"
                                },
                                priority="medium"
                            )
                            notifications_sent += 1
                        else:
                            logger.info(f"   📝 Dry run: Would send profile_complete SMS to {user_data['username']}")
                            notifications_sent += 1
                            
                    except Exception as e:
                        logger.error(f"❌ Failed to queue notification for {user_data.get('username')}: {e}")
                        notifications_failed += 1
                
                # Small delay between batches
                if i + batch_size < total_users:
                    await asyncio.sleep(1)
            
            return JobResult(
                status="success",
                message=f"Processed {total_users} users with incomplete profiles",
                records_processed=total_users,
                records_affected=notifications_sent,
                details={
                    "notifications_sent": notifications_sent,
                    "notifications_failed": notifications_failed,
                    "dry_run": dry_run,
                    "completion_threshold": completion_threshold
                }
            )
            
        except Exception as e:
            logger.error(f"❌ Profile completion job failed: {e}", exc_info=True)
            return JobResult(
                status="failed",
                message=f"Job failed: {str(e)}",
                records_processed=0,
                records_affected=0
            )
    
    async def _find_incomplete_users(self, db, completion_threshold: int, min_age_days: int, max_age_days: int, exclude_recent: bool) -> List[Dict]:
        """Find users with incomplete profiles"""
        
        today = datetime.utcnow()
        min_created_date = today - timedelta(days=max_age_days)
        max_created_date = today - timedelta(days=min_age_days)
        
        # Get recent notification recipients to exclude
        excluded_users = set()
        if exclude_recent:
            recent_notifications = await db.notification_queue.find({
                "trigger": "profile_complete",
                "createdAt": {"$gte": today - timedelta(days=30)},
                "status": "sent"
            }).to_list(length=1000)
            
            for notif in recent_notifications:
                excluded_users.add(notif["username"])
        
        # Find users in the right age range
        users = await db.users.find({
            "status": "active",
            "createdAt": {"$gte": min_created_date, "$lt": max_created_date},
            "username": {"$nin": list(excluded_users)}
        }).to_list(length=1000)
        
        incomplete_users = []
        
        for user in users:
            completion_data = self._calculate_profile_completion(user)
            
            if completion_data["completion_percentage"] < completion_threshold:
                incomplete_users.append({
                    "username": user["username"],
                    "firstName": user.get("firstName", user["username"]),
                    "completion_percentage": completion_data["completion_percentage"],
                    "missing_fields": completion_data["missing_fields"],
                    "suggested_fields": completion_data["suggested_fields"]
                })
        
        return incomplete_users
    
    def _calculate_profile_completion(self, user: Dict) -> Dict:
        """Calculate profile completion percentage and missing fields"""
        
        # Define required fields and their weights
        required_fields = {
            "firstName": {"weight": 10, "name": "First Name"},
            "birthMonth": {"weight": 10, "name": "Birth Month"},
            "birthYear": {"weight": 10, "name": "Birth Year"},
            "gender": {"weight": 10, "name": "Gender"},
            "location": {"weight": 15, "name": "Location"},
            "heightInches": {"weight": 10, "name": "Height"},
            "religion": {"weight": 10, "name": "Religion"},
            "education": {"weight": 10, "name": "Education"},
            "occupation": {"weight": 10, "name": "Occupation"},
            "about": {"weight": 15, "name": "About Me"}
        }
        
        # Optional fields (bonus points)
        optional_fields = {
            "photos": {"weight": 20, "name": "Photos"},
            "workExperience": {"weight": 10, "name": "Work Experience"},
            "familyDetails": {"weight": 10, "name": "Family Details"},
            "hobbies": {"weight": 10, "name": "Hobbies"},
            "preferences": {"weight": 10, "name": "Preferences"}
        }
        
        total_weight = sum(field["weight"] for field in required_fields.values())
        earned_weight = 0
        missing_fields = []
        
        # Check required fields
        for field_name, field_info in required_fields.items():
            if user.get(field_name):
                # Special checks for certain fields
                if field_name == "about" and len(str(user.get(field_name, "")).strip()) < 20:
                    missing_fields.append(field_info["name"])
                elif field_name == "location" and len(str(user.get(field_name, "")).strip()) < 3:
                    missing_fields.append(field_info["name"])
                else:
                    earned_weight += field_info["weight"]
            else:
                missing_fields.append(field_info["name"])
        
        # Check optional fields (bonus)
        bonus_weight = 0
        for field_name, field_info in optional_fields.items():
            if field_name == "photos" and user.get("photos", []):
                bonus_weight += field_info["weight"]
            elif field_name != "photos" and user.get(field_name):
                bonus_weight += field_info["weight"]
        
        # Calculate completion percentage
        base_percentage = (earned_weight / total_weight) * 100
        bonus_percentage = (bonus_weight / (total_weight * 0.5)) * 10  # Max 10% bonus
        completion_percentage = min(100, base_percentage + bonus_percentage)
        
        # Suggest most important missing fields
        suggested_fields = missing_fields[:3] if missing_fields else []
        
        return {
            "completion_percentage": int(completion_percentage),
            "missing_fields": missing_fields,
            "suggested_fields": suggested_fields
        }


# Job registration for scheduler
def register_profile_completion_job():
    """Register this job with the job scheduler"""
    return {
        "name": "profile_completion",
        "template": ProfileCompletionJob,
        "schedule": "0 14 */30 * *",  # Every 30 days at 2:00 PM
        "enabled": True,
        "description": "Send profile completion reminders to users"
    }
