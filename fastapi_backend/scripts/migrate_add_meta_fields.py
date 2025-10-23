"""
Migration Script: Add Meta Fields to Existing Users
Adds Phase 1, 2, and 3 meta fields to all existing user profiles
"""
import asyncio
import sys
import os
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorClient

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config import settings

async def migrate_add_meta_fields():
    """Add meta fields to all existing users"""
    print("🔄 Starting meta fields migration...")
    
    # Connect to MongoDB
    print("📡 Connecting to MongoDB...")
    client = AsyncIOMotorClient(settings.mongodb_url)
    db = client[settings.database_name]
    
    # Test connection
    try:
        await client.server_info()
        print("✅ Connected to MongoDB successfully")
    except Exception as e:
        print(f"❌ Failed to connect to MongoDB: {e}")
        return
    
    # Get all users
    users = await db.users.find({}).to_list(length=None)
    total_users = len(users)
    print(f"📊 Found {total_users} users to migrate")
    
    # Default meta fields
    meta_fields = {
        # Phase 1: Essential
        "idVerified": False,
        "idVerifiedAt": None,
        "idVerifiedBy": None,
        "emailVerified": False,
        "emailVerifiedAt": None,
        "phoneVerified": False,
        "phoneVerifiedAt": None,
        "isPremium": False,
        "premiumStatus": "free",
        "premiumActivatedAt": None,
        "premiumExpiresAt": None,
        "profileCompleteness": 0,
        "trustScore": 50,
        "lastActiveAt": None,
        
        # Phase 2: Enhanced Trust
        "employmentVerified": False,
        "employmentVerifiedAt": None,
        "employmentVerificationSource": None,
        "educationVerified": False,
        "educationVerifiedAt": None,
        "educationVerificationSource": None,
        "backgroundCheckStatus": "none",
        "backgroundCheckCompletedAt": None,
        "profileQualityScore": 0,
        "moderationStatus": "approved",
        "moderatedBy": None,
        "moderatedAt": None,
        
        # Phase 3: Gamification
        "badges": [],
        "achievementPoints": 0,
        "profileRank": None,
        "isFeatured": False,
        "featuredUntil": None,
        "isStaffPick": False,
        "profileViews": 0,
        "profileViewsThisMonth": 0,
        "uniqueViewersCount": 0,
        "responseRate": 0.0,
        "replyTimeAverage": None,
        "activeDays": 0,
        "shortlistCount": 0,
        "favoriteCount": 0,
        
        # Admin Controls
        "metaFieldsVisibility": {},
        "metaFieldsVisibleToPublic": False
    }
    
    updated_count = 0
    skipped_count = 0
    
    for user in users:
        username = user.get('username', 'unknown')
        
        # Check if user already has meta fields
        if 'trustScore' in user:
            print(f"  ⏭️  Skipping {username} (already migrated)")
            skipped_count += 1
            continue
        
        try:
            # Update user with meta fields
            result = await db.users.update_one(
                {'username': username},
                {'$set': meta_fields}
            )
            
            if result.modified_count > 0:
                print(f"  ✅ Migrated {username}")
                updated_count += 1
            
        except Exception as e:
            print(f"  ❌ Error migrating {username}: {e}")
    
    print(f"\n🎉 Migration completed!")
    print(f"   Total users: {total_users}")
    print(f"   Migrated: {updated_count}")
    print(f"   Skipped: {skipped_count}")
    print(f"\n📋 Meta fields added:")
    print(f"   Phase 1 (Essential): 13 fields")
    print(f"   Phase 2 (Enhanced Trust): 11 fields")
    print(f"   Phase 3 (Gamification): 14 fields")
    print(f"   Total: 38 new fields per user")
    
    # Close MongoDB connection
    client.close()
    print("\n🔌 MongoDB connection closed")

if __name__ == "__main__":
    asyncio.run(migrate_add_meta_fields())
