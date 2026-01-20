"""
Migration: Set Daily Digest as Default for All Users
Date: January 2026

This migration updates all existing users to have daily digest enabled by default.
- Sets digestSettings.enabled = True
- Sets all batch options to True (batchFavorites, batchShortlists, batchProfileViews, batchPiiRequests, batchNewMatches)
- Only security alerts (SUSPICIOUS_LOGIN) remain instant

Run with: python -m migrations.migrate_digest_default
"""

import asyncio
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime
from config import Settings

settings = Settings()


async def migrate_digest_defaults():
    """Update all existing users to have daily digest enabled by default"""
    
    print("=" * 60)
    print("🔄 Migration: Set Daily Digest as Default for All Users")
    print("=" * 60)
    
    # Connect to MongoDB
    client = AsyncIOMotorClient(settings.mongodb_url)
    db = client[settings.mongodb_db_name]
    
    # Default digest settings
    default_digest_settings = {
        "enabled": True,
        "frequency": "daily",
        "preferredTime": "08:00",
        "timezone": "UTC",
        "minMatchScore": 0,
        "skipIfNoActivity": True,
        "batchFavorites": True,
        "batchShortlists": True,
        "batchProfileViews": True,
        "batchPiiRequests": True,
        "batchNewMatches": True
    }
    
    try:
        # Count existing notification preferences
        total_prefs = await db.notification_preferences.count_documents({})
        print(f"\n📊 Found {total_prefs} existing notification preference records")
        
        # Count users without notification preferences
        all_users = await db.users.count_documents({})
        users_with_prefs = await db.notification_preferences.distinct("username")
        users_without_prefs = all_users - len(users_with_prefs)
        print(f"📊 Found {users_without_prefs} users without notification preferences")
        
        # Update existing preferences to enable digest
        print("\n🔄 Updating existing notification preferences...")
        
        # Update all existing preferences to have digest enabled
        result = await db.notification_preferences.update_many(
            {},  # All documents
            {
                "$set": {
                    "digestSettings": default_digest_settings,
                    "updatedAt": datetime.utcnow()
                }
            }
        )
        
        print(f"✅ Updated {result.modified_count} notification preference records")
        
        # For users without preferences, they will get defaults when they access the app
        # (handled by create_default_preferences in notification_service.py)
        print(f"\n📝 Note: {users_without_prefs} users without preferences will get digest defaults on next access")
        
        # Summary
        print("\n" + "=" * 60)
        print("✅ Migration Complete!")
        print("=" * 60)
        print("\n📋 Summary:")
        print(f"   - Updated {result.modified_count} existing preference records")
        print(f"   - {users_without_prefs} users will get defaults on next access")
        print("\n📌 New Default Settings:")
        print("   - Daily Digest: ENABLED")
        print("   - Batch Favorites: YES")
        print("   - Batch Shortlists: YES")
        print("   - Batch Profile Views: YES")
        print("   - Batch PII Requests: YES")
        print("   - Batch New Matches: YES")
        print("   - Only SUSPICIOUS_LOGIN alerts are instant")
        
    except Exception as e:
        print(f"\n❌ Migration failed: {e}")
        raise
    finally:
        client.close()


async def dry_run():
    """Preview what the migration would do without making changes"""
    
    print("=" * 60)
    print("🔍 DRY RUN: Preview Migration Changes")
    print("=" * 60)
    
    client = AsyncIOMotorClient(settings.mongodb_url)
    db = client[settings.mongodb_db_name]
    
    try:
        # Count records
        total_prefs = await db.notification_preferences.count_documents({})
        digest_disabled = await db.notification_preferences.count_documents({
            "$or": [
                {"digestSettings.enabled": False},
                {"digestSettings.enabled": {"$exists": False}},
                {"digestSettings": {"$exists": False}}
            ]
        })
        
        all_users = await db.users.count_documents({})
        users_with_prefs = len(await db.notification_preferences.distinct("username"))
        
        print(f"\n📊 Current State:")
        print(f"   - Total users: {all_users}")
        print(f"   - Users with notification preferences: {users_with_prefs}")
        print(f"   - Users without preferences: {all_users - users_with_prefs}")
        print(f"   - Preferences with digest disabled/missing: {digest_disabled}")
        
        print(f"\n📝 Migration Would:")
        print(f"   - Update {total_prefs} notification preference records")
        print(f"   - Set digestSettings.enabled = True for all")
        print(f"   - Set all batch options to True")
        
    finally:
        client.close()


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Migrate users to daily digest default")
    parser.add_argument("--dry-run", action="store_true", help="Preview changes without applying")
    args = parser.parse_args()
    
    if args.dry_run:
        asyncio.run(dry_run())
    else:
        # Confirm before running
        print("\n⚠️  This will update ALL notification preferences to enable daily digest.")
        confirm = input("Continue? (yes/no): ").strip().lower()
        if confirm == "yes":
            asyncio.run(migrate_digest_defaults())
        else:
            print("Migration cancelled.")
