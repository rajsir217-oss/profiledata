"""
Enterprise Event Dispatcher Service
Centralized event handling system for all user actions using Redis Pub/Sub
Production-ready with error handling, retry logic, and comprehensive logging
"""
import json
import logging
import asyncio
from typing import Dict, Any, List, Optional, Callable
from datetime import datetime
from enum import Enum

from redis_manager import get_redis_manager
from services.notification_service import NotificationService

logger = logging.getLogger(__name__)


class UserEventType(str, Enum):
    """All possible user interaction events"""
    # Favorites
    FAVORITE_ADDED = "favorite_added"
    FAVORITE_REMOVED = "favorite_removed"
    MUTUAL_FAVORITE = "mutual_favorite"
    
    # Shortlist
    SHORTLIST_ADDED = "shortlist_added"
    SHORTLIST_REMOVED = "shortlist_removed"
    
    # Exclusions/Blocking
    USER_EXCLUDED = "user_excluded"
    USER_UNEXCLUDED = "user_unexcluded"
    
    # Profile Views
    PROFILE_VIEWED = "profile_viewed"
    
    # Messages
    MESSAGE_SENT = "message_sent"
    MESSAGE_READ = "message_read"
    UNREAD_MESSAGES = "unread_messages"
    
    # PII/Privacy
    PII_REQUESTED = "pii_requested"
    PII_GRANTED = "pii_granted"
    PII_REJECTED = "pii_rejected"
    PII_REVOKED = "pii_revoked"
    
    # User Management (Admin)
    USER_SUSPENDED = "user_suspended"
    USER_UNSUSPENDED = "user_unsuspended"
    USER_BANNED = "user_banned"
    USER_UNBANNED = "user_banned"
    
    # Account Activity
    USER_LOGGED_IN = "user_logged_in"
    USER_LOGGED_OUT = "user_logged_out"
    PROFILE_UPDATED = "profile_updated"
    SUSPICIOUS_LOGIN = "suspicious_login"


