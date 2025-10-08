#!/usr/bin/env python3
"""
Migration script to add status field to existing users
Run this once to update all existing users in the database
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime
from config import settings

async def migrate_user_status():
    """Add status field to all users who don't have it"""
    
    # Connect to database
    client = AsyncIOMotorClient(settings.mongodb_url)
    db = client[settings.database_name]
    
    print("🔍 Checking for users without status field...")
    
    # Find users without status field
    users_without_status = await db.users.count_documents({"status": {"$exists": False}})
    print(f"Found {users_without_status} users without status field")
    
    if users_without_status == 0:
        print("✅ All users already have status field!")
        client.close()
        return
    
    # Update all users without status field
    now = datetime.utcnow().isoformat()
    result = await db.users.update_many(
        {"status": {"$exists": False}},
        {
            "$set": {
                "status": {
                    "status": "pending",  # Set existing users to pending for admin review
                    "reason": "Migration - needs admin activation",
                    "updatedAt": now,
                    "updatedBy": "system_migration"
                }
            }
        }
    )
    
    print(f"✅ Updated {result.modified_count} users with status field")
    print(f"   All users set to 'pending' status - admin needs to activate them")
    
    # Close connection
    client.close()

if __name__ == "__main__":
    print("=" * 60)
    print("USER STATUS MIGRATION")
    print("=" * 60)
    asyncio.run(migrate_user_status())
    print("=" * 60)
    print("Migration complete!")
    print("=" * 60)
