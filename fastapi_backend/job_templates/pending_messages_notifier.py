"""
Pending Messages Notifier Job Template
Sends push notifications for unread messages
"""

import logging
from datetime import datetime, timedelta
from typing import Dict, Any, List, Tuple, Optional

from job_templates.base import JobTemplate, JobExecutionContext, JobResult

logger = logging.getLogger(__name__)


class PendingMessagesNotifierTemplate(JobTemplate):
    """
    Job template for sending push notifications about pending/unread messages
    
    - Finds users with unread messages older than threshold
    - Sends push notification reminders
    - Respects notification preferences
    - Prevents spam by tracking last reminder sent
    """
    
    # Template metadata
    template_type = "pending_messages_notifier"
    template_name = "Pending Messages Notifier"
    template_description = "Send push notifications for unread messages"
    category = "notifications"
    icon = "💬"
    
    def get_name(self) -> str:
        return "pending_messages_notifier"
    
    def get_description(self) -> str:
        return "Send push notifications for unread messages"
    
    def get_schema(self) -> Dict[str, Any]:
        return {
            "min_unread_age_minutes": {
                "type": "integer",
                "label": "Minimum Unread Age (Minutes)",
                "description": "Only notify for messages unread for at least this many minutes",
                "default": 30,
                "min": 5,
                "max": 1440
            },
            "reminder_cooldown_hours": {
                "type": "integer",
                "label": "Reminder Cooldown (Hours)",
                "description": "Wait this many hours between reminders for same user",
                "default": 4,
                "min": 1,
                "max": 24
            },
            "batch_size": {
                "type": "integer",
                "label": "Batch Size",
                "description": "Number of users to process per run",
                "default": 100,
                "min": 1,
                "max": 500
            },
            "max_messages_to_show": {
                "type": "integer",
                "label": "Max Messages in Preview",
                "description": "Maximum number of senders to mention in notification",
                "default": 3,
                "min": 1,
                "max": 5
            }
        }
    
    def validate_params(self, params: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        """Validate job parameters"""
        min_age = params.get("min_unread_age_minutes", 30)
        cooldown = params.get("reminder_cooldown_hours", 4)
        batch_size = params.get("batch_size", 100)
        
        if not (5 <= min_age <= 1440):
            return (False, "min_unread_age_minutes must be between 5 and 1440")
        
        if not (1 <= cooldown <= 24):
            return (False, "reminder_cooldown_hours must be between 1 and 24")
        
        if not (1 <= batch_size <= 500):
            return (False, "batch_size must be between 1 and 500")
        
        return (True, None)
    
    async def execute(self, context: JobExecutionContext) -> JobResult:
        """
        Execute pending messages notification job
        
        Returns:
            JobResult with execution statistics
        """
        import time
        start_time = time.time()
        
        db = context.db
        params = context.parameters
        
        min_unread_age_minutes = params.get("min_unread_age_minutes", 30)
        reminder_cooldown_hours = params.get("reminder_cooldown_hours", 4)
        batch_size = params.get("batch_size", 100)
        max_messages_to_show = params.get("max_messages_to_show", 3)
        
        stats = {
            "users_checked": 0,
            "notifications_queued": 0,
            "skipped_cooldown": 0,
            "skipped_no_subscription": 0,
            "errors": 0
        }
        
        try:
            from services.notification_service import NotificationService
            from models.notification_models import NotificationQueueCreate, NotificationTrigger, NotificationChannel
            
            notification_service = NotificationService(db)
            
            # Calculate cutoff times
            now = datetime.utcnow()
            message_cutoff = now - timedelta(minutes=min_unread_age_minutes)
            reminder_cutoff = now - timedelta(hours=reminder_cooldown_hours)
            
            logger.info(f"📬 Checking for unread messages older than {min_unread_age_minutes} minutes")
            
            # Aggregate pipeline to find users with unread messages
            pipeline = [
                # Find unread messages older than threshold
                {
                    "$match": {
                        "isRead": False,
                        "createdAt": {"$lte": message_cutoff.isoformat()}
                    }
                },
                # Group by recipient
                {
                    "$group": {
                        "_id": "$toUsername",
                        "unreadCount": {"$sum": 1},
                        "senders": {"$addToSet": "$fromUsername"},
                        "oldestMessage": {"$min": "$createdAt"}
                    }
                },
                # Limit results
                {"$limit": batch_size}
            ]
            
            users_with_unread = await db.messages.aggregate(pipeline).to_list(batch_size)
            
            logger.info(f"📬 Found {len(users_with_unread)} users with unread messages")
            
            for user_data in users_with_unread:
                try:
                    stats["users_checked"] += 1
                    
                    username = user_data["_id"]
                    unread_count = user_data["unreadCount"]
                    senders = user_data["senders"][:max_messages_to_show]
                    
                    # Check if user has active push subscriptions
                    has_subscription = await db.push_subscriptions.find_one({
                        "username": username,
                        "isActive": True
                    })
                    
                    if not has_subscription:
                        stats["skipped_no_subscription"] += 1
                        continue
                    
                    # Check cooldown - don't spam users
                    last_reminder = await db.pending_message_reminders.find_one({
                        "username": username
                    })
                    
                    if last_reminder:
                        last_sent = last_reminder.get("lastSent")
                        if last_sent and last_sent > reminder_cutoff:
                            stats["skipped_cooldown"] += 1
                            continue
                    
                    # Get sender names for personalization
                    sender_names = []
                    for sender_username in senders:
                        sender = await db.users.find_one({"username": sender_username})
                        if sender:
                            sender_names.append(sender.get("firstName", sender_username))
                        else:
                            sender_names.append(sender_username)
                    
                    # Build notification message
                    if len(sender_names) == 1:
                        body = f"[L3V3LMATCHES] You have {unread_count} unread message{'s' if unread_count > 1 else ''} from {sender_names[0]}"
                    elif len(sender_names) == 2:
                        body = f"[L3V3LMATCHES] You have {unread_count} unread messages from {sender_names[0]} and {sender_names[1]}"
                    else:
                        others_count = len(senders) - 2
                        body = f"[L3V3LMATCHES] You have {unread_count} unread messages from {sender_names[0]}, {sender_names[1]} and {others_count} other{'s' if others_count > 1 else ''}"
                    
                    # Queue push notification
                    try:
                        await notification_service.enqueue_notification(
                            NotificationQueueCreate(
                                username=username,
                                trigger=NotificationTrigger.UNREAD_MESSAGES,
                                channels=[NotificationChannel.PUSH, NotificationChannel.SMS],
                                templateData={
                                    "unreadCount": unread_count,
                                    "senders": sender_names,
                                    "message": body
                                },
                                title="[L3V3LMATCHES] 📬 Unread Messages",
                                message=body
                            )
                        )
                        
                        stats["notifications_queued"] += 1
                        
                        # Update reminder tracking
                        await db.pending_message_reminders.update_one(
                            {"username": username},
                            {
                                "$set": {
                                    "username": username,
                                    "lastSent": now,
                                    "unreadCount": unread_count
                                }
                            },
                            upsert=True
                        )
                        
                        logger.info(f"🔔 Queued pending messages push for {username} ({unread_count} unread)")
                        
                    except Exception as queue_err:
                        # User may have disabled this notification type
                        logger.debug(f"Could not queue notification for {username}: {queue_err}")
                        
                except Exception as e:
                    logger.error(f"Failed to process user {user_data.get('_id')}: {e}")
                    stats["errors"] += 1
            
            duration = time.time() - start_time
            
            logger.info(
                f"✅ Pending messages notifier complete - "
                f"Checked: {stats['users_checked']}, "
                f"Queued: {stats['notifications_queued']}, "
                f"Skipped (cooldown): {stats['skipped_cooldown']}, "
                f"Skipped (no sub): {stats['skipped_no_subscription']} "
                f"(Duration: {duration:.2f}s)"
            )
            
            return JobResult(
                status="success",
                message=f"Processed {stats['users_checked']} users - Queued: {stats['notifications_queued']}",
                details=stats,
                records_processed=stats['users_checked'],
                records_affected=stats['notifications_queued'],
                errors=[],
                warnings=[],
                duration_seconds=round(duration, 2)
            )
            
        except Exception as e:
            duration = time.time() - start_time
            logger.error(f"Pending messages notifier job failed: {e}")
            return JobResult(
                status="failed",
                message=f"Job failed: {str(e)}",
                details=stats,
                records_processed=stats.get('users_checked', 0),
                records_affected=stats.get('notifications_queued', 0),
                errors=[str(e)],
                warnings=[],
                duration_seconds=round(duration, 2)
            )


# Export the template
__all__ = ['PendingMessagesNotifierTemplate']
