"""
Admin Tool: Push Notification Test Data Generator
Insert test push notifications into the queue for testing

Usage:
    cd /Users/rajsiripuram02/opt/appsrc/profiledata/fastapi_backend
    python admin_tools/test_push_notifications.py
"""

import asyncio
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId

# MongoDB connection
MONGODB_URL = "mongodb://localhost:27017"
DB_NAME = "matrimonialDB"

async def insert_test_push_notifications():
    """Insert test push notifications and device tokens"""
    
    client = AsyncIOMotorClient(MONGODB_URL)
    db = client[DB_NAME]
    
    print("🔔 Inserting test push notifications...")
    
    # 1. First, create a test push subscription (device token)
    test_subscription = {
        "username": "admin",
        "device_token": "test_fcm_token_12345_admin_device",
        "device_type": "web",
        "device_name": "Chrome on MacOS",
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
        "is_active": True
    }
    
    # Check if subscription exists
    existing = await db.push_subscriptions.find_one({"username": "admin"})
    if not existing:
        await db.push_subscriptions.insert_one(test_subscription)
        print("✅ Created test device subscription for 'admin'")
    else:
        print("✅ Device subscription already exists for 'admin'")
    
    # 2. Create test push notifications in the queue
    test_notifications = [
        {
            "username": "admin",
            "trigger": "new_match",
            "channels": ["push"],
            "priority": "normal",
            "status": "pending",
            "attempts": 0,
            "template_data": {
                "title": "🎉 New Match!",
                "body": "Sarah Johnson (92% match) just joined! Check your matches.",
                "match": {
                    "firstName": "Sarah",
                    "age": 28,
                    "matchScore": 92,
                    "location": "New York"
                },
                "click_action": "/matches"
            },
            "scheduled_at": datetime.utcnow(),
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        },
        {
            "username": "admin",
            "trigger": "new_message",
            "channels": ["push"],
            "priority": "high",
            "status": "pending",
            "attempts": 0,
            "template_data": {
                "title": "💬 New Message",
                "body": "Emma sent you a message: 'Hi! I saw your profile...'",
                "sender": {
                    "firstName": "Emma",
                    "username": "emma_smith"
                },
                "click_action": "/messages/emma_smith"
            },
            "scheduled_at": datetime.utcnow(),
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        },
        {
            "username": "admin",
            "trigger": "profile_view",
            "channels": ["push"],
            "priority": "low",
            "status": "pending",
            "attempts": 0,
            "template_data": {
                "title": "👀 Profile View",
                "body": "Michael viewed your profile",
                "viewer": {
                    "firstName": "Michael",
                    "username": "michael_jones"
                },
                "click_action": "/profile-views"
            },
            "scheduled_at": datetime.utcnow(),
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        },
        {
            "username": "admin",
            "trigger": "pii_request",
            "channels": ["push"],
            "priority": "high",
            "status": "pending",
            "attempts": 0,
            "template_data": {
                "title": "🔐 Contact Info Request",
                "body": "Lisa requested access to your contact information",
                "requester": {
                    "firstName": "Lisa",
                    "username": "lisa_brown"
                },
                "click_action": "/pii-requests"
            },
            "scheduled_at": datetime.utcnow(),
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        },
        {
            "username": "admin",
            "trigger": "match_milestone",
            "channels": ["push"],
            "priority": "normal",
            "status": "pending",
            "attempts": 0,
            "template_data": {
                "title": "🎯 Milestone Reached!",
                "body": "You've reached 10 mutual matches! Keep going!",
                "milestone": {
                    "type": "mutual_matches",
                    "count": 10
                },
                "click_action": "/matches"
            },
            "scheduled_at": datetime.utcnow(),
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
    ]
    
    # Clear old test notifications first
    result = await db.notification_queue.delete_many({
        "username": "admin",
        "channels": {"$in": ["push"]}
    })
    print(f"🗑️  Removed {result.deleted_count} old test notifications")
    
    # Insert new test notifications
    result = await db.notification_queue.insert_many(test_notifications)
    print(f"✅ Inserted {len(result.inserted_ids)} test push notifications into queue")
    
    # Show summary
    print("\n📊 Test Data Summary:")
    print(f"   Username: admin")
    print(f"   Device Token: test_fcm_token_12345_admin_device")
    print(f"   Notifications: {len(test_notifications)}")
    print("\n📋 Notification Types:")
    for notif in test_notifications:
        print(f"   • {notif['trigger']}: {notif['template_data']['title']}")
    
    print("\n🚀 Next Steps:")
    print("   1. Go to Dynamic Scheduler")
    print("   2. Run the 'Push Notifier' job manually")
    print("   3. Check Execution History to see the results")
    print("   4. NOTE: Actual FCM sending will fail (test token), but you'll see the processing!")
    
    client.close()

if __name__ == "__main__":
    print("=" * 60)
    print("🔔 PUSH NOTIFICATION TEST DATA GENERATOR")
    print("=" * 60)
    asyncio.run(insert_test_push_notifications())
    print("\n✅ Done!")
