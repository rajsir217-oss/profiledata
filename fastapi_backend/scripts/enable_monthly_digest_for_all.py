#!/usr/bin/env python3
"""
Enable MONTHLY_DIGEST notification trigger for all users.
This updates notification_preferences to include monthly_digest in enabled triggers.
"""

import asyncio
import os
import certifi
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone
from dotenv import load_dotenv


async def enable_monthly_digest():
    """Enable monthly digest notifications for all users"""
    
    load_dotenv('.env.production')
    
    mongodb_url = os.getenv('MONGODB_URL')
    if not mongodb_url:
        print("❌ MONGODB_URL not found")
        return
    
    print("=" * 60)
    print("📧 ENABLE MONTHLY DIGEST FOR ALL USERS")
    print("=" * 60)
    
    client = AsyncIOMotorClient(mongodb_url, tlsCAFile=certifi.where())
    db = client.matrimonialDB
    
    # Check current state
    total_prefs = await db.notification_preferences.count_documents({})
    has_monthly = await db.notification_preferences.count_documents({
        "enabledTriggers": "monthly_digest"
    })
    
    print(f"\n📊 Current state:")
    print(f"   Total notification_preferences docs: {total_prefs}")
    print(f"   Already have monthly_digest enabled: {has_monthly}")
    print(f"   Need to update: {total_prefs - has_monthly}")
    
    # Get total active users
    active_users = await db.users.count_documents({"accountStatus": "active"})
    print(f"   Total active users: {active_users}")
    
    confirm = input("\n⚠️  Add 'monthly_digest' to enabledTriggers for all users? (y/n): ").strip().lower()
    if confirm != 'y':
        print("❌ Cancelled")
        client.close()
        return
    
    # Update all existing preferences to add monthly_digest
    result = await db.notification_preferences.update_many(
        {"enabledTriggers": {"$ne": "monthly_digest"}},  # Only those without it
        {"$addToSet": {"enabledTriggers": "monthly_digest"}}
    )
    
    print(f"\n✅ Updated {result.modified_count} notification preferences")
    
    # For users without any notification_preferences doc, we need to create one
    # Get users without preferences
    users_with_prefs = await db.notification_preferences.distinct("username")
    all_active_users = await db.users.find(
        {"accountStatus": "active"},
        {"username": 1}
    ).to_list(length=None)
    
    users_without_prefs = [
        u["username"] for u in all_active_users 
        if u["username"] not in users_with_prefs
    ]
    
    print(f"\n📝 Users without any notification preferences: {len(users_without_prefs)}")
    
    if users_without_prefs:
        confirm2 = input("   Create default preferences with monthly_digest enabled? (y/n): ").strip().lower()
        if confirm2 == 'y':
            now = datetime.now(timezone.utc)
            default_triggers = [
                "new_match", "mutual_favorite", "shortlist_added",
                "new_message", "pii_request_received", "pii_granted",
                "profile_view", "monthly_digest"  # Include monthly_digest
            ]
            
            docs_to_insert = []
            for username in users_without_prefs:
                docs_to_insert.append({
                    "username": username,
                    "enabledTriggers": default_triggers,
                    "emailEnabled": True,
                    "smsEnabled": False,
                    "pushEnabled": False,
                    "quietHoursEnabled": False,
                    "quietHoursStart": "22:00",
                    "quietHoursEnd": "08:00",
                    "timezone": "America/Los_Angeles",
                    "createdAt": now,
                    "updatedAt": now
                })
            
            if docs_to_insert:
                insert_result = await db.notification_preferences.insert_many(docs_to_insert)
                print(f"   ✅ Created {len(insert_result.inserted_ids)} new preference docs")
    
    # Verify final state
    final_has_monthly = await db.notification_preferences.count_documents({
        "enabledTriggers": "monthly_digest"
    })
    print(f"\n📊 Final state:")
    print(f"   Users with monthly_digest enabled: {final_has_monthly}")
    
    client.close()
    print("\n✅ Done! You can now re-run the Monthly Digest job.")


if __name__ == "__main__":
    asyncio.run(enable_monthly_digest())
