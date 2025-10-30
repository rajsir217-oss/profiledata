"""
Migration: Add profileId to all users who don't have one
Date: October 27, 2025
"""

import asyncio
import random
import string
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv()

MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
DATABASE_NAME = os.getenv("DATABASE_NAME", "matrimonialDB")

async def generate_unique_profile_id(db) -> str:
    """Generate unique 8-character alphanumeric profileId"""
    while True:
        # Generate 8-char alphanumeric ID (mix of uppercase, lowercase, digits)
        profile_id = ''.join(random.choices(string.ascii_letters + string.digits, k=8))
        
        # Check if profileId already exists
        existing = await db.users.find_one({"profileId": profile_id})
        if not existing:
            return profile_id

async def migrate_profile_ids():
    """Add profileId to all users who don't have one"""
    print("🔄 Starting profileId migration...")
    
    # Connect to MongoDB
    client = AsyncIOMotorClient(MONGODB_URL)
    db = client[DATABASE_NAME]
    
    try:
        # Find all users without profileId
        users_without_id = await db.users.find(
            {"profileId": {"$exists": False}}
        ).to_list(None)
        
        print(f"📊 Found {len(users_without_id)} users without profileId")
        
        if len(users_without_id) == 0:
            print("✅ All users already have profileId. Nothing to do!")
            return
        
        # Add profileId to each user
        updated_count = 0
        for user in users_without_id:
            username = user.get("username", "unknown")
            profile_id = await generate_unique_profile_id(db)
            
            result = await db.users.update_one(
                {"username": username},
                {"$set": {"profileId": profile_id}}
            )
            
            if result.modified_count > 0:
                updated_count += 1
                print(f"  ✅ {username} → profileId: {profile_id}")
            else:
                print(f"  ⚠️ Failed to update {username}")
        
        print(f"\n✅ Migration complete! Updated {updated_count}/{len(users_without_id)} users")
        
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        raise
    finally:
        client.close()

if __name__ == "__main__":
    asyncio.run(migrate_profile_ids())
