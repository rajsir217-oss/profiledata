#!/usr/bin/env python3
"""
Migration Script: Set default role_name to 'free_user' for users without explicit role

This script updates all users where role_name is null or missing to have role_name='free_user'.
This ensures database consistency and cleaner queries.

Date: November 29, 2025
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

MONGODB_URL = os.getenv('MONGODB_URL', 'mongodb://localhost:27017')
DATABASE_NAME = os.getenv('MONGODB_DB_NAME', 'matrimonialDB')


async def set_default_role():
    """Set role_name='free_user' for all users without explicit role"""
    
    print("🔄 Starting role_name migration...")
    print(f"📊 Connecting to: {DATABASE_NAME}")
    
    # Connect to MongoDB
    client = AsyncIOMotorClient(MONGODB_URL)
    db = client[DATABASE_NAME]
    users_collection = db.users
    
    try:
        # Find users with null or missing role_name
        query = {
            "$or": [
                {"role_name": {"$exists": False}},
                {"role_name": None}
            ]
        }
        
        # Count affected users
        count_before = await users_collection.count_documents(query)
        print(f"📈 Found {count_before} users without role_name")
        
        if count_before == 0:
            print("✅ No users to update - all users already have role_name")
            return
        
        # Show sample of users to be updated
        sample_users = await users_collection.find(
            query,
            {"username": 1, "role_name": 1, "_id": 0}
        ).limit(5).to_list(length=5)
        
        print("\n📋 Sample users to update:")
        for user in sample_users:
            print(f"   - {user.get('username')}: {user.get('role_name')} → free_user")
        
        if count_before > 5:
            print(f"   ... and {count_before - 5} more")
        
        # Confirm before proceeding
        print(f"\n⚠️  About to update {count_before} users")
        confirmation = input("Continue? (yes/no): ")
        
        if confirmation.lower() != 'yes':
            print("❌ Migration cancelled by user")
            return
        
        # Update all users
        update_result = await users_collection.update_many(
            query,
            {
                "$set": {
                    "role_name": "free_user",
                    "role_updated_at": datetime.utcnow()
                }
            }
        )
        
        print(f"\n✅ Successfully updated {update_result.modified_count} users")
        
        # Verify the update
        count_after = await users_collection.count_documents(query)
        print(f"📊 Users without role_name after migration: {count_after}")
        
        # Show role distribution
        print("\n📊 Role distribution after migration:")
        pipeline = [
            {"$group": {"_id": "$role_name", "count": {"$sum": 1}}},
            {"$sort": {"_id": 1}}
        ]
        role_stats = await users_collection.aggregate(pipeline).to_list(length=None)
        
        for stat in role_stats:
            role = stat['_id'] or 'null'
            count = stat['count']
            print(f"   - {role}: {count} users")
        
        print("\n✅ Migration completed successfully!")
        
    except Exception as e:
        print(f"\n❌ Error during migration: {e}")
        raise
    finally:
        client.close()


async def rollback_migration():
    """Rollback: Remove role_name='free_user' that was added by this migration"""
    
    print("🔄 Starting rollback...")
    print(f"📊 Connecting to: {DATABASE_NAME}")
    
    client = AsyncIOMotorClient(MONGODB_URL)
    db = client[DATABASE_NAME]
    users_collection = db.users
    
    try:
        # Find users with role_name='free_user' added by this migration
        query = {
            "role_name": "free_user",
            "role_updated_at": {"$exists": True}
        }
        
        count = await users_collection.count_documents(query)
        print(f"📈 Found {count} users with role_name='free_user' to rollback")
        
        if count == 0:
            print("✅ No users to rollback")
            return
        
        confirmation = input(f"⚠️  Remove role_name from {count} users? (yes/no): ")
        
        if confirmation.lower() != 'yes':
            print("❌ Rollback cancelled")
            return
        
        # Remove role_name and role_updated_at fields
        result = await users_collection.update_many(
            query,
            {
                "$unset": {
                    "role_name": "",
                    "role_updated_at": ""
                }
            }
        )
        
        print(f"✅ Successfully rolled back {result.modified_count} users")
        
    except Exception as e:
        print(f"❌ Error during rollback: {e}")
        raise
    finally:
        client.close()


if __name__ == "__main__":
    import sys
    
    print("=" * 60)
    print("  Role Name Migration Script")
    print("=" * 60)
    
    if len(sys.argv) > 1 and sys.argv[1] == "--rollback":
        print("🔙 Running in ROLLBACK mode\n")
        asyncio.run(rollback_migration())
    else:
        print("⏩ Running in MIGRATION mode\n")
        print("Tip: Use --rollback flag to undo this migration\n")
        asyncio.run(set_default_role())
