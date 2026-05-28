"""
Migration: Create notification system collections for lazy on-demand notifications
Created: May 27, 2026
"""

from motor.motor_asyncio import AsyncIOMotorDatabase
from datetime import datetime


async def up(db: AsyncIOMotorDatabase):
    """Create notification collections with indexes"""
    
    # 1. user_preferences collection
    await db.create_collection("user_preferences")
    
    # Index for username (unique)
    await db.user_preferences.create_index("username", unique=True)
    
    # 2. notification_cache collection
    await db.create_collection("notification_cache")
    
    # Index for username (unique)
    await db.notification_cache.create_index("username", unique=True)
    
    # TTL index for auto-expiry (24 hours = 86400 seconds)
    await db.notification_cache.create_index("expiresAt", expireAfterSeconds=0)
    
    # 3. messenger_usage_telemetry collection (for tracking usage trends)
    await db.create_collection("messenger_usage_telemetry")
    
    # Index for username and timestamp
    await db.messenger_usage_telemetry.create_index([("username", 1), ("timestamp", -1)])
    # Index for date-based queries (DAU/MAU)
    await db.messenger_usage_telemetry.create_index("timestamp")
    # TTL for telemetry data (keep 90 days)
    await db.messenger_usage_telemetry.create_index("timestamp", expireAfterSeconds=90 * 86400)
    
    print("✅ Created notification collections with indexes")


async def down(db: AsyncIOMotorDatabase):
    """Drop notification collections"""
    
    await db.user_preferences.drop()
    await db.notification_cache.drop()
    await db.messenger_usage_telemetry.drop()
    
    print("✅ Dropped notification collections")
