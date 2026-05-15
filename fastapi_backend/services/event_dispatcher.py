"""
Enterprise Event Dispatcher Service
Centralized event handling system for all user actions using Redis Pub/Sub
Production-ready with error handling, retry logic, and comprehensive logging
"""
import json
import logging
import asyncio
from typing import Dict, Any, List, Optional, Callable
from datetime import datetime, date
from enum import Enum

from bson import ObjectId

from redis_manager import get_redis_manager
from services.notification_service import NotificationService

logger = logging.getLogger(__name__)


# Helper function for age calculation
def calculate_age(birthMonth=None, birthYear=None):
    """Calculate age from birth month and year"""
    if not birthMonth or not birthYear:
        return None
    try:
        from datetime import date
        today = date.today()
        age = today.year - birthYear
        if today.month < birthMonth:
            age -= 1
        return age
    except:
        return None


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
    USER_APPROVED = "user_approved"  # Profile activated by admin
    USER_SUSPENDED = "user_suspended"
    USER_UNSUSPENDED = "user_unsuspended"
    USER_BANNED = "user_banned"
    USER_UNBANNED = "user_unbanned"
    USER_PAUSED = "user_paused"  # Account paused by admin
    
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
    
    def __init__(self, db, cache_service=None):
        self.db = db
        self.redis = get_redis_manager()
        self.cache_service = cache_service
        self.notification_service = NotificationService(db, cache_service)
        
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
        self.register_handler(UserEventType.USER_UNEXCLUDED, self._handle_user_unexcluded)
        
        # Profile
        self.register_handler(UserEventType.PROFILE_VIEWED, self._handle_profile_viewed)
        
        # Messages
        self.register_handler(UserEventType.MESSAGE_SENT, self._handle_message_sent)
        self.register_handler(UserEventType.MESSAGE_READ, self._handle_message_read)
        self.register_handler(UserEventType.UNREAD_MESSAGES, self._handle_unread_messages)
        
        # PII
        self.register_handler(UserEventType.PII_REQUESTED, self._handle_pii_requested)
        self.register_handler(UserEventType.PII_GRANTED, self._handle_pii_granted)
        self.register_handler(UserEventType.PII_REJECTED, self._handle_pii_rejected)
        self.register_handler(UserEventType.PII_REVOKED, self._handle_pii_revoked)
        
        # Admin actions
        self.register_handler(UserEventType.USER_APPROVED, self._handle_user_approved)
        self.register_handler(UserEventType.USER_SUSPENDED, self._handle_user_suspended)
        self.register_handler(UserEventType.USER_UNSUSPENDED, self._handle_user_unsuspended)
        self.register_handler(UserEventType.USER_BANNED, self._handle_user_banned)
        self.register_handler(UserEventType.USER_UNBANNED, self._handle_user_unbanned)
        self.register_handler(UserEventType.USER_PAUSED, self._handle_user_paused)
        
        # Account Activity
        self.register_handler(UserEventType.USER_LOGGED_IN, self._handle_user_logged_in)
        self.register_handler(UserEventType.USER_LOGGED_OUT, self._handle_user_logged_out)
        self.register_handler(UserEventType.PROFILE_UPDATED, self._handle_profile_updated)
        
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
                    UserEventType.USER_APPROVED: ActivityType.USER_STATUS_CHANGED,
                    UserEventType.USER_SUSPENDED: ActivityType.USER_SUSPENDED,
                    UserEventType.USER_BANNED: ActivityType.USER_BANNED,
                    UserEventType.USER_PAUSED: ActivityType.USER_STATUS_CHANGED,
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
    # Privacy Settings Helper
    # ============================================
    
    async def _should_batch_to_digest(self, target_username: str, batch_type: str) -> bool:
        """
        Check if notification should be batched into daily digest instead of sent immediately.
        
        Args:
            target_username: The user who would receive the notification
            batch_type: One of 'batchFavorites', 'batchShortlists', 'batchProfileViews', 
                       'batchPiiRequests', 'batchNewMatches'
        
        Returns:
            True if notification should be batched (skip immediate send), False otherwise
        """
        try:
            # Get target's notification preferences
            prefs = await self.db.notification_preferences.find_one({"username": target_username})
            
            # Default digest settings (daily digest ON for all users)
            default_digest = {
                "enabled": True,
                "batchFavorites": True,
                "batchShortlists": True,
                "batchProfileViews": True,
                "batchPiiRequests": True,
                "batchNewMatches": True
            }
            
            if not prefs:
                # No preferences = use defaults (batch to digest)
                should_batch = default_digest.get(batch_type, True)
                if should_batch:
                    logger.info(f"📬 Batching notification for {target_username} (no prefs) - using default digest")
                return should_batch
            
            digest_settings = prefs.get("digestSettings", {})
            
            # Check if digest is enabled (default True)
            if not digest_settings.get("enabled", True):
                return False  # Digest explicitly disabled = send immediately
            
            # Check if this specific type should be batched (default True)
            should_batch = digest_settings.get(batch_type, True)
            
            if should_batch:
                logger.info(f"📬 Batching notification for {target_username} - {batch_type} enabled in digest settings")
            
            return should_batch
            
        except Exception as e:
            logger.warning(f"⚠️ Error checking digest settings for {target_username}: {e}")
            return True  # Default to batching on error (daily digest is default)

    async def _check_actor_privacy(self, actor_username: str, privacy_type: str) -> bool:
        """
        Check if actor has privacy settings enabled that should block notifications.
        
        Args:
            actor_username: The user performing the action
            privacy_type: One of 'hideFavorites', 'hideShortlist', 'hideProfileViews'
        
        Returns:
            True if notification should be blocked (privacy enabled), False otherwise
        """
        try:
            # Get actor's notification preferences
            prefs = await self.db.notification_preferences.find_one({"username": actor_username})
            if not prefs:
                return False  # No preferences = default (not hidden)
            
            privacy_settings = prefs.get("privacySettings", {})
            is_hidden = privacy_settings.get(privacy_type, False)
            
            if is_hidden:
                # Also check if user is premium (non-free_user)
                actor = await self.db.users.find_one({"username": actor_username})
                if actor:
                    role_name = actor.get("role_name", "free_user")
                    # Only premium users can use privacy features
                    if role_name == "free_user":
                        logger.debug(f"🔓 {actor_username} has {privacy_type} enabled but is free_user - ignoring")
                        return False
                    logger.info(f"🔒 {actor_username} has {privacy_type} enabled (role: {role_name}) - blocking notification")
                    return True
            
            return False
        except Exception as e:
            logger.warning(f"⚠️ Error checking privacy settings for {actor_username}: {e}")
            return False  # Default to sending notification on error
    
    # ============================================
    # Default Event Handlers (Notification Triggers)
    # ============================================
    
    async def _handle_favorite_added(self, event_data: Dict):
        """Handle favorite_added event"""
        try:
            target_username = event_data.get("target")
            actor_username = event_data.get("actor")
            
            if not target_username or not actor_username:
                return
            
            logger.info(f"📊 Favorite added: {actor_username} → {target_username}")
            
            # Check if actor has privacy settings to hide favorites (Premium feature)
            if await self._check_actor_privacy(actor_username, "hideFavorites"):
                logger.info(f"🔒 Skipping 'favorited' notification - {actor_username} has hideFavorites enabled")
                return
            
            # Check if target wants to batch favorites into daily digest
            if await self._should_batch_to_digest(target_username, "batchFavorites"):
                logger.info(f"📬 Skipping immediate 'favorited' notification for {target_username} - will be included in daily digest")
                return
            
            # Fetch BOTH user's full data
            actor = await self.db.users.find_one({"username": actor_username})
            target = await self.db.users.find_one({"username": target_username})
            
            if not actor:
                logger.warning(f"Actor user {actor_username} not found")
                return
            
            if not target:
                logger.warning(f"Target user {target_username} not found")
                return
            
            # Decrypt PII fields for BOTH users
            from crypto_utils import get_encryptor
            try:
                encryptor = get_encryptor()
                actor = encryptor.decrypt_user_pii(actor)
                target = encryptor.decrypt_user_pii(target)
            except Exception as e:
                logger.warning(f"Failed to decrypt PII: {e}")
            
            # Queue notification for target user
            # Include both nested (match.firstName) and flattened (match_firstName) for template compatibility
            result = await self.notification_service.queue_notification(
                username=target_username,
                trigger="favorited",
                channels=["email", "push"],
                template_data={
                    "match": {  # Nested format for dot notation
                        "firstName": actor.get("firstName", actor_username),
                        "lastName": actor.get("lastName", ""),
                        "username": actor_username,
                        "profileId": actor.get("profileId", ""),
                        "location": actor.get("location", ""),
                        "occupation": actor.get("occupation", ""),
                        "age": calculate_age(actor.get("birthMonth"), actor.get("birthYear"))
                    },
                    "recipient": {  # Nested format for dot notation
                        "firstName": target.get("firstName", target_username),
                        "lastName": target.get("lastName", ""),
                        "username": target_username,
                        "profileId": target.get("profileId", "")
                    },
                    # Flattened format for underscore notation (auto-handled by render_template now)
                }
            )
            if result:
                logger.info(f"📧 Queued 'favorited' notification for {target_username}")
            else:
                logger.warning(f"⚠️ Could not queue 'favorited' notification for {target_username} (check user preferences)")
                
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
            actor_username = event_data.get("actor")
            target_username = event_data.get("target")
            
            # Fetch both users' data
            actor = await self.db.users.find_one({"username": actor_username})
            target = await self.db.users.find_one({"username": target_username})
            
            if not actor or not target:
                logger.warning(f"User not found: actor={actor_username}, target={target_username}")
                return
            
            # Decrypt PII fields
            from crypto_utils import get_encryptor
            encryptor = get_encryptor()
            try:
                actor = encryptor.decrypt_user_pii(actor)
                target = encryptor.decrypt_user_pii(target)
            except Exception as e:
                logger.warning(f"Failed to decrypt PII: {e}")
            
            # Send notification to BOTH users
            for user_username, user_data, other_user_data in [
                (actor_username, actor, target),
                (target_username, target, actor)
            ]:
                await self.notification_service.queue_notification(
                    username=user_username,
                    trigger="mutual_favorite",
                    channels=["email", "sms", "push"],
                    template_data={
                        "recipient": {
                            "firstName": user_data.get("firstName", user_username),
                            "username": user_username
                        },
                        "match": {
                            "firstName": other_user_data.get("firstName", other_user_data.get("username")),
                            "lastName": other_user_data.get("lastName", ""),
                            "username": other_user_data.get("username"),
                            "profileId": other_user_data.get("profileId", ""),
                            "location": other_user_data.get("location", ""),
                            "occupation": other_user_data.get("occupation", "")
                        }
                    },
                    priority="high"
                )
            logger.info(f"💕 Queued mutual_favorite notifications for {actor_username} and {target_username}")
            
        except Exception as e:
            logger.error(f"❌ Error handling mutual_favorite: {e}", exc_info=True)
    
    async def _handle_shortlist_added(self, event_data: Dict):
        """Handle shortlist_added event"""
        try:
            target_username = event_data.get("target")
            actor_username = event_data.get("actor")
            
            # Check if actor has privacy settings to hide shortlist (Premium feature)
            if await self._check_actor_privacy(actor_username, "hideShortlist"):
                logger.info(f"🔒 Skipping 'shortlist_added' notification - {actor_username} has hideShortlist enabled")
                return
            
            # Check if target wants to batch shortlists into daily digest
            if await self._should_batch_to_digest(target_username, "batchShortlists"):
                logger.info(f"📬 Skipping immediate 'shortlist_added' notification for {target_username} - will be included in daily digest")
                return
            
            # Fetch BOTH user's full data
            actor = await self.db.users.find_one({"username": actor_username})
            target = await self.db.users.find_one({"username": target_username})
            
            if not actor:
                logger.warning(f"Actor user {actor_username} not found")
                return
            
            if not target:
                logger.warning(f"Target user {target_username} not found")
                return
            
            # Decrypt PII fields for BOTH users
            from crypto_utils import get_encryptor
            try:
                encryptor = get_encryptor()
                actor = encryptor.decrypt_user_pii(actor)
                target = encryptor.decrypt_user_pii(target)
            except Exception as e:
                logger.warning(f"Failed to decrypt PII: {e}")
            
            await self.notification_service.queue_notification(
                username=target_username,
                trigger="shortlist_added",
                channels=["email", "push"],  # Add push for immediate notification
                template_data={
                    "match": {  # Use 'match' key for consistency with templates
                        "firstName": actor.get("firstName", actor_username),
                        "lastName": actor.get("lastName", ""),
                        "username": actor_username,
                        "profileId": actor.get("profileId", ""),
                        "location": actor.get("location", ""),
                        "occupation": actor.get("occupation", ""),
                        "education": actor.get("education", ""),
                        "age": calculate_age(actor.get("birthMonth"), actor.get("birthYear"))
                    },
                    "recipient": {
                        "firstName": target.get("firstName", target_username),
                        "lastName": target.get("lastName", ""),
                        "username": target_username,
                        "profileId": target.get("profileId", "")
                    }
                }
            )
            logger.info(f"📧 Queued 'shortlist_added' notification for {target_username}")
            
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
            
            # Check if actor has privacy settings to hide profile views (Premium feature)
            if await self._check_actor_privacy(actor, "hideProfileViews"):
                logger.info(f"🔒 Skipping 'profile_view' notification - {actor} has hideProfileViews enabled")
                return
            
            # Check if target wants to batch profile views into daily digest
            if await self._should_batch_to_digest(target, "batchProfileViews"):
                logger.info(f"📬 Skipping immediate 'profile_view' notification for {target} - will be included in daily digest")
                return
            
            # Fetch viewer's and recipient's profiles
            viewer = await self.db.users.find_one({"username": actor})
            recipient = await self.db.users.find_one({"username": target})
            
            # Only notify if user has profile view notifications enabled
            await self.notification_service.queue_notification(
                username=target,
                trigger="profile_view",
                channels=["email", "push"],  # Pre-filter removes channels user hasn't opted into
                template_data={
                    "recipient": {
                        "firstName": recipient.get("firstName", target) if recipient else target,
                        "username": target
                    },
                    "match": {
                        "firstName": viewer.get("firstName", actor) if viewer else actor,
                        "username": actor,
                        "profileId": viewer.get("profileId", "") if viewer else ""
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
            
            # Fetch sender's and recipient's profiles
            sender = await self.db.users.find_one({"username": actor})
            recipient = await self.db.users.find_one({"username": target})
            
            # Calculate sender age
            sender_age = ""
            if sender:
                sender_age = str(calculate_age(sender.get("birthMonth"), sender.get("birthYear")))
                if sender_age == "0" or sender_age == "None":
                    sender_age = ""
            
            recipient_firstName = recipient.get("firstName", target) if recipient else target
            
            await self.notification_service.queue_notification(
                username=target,
                trigger="new_message",
                channels=["email", "sms", "push"],  # All channels; pre-filter removes those user hasn't opted into
                template_data={
                    "recipient": {
                        "firstName": recipient_firstName,
                        "username": target
                    },
                    "match": {
                        "firstName": sender.get("firstName", actor) if sender else actor,
                        "username": actor,
                        "profileId": sender.get("profileId", "") if sender else "",
                        "age": sender_age
                    },
                    "message": {
                        "preview": metadata.get("preview", "")
                    },
                    "message_preview": metadata.get("preview", "")
                },
                priority="high"
            )
            logger.info(f"📧 Queued 'new_message' notification for {target}")
            
        except Exception as e:
            logger.error(f"❌ Error handling message_sent: {e}", exc_info=True)
    
    async def _handle_message_read(self, event_data: Dict):
        """Handle message_read event - notify sender their message was read"""
        try:
            actor = event_data.get("actor")  # Person who read the message
            target = event_data.get("target")  # Original sender
            metadata = event_data.get("metadata", {})
            
            if not target:
                logger.warning("No target (sender) specified for message_read event")
                return
            
            # Get reader's and recipient's info
            reader = await self.db.users.find_one({"username": actor})
            reader_name = reader.get("firstName", actor) if reader else actor
            recipient_user = await self.db.users.find_one({"username": target})
            
            await self.notification_service.queue_notification(
                username=target,  # Notify the original sender
                trigger="message_read",
                channels=["email", "push"],  # Pre-filter removes channels user hasn't opted into
                template_data={
                    "recipient": {
                        "firstName": recipient_user.get("firstName", target) if recipient_user else target,
                        "username": target
                    },
                    "match": {
                        "firstName": reader_name,
                        "profileId": reader.get("profileId", "") if reader else ""
                    }
                },
                priority="low"
            )
            logger.info(f"📧 Queued 'message_read' notification for {target}")
            
        except Exception as e:
            logger.error(f"❌ Error handling message_read: {e}", exc_info=True)
    
    async def _handle_unread_messages(self, event_data: Dict):
        """Handle unread_messages digest"""
        try:
            target = event_data.get("target")
            metadata = event_data.get("metadata", {})
            
            # Fetch recipient profile for template
            recipient_user = await self.db.users.find_one({"username": target})
            
            await self.notification_service.queue_notification(
                username=target,
                trigger="unread_messages",
                channels=["email"],
                template_data={
                    "recipient": {
                        "firstName": recipient_user.get("firstName", target) if recipient_user else target,
                        "username": target
                    },
                    "unread_count": metadata.get("count", 0),
                    "senders": metadata.get("senders", []),
                    "stats": {
                        "unreadMessages": metadata.get("count", 0)
                    }
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
            
            # Check if target wants to batch PII requests into daily digest (not recommended)
            if await self._should_batch_to_digest(target, "batchPiiRequests"):
                logger.info(f"📬 Skipping immediate 'pii_request' notification for {target} - will be included in daily digest (not recommended)")
                return
            
            # Fetch requester's profile with all needed fields
            requester = await self.db.users.find_one({"username": actor})
            requester_firstName = requester.get("firstName", actor) if requester else actor
            
            # Extract requester details for email template
            requester_age = ""
            requester_location = ""
            requester_profession = ""
            
            if requester:
                # Calculate age from birthMonth/birthYear
                birth_month = requester.get("birthMonth")
                birth_year = requester.get("birthYear")
                if birth_month and birth_year:
                    from datetime import datetime
                    now = datetime.utcnow()
                    try:
                        age = now.year - int(birth_year)
                        if now.month < int(birth_month):
                            age -= 1
                        requester_age = str(age)
                    except (ValueError, TypeError):
                        requester_age = ""
                
                # Get location - use region (unencrypted) instead of location (encrypted)
                requester_location = requester.get("region", "") or requester.get("city", "") or requester.get("state", "")
                
                # Get profession from workExperience or occupation
                if requester.get("workExperience") and len(requester.get("workExperience", [])) > 0:
                    work = requester["workExperience"][0]
                    requester_profession = work.get("position", "") or work.get("description", "") or work.get("company", "")
                else:
                    requester_profession = requester.get("occupation", "")
            
            # Fetch recipient's profile for personalization
            recipient = await self.db.users.find_one({"username": target})
            recipient_firstName = recipient.get("firstName", target) if recipient else target
            
            await self.notification_service.queue_notification(
                username=target,
                trigger="pii_request",
                channels=["email", "sms", "push"],
                template_data={
                    # Nested format for dot notation: {match.firstName}, {match.age}, etc.
                    "match": {
                        "firstName": requester_firstName,
                        "username": actor,
                        "profileId": requester.get("profileId", "") if requester else "",
                        "age": requester_age,
                        "location": requester_location,
                        "profession": requester_profession,
                        "matchScore": metadata.get("matchScore", "")
                    },
                    # Nested format for recipient: {recipient.firstName}
                    "recipient": {
                        "firstName": recipient_firstName,
                        "username": target
                    },
                    # Flattened format for underscore notation: {match_firstName}
                    "match_firstName": requester_firstName,
                    "match_username": actor,
                    "match_age": requester_age,
                    "match_location": requester_location,
                    "match_profession": requester_profession,
                    "recipient_firstName": recipient_firstName,
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
            
            # Fetch granter's profile to get firstName and other details
            granter_profile = await self.db.users.find_one({"username": actor})
            granter_firstName = (
                granter_profile.get("firstName") or 
                granter_profile.get("firstname") or 
                actor
            ) if granter_profile else actor
            
            # Fetch recipient's profile for personalization
            recipient_firstName, _, _ = await self._get_user_names(target)
            
            # Build template data with granter info (use 'match' key for consistency)
            template_data = {
                "match": {
                    "username": actor,
                    "firstName": granter_firstName,
                    "profileId": granter_profile.get("profileId", "") if granter_profile else "",
                    "age": granter_profile.get("age", "N/A") if granter_profile else "N/A",
                    "location": granter_profile.get("location", "") if granter_profile else ""
                },
                # Nested format for dot notation: {recipient.firstName}
                "recipient": {"firstName": recipient_firstName, "username": target},
                # Flattened format for underscore notation
                "match_firstName": granter_firstName,
                "recipient_firstName": recipient_firstName
            }
            
            await self.notification_service.queue_notification(
                username=target,
                trigger="pii_granted",
                channels=["email", "push", "sms"],  # Add SMS for important contact info
                template_data=template_data,
                priority="high"
            )
            logger.info(f"📧 Queued 'pii_granted' notification for {target}")
            
        except Exception as e:
            logger.error(f"❌ Error handling pii_granted: {e}", exc_info=True)
    
    async def _handle_pii_rejected(self, event_data: Dict):
        """Handle pii_rejected event"""
        try:
            target = event_data.get("target")
            actor = event_data.get("actor")  # The one who rejected
            
            # Get names for both parties
            recipient_firstName, _, _ = await self._get_user_names(target)
            if actor:
                rejecter_firstName, _, _ = await self._get_user_names(actor)
            else:
                rejecter_firstName = "Someone"
            
            await self.notification_service.queue_notification(
                username=target,
                trigger="pii_denied",
                channels=["email", "push", "sms"],  # Add SMS for important contact info
                template_data={
                    "recipient": {"firstName": recipient_firstName, "username": target},
                    "recipient_firstName": recipient_firstName,
                    "match_firstName": rejecter_firstName,
                    "match": {
                        "firstName": rejecter_firstName,
                        "profileId": ""  # Rejecter profileId not exposed for privacy
                    }
                }
            )
            logger.info(f"📧 Queued 'pii_rejected' notification for {target}")
            
        except Exception as e:
            logger.error(f"❌ Error handling pii_rejected: {e}", exc_info=True)
    
    async def _handle_user_approved(self, event_data: Dict):
        """Handle user_approved event - profile activated by admin"""
        try:
            target = event_data.get("target")
            metadata = event_data.get("metadata", {})
            lineage_token = metadata.get("lineage_token")
            
            # Use the trigger from notification config (handles reactivation vs approval)
            trigger = metadata.get("notification_trigger", "status_approved")
            old_status = metadata.get("old_status", "")
            
            # Get user's names using consistent helper
            firstname, lastname, full_name = await self._get_user_names(target, metadata)
            
            # Determine appropriate message based on transition
            if old_status in ["suspended", "paused"]:
                message = "Your account has been reactivated! You now have full access to all features again."
            else:
                message = "Your profile has been approved and is now active. You can now access all features and start connecting with matches!"
            
            logger.info(f"📧 Queueing '{trigger}' for {target} with firstname={firstname}, lastname={lastname}")

            should_send_email = metadata.get("notification_should_send_email", True)

            if should_send_email:
                await self.notification_service.queue_notification(
                    username=target,
                    trigger=trigger,
                    channels=["email"],  # Email only for admin status changes
                    template_data={
                        "username": target,
                        "profileId": metadata.get("profileId", ""),
                        "firstname": firstname,
                        "lastname": lastname,
                        "full_name": full_name,
                        "status": "active",
                        "old_status": old_status,
                        "message": message
                    },
                    priority="high",
                    lineage_token=lineage_token,
                    force_send=True  # Admin status notifications bypass user preference checks
                )
                logger.info(f"✅ Queued '{trigger}' notification for {target} (lineage: {lineage_token})")
            else:
                logger.info(
                    f"ℹ️ Skipping email notification for user_approved: target={target} trigger={trigger} (lineage: {lineage_token})"
                )

            await self._post_activation_intro_to_portal_members(target, old_status)
            
        except Exception as e:
            logger.error(f"❌ Error handling user_approved: {e}", exc_info=True)

    async def _post_activation_intro_to_portal_members(self, activated_username: str, old_status: str = "") -> None:
        """Post a system 'Introduction' profile card message to the Portal Members group."""
        if not activated_username:
            return

        try:
            from websocket_manager import online_users, sio
        except Exception as e:
            logger.warning(f"⚠️ Activation intro: dependencies unavailable: {e}")
            return

        now = datetime.utcnow()

        conv = await self.db.messenger_conversations.find_one(
            {"type": "group", "groupName": "Portal Members"}
        )

        if not conv:
            active_users = await self.db.users.find(
                {"accountStatus": "active"},
                {"username": 1},
            ).to_list(None)
            participant_usernames = [u.get("username") for u in active_users if u.get("username")]

            participants = [
                {"username": u, "role": "member", "joinedAt": now}
                for u in participant_usernames
            ]

            doc = {
                "type": "group",
                "participants": participants,
                "groupName": "Portal Members",
                "groupAvatar": "🦋",
                "createdBy": "L3V3LMatchAgent",
                "lastMessageAt": None,
                "lastMessagePreview": None,
                "createdAt": now,
                "updatedAt": now,
            }
            result = await self.db.messenger_conversations.insert_one(doc)
            conv_oid = result.inserted_id
        else:
            conv_oid = conv.get("_id")

        if not conv_oid:
            return

        if not isinstance(conv_oid, ObjectId):
            try:
                conv_oid = ObjectId(str(conv_oid))
            except Exception:
                return

        await self.db.messenger_conversations.update_one(
            {"_id": conv_oid, "participants.username": {"$ne": activated_username}},
            {
                "$push": {
                    "participants": {
                        "username": activated_username,
                        "role": "member",
                        "joinedAt": now,
                    }
                },
                "$set": {"updatedAt": now},
            },
        )

        user = await self.db.users.find_one({"username": activated_username}) or {}
        try:
            from crypto_utils import get_encryptor
            encryptor = get_encryptor()
            user = encryptor.decrypt_user_pii(user)
        except Exception as e:
            logger.warning(f"⚠️ Activation intro: failed to decrypt PII for {activated_username}: {e}")
        first = user.get("firstName") or user.get("firstname") or ""
        last = user.get("lastName") or user.get("lastname") or ""
        full_name = (f"{first} {last}").strip() or activated_username

        raw_dob = user.get("dob") or user.get("dateOfBirth") or None
        birth_year = user.get("birthYear")
        birth_month = user.get("birthMonth")

        age = None
        if raw_dob and isinstance(raw_dob, str):
            try:
                parsed = datetime.fromisoformat(raw_dob.replace("Z", "+00:00")).date()
                today = date.today()
                age = today.year - parsed.year
                if (today.month, today.day) < (parsed.month, parsed.day):
                    age -= 1
            except Exception:
                age = None
        if age is None:
            age = calculate_age(birth_month, birth_year)

        dob_label = None
        if raw_dob and isinstance(raw_dob, str):
            try:
                parsed_dt = datetime.fromisoformat(raw_dob.replace("Z", "+00:00"))
                dob_label = parsed_dt.strftime("%m/%Y")
            except Exception:
                dob_label = None
        if not dob_label and birth_month and birth_year:
            try:
                dob_label = f"{str(birth_month).zfill(2)}/{int(birth_year)}"
            except Exception:
                dob_label = None

        image_visibility = user.get("imageVisibility") or {}
        images = user.get("images") or []
        avatar_path = (
            image_visibility.get("profilePic")
            or (images[0] if images else None)
            or user.get("profileImage")
        )
        # Normalize avatar path to the canonical /api/users/media/{filename}
        # URL the frontend can render. Raw DB paths like "/uploads/foo.jpg"
        # are not served directly by the backend (especially with GCS), so
        # the persisted snapshot would otherwise 404 on refresh.
        if avatar_path:
            try:
                from utils import get_full_image_url
                resolved = get_full_image_url(avatar_path)
                if resolved:
                    avatar_path = resolved
            except Exception as _e:
                logger.warning(f"Failed to resolve avatar URL for activation card: {_e}")

        height_label = None
        height_val = user.get("height")
        if height_val and str(height_val).strip():
            height_label = str(height_val).strip()
        elif user.get("heightFeet"):
            inches = int(user.get("heightInches") or 0)
            height_label = f"{user.get('heightFeet')}'{inches}\""
        elif user.get("heightInches"):
            try:
                total = int(user.get("heightInches"))
                if total > 11:
                    height_label = f"{total // 12}'{total % 12}\""
            except Exception:
                height_label = None

        location = user.get("location") or user.get("currentLocation")
        if not location:
            location = ", ".join(
                [v for v in [user.get("city"), user.get("state"), user.get("country")] if v]
            ) or None

        gender = str(user.get("gender") or "").strip().lower()
        if gender in ("male", "m", "man"):
            intro_message = "Looking for a suitable bride for our son — please review the profile for details and Contact me. Thanks"
        elif gender in ("female", "f", "woman"):
            intro_message = "Looking for a suitable groom for our daughter — please review the profile for details and Contact me. Thanks"
        else:
            intro_message = "Looking for a suitable match — please review the profile for details and Contact me. Thanks"

        is_reactivation = str(old_status or "").strip().lower() in ("suspended", "paused", "banned")
        system_label = "Reactivated" if is_reactivation else "Newly activated"
        system_tag = "reactivated" if is_reactivation else "newly_activated"

        snapshot = {
            "username": activated_username,
            "fullName": full_name,
            "avatarUrl": avatar_path,
            "age": age,
            "dob": raw_dob,
            "dobLabel": dob_label,
            "height": height_label,
            "location": location,
            "educationHistory": user.get("educationHistory") if isinstance(user.get("educationHistory"), list) else [],
            "workExperience": user.get("workExperience") if isinstance(user.get("workExperience"), list) else [],
            "message": intro_message,
            "systemLabel": system_label,
            "systemTag": system_tag,
        }

        msg = {
            "conversationId": conv_oid,
            "senderUsername": "L3V3LMatchAgent",
            "contentType": "profile_card",
            "content": intro_message,
            "status": "sent",
            "deliveredAt": None,
            "readAt": None,
            "readBy": [],
            "replyTo": None,
            "isForwarded": False,
            "isDeleted": False,
            "moderationStatus": "clean",
            "createdAt": now,
            "updatedAt": now,
            "cardSnapshot": snapshot,
        }

        result = await self.db.messenger_messages.insert_one(msg)
        msg_id = str(result.inserted_id)

        await self.db.messenger_conversations.update_one(
            {"_id": conv_oid},
            {
                "$set": {
                    "lastMessageAt": now,
                    "lastMessagePreview": "📇 Reactivated profile" if is_reactivation else "📇 Newly activated profile",
                    "updatedAt": now,
                }
            },
        )

        conv_fresh = await self.db.messenger_conversations.find_one({"_id": conv_oid}) or {}
        payload = {
            "id": msg_id,
            "conversationId": str(conv_oid),
            "senderUsername": "L3V3LMatchAgent",
            "contentType": "profile_card",
            "content": intro_message,
            "status": "sent",
            "createdAt": now.isoformat(),
            "updatedAt": now.isoformat(),
            "isForwarded": False,
            "isDeleted": False,
            "replyTo": None,
            "cardSnapshot": snapshot,
        }

        for p in (conv_fresh.get("participants") or []):
            recipient = p.get("username")
            if recipient and recipient in online_users:
                await sio.emit(
                    "messenger:new_message",
                    {"conversationId": str(conv_oid), "message": payload},
                    room=online_users[recipient],
                )

        logger.info(
            f"✅ Activation intro posted in Portal Members for {activated_username}: message={msg_id}"
        )
    
    async def _handle_user_suspended(self, event_data: Dict):
        """Handle user_suspended event"""
        try:
            target = event_data.get("target")
            metadata = event_data.get("metadata", {})
            lineage_token = metadata.get("lineage_token")
            trigger = metadata.get("notification_trigger", "status_suspended")
            
            # Get user's names using consistent helper
            firstname, lastname, full_name = await self._get_user_names(target, metadata)
            
            await self.notification_service.queue_notification(
                username=target,
                trigger=trigger,
                channels=["email"],  # Email only for admin status changes
                template_data={
                    "username": target,
                    "profileId": metadata.get("profileId", ""),
                    "firstname": firstname,
                    "lastname": lastname,
                    "full_name": full_name,
                    "status": "suspended",
                    "reason": metadata.get("reason", "Pending investigation"),
                    "message": "Your account has been temporarily suspended. Please contact support for more information."
                },
                priority="high",
                lineage_token=lineage_token,
                force_send=True  # Admin status notifications bypass user preference checks
            )
            logger.info(f"📧 Queued '{trigger}' notification for {target} (lineage: {lineage_token})")
            
        except Exception as e:
            logger.error(f"❌ Error handling user_suspended: {e}", exc_info=True)
    
    async def _handle_user_banned(self, event_data: Dict):
        """Handle user_banned event"""
        try:
            target = event_data.get("target")
            metadata = event_data.get("metadata", {})
            lineage_token = metadata.get("lineage_token")
            trigger = metadata.get("notification_trigger", "status_banned")
            
            # Get user's names using consistent helper
            firstname, lastname, full_name = await self._get_user_names(target, metadata)
            
            await self.notification_service.queue_notification(
                username=target,
                trigger=trigger,
                channels=["email"],
                template_data={
                    "username": target,
                    "profileId": metadata.get("profileId", ""),
                    "firstname": firstname,
                    "lastname": lastname,
                    "full_name": full_name,
                    "status": "banned",
                    "reason": metadata.get("reason", "Violation of terms of service"),
                    "message": "Your account has been permanently banned and you can no longer access USVedika."
                },
                priority="high",
                lineage_token=lineage_token,
                force_send=True  # Admin status notifications bypass user preference checks
            )
            logger.info(f"📧 Queued '{trigger}' notification for {target} (lineage: {lineage_token})")
            
        except Exception as e:
            logger.error(f"❌ Error handling user_banned: {e}", exc_info=True)
    
    async def _handle_user_paused(self, event_data: Dict):
        """Handle user_paused event"""
        try:
            target = event_data.get("target")
            metadata = event_data.get("metadata", {})
            lineage_token = metadata.get("lineage_token")
            trigger = metadata.get("notification_trigger", "status_paused")
            
            # Get user's names using consistent helper
            firstname, lastname, full_name = await self._get_user_names(target, metadata)
            
            await self.notification_service.queue_notification(
                username=target,
                trigger=trigger,
                channels=["email"],
                template_data={
                    "username": target,
                    "profileId": metadata.get("profileId", ""),
                    "firstname": firstname,
                    "lastname": lastname,
                    "full_name": full_name,
                    "status": "paused",
                    "reason": metadata.get("reason", "Administrative action"),
                    "message": "Your account has been paused by an administrator. Your profile is temporarily hidden and you cannot access certain features."
                },
                priority="high",
                lineage_token=lineage_token,
                force_send=True  # Admin status notifications bypass user preference checks
            )
            logger.info(f"📧 Queued '{trigger}' notification for {target} (lineage: {lineage_token})")
            
        except Exception as e:
            logger.error(f"❌ Error handling user_paused: {e}", exc_info=True)
    
    async def _handle_suspicious_login(self, event_data: Dict):
        """Handle suspicious_login event"""
        try:
            target = event_data.get("target")
            metadata = event_data.get("metadata", {})
            
            # Get user's names using consistent helper
            firstname, lastname, full_name = await self._get_user_names(target, metadata)
            
            await self.notification_service.queue_notification(
                username=target,
                trigger="suspicious_login",
                channels=["email", "sms"],
                template_data={
                    "username": target,
                    "profileId": metadata.get("profileId", ""),
                    "firstname": firstname,
                    "lastname": lastname,
                    "recipient_firstName": firstname,  # For template compatibility
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
    
    async def _get_user_names(self, username: str, metadata: Dict = None) -> tuple:
        """
        Get user's first and last name with consistent fallback logic.
        Checks metadata first, then database, then falls back to username.
        Returns (firstname, lastname, full_name)
        
        Note: Also populates metadata with profileId if fetched from database
        """
        metadata = metadata or {}
        
        # Try metadata first
        firstname = metadata.get("firstname", "")
        lastname = metadata.get("lastname", "")
        
        # If not in metadata, fetch from database
        if not firstname:
            user = await self.db.users.find_one({"username": username})
            if user:
                # Check various field name formats
                firstname = (
                    user.get("firstName") or 
                    user.get("firstname") or 
                    user.get("first_name") or 
                    username
                )
                lastname = (
                    user.get("lastName") or 
                    user.get("lastname") or 
                    user.get("last_name") or 
                    ""
                )
                # Also get profileId and store in metadata for template use
                if "profileId" not in metadata:
                    metadata["profileId"] = user.get("profileId", "")
            else:
                firstname = username  # Fallback to username
        
        full_name = f"{firstname} {lastname}".strip() or username
        return firstname, lastname, full_name
    
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
    
    # ============================================
    # MISSING EVENT HANDLERS (Phase 4)
    # ============================================
    
    async def _handle_user_unexcluded(self, event_data: Dict):
        """Handle user_unexcluded event - No notification (privacy)"""
        logger.info(f"🔓 User unexcluded: {event_data.get('actor')} unexcluded {event_data.get('target')}")
    
    async def _handle_user_unsuspended(self, event_data: Dict):
        """Handle user_unsuspended event"""
        try:
            target = event_data.get("target")
            metadata = event_data.get("metadata", {})
            lineage_token = metadata.get("lineage_token")
            trigger = metadata.get("notification_trigger", "status_reactivated")
            
            # Get user's names using consistent helper
            firstname, lastname, full_name = await self._get_user_names(target, metadata)
            
            await self.notification_service.queue_notification(
                username=target,
                trigger=trigger,
                channels=["email"],  # Email only for admin status changes
                template_data={
                    "username": target,
                    "profileId": metadata.get("profileId", ""),
                    "firstname": firstname,
                    "lastname": lastname,
                    "full_name": full_name,
                    "status": "active",
                    "old_status": "suspended",
                    "message": "Your account has been reactivated! You now have full access to all features again."
                },
                priority="high",
                lineage_token=lineage_token,
                force_send=True  # Admin status notifications bypass user preference checks
            )
            logger.info(f"📧 Queued '{trigger}' notification for {target} (lineage: {lineage_token})")
            
        except Exception as e:
            logger.error(f"❌ Error handling user_unsuspended: {e}", exc_info=True)
    
    async def _handle_user_unbanned(self, event_data: Dict):
        """Handle user_unbanned event"""
        try:
            target = event_data.get("target")
            metadata = event_data.get("metadata", {})
            lineage_token = metadata.get("lineage_token")
            trigger = metadata.get("notification_trigger", "status_reactivated")
            
            # Get user's names using consistent helper
            firstname, lastname, full_name = await self._get_user_names(target, metadata)
            
            await self.notification_service.queue_notification(
                username=target,
                trigger=trigger,
                channels=["email"],  # Email only for admin status changes
                template_data={
                    "username": target,
                    "profileId": metadata.get("profileId", ""),
                    "firstname": firstname,
                    "lastname": lastname,
                    "full_name": full_name,
                    "status": "active",
                    "old_status": "banned",
                    "message": "Your account has been unbanned and you can now access all features."
                },
                priority="high",
                lineage_token=lineage_token,
                force_send=True  # Admin status notifications bypass user preference checks
            )
            logger.info(f"📧 Queued '{trigger}' notification for {target} (lineage: {lineage_token})")
            
        except Exception as e:
            logger.error(f"❌ Error handling user_unbanned: {e}", exc_info=True)
    
    async def _handle_user_logged_in(self, event_data: Dict):
        """Handle user_logged_in event - No notification (routine activity)"""
        logger.debug(f"🔑 User logged in: {event_data.get('actor')}")
    
    async def _handle_user_logged_out(self, event_data: Dict):
        """Handle user_logged_out event - No notification (routine activity)"""
        logger.debug(f"🔓 User logged out: {event_data.get('actor')}")
    
    async def _handle_profile_updated(self, event_data: Dict):
        """Handle profile_updated event - No notification (routine activity)"""
        logger.debug(f"📝 Profile updated: {event_data.get('actor')}")
    
    async def _handle_pii_revoked(self, event_data: Dict):
        """Handle pii_revoked event"""
        try:
            target = event_data.get("target")  # The person whose access was revoked
            actor = event_data.get("actor")  # The person who revoked access
            
            # Get names for both parties
            target_name, _, _ = await self._get_user_names(target)
            if actor:
                revoker_name, _, _ = await self._get_user_names(actor)
            else:
                revoker_name = "Admin"
            
            await self.notification_service.queue_notification(
                username=target,
                trigger="pii_revoked",
                channels=["email", "push", "sms"],  # Add SMS for important PII changes
                template_data={
                    "recipient": {"firstName": target_name, "username": target},
                    "recipient_firstName": target_name,
                    "match_firstName": revoker_name,
                    "match": {
                        "firstName": revoker_name,
                        "profileId": ""  # Revoker profileId not exposed for privacy
                    }
                },
                priority="high"
            )
            logger.info(f"📧 Queued 'pii_revoked' notification for {target}")
            
        except Exception as e:
            logger.error(f"❌ Error handling pii_revoked: {e}", exc_info=True)


# Global instance
_event_dispatcher = None


async def get_event_dispatcher(db, cache_service=None) -> EventDispatcher:
    """Get or create event dispatcher instance"""
    global _event_dispatcher
    if _event_dispatcher is None:
        # Initialize cache service if not provided
        if cache_service is None:
            from services.notification_cache import get_notification_cache
            cache_service = await get_notification_cache()
        _event_dispatcher = EventDispatcher(db, cache_service)
    return _event_dispatcher
