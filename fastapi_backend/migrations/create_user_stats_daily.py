"""
Migration: Create user_stats_daily collection for per-user daily statistics
Created: Jun 28, 2026
Purpose: Store daily snapshot of user profile metrics (days active, views, favorites, shortlists, messages)
"""

from motor.motor_asyncio import AsyncIOMotorDatabase
from datetime import datetime


async def up(db: AsyncIOMotorDatabase):
    """Create user_stats_daily collection with indexes"""
    
    # 1. user_stats_daily collection
    await db.create_collection("user_stats_daily")
    
    # Compound unique index: username + date (one snapshot per user per day)
    await db.user_stats_daily.create_index([("username", 1), ("date", 1)], unique=True)
    
    # Index for username queries (fetch latest stats for a user)
    await db.user_stats_daily.create_index("username")
    
    # Index for date queries (analytics)
    await db.user_stats_daily.create_index("date")
    
    # TTL index: keep data for 90 days (optional - comment out if you want to keep all historical data)
    # await db.user_stats_daily.create_index("createdAt", expireAfterSeconds=90 * 86400)
    
    print("✅ Created user_stats_daily collection with indexes")


async def down(db: AsyncIOMotorDatabase):
    """Drop user_stats_daily collection"""
    
    await db.user_stats_daily.drop()
    
    print("✅ Dropped user_stats_daily collection")
