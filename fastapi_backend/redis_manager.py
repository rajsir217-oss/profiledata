"""
Redis Manager for Real-time Features
Handles online/offline status and messaging with Redis
"""
import redis
import json
import logging
from typing import List, Dict, Optional, Set
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

class RedisManager:
    """Manages Redis connections and operations for real-time features"""
    
    def __init__(self, host='localhost', port=6379, db=0):
        self.host = host
        self.port = port
        self.db = db
        self.redis_client: Optional[redis.Redis] = None
        self.pubsub = None
        
        # Key prefixes
        self.ONLINE_PREFIX = "online:"
        self.ONLINE_SET = "online_users"
        self.MESSAGE_PREFIX = "messages:"
        self.UNREAD_PREFIX = "unread:"
        self.TYPING_PREFIX = "typing:"
        
        # TTL settings (in seconds)
        self.ONLINE_TTL = 300  # 5 minutes
        self.TYPING_TTL = 5    # 5 seconds
        
    def connect(self):
        """Establish connection to Redis"""
        try:
            self.redis_client = redis.Redis(
                host=self.host,
                port=self.port,
                db=self.db,
                decode_responses=True,
                socket_connect_timeout=5,
                socket_keepalive=True
            )
            # Test connection
            self.redis_client.ping()
            logger.info(f"✅ Connected to Redis at {self.host}:{self.port}")
            return True
        except redis.ConnectionError as e:
            logger.error(f"❌ Failed to connect to Redis: {e}")
            return False
        except Exception as e:
            logger.error(f"❌ Redis connection error: {e}")
            return False
    
    def disconnect(self):
        """Close Redis connection"""
        if self.redis_client:
            self.redis_client.close()
            logger.info("🔌 Redis connection closed")
    
    # ===== ONLINE/OFFLINE STATUS =====
    
    def set_user_online(self, username: str) -> bool:
        """Mark user as online with auto-expiration"""
        try:
            key = f"{self.ONLINE_PREFIX}{username}"
            timestamp = datetime.now().isoformat()
            
            # Set user online with TTL
            self.redis_client.setex(key, self.ONLINE_TTL, timestamp)
            
            # Add to online users set
            self.redis_client.sadd(self.ONLINE_SET, username)
            
            logger.info(f"🟢 User '{username}' marked as online")
            return True
        except Exception as e:
            logger.error(f"❌ Error setting user online: {e}")
            return False
    
    def set_user_offline(self, username: str) -> bool:
        """Mark user as offline"""
        try:
            key = f"{self.ONLINE_PREFIX}{username}"
            
            # Remove online status
            self.redis_client.delete(key)
            
            # Remove from online users set
            self.redis_client.srem(self.ONLINE_SET, username)
            
            logger.info(f"⚪ User '{username}' marked as offline")
            return True
        except Exception as e:
            logger.error(f"❌ Error setting user offline: {e}")
            return False
    
    def is_user_online(self, username: str) -> bool:
        """Check if user is online"""
        try:
            key = f"{self.ONLINE_PREFIX}{username}"
            return self.redis_client.exists(key) > 0
        except Exception as e:
            logger.error(f"❌ Error checking user online status: {e}")
            return False
    
    def get_online_users(self) -> List[str]:
        """Get list of all online users"""
        try:
            # Get all members from online users set
            online_users = self.redis_client.smembers(self.ONLINE_SET)
            
            # Verify each user is still online (has valid key)
            valid_users = []
            for username in online_users:
                if self.is_user_online(username):
                    valid_users.append(username)
                else:
                    # Remove stale entry
                    self.redis_client.srem(self.ONLINE_SET, username)
            
            logger.info(f"🟢 Found {len(valid_users)} online users")
            return valid_users
        except Exception as e:
            logger.error(f"❌ Error getting online users: {e}")
            return []
    
    def refresh_user_online(self, username: str) -> bool:
        """Refresh user's online status (extend TTL)"""
        try:
            key = f"{self.ONLINE_PREFIX}{username}"
            if self.redis_client.exists(key):
                self.redis_client.expire(key, self.ONLINE_TTL)
                return True
            else:
                # User was offline, mark as online
                return self.set_user_online(username)
        except Exception as e:
            logger.error(f"❌ Error refreshing user online status: {e}")
            return False
    
    # ===== MESSAGING =====
    
    def send_message(self, from_user: str, to_user: str, message: str, message_id: str = None) -> bool:
        """Send a message to a user with validation and error handling"""
        try:
            # Validation
            if not from_user or not to_user:
                logger.error("❌ Invalid users: from_user and to_user are required")
                return False
            
            if not message or not message.strip():
                logger.error("❌ Invalid message: message cannot be empty")
                return False
            
            if len(message) > 10000:  # Prevent extremely large messages
                logger.error(f"❌ Message too large: {len(message)} characters")
                return False
            
            if not message_id:
                message_id = f"{from_user}_{to_user}_{datetime.now().timestamp()}"
            
            message_data = {
                'id': message_id,
                'from': from_user,
                'to': to_user,
                'message': message.strip(),
                'timestamp': datetime.now().isoformat(),
                'read': False
            }
            
            # Store message ONLY in recipient's queue for polling
            # The sender will handle their sent messages locally in the frontend
            to_queue_key = f"{self.MESSAGE_PREFIX}{to_user}"
            self.redis_client.lpush(to_queue_key, json.dumps(message_data))
            self.redis_client.expire(to_queue_key, 30 * 24 * 60 * 60)  # 30 days TTL
            self.redis_client.ltrim(to_queue_key, 0, 999)  # Keep last 1000
            
            # Do NOT store in sender's queue - they already have the message locally
            
            # Increment unread count
            unread_key = f"{self.UNREAD_PREFIX}{to_user}:{from_user}"
            self.redis_client.incr(unread_key)
            self.redis_client.expire(unread_key, 30 * 24 * 60 * 60)  # 30 days TTL
            
            # Publish to recipient's channel for real-time delivery
            channel = f"messages:{to_user}"
            published = self.redis_client.publish(channel, json.dumps(message_data))
            logger.info(f"💬 Message sent from '{from_user}' to '{to_user}' (ID: {message_id}, {published} subscribers)")
            
            return True
        except redis.RedisError as e:
            logger.error(f"❌ Redis error sending message: {e}", exc_info=True)
            return False
        except Exception as e:
            logger.error(f"❌ Unexpected error sending message: {e}", exc_info=True)
            return False
    
    def get_new_messages_since(self, username: str, since_timestamp: str = None, limit: int = 50) -> List[Dict]:
        """Get new messages for a user since a specific timestamp with validation"""
        try:
            # Validation
            if not username:
                logger.error("❌ Invalid username: username is required")
                return []
            
            if limit <= 0 or limit > 1000:
                logger.warning(f"⚠️ Invalid limit {limit}, using default 50")
                limit = 50
            
            queue_key = f"{self.MESSAGE_PREFIX}{username}"
            
            # Check if queue exists
            if not self.redis_client.exists(queue_key):
                logger.debug(f"📭 No message queue for user '{username}'")
                return []
            
            messages = self.redis_client.lrange(queue_key, 0, limit - 1)
            
            if not messages:
                return []
            
            # Parse messages with error handling
            all_messages = []
            for msg in messages:
                try:
                    parsed = json.loads(msg)
                    all_messages.append(parsed)
                except json.JSONDecodeError as e:
                    logger.error(f"❌ Failed to parse message: {e}")
                    continue
            
            if since_timestamp:
                # Filter messages newer than the timestamp
                try:
                    new_messages = [
                        msg for msg in all_messages 
                        if msg.get('timestamp', '') > since_timestamp
                    ]
                    logger.debug(f"📬 Found {len(new_messages)} new messages for '{username}' since {since_timestamp}")
                    return new_messages
                except Exception as e:
                    logger.error(f"❌ Error filtering messages by timestamp: {e}")
                    return all_messages
            
            logger.debug(f"📬 Retrieved {len(all_messages)} messages for '{username}'")
            return all_messages
            
        except redis.RedisError as e:
            logger.error(f"❌ Redis error getting messages: {e}", exc_info=True)
            return []
        except Exception as e:
            logger.error(f"❌ Unexpected error getting messages: {e}", exc_info=True)
            return []
    
    def get_messages(self, username: str, limit: int = 50) -> List[Dict]:
        """Get messages for a user"""
        try:
            queue_key = f"{self.MESSAGE_PREFIX}{username}"
            messages = self.redis_client.lrange(queue_key, 0, limit - 1)
            
            return [json.loads(msg) for msg in messages]
        except Exception as e:
            logger.error(f"❌ Error getting messages: {e}")
            return []
    
    def mark_messages_read(self, username: str, from_user: str) -> bool:
        """Mark messages from a specific user as read"""
        try:
            unread_key = f"{self.UNREAD_PREFIX}{username}:{from_user}"
            self.redis_client.delete(unread_key)
            return True
        except Exception as e:
            logger.error(f"❌ Error marking messages as read: {e}")
            return False
    
    def get_unread_count(self, username: str, from_user: str = None) -> int:
        """Get unread message count"""
        try:
            if from_user:
                unread_key = f"{self.UNREAD_PREFIX}{username}:{from_user}"
                count = self.redis_client.get(unread_key)
                return int(count) if count else 0
            else:
                # Get total unread from all users
                pattern = f"{self.UNREAD_PREFIX}{username}:*"
                keys = self.redis_client.keys(pattern)
                total = 0
                for key in keys:
                    count = self.redis_client.get(key)
                    total += int(count) if count else 0
                return total
        except Exception as e:
            logger.error(f"❌ Error getting unread count: {e}")
            return 0
    
    # ===== TYPING INDICATORS =====
    
    def set_typing(self, username: str, to_user: str) -> bool:
        """Set typing indicator"""
        try:
            key = f"{self.TYPING_PREFIX}{to_user}:{username}"
            self.redis_client.setex(key, self.TYPING_TTL, "1")
            
            # Publish typing event
            channel = f"typing:{to_user}"
            self.redis_client.publish(channel, json.dumps({
                'user': username,
                'typing': True
            }))
            return True
        except Exception as e:
            logger.error(f"❌ Error setting typing indicator: {e}")
            return False
    
    def clear_typing(self, username: str, to_user: str) -> bool:
        """Clear typing indicator"""
        try:
            key = f"{self.TYPING_PREFIX}{to_user}:{username}"
            self.redis_client.delete(key)
            
            # Publish typing stopped event
            channel = f"typing:{to_user}"
            self.redis_client.publish(channel, json.dumps({
                'user': username,
                'typing': False
            }))
            return True
        except Exception as e:
            logger.error(f"❌ Error clearing typing indicator: {e}")
            return False
    
    def is_typing(self, username: str, from_user: str) -> bool:
        """Check if user is typing"""
        try:
            key = f"{self.TYPING_PREFIX}{username}:{from_user}"
            return self.redis_client.exists(key) > 0
        except Exception as e:
            logger.error(f"❌ Error checking typing status: {e}")
            return False
    
    # ===== PUB/SUB =====
    
    def subscribe(self, *channels):
        """Subscribe to Redis channels"""
        try:
            if not self.pubsub:
                self.pubsub = self.redis_client.pubsub()
            self.pubsub.subscribe(*channels)
            logger.info(f"📡 Subscribed to channels: {channels}")
            return self.pubsub
        except Exception as e:
            logger.error(f"❌ Error subscribing to channels: {e}")
            return None
    
    def publish(self, channel: str, message: str) -> bool:
        """Publish message to a channel"""
        try:
            self.redis_client.publish(channel, message)
            return True
        except Exception as e:
            logger.error(f"❌ Error publishing message: {e}")
            return False


# Global Redis manager instance
redis_manager = RedisManager()


def get_redis_manager() -> RedisManager:
    """Get Redis manager instance"""
    return redis_manager
