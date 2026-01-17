"""
Notification Service
Handles notification queue management, template rendering, and delivery
"""

from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from pymongo.database import Database
from fastapi import HTTPException
import re
import pytz
import logging

logger = logging.getLogger(__name__)

from models.notification_models import (
    NotificationQueueItem,
    NotificationQueueCreate,
    NotificationPreferences,
    NotificationLog,
    NotificationTrigger,
    NotificationChannel,
    NotificationPriority,
    NotificationStatus,
    QuietHours
)


class NotificationService:
    """Service for managing notifications"""
    
    def __init__(self, db: Database):
        self.db = db
        self.preferences_collection = db.notification_preferences
        self.queue_collection = db.notification_queue
        self.log_collection = db.notification_log
        self.templates_collection = db.notification_templates
        
    # ============================================
    # Preferences Management
    # ============================================
    
    async def get_preferences(self, username: str) -> Optional[NotificationPreferences]:
        """Get user notification preferences"""
        prefs = await self.preferences_collection.find_one({"username": username})
        if not prefs:
            # Return default preferences
            return await self.create_default_preferences(username)
        return NotificationPreferences(**prefs)
    
    async def create_default_preferences(self, username: str) -> NotificationPreferences:
        """Create default preferences for new user"""
        from models.notification_models import QuietHours, SMSOptimization
        
        default_prefs = NotificationPreferences(
            username=username,
            channels={
                # Matches
                NotificationTrigger.NEW_MATCH: [NotificationChannel.EMAIL, NotificationChannel.PUSH],
                NotificationTrigger.MUTUAL_FAVORITE: [NotificationChannel.EMAIL, NotificationChannel.SMS, NotificationChannel.PUSH],
                NotificationTrigger.FAVORITED: [NotificationChannel.EMAIL, NotificationChannel.PUSH],
                NotificationTrigger.SHORTLIST_ADDED: [NotificationChannel.EMAIL],
                
                # Messages
                NotificationTrigger.NEW_MESSAGE: [NotificationChannel.SMS, NotificationChannel.PUSH],
                NotificationTrigger.UNREAD_MESSAGES: [NotificationChannel.EMAIL, NotificationChannel.SMS, NotificationChannel.PUSH],
                
                # Profile Activity
                NotificationTrigger.PROFILE_VIEW: [NotificationChannel.PUSH],
                
                # PII/Privacy
                NotificationTrigger.PII_REQUEST: [NotificationChannel.EMAIL, NotificationChannel.SMS, NotificationChannel.PUSH],
                NotificationTrigger.PENDING_PII_REQUEST: [NotificationChannel.EMAIL, NotificationChannel.SMS, NotificationChannel.PUSH],
                NotificationTrigger.PII_GRANTED: [NotificationChannel.EMAIL, NotificationChannel.PUSH],
                NotificationTrigger.SUSPICIOUS_LOGIN: [NotificationChannel.EMAIL, NotificationChannel.SMS],
                
                # Polls
                NotificationTrigger.POLL_REMINDER: [NotificationChannel.EMAIL, NotificationChannel.PUSH],
            },
            frequency={
                "instant": [NotificationTrigger.NEW_MATCH, NotificationTrigger.PII_REQUEST],
                "digest": {
                    NotificationTrigger.PROFILE_VIEW: "daily",
                    NotificationTrigger.NEW_MESSAGE: "hourly"
                }
            },
            quietHours=QuietHours(
                enabled=True,
                start="22:00",
                end="08:00",
                timezone="UTC",
                exceptions=[NotificationTrigger.PII_REQUEST, NotificationTrigger.SUSPICIOUS_LOGIN]
            ),
            smsOptimization=SMSOptimization(
                verifiedUsersOnly=True,
                priorityOnly=False,
                costLimit=100.00,
                dailyLimit=10
            )
        )
        
        await self.preferences_collection.insert_one(default_prefs.dict())
        return default_prefs
    
    async def update_preferences(
        self,
        username: str,
        updates: Dict[str, Any]
    ) -> NotificationPreferences:
        """Update user notification preferences"""
        updates["updatedAt"] = datetime.utcnow()
        
        result = await self.preferences_collection.update_one(
            {"username": username},
            {"$set": updates}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Preferences not found")
        
        return await self.get_preferences(username)
    
    # ============================================
    # Queue Management
    # ============================================
    
    async def enqueue_notification(
        self,
        create_data: NotificationQueueCreate
    ) -> NotificationQueueItem:
        """Add notification to queue"""
        
        # Get user preferences
        prefs = await self.get_preferences(create_data.username)
        print(f"📧 enqueue_notification for {create_data.username}, trigger={create_data.trigger}, channels={create_data.channels}", flush=True)
        print(f"📧 User prefs channels: {prefs.channels}", flush=True)
        logger.info(f"📧 enqueue_notification for {create_data.username}, trigger={create_data.trigger}, channels={create_data.channels}")
        logger.info(f"📧 User prefs channels: {prefs.channels}")
        
        # Check if user wants this notification
        should_send = await self._should_send(create_data.trigger, create_data.channels, prefs)
        print(f"📧 _should_send returned: {should_send}", flush=True)
        logger.info(f"📧 _should_send returned: {should_send}")
        if not should_send:
            logger.warning(f"❌ User {create_data.username} has disabled {create_data.trigger} notifications")
            raise HTTPException(
                status_code=400,
                detail=f"User has disabled {create_data.trigger} notifications"
            )
        
        # Check rate limits
        if not await self._check_rate_limit(create_data.username, create_data.channels, prefs):
            raise HTTPException(
                status_code=429,
                detail="Rate limit exceeded"
            )
        
        # Apply quiet hours if needed
        scheduled_for = await self._apply_quiet_hours(
            create_data.scheduledFor,
            create_data.priority,
            prefs.quietHours
        )
        
        # Create queue item
        # Exclude fields we're going to override to avoid duplicate keyword argument error
        create_dict = create_data.dict(exclude={'scheduledFor', 'status'})
        queue_item = NotificationQueueItem(
            **create_dict,
            scheduledFor=scheduled_for,
            status=NotificationStatus.PENDING if scheduled_for is None else NotificationStatus.SCHEDULED
        )
        
        result = await self.queue_collection.insert_one(queue_item.dict())
        queue_item_dict = queue_item.dict()
        queue_item_dict["_id"] = str(result.inserted_id)  # Convert ObjectId to string
        
        return NotificationQueueItem(**queue_item_dict)
    
    async def get_pending_notifications(
        self,
        channel: Optional[NotificationChannel] = None,
        limit: int = 100
    ) -> List[NotificationQueueItem]:
        """
        Get pending notifications ready to send (respects retry delays).
        Uses atomic find_one_and_update to prevent race conditions when
        multiple job instances run simultaneously.
        """
        query = {
            "status": {"$in": [NotificationStatus.PENDING, NotificationStatus.SCHEDULED]},
            "$and": [
                {
                    "$or": [
                        {"scheduledFor": None},
                        {"scheduledFor": {"$lte": datetime.utcnow()}}
                    ]
                },
                {
                    "$or": [
                        {"nextRetryAt": None},  # First attempt
                        {"nextRetryAt": {"$exists": False}},  # Legacy records
                        {"nextRetryAt": {"$lte": datetime.utcnow()}}  # Retry time reached
                    ]
                }
            ]
        }
        
        if channel:
            # Check if channel exists in the channels array
            # Use .value to get the string value from the enum
            channel_value = channel.value if hasattr(channel, 'value') else channel
            query["channels"] = {"$in": [channel_value]}
        
        notifications = []
        
        # Atomically claim notifications one by one to prevent race conditions
        for _ in range(limit):
            # find_one_and_update is atomic - only one process can claim each notification
            doc = await self.queue_collection.find_one_and_update(
                query,
                {
                    "$set": {
                        "status": NotificationStatus.PROCESSING,
                        "processingStartedAt": datetime.utcnow()
                    }
                },
                return_document=True  # Return the updated document
            )
            
            if not doc:
                break  # No more pending notifications
            
            # Convert ObjectId to string for JSON serialization
            if "_id" in doc:
                doc["_id"] = str(doc["_id"])
            notifications.append(NotificationQueueItem(**doc))
        
        return notifications
    
    async def reset_stuck_processing(self, timeout_minutes: int = 10) -> int:
        """
        Reset notifications stuck in PROCESSING state (job crashed).
        Called at the start of each job run to recover from failures.
        Returns count of reset notifications.
        """
        from datetime import timedelta
        
        cutoff_time = datetime.utcnow() - timedelta(minutes=timeout_minutes)
        
        result = await self.queue_collection.update_many(
            {
                "status": NotificationStatus.PROCESSING,
                "processingStartedAt": {"$lt": cutoff_time}
            },
            {
                "$set": {
                    "status": NotificationStatus.PENDING,
                    "statusReason": f"Reset from stuck PROCESSING state after {timeout_minutes} minutes"
                },
                "$inc": {"attempts": 0}  # Don't increment attempts for stuck reset
            }
        )
        
        if result.modified_count > 0:
            print(f"🔄 Reset {result.modified_count} stuck PROCESSING notifications")
        
        return result.modified_count
    
    async def mark_as_sent(
        self,
        notification_id: str,
        channel: NotificationChannel,
        success: bool,
        error: Optional[str] = None
    ) -> None:
        """Mark notification as sent with retry logic"""
        from bson import ObjectId
        from datetime import timedelta
        
        # Convert string ID to ObjectId
        try:
            obj_id = ObjectId(notification_id)
        except Exception as e:
            print(f"⚠️ Warning: Could not convert to ObjectId: {notification_id}, error: {e}")
            obj_id = notification_id
        
        # Get current notification to check attempts
        notification = await self.queue_collection.find_one({"_id": obj_id})
        if not notification:
            print(f"❌ Notification not found: {obj_id}")
            return
        
        current_attempts = notification.get("attempts", 0) + 1  # Increment for this attempt
        max_attempts = 3
        
        # Build update document
        set_fields = {
            "updatedAt": datetime.utcnow(),
            "lastAttempt": datetime.utcnow()
        }
        
        if success:
            # SUCCESS - Mark as sent
            set_fields["status"] = NotificationStatus.SENT
            set_fields["sentAt"] = datetime.utcnow()
            if error:  # Clear any previous error
                set_fields["error"] = None
                set_fields["statusReason"] = None
            print(f"✅ Notification sent successfully: {obj_id}")
        else:
            # FAILED - Check if we should retry
            if current_attempts < max_attempts:
                # RETRY - Keep as pending with exponential backoff
                set_fields["status"] = NotificationStatus.PENDING
                
                # Exponential backoff: 5min, 30min, 2hrs
                backoff_minutes = [5, 30, 120]
                delay_minutes = backoff_minutes[current_attempts - 1] if current_attempts <= len(backoff_minutes) else 120
                next_retry = datetime.utcnow() + timedelta(minutes=delay_minutes)
                set_fields["nextRetryAt"] = next_retry
                
                # Store error details
                set_fields["statusReason"] = error or "Unknown error"
                set_fields["error"] = error
                
                print(f"🔄 Retry {current_attempts}/{max_attempts} scheduled for {next_retry.strftime('%Y-%m-%d %H:%M:%S')}: {obj_id}")
            else:
                # MAX ATTEMPTS REACHED - Mark as failed
                set_fields["status"] = NotificationStatus.FAILED
                set_fields["statusReason"] = error or "Max retry attempts reached"
                set_fields["error"] = error
                set_fields["failedAt"] = datetime.utcnow()
                
                print(f"❌ Notification failed after {current_attempts} attempts: {obj_id}")
                print(f"   Reason: {error}")
        
        update_doc = {
            "$set": set_fields,
            "$inc": {"attempts": 1}
        }
        
        # Update notification
        result = await self.queue_collection.update_one(
            {"_id": obj_id},
            update_doc
        )
        
        print(f"📊 Update result: matched={result.matched_count}, modified={result.modified_count}")
    
    # ============================================
    # Template Rendering
    # ============================================
    
    def render_template(
        self,
        template: str,
        variables: Dict[str, Any]
    ) -> str:
        """Render template with variables (supports both {{var}} and {var} syntax)"""
        result = template
        
        # Replace {{variable}} and {variable} with values
        for key, value in variables.items():
            # Support nested keys like {{match.firstName}} or {match.firstName}
            if isinstance(value, dict):
                for nested_key, nested_value in value.items():
                    # Handle dot notation: {key.nested}
                    double_brace_dot = f"{{{{{key}.{nested_key}}}}}"  # {{key.nested}}
                    single_brace_dot = f"{{{key}.{nested_key}}}"       # {key.nested}
                    
                    # Handle underscore notation: {key_nested}
                    double_brace_underscore = f"{{{{{key}_{nested_key}}}}}"  # {{key_nested}}
                    single_brace_underscore = f"{{{key}_{nested_key}}}"       # {key_nested}
                    
                    str_value = str(nested_value) if nested_value is not None else ""
                    result = result.replace(double_brace_dot, str_value)
                    result = result.replace(single_brace_dot, str_value)
                    result = result.replace(double_brace_underscore, str_value)
                    result = result.replace(single_brace_underscore, str_value)
            else:
                # Handle both double and single brace syntax
                double_brace = f"{{{{{key}}}}}"  # {{key}}
                single_brace = f"{{{key}}}"       # {key}
                
                str_value = str(value) if value is not None else ""
                result = result.replace(double_brace, str_value)
                result = result.replace(single_brace, str_value)
        
        # Handle conditional blocks {% if condition %}...{% endif %}
        result = self._process_conditionals(result, variables)
        
        return result
    
    def _process_conditionals(self, template: str, variables: Dict[str, Any]) -> str:
        """Process {% if %} conditional blocks"""
        
        # First, handle simple truthiness checks: {% if variable %}
        simple_pattern = r'\{%\s*if\s+(\w+(?:\.\w+)*)\s*%\}(.*?)\{%\s*endif\s*%\}'
        
        def evaluate_simple(match):
            var_path = match.group(1)
            content = match.group(2)
            
            # Get variable value
            var_value = self._get_nested_value(variables, var_path)
            
            # Check truthiness (not None, not empty string, not False)
            if var_value and var_value != '':
                return content
            return ''
        
        template = re.sub(simple_pattern, evaluate_simple, template, flags=re.DOTALL)
        
        # Then handle comparison conditionals: {% if variable >= value %}
        comparison_pattern = r'\{%\s*if\s+(\w+(?:\.\w+)*)\s*([><=!]+)\s*(\w+)\s*%\}(.*?)\{%\s*endif\s*%\}'
        
        def evaluate_comparison(match):
            var_path = match.group(1)
            operator = match.group(2)
            value = match.group(3)
            content = match.group(4)
            
            # Get variable value
            var_value = self._get_nested_value(variables, var_path)
            
            # Evaluate condition
            try:
                if operator == '>=':
                    if float(var_value) >= float(value):
                        return content
                elif operator == '>':
                    if float(var_value) > float(value):
                        return content
                elif operator == '==':
                    if str(var_value) == str(value):
                        return content
            except:
                pass
            
            return ''
        
        template = re.sub(comparison_pattern, evaluate_comparison, template, flags=re.DOTALL)
        
        return template
    
    def _get_nested_value(self, data: Dict[str, Any], path: str) -> Any:
        """Get nested dictionary value from path like 'match.firstName'"""
        keys = path.split('.')
        value = data
        for key in keys:
            if isinstance(value, dict):
                value = value.get(key)
            else:
                return None
        return value
    
    # ============================================
    # Logging & Analytics
    # ============================================
    
    async def log_notification(
        self,
        username: str,
        trigger: NotificationTrigger,
        channel: NotificationChannel,
        priority: NotificationPriority,
        status: NotificationStatus = NotificationStatus.SENT,
        subject: Optional[str] = None,
        preview: Optional[str] = None,
        cost: float = 0.0,
        template_data: Optional[Dict[str, Any]] = None  # Include for lineage tracking
    ) -> None:
        """Log sent notification for analytics"""
        log_entry = NotificationLog(
            username=username,
            trigger=trigger,
            channel=channel,
            priority=priority,
            status=status,
            subject=subject,
            preview=preview,
            cost=cost,
            sentAt=datetime.utcnow()
        )
        
        # Add template data (includes lineage_token) to log entry
        log_dict = log_entry.dict()
        if template_data:
            log_dict["templateData"] = template_data
        
        await self.log_collection.insert_one(log_dict)
    
    async def track_open(self, log_id: str) -> None:
        """Track notification opened"""
        await self.log_collection.update_one(
            {"_id": log_id},
            {
                "$set": {
                    "opened": True,
                    "openedAt": datetime.utcnow()
                }
            }
        )
    
    async def track_click(self, log_id: str) -> None:
        """Track link clicked in notification"""
        await self.log_collection.update_one(
            {"_id": log_id},
            {
                "$set": {
                    "clicked": True,
                    "clickedAt": datetime.utcnow()
                }
            }
        )
    
    async def get_analytics(
        self,
        username: Optional[str] = None,
        trigger: Optional[NotificationTrigger] = None,
        channel: Optional[NotificationChannel] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """Get notification analytics"""
        query = {}
        
        if username:
            query["username"] = username
        if trigger:
            query["trigger"] = trigger
        if channel:
            query["channel"] = channel
        if start_date or end_date:
            query["createdAt"] = {}
            if start_date:
                query["createdAt"]["$gte"] = start_date
            if end_date:
                query["createdAt"]["$lte"] = end_date
        
        # Aggregate statistics
        pipeline = [
            {"$match": query},
            {
                "$group": {
                    "_id": None,
                    "totalSent": {"$sum": 1},
                    "totalOpened": {"$sum": {"$cond": ["$opened", 1, 0]}},
                    "totalClicked": {"$sum": {"$cond": ["$clicked", 1, 0]}},
                    "totalCost": {"$sum": "$cost"}
                }
            }
        ]
        
        result = await self.log_collection.aggregate(pipeline).to_list(1)
        
        if not result:
            return {
                "totalSent": 0,
                "totalOpened": 0,
                "totalClicked": 0,
                "openRate": 0.0,
                "clickRate": 0.0,
                "totalCost": 0.0
            }
        
        stats = result[0]
        total_sent = stats["totalSent"]
        
        return {
            "totalSent": total_sent,
            "totalOpened": stats["totalOpened"],
            "totalClicked": stats["totalClicked"],
            "openRate": (stats["totalOpened"] / total_sent * 100) if total_sent > 0 else 0.0,
            "clickRate": (stats["totalClicked"] / total_sent * 100) if total_sent > 0 else 0.0,
            "totalCost": stats["totalCost"]
        }
    
    # ============================================
    # Helper Methods
    # ============================================
    
    async def _should_send(
        self,
        trigger: NotificationTrigger,
        channels: List[NotificationChannel],
        prefs: NotificationPreferences
    ) -> bool:
        """Check if user wants this notification"""
        # Admin/system status notifications always bypass user preferences
        # These are critical notifications users cannot opt out of
        system_triggers = [
            NotificationTrigger.STATUS_APPROVED,
            NotificationTrigger.STATUS_SUSPENDED,
            NotificationTrigger.STATUS_BANNED,
            NotificationTrigger.STATUS_PAUSED,
            NotificationTrigger.STATUS_REACTIVATED,
            NotificationTrigger.SUSPICIOUS_LOGIN,
        ]
        if trigger in system_triggers:
            return True
        
        # Triggers that are enabled by default (user can opt-out)
        # If user hasn't set preferences for these, allow them
        default_enabled_triggers = [
            NotificationTrigger.SAVED_SEARCH_MATCHES,
            NotificationTrigger.NEW_MATCH,
            NotificationTrigger.FAVORITED,
            NotificationTrigger.SHORTLIST_ADDED,
            NotificationTrigger.PII_REQUEST,
            NotificationTrigger.PII_GRANTED,
            NotificationTrigger.NEW_MESSAGE,
            NotificationTrigger.MONTHLY_DIGEST,
        ]
        
        # Handle both enum keys and string keys (MongoDB stores as strings due to use_enum_values=True)
        trigger_value = trigger.value if hasattr(trigger, 'value') else trigger
        user_channels = prefs.channels.get(trigger, []) or prefs.channels.get(trigger_value, [])
        
        # If user has no preference set for this trigger and it's a default-enabled one,
        # allow it (default to email channel)
        if not user_channels and trigger in default_enabled_triggers:
            # Default to allowing email for these triggers
            # Handle both enum and string comparison
            email_value = NotificationChannel.EMAIL.value if hasattr(NotificationChannel.EMAIL, 'value') else NotificationChannel.EMAIL
            return NotificationChannel.EMAIL in channels or email_value in channels
        
        # Handle both enum and string values in user_channels
        channel_values = [c.value if hasattr(c, 'value') else c for c in channels]
        user_channel_values = [c.value if hasattr(c, 'value') else c for c in user_channels]
        return any(cv in user_channel_values or c in user_channels for c, cv in zip(channels, channel_values))
    
    async def _check_rate_limit(
        self,
        username: str,
        channels: List[NotificationChannel],
        prefs: NotificationPreferences
    ) -> bool:
        """Check if rate limit allows sending"""
        for channel in channels:
            rate_limit = prefs.rateLimit.get(channel)
            if not rate_limit:
                continue
            
            # Count recent notifications
            period_start = self._get_period_start(rate_limit.period)
            count = await self.log_collection.count_documents({
                "username": username,
                "channel": channel,
                "createdAt": {"$gte": period_start}
            })
            
            if count >= rate_limit.max:
                return False
        
        return True
    
    def _get_period_start(self, period: str) -> datetime:
        """Get start time for rate limit period"""
        now = datetime.utcnow()
        if period == "hourly":
            return now - timedelta(hours=1)
        elif period == "daily":
            return now - timedelta(days=1)
        elif period == "weekly":
            return now - timedelta(weeks=1)
        return now
    
    async def _apply_quiet_hours(
        self,
        scheduled_for: Optional[datetime],
        priority: NotificationPriority,
        quiet_hours: QuietHours
    ) -> Optional[datetime]:
        """Apply quiet hours scheduling"""
        if not quiet_hours.enabled:
            return scheduled_for
        
        # Critical priority bypasses quiet hours
        if priority == NotificationPriority.CRITICAL:
            return scheduled_for
        
        now = datetime.utcnow()
        user_tz = pytz.timezone(quiet_hours.timezone)
        user_time = now.astimezone(user_tz).time()
        
        start_time = datetime.strptime(quiet_hours.start, "%H:%M").time()
        end_time = datetime.strptime(quiet_hours.end, "%H:%M").time()
        
        # Check if current time is in quiet hours
        if start_time <= user_time < end_time:
            # Schedule for end of quiet hours
            next_send_time = datetime.combine(
                now.date(),
                end_time,
                tzinfo=user_tz
            )
            return next_send_time.astimezone(pytz.utc)
        
        return scheduled_for
    
    # ============================================
    # Convenience Methods
    # ============================================
    
    async def queue_notification(
        self,
        username: str,
        trigger: str,
        channels: List[str],
        template_data: Optional[Dict[str, Any]] = None,
        priority: str = "medium",  # Changed from "normal" to valid enum value
        lineage_token: Optional[str] = None  # Track workflow end-to-end
    ) -> Optional[NotificationQueueItem]:
        """
        Simple helper to queue a notification.
        Creates SEPARATE queue entries per channel to allow independent processing.
        """
        try:
            # Convert string trigger to enum
            trigger_enum = NotificationTrigger(trigger)
            
            # Convert priority string to enum
            priority_enum = NotificationPriority(priority)
            
            # Include lineage token in template data for tracking
            enriched_template_data = template_data or {}
            if lineage_token:
                enriched_template_data["lineage_token"] = lineage_token
            
            # Create SEPARATE queue entries per channel to allow independent processing
            # This prevents the race condition where one job claims the notification
            # and blocks other channels from processing it
            last_result = None
            for channel in channels:
                try:
                    channel_enum = NotificationChannel(channel)
                    
                    # Create queue item for this specific channel
                    queue_data = NotificationQueueCreate(
                        username=username,
                        trigger=trigger_enum,
                        channels=[channel_enum],  # Single channel per entry
                        templateData=enriched_template_data,
                        priority=priority_enum,
                        scheduledFor=None
                    )
                    
                    # Enqueue
                    last_result = await self.enqueue_notification(queue_data)
                except Exception as channel_error:
                    import logging
                    logger = logging.getLogger(__name__)
                    logger.warning(f"⚠️ Failed to queue {channel} notification for {username}/{trigger}: {channel_error}")
                    # Continue with other channels
            
            return last_result
            
        except ValueError as e:
            # Invalid enum value
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"❌ Invalid notification parameter for {username}/{trigger}: {e}")
            return None
        except Exception as e:
            import logging
            import traceback
            logger = logging.getLogger(__name__)
            logger.error(f"❌ Error queuing notification for {username}/{trigger}: {e}")
            logger.error(traceback.format_exc())
            return None
