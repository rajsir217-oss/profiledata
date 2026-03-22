#!/usr/bin/env python3
"""
Disable SMS Channel for Active Users (Standalone)
==================================================
Migration script to remove SMS from notification preferences for active users.
Uses MongoDB connection directly without FastAPI dependencies.
"""

import asyncio
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv('.env.production')

MONGODB_URL = os.getenv('MONGODB_URL', 'mongodb+srv://rajl3v3l_db_user:3F01eZUHTY9tx07u@mongocluster0.rebdf0h.mongodb.net/matrimonialDB')
DATABASE_NAME = os.getenv('DATABASE_NAME', 'matrimonialDB')


async def disable_sms_for_active_users():
    """Disable SMS channel for all active users across all notification triggers"""
    
    client = AsyncIOMotorClient(MONGODB_URL)
    db = client[DATABASE_NAME]
    
    print("🔧 Starting SMS channel migration for active users...")
    print(f"   Database: {DATABASE_NAME}")
    print(f"   Target: Remove SMS from all notification triggers for active users")
    print()
    
    # Step 1: Count users with SMS enabled
    total_users = await db.notification_preferences.count_documents({})
    print(f"📊 Total users with notification preferences: {total_users}")
    
    # Count users with SMS in any channel
    users_with_sms = await db.notification_preferences.count_documents({
        "$or": [
            {"channels.new_message": "sms"},
            {"channels.unread_messages": "sms"},
            {"channels.new_match": "sms"},
            {"channels.mutual_favorite": "sms"},
            {"channels.favorited": "sms"},
            {"channels.shortlist_added": "sms"},
            {"channels.profile_view": "sms"},
            {"channels.pii_request": "sms"},
            {"channels.pending_pii_request": "sms"},
            {"channels.pii_granted": "sms"},
            {"channels.pii_denied": "sms"},
            {"channels.pii_revoked": "sms"},
            {"channels.message_read": "sms"},
            {"channels.conversation_cold": "sms"},
            {"channels.suspicious_login": "sms"},
            {"channels.poll_reminder": "sms"}
        ]
    })
    print(f"📱 Users with SMS enabled on any trigger: {users_with_sms}")
    print()
    
    # Step 2: Get list of all notification triggers that might have SMS
    all_triggers = [
        "new_message",
        "unread_messages",
        "message_read",
        "conversation_cold",
        "new_match",
        "mutual_favorite",
        "favorited",
        "shortlist_added",
        "profile_view",
        "pii_request",
        "pending_pii_request",
        "pii_granted",
        "pii_denied",
        "pii_revoked",
        "suspicious_login",
        "poll_reminder"
    ]
    
    # Step 3: Build update operation to remove SMS from all channels
    pull_operations = {}
    for trigger in all_triggers:
        pull_operations[f"channels.{trigger}"] = "sms"
    
    print("🔄 Removing SMS from notification preferences...")
    print(f"   Triggers affected: {len(all_triggers)}")
    print()
    
    # Step 4: Execute bulk update
    result = await db.notification_preferences.update_many(
        {},  # All users
        {
            "$pull": pull_operations,
            "$set": {
                "updatedAt": datetime.utcnow(),
                "smsDisabledByMigration": True,  # Track that this was a migration
                "smsDisabledAt": datetime.utcnow()
            }
        }
    )
    
    print("✅ Migration completed!")
    print(f"   Users matched: {result.matched_count}")
    print(f"   Users modified: {result.modified_count}")
    print()
    
    # Step 5: Verify - count users with SMS still enabled
    remaining_sms = await db.notification_preferences.count_documents({
        "$or": [
            {"channels.new_message": "sms"},
            {"channels.unread_messages": "sms"},
            {"channels.new_match": "sms"},
            {"channels.mutual_favorite": "sms"},
            {"channels.favorited": "sms"},
            {"channels.shortlist_added": "sms"},
            {"channels.profile_view": "sms"},
            {"channels.pii_request": "sms"},
            {"channels.pending_pii_request": "sms"},
            {"channels.pii_granted": "sms"},
            {"channels.pii_denied": "sms"},
            {"channels.pii_revoked": "sms"}
        ]
    })
    
    print("📊 Verification:")
    print(f"   Users with SMS before: {users_with_sms}")
    print(f"   Users with SMS after: {remaining_sms}")
    print(f"   SMS channels removed: {users_with_sms - remaining_sms}")
    print()
    
    # Step 6: Show sample of affected users
    print("📋 Sample of updated users:")
    sample_users = await db.notification_preferences.find(
        {"smsDisabledByMigration": True},
        {"username": 1, "channels": 1, "smsDisabledAt": 1}
    ).limit(5).to_list(length=5)
    
    for user in sample_users:
        print(f"   - {user['username']}")
        # Count how many channels still have notifications
        channels_with_notifs = sum(1 for trigger, channels in user.get('channels', {}).items() if channels)
        print(f"     Active notification channels: {channels_with_notifs}")
    print()
    
    print("ℹ️  Important Notes:")
    print("   1. Users can manually re-enable SMS in their notification settings")
    print("   2. Admin-triggered notifications (Enhanced Login Reminder) still send SMS via force_send")
    print("   3. This migration is tracked with 'smsDisabledByMigration' flag")
    print("   4. Email and Push notifications remain unchanged")
    print()
    
    client.close()


async def rollback_migration():
    """Rollback: Re-enable SMS for users who had it before (if needed)"""
    
    client = AsyncIOMotorClient(MONGODB_URL)
    db = client[DATABASE_NAME]
    
    print("⚠️  ROLLBACK: Re-enabling SMS for users affected by migration...")
    print()
    
    # This is a safety rollback - it re-enables SMS for critical triggers only
    result = await db.notification_preferences.update_many(
        {"smsDisabledByMigration": True},
        {
            "$addToSet": {
                "channels.new_message": "sms",
                "channels.pii_request": "sms",
                "channels.suspicious_login": "sms"
            },
            "$unset": {
                "smsDisabledByMigration": "",
                "smsDisabledAt": ""
            },
            "$set": {
                "updatedAt": datetime.utcnow()
            }
        }
    )
    
    print(f"✅ Rollback completed!")
    print(f"   Users restored: {result.modified_count}")
    print(f"   SMS re-enabled for: new_message, pii_request, suspicious_login")
    print()
    
    client.close()


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Disable SMS for active users")
    parser.add_argument(
        "--rollback",
        action="store_true",
        help="Rollback the migration (re-enable SMS)"
    )
    
    args = parser.parse_args()
    
    if args.rollback:
        asyncio.run(rollback_migration())
    else:
        asyncio.run(disable_sms_for_active_users())
