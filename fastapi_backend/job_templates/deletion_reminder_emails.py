"""
Scheduled Job: Send Deletion Reminder Emails
Runs daily at 9:00 AM
Sends reminder emails to users with pending account deletions
"""

from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timedelta
from config import settings
from services.notification_service import NotificationService
import logging
import re

logger = logging.getLogger(__name__)

# Helper function for case-insensitive username lookup
def get_username_query(username: str):
    """Create a case-insensitive MongoDB query for username"""
    return {"username": {"$regex": f"^{re.escape(username)}$", "$options": "i"}}

async def send_deletion_reminder_emails(db, **kwargs):
    """
    Send reminder emails at key intervals:
    - Day 7: First reminder (23 days remaining)
    - Day 23: Final warning (7 days remaining)
    """
    logger.info("📧 Starting deletion reminder email job...")
    
    try:
        # Get all users with pending deletions
        users_pending_deletion = await db.users.find({
            "deletionRequest.status": "pending_deletion"
        }).to_list(1000)
        
        logger.info(f"Found {len(users_pending_deletion)} users with pending deletions")
        
        notification_service = NotificationService(db)
        day7_count = 0
        day23_count = 0
        
        for user in users_pending_deletion:
            try:
                username = user.get("username")
                deletion_request = user.get("deletionRequest", {})
                scheduled_date = datetime.fromisoformat(deletion_request.get("scheduledDeletionDate"))
                days_remaining = (scheduled_date - datetime.utcnow()).days
                
                # Day 7 reminder (23 days remaining)
                if days_remaining == 23 and not deletion_request.get("emailsSent", {}).get("day7Reminder"):
                    await send_day7_reminder(user, scheduled_date, notification_service)
                    await db.users.update_one(
                        {"username": username},
                        {"$set": {"deletionRequest.emailsSent.day7Reminder": True}}
                    )
                    day7_count += 1
                    logger.info(f"✅ Sent day 7 reminder to: {username}")
                
                # Day 23 final warning (7 days remaining)
                elif days_remaining == 7 and not deletion_request.get("emailsSent", {}).get("day23Warning"):
                    await send_day23_warning(user, scheduled_date, notification_service)
                    await db.users.update_one(
                        {"username": username},
                        {"$set": {"deletionRequest.emailsSent.day23Warning": True}}
                    )
                    day23_count += 1
                    logger.info(f"✅ Sent day 23 warning to: {username}")
                    
            except Exception as e:
                logger.error(f"❌ Error processing reminder for {username}: {e}")
                continue
        
        summary = f"Day 7 reminders: {day7_count}, Day 23 warnings: {day23_count}"
        logger.info(f"✅ Deletion reminder job completed. {summary}")
        
        return {
            "status": "success",
            "message": summary,
            "details": {
                "day7Reminders": day7_count,
                "day23Warnings": day23_count,
                "totalProcessed": len(users_pending_deletion)
            }
        }
        
    except Exception as e:
        logger.error(f"❌ Deletion reminder job failed: {e}", exc_info=True)
        return {
            "status": "failed",
            "message": str(e)
        }


async def send_day7_reminder(user: dict, scheduled_date: datetime, notification_service: NotificationService):
    """Send day 7 reminder email (23 days remaining)"""
    first_name = user.get("firstName", user.get("username"))
    
    message = f"""
    Hi {first_name},
    
    Just a reminder that your L3V3L account deletion is scheduled for {scheduled_date.strftime('%B %d, %Y')}.
    
    TIME REMAINING: 23 days
    
    To keep your account, simply log back in:
    https://l3v3lmatches.com/login
    
    Download your data before it's deleted:
    https://l3v3lmatches.com/preferences
    
    If you're leaving due to an issue, we'd love to hear from you:
    support@l3v3lmatches.com
    
    Best regards,
    The L3V3L Team
    """
    
    await notification_service.queue_notification(
        username=user.get("username"),
        notification_type="deletion_day7_reminder",
        channel="email",
        title="23 Days Left - Your L3V3L Account Will Be Deleted",
        message=message,
        metadata={"scheduled_date": scheduled_date.isoformat()}
    )


async def send_day23_warning(user: dict, scheduled_date: datetime, notification_service: NotificationService):
    """Send day 23 final warning email (7 days remaining)"""
    first_name = user.get("firstName", user.get("username"))
    
    message = f"""
    Hi {first_name},
    
    ⚠️ FINAL WARNING: Your L3V3L account will be permanently deleted in 7 days on {scheduled_date.strftime('%B %d, %Y')}.
    
    ⏰ LAST CHANCE TO:
    • Reactivate your account: https://l3v3lmatches.com/login
    • Download your data: https://l3v3lmatches.com/preferences
    
    After {scheduled_date.strftime('%B %d, %Y')}, all your data will be permanently removed and cannot be recovered.
    
    WHAT WILL BE DELETED:
    ✓ Your profile and photos
    ✓ All messages and conversations
    ✓ Match history and favorites
    ✓ Activity logs
    
    If you're leaving due to an issue, please let us know:
    support@l3v3lmatches.com
    
    Best regards,
    The L3V3L Team
    """
    
    await notification_service.queue_notification(
        username=user.get("username"),
        notification_type="deletion_day23_warning",
        channel="email",
        title="⚠️ FINAL WARNING: 7 Days Until Permanent Deletion",
        message=message,
        metadata={"scheduled_date": scheduled_date.isoformat()}
    )


# Job configuration for scheduler
JOB_CONFIG = {
    "name": "deletion_reminder_emails",
    "description": "Send reminder emails to users with pending account deletions",
    "schedule_type": "cron",
    "cron_expression": "0 9 * * *",  # Daily at 9:00 AM
    "enabled": True,
    "function": send_deletion_reminder_emails,
    "timeout_seconds": 300,
    "retry_on_failure": True,
    "max_retries": 2
}
