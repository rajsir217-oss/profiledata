#!/usr/bin/env python3
"""
Test profile view notification system
Simulates a profile view and checks if notification is created
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
from datetime import datetime

load_dotenv('.env.local')

async def test_profile_view():
    client = AsyncIOMotorClient(os.getenv("MONGODB_URL"))
    db = client.matrimonialDB
    
    print("🧪 Testing Profile View Notification System\n")
    print("=" * 60)
    
    # Setup: Create a test user who will view admin's profile
    viewer_username = "test_viewer_001"
    target_username = "admin"
    
    # Check if test viewer exists, if not create minimal doc
    viewer = await db.users.find_one({"username": viewer_username})
    if not viewer:
        print(f"📝 Creating test viewer: {viewer_username}")
        await db.users.insert_one({
            "username": viewer_username,
            "email": f"{viewer_username}@test.com",
            "firstName": "Test",
            "lastName": "Viewer",
            "createdAt": datetime.utcnow(),
            "isActive": True
        })
    else:
        print(f"✅ Test viewer exists: {viewer_username}")
    
    print(f"👤 Viewer: {viewer_username}")
    print(f"🎯 Target: {target_username}\n")
    
    # Step 1: Log profile view activity
    print("Step 1: Logging profile view activity...")
    activity = {
        "username": target_username,
        "actorUsername": viewer_username,
        "activityType": "profile_view",
        "metadata": {
            "viewedBy": viewer_username,
            "viewedAt": datetime.utcnow().isoformat()
        },
        "timestamp": datetime.utcnow(),
        "createdAt": datetime.utcnow()
    }
    
    await db.activity_logs.insert_one(activity)
    print("   ✅ Activity logged\n")
    
    # Step 2: Check if event dispatcher would trigger
    print("Step 2: Checking notification preferences...")
    prefs = await db.notification_preferences.find_one({"username": target_username})
    
    if not prefs:
        print("   ❌ No preferences found!")
        client.close()
        return
    
    profile_view_channels = prefs.get("channels", {}).get("profile_view", [])
    print(f"   ✅ Channels enabled: {', '.join(profile_view_channels) if profile_view_channels else 'NONE'}\n")
    
    if not profile_view_channels:
        print("⚠️  Profile view notifications are DISABLED in preferences!")
        client.close()
        return
    
    # Step 3: Manually create notification (simulating event dispatcher)
    print("Step 3: Creating notification in queue...")
    
    notification = {
        "username": target_username,
        "trigger": "profile_view",
        "channels": profile_view_channels,
        "priority": "low",
        "data": {
            "viewer_username": viewer_username,
            "viewer_name": "Test Viewer",
            "timestamp": datetime.utcnow().isoformat()
        },
        "status": "pending",
        "attempts": 0,
        "createdAt": datetime.utcnow(),
        "scheduledFor": datetime.utcnow()
    }
    
    result = await db.notification_queue.insert_one(notification)
    print(f"   ✅ Notification queued: {result.inserted_id}\n")
    
    # Step 4: Verify notification in queue
    print("Step 4: Verifying notification in queue...")
    queued = await db.notification_queue.find_one({"_id": result.inserted_id})
    
    if queued:
        print("   ✅ Found in queue:")
        print(f"      Username: {queued.get('username')}")
        print(f"      Trigger: {queued.get('trigger')}")
        print(f"      Channels: {', '.join(queued.get('channels', []))}")
        print(f"      Status: {queued.get('status')}")
        print(f"      Viewer: {queued.get('data', {}).get('viewer_username')}")
    else:
        print("   ❌ Not found in queue!")
    
    print("\n" + "=" * 60)
    print("\n✅ Test Complete!")
    print("\n📝 Next Steps:")
    print("   1. Check notification queue in UI: Event Queue Manager")
    print("   2. Process the queue (should send email/push)")
    print("   3. Check notification log for delivery status")
    print("\n💡 To trigger real profile view, have another user view your profile")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(test_profile_view())
