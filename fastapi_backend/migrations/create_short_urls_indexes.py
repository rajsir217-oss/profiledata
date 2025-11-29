"""
Migration: Create indexes for short_urls collection
Date: 2025-11-29
"""
from motor.motor_asyncio import AsyncIOMotorClient
from config import Settings
import asyncio

settings = Settings()


async def up():
    """Create indexes for short_urls collection"""
    client = AsyncIOMotorClient(settings.mongodb_url)
    db = client[settings.database_name]
    
    # Create unique index on shortCode
    await db.short_urls.create_index("shortCode", unique=True)
    print("✅ Created unique index on short_urls.shortCode")
    
    # Create index on createdAt for cleanup/analytics
    await db.short_urls.create_index("createdAt")
    print("✅ Created index on short_urls.createdAt")
    
    # Create index on longUrl for duplicate detection
    await db.short_urls.create_index("longUrl")
    print("✅ Created index on short_urls.longUrl")
    
    client.close()


async def down():
    """Remove indexes from short_urls collection"""
    client = AsyncIOMotorClient(settings.mongodb_url)
    db = client[settings.database_name]
    
    await db.short_urls.drop_index("shortCode_1")
    await db.short_urls.drop_index("createdAt_1")
    await db.short_urls.drop_index("longUrl_1")
    print("✅ Dropped indexes from short_urls collection")
    
    client.close()


if __name__ == "__main__":
    print("Running migration: create_short_urls_indexes")
    asyncio.run(up())
    print("Migration completed successfully!")
