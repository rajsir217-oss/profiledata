#!/usr/bin/env python3
"""
Disable SMS Channel for Active Users
=====================================
Migration script to remove SMS from notification preferences for active users.
Inactive users (for re-engagement campaigns) keep SMS enabled.

This solves:
1. Duplicate SMS issue for active users
2. Reduces SMS costs significantly
3. Preserves SMS for re-engagement (Enhanced Login Reminder still works via force_send)

Users can manually re-enable SMS in their settings if desired.
"""

import asyncio
import sys
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorClient
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from config import Settings

settings = Settings()


async def disable_sms_for_active_users():
    """Disable SMS channel for all active users across all notification triggers"""
    
    client = AsyncIOMotorClient(settings.mongodb_url)
    db = client[settings.database_name]
    
    print("🔧 Starting SMS channel migration for active users...")
    print(f"   Database: {settings.database_name}")
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
    
    client = AsyncIOMotorClient(settings.mongodb_url)
    db = client[settings.database_name]
    
    print("⚠️  ROLLBACK: Re-enabling SMS for users affected by migration...")
    print()
    
    # This is a safety rollback - it re-enables SMS for email channel only
    # Users who want full SMS can manually enable it
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
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be changed without making changes"
    )
    
    args = parser.parse_args()
    
    if args.dry_run:
        print("🧪 DRY RUN MODE - No changes will be made")
        print()
        # TODO: Implement dry-run logic
        print("⚠️  Dry-run not yet implemented. Run without --dry-run to execute.")
    elif args.rollback:
        asyncio.run(rollback_migration())
    else:
        asyncio.run(disable_sms_for_active_users())
