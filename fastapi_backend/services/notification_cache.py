"""
Notification Cache Service
Redis-based caching for notification preferences and templates
"""

import json
import logging
from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta
import redis.asyncio as redis
from motor.motor_asyncio import AsyncIOMotorDatabase

logger = logging.getLogger(__name__)

class NotificationCacheService:
    """Redis-based caching service for notification data"""
    
    def __init__(self, redis_url: str = None):
        self.redis_url = redis_url or "redis://localhost:6379/0"
        self.redis_client = None
        self.default_ttl = 3600  # 1 hour default TTL
        
    async def connect(self):
        """Initialize Redis connection"""
        try:
            self.redis_client = redis.from_url(
                self.redis_url,
                encoding="utf-8",
                decode_responses=True
            )
            # Test connection
            await self.redis_client.ping()
            logger.info("✅ Notification cache service connected to Redis")
            return True
        except Exception as e:
            logger.warning(f"⚠️ Failed to connect to Redis: {e}")
            logger.info("📦 Cache service running without Redis (fallback to database)")
            return False
    
    async def disconnect(self):
        """Close Redis connection"""
        if self.redis_client:
            await self.redis_client.close()
            logger.info("📦 Notification cache service disconnected from Redis")
    
    # ============================================
    # User Preferences Caching
    # ============================================
    
    async def get_user_preferences(self, username: str, db: AsyncIOMotorDatabase) -> Optional[Dict[str, Any]]:
        """Get user preferences from cache or database"""
        cache_key = f"notification_prefs:{username}"
        
        # Try cache first
        if self.redis_client:
            try:
                cached_data = await self.redis_client.get(cache_key)
                if cached_data:
                    logger.debug(f"🎯 Cache hit for user preferences: {username}")
                    return json.loads(cached_data)
            except Exception as e:
                logger.warning(f"⚠️ Cache get error for preferences {username}: {e}")
        
        # Fallback to database
        try:
            from services.notification_service import NotificationService
            notification_service = NotificationService(db)
            prefs = await notification_service.get_preferences(username)
            
            if prefs:
                prefs_dict = prefs.dict()
                
                # Cache the result
                if self.redis_client:
                    try:
                        # Convert datetime objects to strings for JSON serialization
                        cache_data = {}
                        for key, value in prefs_dict.items():
                            if hasattr(value, 'isoformat'):
                                cache_data[key] = value.isoformat()
                            elif isinstance(value, dict):
                                # Handle nested datetime objects
                                cache_data[key] = self._serialize_datetime_dict(value)
                            else:
                                cache_data[key] = value
                        
                        await self.redis_client.setex(
                            cache_key, 
                            self.default_ttl, 
                            json.dumps(cache_data)
                        )
                        logger.debug(f"💾 Cached user preferences: {username}")
                    except Exception as e:
                        logger.warning(f"⚠️ Cache set error for preferences {username}: {e}")
                
                return prefs_dict
                
        except Exception as e:
            logger.error(f"❌ Error getting user preferences for {username}: {e}")
        
        return None
    
    async def invalidate_user_preferences(self, username: str):
        """Invalidate cached user preferences"""
        cache_key = f"notification_prefs:{username}"
        
        if self.redis_client:
            try:
                await self.redis_client.delete(cache_key)
                logger.debug(f"🗑️ Invalidated cached preferences: {username}")
            except Exception as e:
                logger.warning(f"⚠️ Cache delete error for preferences {username}: {e}")
    
    # ============================================
    # Notification Templates Caching
    # ============================================
    
    async def get_notification_template(self, trigger: str, db: AsyncIOMotorDatabase) -> Optional[Dict[str, Any]]:
        """Get notification template from cache or database"""
        cache_key = f"notification_template:{trigger}"
        
        # Try cache first
        if self.redis_client:
            try:
                cached_data = await self.redis_client.get(cache_key)
                if cached_data:
                    logger.debug(f"🎯 Cache hit for template: {trigger}")
                    return json.loads(cached_data)
            except Exception as e:
                logger.warning(f"⚠️ Cache get error for template {trigger}: {e}")
        
        # Fallback to database
        try:
            template = await db.notification_templates.find_one({"trigger": trigger})
            
            if template:
                # Convert ObjectId to string for JSON serialization
                template["_id"] = str(template["_id"])
                
                # Cache the result (templates change rarely, use longer TTL)
                if self.redis_client:
                    try:
                        await self.redis_client.setex(
                            cache_key, 
                            86400,  # 24 hours TTL for templates
                            json.dumps(template)
                        )
                        logger.debug(f"💾 Cached notification template: {trigger}")
                    except Exception as e:
                        logger.warning(f"⚠️ Cache set error for template {trigger}: {e}")
                
                return template
                
        except Exception as e:
            logger.error(f"❌ Error getting notification template for {trigger}: {e}")
        
        return None
    
    async def invalidate_notification_template(self, trigger: str):
        """Invalidate cached notification template"""
        cache_key = f"notification_template:{trigger}"
        
        if self.redis_client:
            try:
                await self.redis_client.delete(cache_key)
                logger.debug(f"🗑️ Invalidated cached template: {trigger}")
            except Exception as e:
                logger.warning(f"⚠️ Cache delete error for template {trigger}: {e}")
    
    async def invalidate_all_templates(self):
        """Invalidate all cached templates"""
        if self.redis_client:
            try:
                pattern = "notification_template:*"
                keys = await self.redis_client.keys(pattern)
                if keys:
                    await self.redis_client.delete(*keys)
                    logger.info(f"🗑️ Invalidated {len(keys)} cached templates")
            except Exception as e:
                logger.warning(f"⚠️ Cache delete error for all templates: {e}")
    
    # ============================================
    # Rate Limiting Caching
    # ============================================
    
    async def check_rate_limit(self, username: str, channel: str, limit: int, window: int = 3600) -> bool:
        """Check rate limit using Redis sliding window"""
        if not self.redis_client:
            # Fallback to database-based rate limiting
            return True
        
        cache_key = f"rate_limit:{username}:{channel}"
        current_time = datetime.utcnow().timestamp()
        
        try:
            # Use Redis sorted set for sliding window
            await self.redis_client.zremrangebyscore(
                cache_key, 
                0, 
                current_time - window
            )
            
            current_count = await self.redis_client.zcard(cache_key)
            
            if current_count >= limit:
                logger.debug(f"🚫 Rate limit exceeded for {username}:{channel}")
                return False
            
            # Add current request
            await self.redis_client.zadd(cache_key, {str(current_time): current_time})
            await self.redis_client.expire(cache_key, window)
            
            logger.debug(f"✅ Rate limit OK for {username}:{channel} ({current_count + 1}/{limit})")
            return True
            
        except Exception as e:
            logger.warning(f"⚠️ Rate limit cache error for {username}:{channel}: {e}")
            # Fallback to allowing the request
            return True
    
    def _serialize_datetime_dict(self, data_dict: Dict[str, Any]) -> Dict[str, Any]:
        """Recursively serialize datetime objects in dictionary"""
        result = {}
        for key, value in data_dict.items():
            if hasattr(value, 'isoformat'):
                result[key] = value.isoformat()
            elif isinstance(value, dict):
                result[key] = self._serialize_datetime_dict(value)
            elif isinstance(value, list):
                result[key] = [
                    item.isoformat() if hasattr(item, 'isoformat') else item
                    for item in value
                ]
            else:
                result[key] = value
        return result
    
    # ============================================
    # Batch Operations Caching
    # ============================================
    
    async def get_batch_user_preferences(self, usernames: List[str], db: AsyncIOMotorDatabase) -> Dict[str, Any]:
        """Get multiple user preferences efficiently"""
        results = {}
        
        if self.redis_client:
            # Try to get all from cache first
            cache_keys = [f"notification_prefs:{username}" for username in usernames]
            
            try:
                cached_values = await self.redis_client.mget(cache_keys)
                
                for i, username in enumerate(usernames):
                    cached_data = cached_values[i]
                    if cached_data:
                        results[username] = json.loads(cached_data)
                    else:
                        # Need to fetch from database
                        prefs = await self.get_user_preferences(username, db)
                        if prefs:
                            results[username] = prefs
                
                logger.debug(f"🎯 Batch cache hit: {len(results)}/{len(usernames)}")
                return results
                
            except Exception as e:
                logger.warning(f"⚠️ Batch cache get error: {e}")
        
        # Fallback: fetch individually
        for username in usernames:
            prefs = await self.get_user_preferences(username, db)
            if prefs:
                results[username] = prefs
        
        return results
    
    # ============================================
    # Cache Statistics
    # ============================================
    
    async def get_cache_stats(self) -> Dict[str, Any]:
        """Get cache statistics for monitoring"""
        if not self.redis_client:
            return {"redis_connected": False}
        
        try:
            info = await self.redis_client.info()
            keyspace = info.get("keyspace", {})
            db_info = info.get("db0", {})
            
            # Count notification-related keys
            prefs_keys = await self.redis_client.keys("notification_prefs:*")
            template_keys = await self.redis_client.keys("notification_template:*")
            rate_limit_keys = await self.redis_client.keys("rate_limit:*")
            
            return {
                "redis_connected": True,
                "total_keys": db_info.get("keys", 0),
                "notification_prefs_cached": len(prefs_keys),
                "templates_cached": len(template_keys),
                "rate_limit_entries": len(rate_limit_keys),
                "memory_usage": info.get("used_memory_human", "unknown"),
                "hit_rate": info.get("keyspace_hits", 0) / max(info.get("keyspace_misses", 1), 1)
            }
            
        except Exception as e:
            logger.warning(f"⚠️ Error getting cache stats: {e}")
            return {"redis_connected": True, "error": str(e)}


# Global cache instance
_cache_service = None

async def get_notification_cache(redis_url: str = None) -> NotificationCacheService:
    """Get or create notification cache service instance"""
    global _cache_service
    if _cache_service is None:
        _cache_service = NotificationCacheService(redis_url)
        await _cache_service.connect()
    return _cache_service
