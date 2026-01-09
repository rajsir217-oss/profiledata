"""
Profile Completion Reminder Job Template
Sends reminders to users with incomplete profiles
"""

from typing import Dict, Any, Tuple, Optional
from datetime import datetime, timedelta

from .base import JobTemplate, JobExecutionContext, JobResult
from services.notification_service import NotificationService


class ProfileCompletionReminderTemplate(JobTemplate):
    """Job template for sending profile completion reminders"""
    
    # Template metadata
    template_type = "profile_completion_reminder"
    template_name = "Profile Completion Reminder"
    template_description = "Send reminders to users with incomplete profiles or missing photos"
    category = "notifications"
    icon = "📝"
    estimated_duration = "2-5 minutes"
    resource_usage = "medium"
    risk_level = "low"
    
    def validate_params(self, params: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        """Validate job parameters"""
        min_age_hours = params.get("minAccountAgeHours", 24)
        if not isinstance(min_age_hours, int) or min_age_hours < 1:
            return False, "minAccountAgeHours must be a positive integer"
        
        min_completeness = params.get("minCompleteness", 75)
        if not isinstance(min_completeness, int) or min_completeness < 0 or min_completeness > 100:
            return False, "minCompleteness must be between 0 and 100"
        
        return True, None
    
    def get_default_params(self) -> Dict[str, Any]:
        """Get default parameters"""
        return {
            "minAccountAgeHours": 24,  # Don't spam new users immediately
            "minCompleteness": 75,  # Notify if profile < 75% complete
            "checkPhotos": True,  # Check for missing photos
            "batchSize": 100,
            "reminderIntervalDays": 3  # Don't spam daily
        }
    
    def get_schema(self) -> Dict[str, Any]:
        """Get parameter schema for UI"""
        return {
            "minAccountAgeHours": {
                "type": "integer",
                "label": "Minimum Account Age (Hours)",
                "description": "Only remind users whose accounts are at least this old",
                "default": 24,
                "min": 1
            },
            "minCompleteness": {
                "type": "integer",
                "label": "Completeness Threshold (%)",
                "description": "Send reminder if profile completeness is below this",
                "default": 75,
                "min": 0,
                "max": 100
            },
            "checkPhotos": {
                "type": "boolean",
                "label": "Check for Photos",
                "description": "Send separate reminder for users with no photos",
                "default": True
            },
            "batchSize": {
                "type": "integer",
                "label": "Batch Size",
                "description": "Number of users to process per run",
                "default": 100,
                "min": 1,
                "max": 500
            },
            "reminderIntervalDays": {
                "type": "integer",
                "label": "Reminder Interval (Days)",
                "description": "Wait this many days between reminders",
                "default": 3,
                "min": 1
            }
        }
    
    async def execute(self, context: JobExecutionContext) -> JobResult:
        """Execute the profile completion reminder job"""
        start_time = datetime.utcnow()
        photo_reminders = 0
        profile_reminders = 0
        errors = []
        
        try:
            service = NotificationService(context.db)
            params = context.parameters
            
            min_age_hours = params.get("minAccountAgeHours", 24)
            min_completeness = params.get("minCompleteness", 75)
            check_photos = params.get("checkPhotos", True)
            batch_size = params.get("batchSize", 100)
            reminder_interval_days = params.get("reminderIntervalDays", 3)
            
            # Calculate cutoff times
            now = datetime.utcnow()
            account_age_cutoff = now - timedelta(hours=min_age_hours)
            last_reminder_cutoff = now - timedelta(days=reminder_interval_days)
            
            context.log("info", f"Checking for incomplete profiles (completeness < {min_completeness}%)")
            
            # Find users with incomplete profiles
            incomplete_profiles = await context.db.users.find({
                "createdAt": {"$lte": account_age_cutoff},  # Account old enough
                "$or": [
                    {"lastProfileReminderSent": None},  # Never reminded
                    {"lastProfileReminderSent": {"$lte": last_reminder_cutoff}}  # Last reminder was a while ago
                ]
            }).limit(batch_size).to_list(batch_size)
            
            context.log("info", f"Found {len(incomplete_profiles)} users to check")
            
            for user in incomplete_profiles:
                try:
                    username = user.get("username")
                    if not username:
                        continue
                    
                    # Calculate profile completeness
                    completeness = self._calculate_completeness(user)
                    has_photos = len(user.get("photos", [])) > 0
                    
                    # Get user's first name for template
                    recipient_firstName = user.get("firstName", username)
                    
                    # Check if we should send photo reminder
                    if check_photos and not has_photos:
                        # Account at least 24 hours old, no photos
                        account_age_hours = (now - user.get("createdAt", now)).total_seconds() / 3600
                        
                        if account_age_hours >= 24:
                            await service.queue_notification(
                                username=username,
                                trigger="upload_photos",
                                channels=["email"],
                                template_data={
                                    "recipient_firstName": recipient_firstName,
                                    "profile": {
                                        "completeness": completeness
                                    }
                                },
                                priority="low"
                            )
                            photo_reminders += 1
                            context.log("info", f"Sent photo upload reminder to {username}")
                    
                    # Check if profile is incomplete
                    elif completeness < min_completeness:
                        # Get missing fields
                        missing_fields = self._get_missing_fields(user)
                        
                        await service.queue_notification(
                            username=username,
                            trigger="profile_incomplete",
                            channels=["email"],
                            template_data={
                                "recipient_firstName": recipient_firstName,
                                "profile": {
                                    "completeness": completeness,
                                    "missingFields": ", ".join(missing_fields)
                                }
                            },
                            priority="low"
                        )
                        profile_reminders += 1
                        context.log("info", f"Sent profile completion reminder to {username} ({completeness}% complete)")
                    
                    # Update last reminder timestamp
                    if photo_reminders > 0 or profile_reminders > 0:
                        await context.db.users.update_one(
                            {"username": username},
                            {"$set": {"lastProfileReminderSent": now}}
                        )
                    
                except Exception as e:
                    error_msg = f"Failed to process user {user.get('username')}: {str(e)}"
                    errors.append(error_msg)
                    context.log("error", error_msg)
            
            duration = (datetime.utcnow() - start_time).total_seconds()
            total_reminders = photo_reminders + profile_reminders
            
            return JobResult(
                status="success" if not errors else "partial",
                message=f"Sent {total_reminders} profile completion reminders",
                details={
                    "photo_reminders": photo_reminders,
                    "profile_reminders": profile_reminders,
                    "total": total_reminders,
                    "users_checked": len(incomplete_profiles)
                },
                records_processed=len(incomplete_profiles),
                records_affected=total_reminders,
                errors=errors[:10],
                duration_seconds=duration
            )
            
        except Exception as e:
            duration = (datetime.utcnow() - start_time).total_seconds()
            context.log("error", f"Job failed: {str(e)}")
            return JobResult(
                status="failed",
                message=f"Failed to check incomplete profiles: {str(e)}",
                errors=[str(e)],
                duration_seconds=duration
            )
    
    def _calculate_completeness(self, user: Dict) -> int:
        """Calculate profile completeness percentage"""
        fields_to_check = [
            "firstName", "dateOfBirth", "gender", "location", 
            "bio", "profession", "education", "height",
            "religion", "ethnicity", "photos"
        ]
        
        filled_count = 0
        for field in fields_to_check:
            value = user.get(field)
            if value:
                if isinstance(value, list):
                    if len(value) > 0:
                        filled_count += 1
                elif isinstance(value, str):
                    if value.strip():
                        filled_count += 1
                else:
                    filled_count += 1
        
        return int((filled_count / len(fields_to_check)) * 100)
    
    def _get_missing_fields(self, user: Dict) -> list:
        """Get list of missing profile fields"""
        field_labels = {
            "firstName": "name",
            "dateOfBirth": "age",
            "bio": "bio",
            "profession": "profession",
            "education": "education",
            "height": "height",
            "photos": "photos"
        }
        
        missing = []
        for field, label in field_labels.items():
            value = user.get(field)
            if not value or (isinstance(value, (list, str)) and len(value) == 0):
                missing.append(label)
        
        return missing


# Export the template
__all__ = ['ProfileCompletionReminderTemplate']
