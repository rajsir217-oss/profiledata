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
                NotificationTrigger.UNREAD_MESSAGES: [NotificationChannel.EMAIL],
                
                # Profile Activity
                NotificationTrigger.PROFILE_VIEW: [NotificationChannel.PUSH],
                
                # PII/Privacy
                NotificationTrigger.PII_REQUEST: [NotificationChannel.EMAIL, NotificationChannel.SMS],
                NotificationTrigger.PII_GRANTED: [NotificationChannel.EMAIL, NotificationChannel.PUSH],
                NotificationTrigger.SUSPICIOUS_LOGIN: [NotificationChannel.EMAIL, NotificationChannel.SMS],
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
        
        # Check if user wants this notification
        if not await self._should_send(create_data.trigger, create_data.channels, prefs):
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
        """Get pending notifications ready to send"""
        query = {
            "status": {"$in": [NotificationStatus.PENDING, NotificationStatus.SCHEDULED]},
            "$or": [
                {"scheduledFor": None},
                {"scheduledFor": {"$lte": datetime.utcnow()}}
            ]
        }
        
        if channel:
            query["channels"] = channel
        
        cursor = self.queue_collection.find(query).limit(limit)
        notifications = []
        
        async for doc in cursor:
            # Convert ObjectId to string for JSON serialization
            if "_id" in doc:
                doc["_id"] = str(doc["_id"])
            notifications.append(NotificationQueueItem(**doc))
        
        return notifications
    
    async def mark_as_sent(
        self,
        notification_id: str,
        channel: NotificationChannel,
        success: bool,
        error: Optional[str] = None
    ) -> None:
        """Mark notification as sent"""
        from bson import ObjectId
        
        # Build update document with separate operators
        set_fields = {
            "status": NotificationStatus.SENT if success else NotificationStatus.FAILED,
            "updatedAt": datetime.utcnow(),
            "lastAttempt": datetime.utcnow()
        }
        
        if error:
            set_fields["error"] = error
        
        update_doc = {
            "$set": set_fields,
            "$inc": {"attempts": 1}
        }
        
        # Convert string ID to ObjectId
        try:
            obj_id = ObjectId(notification_id)
        except Exception as e:
            # If not a valid ObjectId, treat as string
            print(f"⚠️ Warning: Could not convert to ObjectId: {notification_id}, error: {e}")
            obj_id = notification_id
        
        # Debug logging
        print(f"🔍 Updating queue item: _id={obj_id}, status={set_fields['status']}")
        
        result = await self.queue_collection.update_one(
            {"_id": obj_id},
            update_doc
        )
        
        # Debug logging
        print(f"📊 Update result: matched={result.matched_count}, modified={result.modified_count}")
    
    # ============================================
    # Template Rendering
    # ============================================
    
    def render_template(
        self,
        template: str,
        variables: Dict[str, Any]
    ) -> str:
        """Render template with variables"""
        result = template
        
        # Replace {variable} with values
        for key, value in variables.items():
            # Support nested keys like {match.firstName}
            if isinstance(value, dict):
                for nested_key, nested_value in value.items():
                    placeholder = f"{{{key}.{nested_key}}}"
                    result = result.replace(placeholder, str(nested_value))
            else:
                placeholder = f"{{{key}}}"
                result = result.replace(placeholder, str(value))
        
        # Handle conditional blocks {% if condition %}...{% endif %}
        result = self._process_conditionals(result, variables)
        
        return result
    
    def _process_conditionals(self, template: str, variables: Dict[str, Any]) -> str:
        """Process {% if %} conditional blocks"""
        # Simple regex for {% if variable %}...{% endif %}
        pattern = r'\{%\s*if\s+(\w+(?:\.\w+)*)\s*([><=!]+)\s*(\w+)\s*%\}(.*?)\{%\s*endif\s*%\}'
        
        def evaluate_condition(match):
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
        
        return re.sub(pattern, evaluate_condition, template, flags=re.DOTALL)
    
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
        cost: float = 0.0
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
        
        await self.log_collection.insert_one(log_entry.dict())
    
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
        user_channels = prefs.channels.get(trigger, [])
        return any(channel in user_channels for channel in channels)
    
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
        priority: str = "medium"  # Changed from "normal" to valid enum value
    ) -> Optional[NotificationQueueItem]:
        """Simple helper to queue a notification"""
        try:
            # Convert string trigger to enum
            trigger_enum = NotificationTrigger(trigger)
            
            # Convert string channels to enums
            channel_enums = [NotificationChannel(ch) for ch in channels]
            
            # Convert priority string to enum
            priority_enum = NotificationPriority(priority)
            
            # Create queue item
            queue_data = NotificationQueueCreate(
                username=username,
                trigger=trigger_enum,
                channels=channel_enums,
                templateData=template_data or {},
                priority=priority_enum,
                scheduledFor=None
            )
            
            # Enqueue
            return await self.enqueue_notification(queue_data)
            
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