class EventDispatcher:
    """
    Enterprise-grade Event Dispatcher
    Handles all user events, publishes to Redis, queues notifications
    """
    
    def __init__(self, db):
        self.db = db
        self.redis = get_redis_manager()
        self.notification_service = NotificationService(db)
        
        # Event channel prefix
        self.EVENT_CHANNEL_PREFIX = "events:"
        
        # Event handlers registry
        self.handlers: Dict[UserEventType, List[Callable]] = {}
        
        # Initialize default handlers
        self._register_default_handlers()
        
    def _register_default_handlers(self):
        """Register default event handlers for notifications"""
        # Favorites
        self.register_handler(UserEventType.FAVORITE_ADDED, self._handle_favorite_added)
        self.register_handler(UserEventType.FAVORITE_REMOVED, self._handle_favorite_removed)
        self.register_handler(UserEventType.MUTUAL_FAVORITE, self._handle_mutual_favorite)
        
        # Shortlist
        self.register_handler(UserEventType.SHORTLIST_ADDED, self._handle_shortlist_added)
        self.register_handler(UserEventType.SHORTLIST_REMOVED, self._handle_shortlist_removed)
        
        # Exclusions
        self.register_handler(UserEventType.USER_EXCLUDED, self._handle_user_excluded)
        
        # Profile
        self.register_handler(UserEventType.PROFILE_VIEWED, self._handle_profile_viewed)
        
        # Messages
        self.register_handler(UserEventType.MESSAGE_SENT, self._handle_message_sent)
        self.register_handler(UserEventType.UNREAD_MESSAGES, self._handle_unread_messages)
        
        # PII
        self.register_handler(UserEventType.PII_REQUESTED, self._handle_pii_requested)
        self.register_handler(UserEventType.PII_GRANTED, self._handle_pii_granted)
        self.register_handler(UserEventType.PII_REJECTED, self._handle_pii_rejected)
        
        # Admin actions
        self.register_handler(UserEventType.USER_SUSPENDED, self._handle_user_suspended)
        self.register_handler(UserEventType.USER_BANNED, self._handle_user_banned)
        
        # Security
        self.register_handler(UserEventType.SUSPICIOUS_LOGIN, self._handle_suspicious_login)
    
    def register_handler(self, event_type: UserEventType, handler: Callable):
        """Register a handler for an event type"""
        if event_type not in self.handlers:
            self.handlers[event_type] = []
        self.handlers[event_type].append(handler)
        logger.debug(f"📝 Registered handler for {event_type}")
    
    async def dispatch(
        self,
        event_type: UserEventType,
        actor_username: str,
        target_username: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
        priority: str = "medium"  # Changed from "normal" to valid enum value
    ) -> bool:
        """
        Dispatch an event through the system
        
        Args:
            event_type: Type of event (UserEventType enum)
            actor_username: User who performed the action
            target_username: User who is affected (if applicable)
            metadata: Additional event data
            priority: Event priority (low, medium, high, critical)
        
        Returns:
            bool: Success status
        """
        try:
            # Build event payload
            event_data = {
                "event_type": event_type.value,
                "actor": actor_username,
                "target": target_username,
                "metadata": metadata or {},
                "timestamp": datetime.utcnow().isoformat(),
                "priority": priority
            }
            
            logger.info(
                f"📤 Dispatching event: {event_type.value} | "
                f"Actor: {actor_username} | Target: {target_username}"
            )
            
            # Publish to Redis pub/sub for real-time processing (optional)
            try:
                if self.redis and self.redis.redis_client:
                    channel = f"{self.EVENT_CHANNEL_PREFIX}{event_type.value}"
                    self.redis.publish(channel, json.dumps(event_data))
                else:
                    logger.debug("⚠️ Redis not connected, skipping pub/sub (not critical)")
            except Exception as redis_err:
                logger.warning(f"⚠️ Redis publish failed: {redis_err} (continuing anyway)")
            
            # Log to activity logger
            try:
                from services.activity_logger import get_activity_logger
                from models.activity_models import ActivityType
                
                # Map event types to activity types
                event_to_activity_map = {
                    UserEventType.FAVORITE_ADDED: ActivityType.FAVORITE_ADDED,
                    UserEventType.FAVORITE_REMOVED: ActivityType.FAVORITE_REMOVED,
                    UserEventType.SHORTLIST_ADDED: ActivityType.SHORTLIST_ADDED,
                    UserEventType.SHORTLIST_REMOVED: ActivityType.SHORTLIST_REMOVED,
                    UserEventType.USER_EXCLUDED: ActivityType.EXCLUSION_ADDED,
                    UserEventType.PROFILE_VIEWED: ActivityType.PROFILE_VIEWED,
                    UserEventType.MESSAGE_SENT: ActivityType.MESSAGE_SENT,
                    UserEventType.MESSAGE_READ: ActivityType.MESSAGE_READ,
                    UserEventType.PII_REQUESTED: ActivityType.PII_REQUEST_SENT,
                    UserEventType.PII_GRANTED: ActivityType.PII_REQUEST_APPROVED,
                    UserEventType.PII_REJECTED: ActivityType.PII_REQUEST_DENIED,
                    UserEventType.PII_REVOKED: ActivityType.PII_ACCESS_REVOKED,
                    UserEventType.USER_SUSPENDED: ActivityType.USER_SUSPENDED,
                    UserEventType.USER_BANNED: ActivityType.USER_BANNED,
                    UserEventType.USER_LOGGED_IN: ActivityType.USER_LOGIN,
                    UserEventType.USER_LOGGED_OUT: ActivityType.USER_LOGOUT,
                    UserEventType.PROFILE_UPDATED: ActivityType.PROFILE_EDITED
                }
                
                activity_type = event_to_activity_map.get(event_type)
                if activity_type:
                    activity_logger = get_activity_logger()
                    await activity_logger.log_activity(
                        username=actor_username,
                        action_type=activity_type,
                        target_username=target_username,
                        metadata=metadata or {},
                        pii_logged=(event_type in [
                            UserEventType.PII_REQUESTED,
                            UserEventType.PII_GRANTED,
                            UserEventType.PII_REJECTED
                        ])
                    )
            except Exception as activity_err:
                logger.warning(f"⚠️ Activity logging failed: {activity_err} (continuing anyway)")
            
            # Execute registered handlers asynchronously
            handlers = self.handlers.get(event_type, [])
            if handlers:
                # Run all handlers in parallel with error isolation
                tasks = [
                    self._safe_execute_handler(handler, event_data)
                    for handler in handlers
                ]
                await asyncio.gather(*tasks, return_exceptions=True)
            else:
                logger.warning(f"⚠️ No handlers registered for {event_type}")
            
            logger.info(f"✅ Event dispatched successfully: {event_type.value}")
            return True
            
        except Exception as e:
            logger.error(
                f"❌ Error dispatching event {event_type}: {e}",
                exc_info=True
            )
            return False
    
    async def _safe_execute_handler(self, handler: Callable, event_data: Dict) -> None:
        """Execute handler with error isolation"""
        try:
            if asyncio.iscoroutinefunction(handler):
                await handler(event_data)
            else:
                handler(event_data)
        except Exception as e:
            logger.error(
                f"❌ Error in event handler {handler.__name__}: {e}",
                exc_info=True
            )
    
    # ============================================
    # Default Event Handlers (Notification Triggers)
    # ============================================
    
    async def _handle_favorite_added(self, event_data: Dict):
        """Handle favorite_added event"""
        try:
            target = event_data.get("target")
            actor = event_data.get("actor")
            
            if not target or not actor:
                return
            
            # Check if it's mutual
            is_mutual = await self._is_mutual_favorite(actor, target)
            
            if is_mutual:
                # Trigger mutual favorite event
                await self.dispatch(
                    UserEventType.MUTUAL_FAVORITE,
                    actor_username=actor,
                    target_username=target,
                    priority="high"
                )
            else:
                # Queue notification
                result = await self.notification_service.queue_notification(
                    username=target,
                    trigger="favorited",
                    channels=["email", "push"],
                    template_data={
                        "match": {
                            "firstName": actor,
                            "username": actor
                        }
                    }
                )
                if result:
                    logger.info(f"📧 Queued 'favorited' notification for {target}")
                else:
                    logger.warning(f"⚠️ Could not queue 'favorited' notification for {target} (check user preferences)")
                
        except Exception as e:
            logger.error(f"❌ Error handling favorite_added: {e}", exc_info=True)
    
    async def _handle_favorite_removed(self, event_data: Dict):
        """Handle favorite_removed event - cancel pending notification"""
        try:
            target = event_data.get("target")
            actor = event_data.get("actor")
            
            if not target or not actor:
                return
            
            logger.info(f"📊 Favorite removed: {actor} removed {target}")
            
            # Cancel any pending 'favorited' notification for this target
            # This prevents duplicate notifications if user adds, removes, adds again
            result = await self.db.notification_queue.delete_many({
                "username": target,
                "trigger": "favorited",
                "status": {"$in": ["pending", "scheduled"]},
                "templateData.match.username": actor
            })
            
            if result.deleted_count > 0:
                logger.info(f"🗑️ Cancelled {result.deleted_count} pending 'favorited' notification(s) for {target} from {actor}")
            
        except Exception as e:
            logger.error(f"❌ Error handling favorite_removed: {e}", exc_info=True)
    
    async def _handle_mutual_favorite(self, event_data: Dict):
        """Handle mutual_favorite event"""
        try:
            actor = event_data.get("actor")
            target = event_data.get("target")
            
            # Send notification to BOTH users
            for user in [actor, target]:
                other_user = target if user == actor else actor
                await self.notification_service.queue_notification(
                    username=user,
                    trigger="mutual_favorite",
                    channels=["email", "sms", "push"],
                    template_data={
                        "match": {
                            "firstName": other_user,
                            "username": other_user
                        }
                    },
                    priority="high"
                )
            logger.info(f"💕 Queued mutual_favorite notifications for {actor} and {target}")
            
        except Exception as e:
            logger.error(f"❌ Error handling mutual_favorite: {e}", exc_info=True)
    
    async def _handle_shortlist_added(self, event_data: Dict):
        """Handle shortlist_added event"""
        try:
            target = event_data.get("target")
            actor = event_data.get("actor")
            
            await self.notification_service.queue_notification(
                username=target,
                trigger="shortlist_added",
                channels=["email"],
                template_data={
                    "match": {
                        "firstName": actor,
                        "username": actor
                    }
                }
            )
            logger.info(f"📧 Queued 'shortlist_added' notification for {target}")
            
        except Exception as e:
            logger.error(f"❌ Error handling shortlist_added: {e}", exc_info=True)
    
    async def _handle_shortlist_removed(self, event_data: Dict):
        """Handle shortlist_removed event - cancel pending notification"""
        try:
            target = event_data.get("target")
            actor = event_data.get("actor")
            
            if not target or not actor:
                return
            
            logger.info(f"📊 Shortlist removed: {actor} removed {target}")
            
            # Cancel any pending 'shortlist_added' notification for this target
            result = await self.db.notification_queue.delete_many({
                "username": target,
                "trigger": "shortlist_added",
                "status": {"$in": ["pending", "scheduled"]},
                "templateData.match.username": actor
            })
            
            if result.deleted_count > 0:
                logger.info(f"🗑️ Cancelled {result.deleted_count} pending 'shortlist_added' notification(s) for {target} from {actor}")
            
        except Exception as e:
            logger.error(f"❌ Error handling shortlist_removed: {e}", exc_info=True)
    
    async def _handle_user_excluded(self, event_data: Dict):
        """Handle user_excluded event - No notification (privacy)"""
        logger.info(f"🚫 User excluded: {event_data.get('actor')} excluded {event_data.get('target')}")
    
    async def _handle_profile_viewed(self, event_data: Dict):
        """Handle profile_viewed event"""
        try:
            target = event_data.get("target")
            actor = event_data.get("actor")
            
            # Only notify if user has profile view notifications enabled
            await self.notification_service.queue_notification(
                username=target,
                trigger="profile_view",
                channels=["push"],  # Low priority - push only
                template_data={
                    "viewer": {
                        "username": actor
                    }
                }
            )
            logger.info(f"📧 Queued 'profile_view' notification for {target}")
            
        except Exception as e:
            logger.error(f"❌ Error handling profile_viewed: {e}", exc_info=True)
    
    async def _handle_message_sent(self, event_data: Dict):
        """Handle message_sent event"""
        try:
            target = event_data.get("target")
            actor = event_data.get("actor")
            metadata = event_data.get("metadata", {})
            
            await self.notification_service.queue_notification(
                username=target,
                trigger="new_message",
                channels=["sms", "push"],  # Real-time channels
                template_data={
                    "sender": {
                        "username": actor
                    },
                    "message_preview": metadata.get("preview", "")
                },
                priority="high"
            )
            logger.info(f"📧 Queued 'new_message' notification for {target}")
            
        except Exception as e:
            logger.error(f"❌ Error handling message_sent: {e}", exc_info=True)
    
    async def _handle_unread_messages(self, event_data: Dict):
        """Handle unread_messages digest"""
        try:
            target = event_data.get("target")
            metadata = event_data.get("metadata", {})
            
            await self.notification_service.queue_notification(
                username=target,
                trigger="unread_messages",
                channels=["email"],
                template_data={
                    "unread_count": metadata.get("count", 0),
                    "senders": metadata.get("senders", [])
                }
            )
            logger.info(f"📧 Queued 'unread_messages' notification for {target}")
            
        except Exception as e:
            logger.error(f"❌ Error handling unread_messages: {e}", exc_info=True)
    
    async def _handle_pii_requested(self, event_data: Dict):
        """Handle pii_requested event"""
        try:
            target = event_data.get("target")
            actor = event_data.get("actor")
            metadata = event_data.get("metadata", {})
            
            await self.notification_service.queue_notification(
                username=target,
                trigger="pii_request",
                channels=["email", "sms"],
                template_data={
                    "requester": {
                        "username": actor
                    },
                    "request_type": metadata.get("type", "contact_info")
                },
                priority="high"
            )
            logger.info(f"📧 Queued 'pii_request' notification for {target}")
            
        except Exception as e:
            logger.error(f"❌ Error handling pii_requested: {e}", exc_info=True)
    
    async def _handle_pii_granted(self, event_data: Dict):
        """Handle pii_granted event"""
        try:
            target = event_data.get("target")  # The requester
            actor = event_data.get("actor")  # The granter
            
            await self.notification_service.queue_notification(
                username=target,
                trigger="pii_granted",
                channels=["email", "push"],
                template_data={
                    "granter": {
                        "username": actor
                    }
                },
                priority="high"
            )
            logger.info(f"📧 Queued 'pii_granted' notification for {target}")
            
        except Exception as e:
            logger.error(f"❌ Error handling pii_granted: {e}", exc_info=True)
    
    async def _handle_pii_rejected(self, event_data: Dict):
        """Handle pii_rejected event"""
        try:
            target = event_data.get("target")
            
            await self.notification_service.queue_notification(
                username=target,
                trigger="pii_rejected",
                channels=["email"],
                template_data={}
            )
            logger.info(f"📧 Queued 'pii_rejected' notification for {target}")
            
        except Exception as e:
            logger.error(f"❌ Error handling pii_rejected: {e}", exc_info=True)
    
    async def _handle_user_suspended(self, event_data: Dict):
        """Handle user_suspended event"""
        try:
            target = event_data.get("target")
            metadata = event_data.get("metadata", {})
            
            await self.notification_service.queue_notification(
                username=target,
                trigger="account_suspended",
                channels=["email", "sms"],
                template_data={
                    "reason": metadata.get("reason", "Policy violation"),
                    "duration": metadata.get("duration", "Indefinite"),
                    "appeal_url": metadata.get("appeal_url", "")
                },
                priority="critical"
            )
            logger.info(f"📧 Queued 'account_suspended' notification for {target}")
            
        except Exception as e:
            logger.error(f"❌ Error handling user_suspended: {e}", exc_info=True)
    
    async def _handle_user_banned(self, event_data: Dict):
        """Handle user_banned event"""
        try:
            target = event_data.get("target")
            metadata = event_data.get("metadata", {})
            
            await self.notification_service.queue_notification(
                username=target,
                trigger="account_banned",
                channels=["email", "sms"],
                template_data={
                    "reason": metadata.get("reason", "Severe policy violation")
                },
                priority="critical"
            )
            logger.info(f"📧 Queued 'account_banned' notification for {target}")
            
        except Exception as e:
            logger.error(f"❌ Error handling user_banned: {e}", exc_info=True)
    
    async def _handle_suspicious_login(self, event_data: Dict):
        """Handle suspicious_login event"""
        try:
            target = event_data.get("target")
            metadata = event_data.get("metadata", {})
            
            await self.notification_service.queue_notification(
                username=target,
                trigger="suspicious_login",
                channels=["email", "sms"],
                template_data={
                    "ip_address": metadata.get("ip", "Unknown"),
                    "location": metadata.get("location", "Unknown"),
                    "device": metadata.get("device", "Unknown"),
                    "timestamp": metadata.get("timestamp", "")
                },
                priority="critical"
            )
            logger.info(f"📧 Queued 'suspicious_login' notification for {target}")
            
        except Exception as e:
            logger.error(f"❌ Error handling suspicious_login: {e}", exc_info=True)
    
    # ============================================
    # Helper Methods
    # ============================================
    
    async def _is_mutual_favorite(self, user1: str, user2: str) -> bool:
        """Check if two users have favorited each other"""
        try:
            fav1 = await self.db.favorites.find_one({
                "userUsername": user1,
                "favoriteUsername": user2
            })
            fav2 = await self.db.favorites.find_one({
                "userUsername": user2,
                "favoriteUsername": user1
            })
            return bool(fav1 and fav2)
        except Exception as e:
            logger.error(f"❌ Error checking mutual favorite: {e}")
            return False


# Global instance
_event_dispatcher = None


def get_event_dispatcher(db) -> EventDispatcher:
    """Get or create event dispatcher instance"""
    global _event_dispatcher
    if _event_dispatcher is None:
        _event_dispatcher = EventDispatcher(db)
    return _event_dispatcher
