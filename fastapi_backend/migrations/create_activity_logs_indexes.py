#!/usr/bin/env python3
"""
Database Migration: Create Activity Logs Indexes
Creates all necessary indexes for the activity_logs collection

Run: python -m migrations.create_activity_logs_indexes
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from config import settings

async def create_indexes():
    """Create indexes for activity_logs collection"""
    
    print("🔗 Connecting to MongoDB...")
    client = AsyncIOMotorClient(settings.mongodb_url)
    db = client[settings.database_name]
    collection = db.activity_logs
    
    print("📊 Creating indexes for activity_logs collection...")
    
    # Single field indexes
    await collection.create_index("username")
    print("✅ Created index on 'username'")
    
    await collection.create_index("action_type")
    print("✅ Created index on 'action_type'")
    
    await collection.create_index("timestamp")
    print("✅ Created index on 'timestamp'")
    
    # Compound indexes for common queries
    await collection.create_index([("username", 1), ("timestamp", -1)])
    print("✅ Created compound index on ('username', 'timestamp')")
    
    await collection.create_index([("action_type", 1), ("timestamp", -1)])
    print("✅ Created compound index on ('action_type', 'timestamp')")
    
    # TTL index for automatic document expiration (30 days)
    await collection.create_index(
        "timestamp",
        expireAfterSeconds=2592000,  # 30 days in seconds
        name="timestamp_ttl"
    )
    print("✅ Created TTL index on 'timestamp' (30 days expiration)")
    
    # List all indexes
    print("\n📋 All indexes on activity_logs collection:")
    indexes = await collection.list_indexes().to_list(length=None)
    for idx in indexes:
        print(f"  - {idx['name']}: {idx.get('key', {})}")
        if 'expireAfterSeconds' in idx:
            print(f"    (TTL: {idx['expireAfterSeconds']} seconds)")
    
    print("\n✅ Migration completed successfully!")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(create_indexes())
