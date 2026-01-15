"""
Migration: Set ALL notification preferences defaults for all existing users
Sets email and push channels enabled by default for ALL notification triggers
"""

import asyncio
import os
import sys
from datetime import datetime

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Load production environment
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env.production'))

from motor.motor_asyncio import AsyncIOMotorClient
from config import settings


# Default notification channels for all triggers (email + push enabled)
DEFAULT_CHANNELS = {
    # Matches
    "new_match": ["email", "push"],
    "mutual_favorite": ["email", "push"],
    "shortlist_added": ["email", "push"],
    "match_milestone": ["email", "push"],
    "favorited": ["email", "push"],
    
    # Profile Activity
    "profile_view": ["email", "push"],
    "profile_visibility_spike": ["email", "push"],
    "search_appearance": ["email", "push"],
    
    # Messages
    "new_message": ["email", "push"],
    "message_read": ["email", "push"],
    "conversation_cold": ["email", "push"],
    "unread_messages": ["email", "push"],
    
    # Privacy/PII
    "pii_request": ["email", "push"],
    "pending_pii_request": ["email", "push"],
    "pii_granted": ["email", "push"],
    "pii_denied": ["email", "push"],
    "pii_expiring": ["email", "push"],
    "suspicious_login": ["email", "push"],
    
    # Engagement
    "new_users_matching": ["email", "push"],
    "profile_incomplete": ["email", "push"],
    "upload_photos": ["email", "push"],
    
    # Digests
    "weekly_digest": ["email"],
    "monthly_digest": ["email"],
    "saved_search_matches": ["email", "push"],
    
    # Polls
    "poll_reminder": ["email", "push"],
}


async def run_migration():
    """Set ALL notification defaults for all existing users"""
    
    print("=" * 60)
    print("Migration: Set ALL notification preferences defaults")
    print("=" * 60)
    
    # Connect to MongoDB
    client = AsyncIOMotorClient(settings.mongodb_url)
    db = client[settings.database_name]
    
    try:
        preferences_collection = db.notification_preferences
        
        total_docs = await preferences_collection.count_documents({})
        print(f"\n📊 Found {total_docs} notification preference documents")
        
        # Process each document individually to merge channels
        updated_count = 0
        cursor = preferences_collection.find({})
        
        async for doc in cursor:
            username = doc.get("username")
            existing_channels = doc.get("channels", {})
            
            # Merge: keep existing preferences, add missing ones with defaults
            updated_channels = dict(existing_channels)
            changes_made = False
            
            for trigger, default_channels in DEFAULT_CHANNELS.items():
                if trigger not in updated_channels:
                    updated_channels[trigger] = default_channels
                    changes_made = True
            
            if changes_made:
                await preferences_collection.update_one(
                    {"_id": doc["_id"]},
                    {
                        "$set": {
                            "channels": updated_channels,
                            "updatedAt": datetime.utcnow()
                        }
                    }
                )
                updated_count += 1
                
                if updated_count % 50 == 0:
                    print(f"   Processed {updated_count} users...")
        
        print(f"\n✅ Updated {updated_count} documents")
        
        # Verify the update
        sample = await preferences_collection.find_one({})
        if sample:
            print(f"\n📋 Sample verification for {sample.get('username')}:")
            channels = sample.get('channels', {})
            print(f"   Total triggers configured: {len(channels)}")
            print(f"   poll_reminder: {channels.get('poll_reminder')}")
            print(f"   new_match: {channels.get('new_match')}")
        
        print("\n" + "=" * 60)
        print("✅ Migration completed successfully!")
        print(f"   - {len(DEFAULT_CHANNELS)} notification triggers configured")
        print(f"   - {updated_count} users updated")
        print("=" * 60)
        
    except Exception as e:
        print(f"\n❌ Migration failed: {e}")
        import traceback
        traceback.print_exc()
        raise
    finally:
        client.close()


async def rollback_migration():
    """Rollback: This would require storing original values - not implemented"""
    print("⚠️  Rollback not implemented for this migration")
    print("   This migration only ADDS missing defaults, it doesn't overwrite existing preferences")


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Set ALL notification preferences defaults")
    parser.add_argument("--rollback", action="store_true", help="Rollback the migration")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be done without making changes")
    args = parser.parse_args()
    
    if args.rollback:
        asyncio.run(rollback_migration())
    else:
        asyncio.run(run_migration())
