"""
Migration: Enable all 3 channels for new notification types
Date: 2024-12-24
Description: Updates all existing users' notification preferences to enable
             email, sms, and push for:
             - pending_pii_request (Pending Request Reminder)
             - unread_messages (Unread Messages)
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime
import os
import sys

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config import Settings

settings = Settings()

async def run_migration():
    """Enable all 3 channels for pending_pii_request and unread_messages for all users"""
    
    print("=" * 60)
    print("Migration: Enable New Notification Channels")
    print("=" * 60)
    print(f"Database: {settings.database_name}")
    print(f"Started: {datetime.utcnow().isoformat()}")
    print()
    
    # Connect to MongoDB
    client = AsyncIOMotorClient(settings.mongodb_url)
    db = client[settings.database_name]
    
    try:
        # Get count of notification preferences
        total_prefs = await db.notification_preferences.count_documents({})
        print(f"Total notification preference records: {total_prefs}")
        
        # Define the channels to set
        all_channels = ["email", "sms", "push"]
        
        # Update all users to have all 3 channels for these triggers
        result = await db.notification_preferences.update_many(
            {},  # All documents
            {
                "$set": {
                    "channels.pending_pii_request": all_channels,
                    "channels.unread_messages": all_channels,
                    "updatedAt": datetime.utcnow()
                }
            }
        )
        
        print(f"\n✅ Migration Complete!")
        print(f"   - Matched: {result.matched_count} records")
        print(f"   - Modified: {result.modified_count} records")
        print()
        print("Channels enabled for:")
        print("   - pending_pii_request: email, sms, push")
        print("   - unread_messages: email, sms, push")
        print()
        
        # Verify a sample
        sample = await db.notification_preferences.find_one({})
        if sample:
            channels = sample.get("channels", {})
            print("Sample verification:")
            print(f"   - pending_pii_request: {channels.get('pending_pii_request', 'NOT SET')}")
            print(f"   - unread_messages: {channels.get('unread_messages', 'NOT SET')}")
        
        print()
        print(f"Completed: {datetime.utcnow().isoformat()}")
        print("=" * 60)
        
    except Exception as e:
        print(f"\n❌ Migration failed: {e}")
        raise
    finally:
        client.close()

if __name__ == "__main__":
    asyncio.run(run_migration())
