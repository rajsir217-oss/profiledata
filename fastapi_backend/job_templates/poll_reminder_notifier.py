"""
Poll Reminder Notifier Job Template
Sends SMS/Email/Push notifications to members who haven't responded to active polls
"""

import logging
from datetime import datetime, timedelta
from typing import Dict, Any, List, Tuple, Optional

from job_templates.base import JobTemplate, JobExecutionContext, JobResult

logger = logging.getLogger(__name__)


class PollReminderNotifierTemplate(JobTemplate):
    """
    Job template for sending reminders to users who haven't responded to active polls
    
    - Finds active polls with pending responses
    - Identifies users who haven't responded
    - Sends email/SMS/push notification reminders
    - Respects notification preferences and cooldown periods
    - Tracks reminder history to prevent spam
    """
    
    # Template metadata
    template_type = "poll_reminder_notifier"
    template_name = "Poll Reminder Notifier"
    template_description = "Send reminders to members who haven't responded to active polls"
    category = "notifications"
    icon = "🔔"
    estimated_duration = "1-5 minutes"
    resource_usage = "low"
    risk_level = "low"
    
    def get_name(self) -> str:
        return "poll_reminder_notifier"
    
    def get_description(self) -> str:
        return "Send reminders to members who haven't responded to active polls"
    
    def get_schema(self) -> Dict[str, Any]:
        return {
            "reminder_cooldown_hours": {
                "type": "integer",
                "label": "Reminder Cooldown (Hours)",
                "description": "Wait this many hours between reminders for same user/poll",
                "default": 24,
                "min": 1,
                "max": 168
            },
            "min_poll_age_hours": {
                "type": "integer",
                "label": "Minimum Poll Age (Hours)",
                "description": "Only send reminders for polls active for at least this many hours",
                "default": 1,
                "min": 0,
                "max": 168
            },
            "days_before_event": {
                "type": "integer",
                "label": "Days Before Event",
                "description": "Send reminder when event is within this many days",
                "default": 7,
                "min": 1,
                "max": 30
            },
            "batch_size": {
                "type": "integer",
                "label": "Batch Size",
                "description": "Number of users to process per run",
                "default": 100,
                "min": 1,
                "max": 500
            },
            "channels": {
                "type": "array",
                "label": "Notification Channels",
                "description": "Which channels to use for reminders",
                "default": ["email", "push"],
                "options": ["email", "sms", "push"]
            },
            "include_event_polls_only": {
                "type": "boolean",
                "label": "Event Polls Only",
                "description": "Only send reminders for polls with event dates",
                "default": True
            }
        }
    
    def validate_params(self, params: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        """Validate job parameters"""
        cooldown = params.get("reminder_cooldown_hours", 24)
        min_age = params.get("min_poll_age_hours", 24)
        batch_size = params.get("batch_size", 100)
        days_before = params.get("days_before_event", 7)
        
        if not (1 <= cooldown <= 168):
            return (False, "reminder_cooldown_hours must be between 1 and 168")
        
        if not (1 <= min_age <= 168):
            return (False, "min_poll_age_hours must be between 1 and 168")
        
        if not (1 <= batch_size <= 500):
            return (False, "batch_size must be between 1 and 500")
        
        if not (1 <= days_before <= 30):
            return (False, "days_before_event must be between 1 and 30")
        
        return (True, None)
    
    def get_default_params(self) -> Dict[str, Any]:
        """Get default parameters"""
        return {
            "reminder_cooldown_hours": 24,
            "min_poll_age_hours": 1,
            "days_before_event": 7,
            "batch_size": 100,
            "channels": ["email", "push"],
            "include_event_polls_only": True
        }
    
    async def execute(self, context: JobExecutionContext) -> JobResult:
        """
        Execute poll reminder notification job
        
        Returns:
            JobResult with execution statistics
        """
        import time
        start_time = time.time()
        
        db = context.db
        params = context.parameters
        
        reminder_cooldown_hours = params.get("reminder_cooldown_hours", 24)
        min_poll_age_hours = params.get("min_poll_age_hours", 24)
        days_before_event = params.get("days_before_event", 7)
        batch_size = params.get("batch_size", 100)
        channels = params.get("channels", ["email", "push"])
        include_event_polls_only = params.get("include_event_polls_only", True)
        
        stats = {
            "polls_checked": 0,
            "users_checked": 0,
            "notifications_queued": 0,
            "skipped_cooldown": 0,
            "skipped_preferences": 0,
            "skipped_no_contact": 0,
            "errors": 0
        }
        
        try:
            from services.notification_service import NotificationService
            from models.notification_models import (
                NotificationQueueCreate, 
                NotificationTrigger, 
                NotificationChannel,
                NotificationPriority
            )
            
            notification_service = NotificationService(db)
            
            # Calculate cutoff times
            now = datetime.utcnow()
            poll_age_cutoff = now - timedelta(hours=min_poll_age_hours)
            reminder_cutoff = now - timedelta(hours=reminder_cooldown_hours)
            event_date_cutoff = now + timedelta(days=days_before_event)
            
            logger.info(f"🔔 Checking for active polls needing reminders")
            logger.info(f"   - Poll age cutoff: {poll_age_cutoff}")
            logger.info(f"   - Event date cutoff: {event_date_cutoff}")
            
            # Build query for active polls
            poll_query = {
                "status": "active",
                "created_at": {"$lte": poll_age_cutoff}
            }
            
            # If only event polls, require event_date
            if include_event_polls_only:
                poll_query["event_date"] = {
                    "$exists": True,
                    "$ne": None,
                    "$lte": event_date_cutoff  # Compare datetime to datetime
                }
            
            # Get active polls
            active_polls = await db.polls.find(poll_query).to_list(50)
            
            logger.info(f"🔔 Found {len(active_polls)} active polls to check")
            
            for poll in active_polls:
                try:
                    stats["polls_checked"] += 1
                    poll_id = str(poll["_id"])
                    poll_title = poll.get("title", "Untitled Poll")
                    event_date = poll.get("event_date")
                    event_time = poll.get("event_time", "")
                    
                    logger.info(f"📋 Processing poll: {poll_title}")
                    
                    # Get users who have already responded
                    responded_usernames = set()
                    responses = await db.poll_responses.find({"poll_id": poll_id}).to_list(1000)
                    for response in responses:
                        responded_usernames.add(response.get("username"))
                    
                    logger.info(f"   - {len(responded_usernames)} users have responded")
                    
                    # Determine target users
                    if poll.get("target_all_users"):
                        # Get all active users
                        user_query = {
                            "accountStatus": "active",
                            "username": {"$nin": list(responded_usernames)}
                        }
                    else:
                        # Get targeted users who haven't responded
                        target_usernames = poll.get("target_usernames", [])
                        if not target_usernames:
                            continue
                        user_query = {
                            "username": {
                                "$in": target_usernames,
                                "$nin": list(responded_usernames)
                            },
                            "accountStatus": "active"
                        }
                    
                    # Get users who haven't responded
                    pending_users = await db.users.find(user_query).limit(batch_size).to_list(batch_size)
                    
                    logger.info(f"   - {len(pending_users)} users haven't responded")
                    
                    for user in pending_users:
                        try:
                            stats["users_checked"] += 1
                            username = user.get("username")
                            
                            # Check cooldown - don't spam users
                            last_reminder = await db.poll_reminders.find_one({
                                "username": username,
                                "poll_id": poll_id
                            })
                            
                            if last_reminder:
                                last_sent = last_reminder.get("last_sent")
                                if last_sent and last_sent > reminder_cutoff:
                                    stats["skipped_cooldown"] += 1
                                    continue
                            
                            # Get user contact info
                            email = user.get("email") or user.get("contactEmail")
                            phone = user.get("phone") or user.get("contactNumber")
                            first_name = user.get("firstName", username)
                            
                            # 🔓 Decrypt PII if encrypted
                            from crypto_utils import get_encryptor
                            encryptor = get_encryptor()
                            
                            logger.info(f"🔍 User {username}: email={email[:20] if email else None}..., phone={phone[:10] if phone else None}...")
                            
                            if email and email.startswith('gAAAAA'):
                                try:
                                    decrypted = encryptor.decrypt(email)
                                    logger.info(f"🔓 Decrypted email for {username}: {decrypted[:3]}***@{decrypted.split('@')[1] if '@' in decrypted else '***'}")
                                    email = decrypted
                                except Exception as decrypt_err:
                                    logger.warning(f"❌ Failed to decrypt email for {username}: {decrypt_err}")
                                    email = None
                            
                            if phone and phone.startswith('gAAAAA'):
                                try:
                                    decrypted = encryptor.decrypt(phone)
                                    logger.info(f"🔓 Decrypted phone for {username}: ***{decrypted[-4:] if len(decrypted) >= 4 else '****'}")
                                    phone = decrypted
                                except Exception as decrypt_err:
                                    logger.warning(f"❌ Failed to decrypt phone for {username}: {decrypt_err}")
                                    phone = None
                            
                            logger.info(f"📧 After decrypt - {username}: email={'YES' if email else 'NO'}, phone={'YES' if phone else 'NO'}")
                            
                            # Build notification content
                            subject = f"🔔 Reminder: Please respond to poll - {poll_title}"
                            
                            if event_date:
                                try:
                                    event_dt = datetime.fromisoformat(event_date.replace('Z', '+00:00'))
                                    event_date_str = event_dt.strftime("%B %d, %Y")
                                    body = f"Hi {first_name},\n\nYou haven't responded to the poll: \"{poll_title}\"\n\nEvent Date: {event_date_str}"
                                    if event_time:
                                        body += f" at {event_time}"
                                    body += "\n\nPlease log in to respond and let us know if you can attend!"
                                except:
                                    body = f"Hi {first_name},\n\nYou haven't responded to the poll: \"{poll_title}\"\n\nPlease log in to respond!"
                            else:
                                body = f"Hi {first_name},\n\nYou haven't responded to the poll: \"{poll_title}\"\n\nPlease log in to respond!"
                            
                            # Queue notifications for each channel
                            notifications_sent = 0
                            
                            for channel in channels:
                                try:
                                    if channel == "email" and email:
                                        notification = NotificationQueueCreate(
                                            username=username,
                                            trigger=NotificationTrigger.POLL_REMINDER,
                                            channels=[NotificationChannel.EMAIL],
                                            priority=NotificationPriority.MEDIUM,
                                            title=subject,
                                            body=body,
                                            metadata={
                                                "poll_id": poll_id,
                                                "poll_title": poll_title,
                                                "event_date": event_date,
                                                "recipient_email": email
                                            }
                                        )
                                        await notification_service.queue_notification(notification)
                                        notifications_sent += 1
                                        
                                    elif channel == "sms" and phone:
                                        sms_body = f"[L3V3LMATCHES] Reminder: Please respond to poll \"{poll_title}\". Log in to respond!"
                                        notification = NotificationQueueCreate(
                                            username=username,
                                            trigger=NotificationTrigger.POLL_REMINDER,
                                            channels=[NotificationChannel.SMS],
                                            priority=NotificationPriority.MEDIUM,
                                            title="Poll Reminder",
                                            body=sms_body,
                                            metadata={
                                                "poll_id": poll_id,
                                                "poll_title": poll_title,
                                                "recipient_phone": phone
                                            }
                                        )
                                        await notification_service.queue_notification(notification)
                                        notifications_sent += 1
                                        
                                    elif channel == "push":
                                        # Check if user has push subscription
                                        has_subscription = await db.push_subscriptions.find_one({
                                            "username": username,
                                            "isActive": True
                                        })
                                        
                                        if has_subscription:
                                            notification = NotificationQueueCreate(
                                                username=username,
                                                trigger=NotificationTrigger.POLL_REMINDER,
                                                channels=[NotificationChannel.PUSH],
                                                priority=NotificationPriority.MEDIUM,
                                                title=f"🔔 Poll Reminder",
                                                body=f"Please respond to: {poll_title}",
                                                metadata={
                                                    "poll_id": poll_id,
                                                    "poll_title": poll_title,
                                                    "action_url": f"/polls/{poll_id}"
                                                }
                                            )
                                            await notification_service.queue_notification(notification)
                                            notifications_sent += 1
                                        
                                except Exception as channel_error:
                                    logger.error(f"Error sending {channel} notification: {channel_error}")
                            
                            if notifications_sent > 0:
                                stats["notifications_queued"] += notifications_sent
                                
                                # Update reminder tracking
                                await db.poll_reminders.update_one(
                                    {"username": username, "poll_id": poll_id},
                                    {
                                        "$set": {
                                            "last_sent": datetime.utcnow(),
                                            "poll_title": poll_title
                                        },
                                        "$inc": {"reminder_count": 1}
                                    },
                                    upsert=True
                                )
                            else:
                                stats["skipped_no_contact"] += 1
                                
                        except Exception as user_error:
                            logger.error(f"Error processing user {user.get('username')}: {user_error}")
                            stats["errors"] += 1
                            
                except Exception as poll_error:
                    logger.error(f"Error processing poll {poll.get('_id')}: {poll_error}")
                    stats["errors"] += 1
            
            execution_time = time.time() - start_time
            
            logger.info(f"✅ Poll reminder job completed in {execution_time:.2f}s")
            logger.info(f"   Stats: {stats}")
            
            return JobResult(
                status="success",
                message=f"Processed {stats['polls_checked']} polls, queued {stats['notifications_queued']} reminders",
                details=stats,
                records_processed=stats['users_checked'],
                records_affected=stats['notifications_queued'],
                duration_seconds=execution_time
            )
            
        except Exception as e:
            logger.error(f"❌ Poll reminder job failed: {e}")
            import traceback
            traceback.print_exc()
            
            return JobResult(
                status="failed",
                message=f"Job failed: {str(e)}",
                details=stats,
                errors=[str(e)],
                duration_seconds=time.time() - start_time
            )
