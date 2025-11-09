"""
Migration 003: Add profileId to existing users
Generate unique 8-character alphanumeric profileId for users who don't have one
"""

import asyncio
import random
import string
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime
import os

# Get MongoDB URL from environment
MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
DATABASE_NAME = "matrimonialDB"

async def generate_unique_profile_id(db) -> str:
    """Generate a unique 8-character alphanumeric profileId"""
    while True:
        # Generate 8-char alphanumeric ID (mix of uppercase, lowercase, digits)
        profile_id = ''.join(random.choices(string.ascii_letters + string.digits, k=8))
        
        # Check if profileId already exists
        existing = await db.users.find_one({"profileId": profile_id})
        if not existing:
            return profile_id

async def migrate_add_profile_ids():
    """Add profileId to all users who don't have one"""
    print("=" * 60)
    print("MIGRATION 003: Add profileId to existing users")
    print("=" * 60)
    print(f"MongoDB URL: {MONGODB_URL[:50]}...")
    print(f"Database: {DATABASE_NAME}")
    print("=" * 60)
    
    try:
        client = AsyncIOMotorClient(MONGODB_URL)
        db = client[DATABASE_NAME]
        
        # Test connection
        await db.command('ping')
        print("✅ Connected to MongoDB")
        
        # Find users without profileId
        users_without_id = await db.users.count_documents({
            "$or": [
                {"profileId": {"$exists": False}},
                {"profileId": None},
                {"profileId": ""}
            ]
        })
        
        print(f"\n📊 Found {users_without_id} users without profileId")
        
        if users_without_id == 0:
            print("✅ All users already have profileId!")
            client.close()
            return
        
        print(f"🔄 Generating profileIds...")
        
        # Get all users without profileId
        cursor = db.users.find({
            "$or": [
                {"profileId": {"$exists": False}},
                {"profileId": None},
                {"profileId": ""}
            ]
        })
        
        updated = 0
        errors = 0
        
        async for user in cursor:
            try:
                username = user.get('username', 'unknown')
                profile_id = await generate_unique_profile_id(db)
                
                # Update user with profileId
                result = await db.users.update_one(
                    {"_id": user["_id"]},
                    {
                        "$set": {
                            "profileId": profile_id,
                            "updatedAt": datetime.utcnow()
                        }
                    }
                )
                
                if result.modified_count > 0:
                    print(f"   ✅ {username} → {profile_id}")
                    updated += 1
                else:
                    print(f"   ⚠️  {username} → Failed to update")
                    errors += 1
                    
            except Exception as e:
                print(f"   ❌ Error processing user: {e}")
                errors += 1
        
        print("\n" + "=" * 60)
        print("MIGRATION COMPLETE")
        print("=" * 60)
        print(f"✅ Updated: {updated} users")
        if errors > 0:
            print(f"❌ Errors: {errors}")
        
        # Verify all users have profileId now
        remaining = await db.users.count_documents({
            "$or": [
                {"profileId": {"$exists": False}},
                {"profileId": None},
                {"profileId": ""}
            ]
        })
        
        if remaining == 0:
            print("\n🎉 SUCCESS! All users now have profileId")
        else:
            print(f"\n⚠️  Warning: {remaining} users still without profileId")
        
        # Record migration
        await db.migrations.update_one(
            {"migration_id": "003_add_profile_ids"},
            {
                "$set": {
                    "migration_id": "003_add_profile_ids",
                    "description": "Add profileId to existing users",
                    "applied_at": datetime.utcnow(),
                    "status": "completed",
                    "users_updated": updated,
                    "errors": errors
                }
            },
            upsert=True
        )
        
        print("\n📝 Migration recorded in database")
        
        client.close()
        
    except Exception as e:
        print(f"\n❌ Migration failed: {e}")
        raise

if __name__ == "__main__":
    print("\n⚠️  This will add profileId to users in the database!")
    print(f"MongoDB: {os.getenv('MONGODB_URL', 'NOT SET')[:50]}...")
    response = input("\nContinue? (yes/no): ")
    
    if response.lower() == 'yes':
        asyncio.run(migrate_add_profile_ids())
    else:
        print("❌ Cancelled")
