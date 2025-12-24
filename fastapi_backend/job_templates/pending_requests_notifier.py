"""
Pending Requests Notifier Job Template
Sends push notifications for pending PII requests that haven't been responded to
"""

import logging
from datetime import datetime, timedelta
from typing import Dict, Any, List, Tuple, Optional

from job_templates.base import JobTemplate, JobExecutionContext, JobResult

logger = logging.getLogger(__name__)


class PendingRequestsNotifierTemplate(JobTemplate):
    """
    Job template for sending push notifications about pending PII requests
    
    - Finds users with pending PII requests older than threshold
    - Sends push notification reminders to respond
    - Respects notification preferences
    - Prevents spam by tracking last reminder sent
    """
    
    # Template metadata
    template_type = "pending_requests_notifier"
    template_name = "Pending Requests Notifier"
    template_description = "Send push notifications for pending PII requests awaiting response"
    category = "notifications"
    icon = "🔔"
    
    def get_name(self) -> str:
        return "pending_requests_notifier"
    
    def get_description(self) -> str:
        return "Send push notifications for pending PII requests awaiting response"
    
    def get_schema(self) -> Dict[str, Any]:
        return {
            "min_pending_age_hours": {
                "type": "integer",
                "label": "Minimum Pending Age (Hours)",
                "description": "Only notify for requests pending for at least this many hours",
                "default": 24,
                "min": 1,
                "max": 168
            },
            "reminder_cooldown_hours": {
                "type": "integer",
                "label": "Reminder Cooldown (Hours)",
                "description": "Wait this many hours between reminders for same user",
                "default": 24,
                "min": 6,
                "max": 72
            },
            "batch_size": {
                "type": "integer",
                "label": "Batch Size",
                "description": "Number of users to process per run",
                "default": 100,
                "min": 1,
                "max": 500
            }
        }
    
    def validate_params(self, params: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        """Validate job parameters"""
        min_age = params.get("min_pending_age_hours", 24)
        cooldown = params.get("reminder_cooldown_hours", 24)
        batch_size = params.get("batch_size", 100)
        
        if not (1 <= min_age <= 168):
            return (False, "min_pending_age_hours must be between 1 and 168")
        
        if not (6 <= cooldown <= 72):
            return (False, "reminder_cooldown_hours must be between 6 and 72")
        
        if not (1 <= batch_size <= 500):
            return (False, "batch_size must be between 1 and 500")
        
        return (True, None)
    
    async def execute(self, context: JobExecutionContext) -> JobResult:
        """
        Execute pending requests notification job
        
        Returns:
            JobResult with execution statistics
        """
        import time
        start_time = time.time()
        
        db = context.db
        params = context.parameters
        
        min_pending_age_hours = params.get("min_pending_age_hours", 24)
        reminder_cooldown_hours = params.get("reminder_cooldown_hours", 24)
        batch_size = params.get("batch_size", 100)
        
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
            request_cutoff = now - timedelta(hours=min_pending_age_hours)
            reminder_cutoff = now - timedelta(hours=reminder_cooldown_hours)
            
            logger.info(f"🔔 Checking for pending PII requests older than {min_pending_age_hours} hours")
            
            # Aggregate pipeline to find users with pending requests
            pipeline = [
                # Find pending requests older than threshold
                {
                    "$match": {
                        "status": "pending",
                        "requestedAt": {"$lte": request_cutoff}
                    }
                },
                # Group by profile owner (the one who needs to respond)
                {
                    "$group": {
                        "_id": "$profileUsername",
                        "pendingCount": {"$sum": 1},
                        "requesters": {"$addToSet": "$requesterUsername"},
                        "oldestRequest": {"$min": "$requestedAt"}
                    }
                },
                # Limit results
                {"$limit": batch_size}
            ]
            
            users_with_pending = await db.pii_requests.aggregate(pipeline).to_list(batch_size)
            
            logger.info(f"🔔 Found {len(users_with_pending)} users with pending PII requests")
            
            for user_data in users_with_pending:
                try:
                    stats["users_checked"] += 1
                    
                    username = user_data["_id"]
                    pending_count = user_data["pendingCount"]
                    requesters = user_data["requesters"][:3]  # Show max 3 names
                    
                    # Check if user has active push subscriptions
                    has_subscription = await db.push_subscriptions.find_one({
                        "username": username,
                        "isActive": True
                    })
                    
                    if not has_subscription:
                        stats["skipped_no_subscription"] += 1
                        continue
                    
                    # Check cooldown - don't spam users
                    last_reminder = await db.pending_request_reminders.find_one({
                        "username": username
                    })
                    
                    if last_reminder:
                        last_sent = last_reminder.get("lastSent")
                        if last_sent and last_sent > reminder_cutoff:
                            stats["skipped_cooldown"] += 1
                            continue
                    
                    # Get requester names for personalization
                    requester_names = []
                    for requester_username in requesters:
                        requester = await db.users.find_one({"username": requester_username})
                        if requester:
                            requester_names.append(requester.get("firstName", requester_username))
                        else:
                            requester_names.append(requester_username)
                    
                    # Build notification message
                    if pending_count == 1:
                        body = f"[L3V3LMATCHES] {requester_names[0]} is waiting for your response to their contact request"
                    elif len(requester_names) == 2:
                        body = f"[L3V3LMATCHES] {requester_names[0]} and {requester_names[1]} are waiting for your response"
                    else:
                        others_count = pending_count - 2
                        body = f"[L3V3LMATCHES] {requester_names[0]}, {requester_names[1]} and {others_count} other{'s' if others_count > 1 else ''} are waiting for your response"
                    
                    # Queue push notification
                    try:
                        await notification_service.enqueue_notification(
                            NotificationQueueCreate(
                                username=username,
                                trigger=NotificationTrigger.PENDING_PII_REQUEST,
                                channels=[NotificationChannel.EMAIL, NotificationChannel.SMS, NotificationChannel.PUSH],
                                templateData={
                                    "pendingCount": pending_count,
                                    "requesters": requester_names,
                                    "message": body
                                },
                                title="[L3V3LMATCHES] 🔔 Pending Contact Requests",
                                message=body
                            )
                        )
                        
                        stats["notifications_queued"] += 1
                        
                        # Update reminder tracking
                        await db.pending_request_reminders.update_one(
                            {"username": username},
                            {
                                "$set": {
                                    "username": username,
                                    "lastSent": now,
                                    "pendingCount": pending_count
                                }
                            },
                            upsert=True
                        )
                        
                        logger.info(f"🔔 Queued pending requests push for {username} ({pending_count} pending)")
                        
                    except Exception as queue_err:
                        # User may have disabled this notification type
                        logger.debug(f"Could not queue notification for {username}: {queue_err}")
                        
                except Exception as e:
                    logger.error(f"Failed to process user {user_data.get('_id')}: {e}")
                    stats["errors"] += 1
            
            duration = time.time() - start_time
            
            logger.info(
                f"✅ Pending requests notifier complete - "
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
            logger.error(f"Pending requests notifier job failed: {e}")
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
__all__ = ['PendingRequestsNotifierTemplate']
