"""
Database Migration: Add Pause/Account Status Fields
Created: November 2, 2025
Purpose: Add pause functionality fields to users collection
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import sys
sys.path.append('..')
from config import Settings

settings = Settings()


async def migrate():
    """Add pause fields to all existing users"""
    
    print("🔄 Starting database migration: Add Pause Fields")
    print(f"📊 Connecting to: {settings.mongodb_url}")
    
    client = AsyncIOMotorClient(settings.mongodb_url)
    db = client.matrimonialDB
    users = db.users
    
    # Add new fields to all users
    print("\n📝 Adding pause fields to existing users...")
    
    result = await users.update_many(
        {},  # All users
        {
            "$set": {
                "accountStatus": "active",
                "pausedAt": None,
                "pausedUntil": None,
                "pauseReason": None,
                "pauseMessage": None,
                "pauseCount": 0,
                "lastUnpausedAt": None
            }
        }
    )
    
    print(f"✅ Updated {result.modified_count} users")
    
    # Create indexes for performance
    print("\n🔍 Creating indexes...")
    
    # Index on accountStatus (for filtering paused users in search)
    await users.create_index("accountStatus")
    print("✅ Created index on accountStatus")
    
    # Index on pausedUntil (for auto-unpause job)
    await users.create_index("pausedUntil")
    print("✅ Created index on pausedUntil")
    
    # Verify indexes
    indexes = await users.index_information()
    print("\n📋 Current indexes on users collection:")
    for index_name, index_info in indexes.items():
        print(f"  - {index_name}: {index_info.get('key', [])}")
    
    # Count users by status
    active_count = await users.count_documents({"accountStatus": "active"})
    paused_count = await users.count_documents({"accountStatus": "paused"})
    
    print("\n📊 User Status Summary:")
    print(f"  - Active: {active_count}")
    print(f"  - Paused: {paused_count}")
    
    print("\n✅ Migration completed successfully!")
    print("\nNew fields added:")
    print("  - accountStatus: 'active' | 'paused' | 'deactivated'")
    print("  - pausedAt: ISODate | null")
    print("  - pausedUntil: ISODate | null")
    print("  - pauseReason: string | null")
    print("  - pauseMessage: string | null")
    print("  - pauseCount: number (default: 0)")
    print("  - lastUnpausedAt: ISODate | null")
    
    client.close()


if __name__ == "__main__":
    asyncio.run(migrate())
