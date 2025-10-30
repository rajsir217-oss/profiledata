"""
Admin Tool: All Notifications Test Data Generator
Insert test notifications for all channels (Email, SMS, Push)

Usage:
    cd /Users/rajsiripuram02/opt/appsrc/profiledata/fastapi_backend
    python admin_tools/test_all_notifications.py
"""

import asyncio
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId

# MongoDB connection
MONGODB_URL = "mongodb://localhost:27017"
DB_NAME = "matrimonialDB"

async def insert_test_notifications():
    """Insert test notifications for all channels"""
    
    client = AsyncIOMotorClient(MONGODB_URL)
    db = client[DB_NAME]
    
    print("📬 Inserting test notifications for all channels...")
    
    # Test data
    test_user = {
        "username": "admin",
        "email": "admin@example.com",
        "contactNumber": "+1234567890"
    }
    
    # 1. EMAIL NOTIFICATIONS
    email_notifications = [
        {
            "username": test_user["username"],
            "trigger": "new_match",
            "channel": "email",
            "priority": "normal",
            "status": "pending",
            "attempts": 0,
            "template_data": {
                "subject": "🎉 You Have a New Match!",
                "recipient": {
                    "firstName": "Admin",
                    "email": test_user["email"]
                },
                "match": {
                    "firstName": "Sarah",
                    "age": 28,
                    "matchScore": 92,
                    "location": "New York, NY"
                }
            },
            "scheduled_at": datetime.utcnow(),
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        },
        {
            "username": test_user["username"],
            "trigger": "new_message",
            "channel": "email",
            "priority": "high",
            "status": "pending",
            "attempts": 0,
            "template_data": {
                "subject": "💬 New Message from Emma",
                "recipient": {
                    "firstName": "Admin",
                    "email": test_user["email"]
                },
                "sender": {
                    "firstName": "Emma",
                    "username": "emma_smith"
                },
                "message_preview": "Hi! I saw your profile and thought we'd be a great match..."
            },
            "scheduled_at": datetime.utcnow(),
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
    ]
    
    # 2. SMS NOTIFICATIONS
    sms_notifications = [
        {
            "username": test_user["username"],
            "trigger": "pii_request",
            "channel": "sms",
            "priority": "high",
            "status": "pending",
            "attempts": 0,
            "template_data": {
                "phone": test_user["contactNumber"],
                "message": "Lisa Brown requested access to your contact info. Login to respond.",
                "requester": {
                    "firstName": "Lisa",
                    "username": "lisa_brown"
                }
            },
            "scheduled_at": datetime.utcnow(),
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        },
        {
            "username": test_user["username"],
            "trigger": "match_milestone",
            "channel": "sms",
            "priority": "low",
            "status": "pending",
            "attempts": 0,
            "template_data": {
                "phone": test_user["contactNumber"],
                "message": "🎯 Congrats! You've reached 10 mutual matches on ProfileData!",
                "milestone": {
                    "type": "mutual_matches",
                    "count": 10
                }
            },
            "scheduled_at": datetime.utcnow(),
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
    ]
    
    # 3. PUSH NOTIFICATIONS
    push_notifications = [
        {
            "username": test_user["username"],
            "trigger": "profile_view",
            "channel": "push",
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
            "username": test_user["username"],
            "trigger": "new_favorite",
            "channel": "push",
            "priority": "normal",
            "status": "pending",
            "attempts": 0,
            "template_data": {
                "title": "💖 Someone Favorited You!",
                "body": "Jessica added you to favorites",
                "fan": {
                    "firstName": "Jessica",
                    "username": "jessica_davis"
                },
                "click_action": "/favorites"
            },
            "scheduled_at": datetime.utcnow(),
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
    ]
    
    # Create push subscription if needed
    existing_sub = await db.push_subscriptions.find_one({"username": test_user["username"]})
    if not existing_sub:
        await db.push_subscriptions.insert_one({
            "username": test_user["username"],
            "device_token": "test_fcm_token_admin_device_001",
            "device_type": "web",
            "device_name": "Test Browser",
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
            "is_active": True
        })
        print("✅ Created test push subscription")
    
    # Clear old test notifications
    result = await db.notification_queue.delete_many({"username": test_user["username"]})
    print(f"🗑️  Removed {result.deleted_count} old test notifications")
    
    # Insert all notifications
    all_notifications = email_notifications + sms_notifications + push_notifications
    result = await db.notification_queue.insert_many(all_notifications)
    
    print(f"\n✅ Inserted {len(result.inserted_ids)} test notifications")
    print(f"   📧 Email: {len(email_notifications)}")
    print(f"   📱 SMS: {len(sms_notifications)}")
    print(f"   🔔 Push: {len(push_notifications)}")
    
    print("\n📋 Test Notifications Created:")
    for notif in all_notifications:
        channel_icon = {"email": "📧", "sms": "📱", "push": "🔔"}.get(notif["channel"], "❓")
        title = notif["template_data"].get("subject") or notif["template_data"].get("title") or notif["trigger"]
        print(f"   {channel_icon} {notif['channel'].upper()}: {title}")
    
    # Count pending in queue
    pending_count = await db.notification_queue.count_documents({"status": "pending"})
    print(f"\n📊 Total pending in queue: {pending_count}")
    
    print("\n🚀 Next Steps:")
    print("   1. Go to Dynamic Scheduler: http://localhost:3000/dynamic-scheduler")
    print("   2. Run these jobs manually:")
    print("      • Email Notifier")
    print("      • SMS Notifier (will show cost calculations)")
    print("      • Push Notifier")
    print("   3. Check Execution History for each job")
    print("   4. NOTE: Actual sending will fail (test data), but processing will work!")
    
    client.close()

if __name__ == "__main__":
    print("=" * 70)
    print("📬 NOTIFICATION TEST DATA GENERATOR (ALL CHANNELS)")
    print("=" * 70)
    asyncio.run(insert_test_notifications())
    print("\n✅ Done! Queue populated with test data")
