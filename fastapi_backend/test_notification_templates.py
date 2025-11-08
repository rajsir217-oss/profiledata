"""
Test Email Templates with Real Notifications
Creates test notifications in the queue and processes them
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime
from config import Settings

settings = Settings()

# MongoDB connection
client = AsyncIOMotorClient(settings.mongodb_url)
db = client[settings.database_name]

# Sample notification data for each template
TEST_NOTIFICATIONS = [
    # 1. mutual_favorite - HIGH priority
    {
        "trigger": "mutual_favorite",
        "channel": "email",
        "recipient": {
            "username": "testuser1",
            "email": "test1@example.com",
            "firstName": "John"
        },
        "data": {
            "match": {
                "firstName": "Sarah",
                "age": "28",
                "matchScore": "85"
            },
            "app": {
                "conversationUrl": "http://localhost:3000/messages",
                "unsubscribeUrl": "http://localhost:3000/preferences",
                "preferencesUrl": "http://localhost:3000/preferences"
            }
        },
        "priority": "high",
        "scheduledFor": datetime.utcnow()
    },
    
    # 2. shortlist_added
    {
        "trigger": "shortlist_added",
        "channel": "email",
        "recipient": {
            "username": "testuser2",
            "email": "test2@example.com",
            "firstName": "Jane"
        },
        "data": {
            "match": {
                "firstName": "Mike",
                "age": "30",
                "location": "New York, NY",
                "profession": "Engineer"
            },
            "app": {
                "profileUrl": "http://localhost:3000/profile/mike",
                "unsubscribeUrl": "http://localhost:3000/preferences",
                "preferencesUrl": "http://localhost:3000/preferences"
            }
        },
        "priority": "medium",
        "scheduledFor": datetime.utcnow()
    },
    
    # 3. pii_granted
    {
        "trigger": "pii_granted",
        "channel": "email",
        "recipient": {
            "username": "testuser3",
            "email": "test3@example.com",
            "firstName": "Alex"
        },
        "data": {
            "match": {
                "firstName": "Emma"
            },
            "contact": {
                "email": "emma@example.com",
                "phone": "+1 (555) 123-4567"
            },
            "app": {
                "conversationUrl": "http://localhost:3000/messages",
                "unsubscribeUrl": "http://localhost:3000/preferences",
                "preferencesUrl": "http://localhost:3000/preferences"
            }
        },
        "priority": "high",
        "scheduledFor": datetime.utcnow()
    },
    
    # 4. suspicious_login - CRITICAL
    {
        "trigger": "suspicious_login",
        "channel": "email",
        "recipient": {
            "username": "testuser4",
            "email": "test4@example.com",
            "firstName": "David"
        },
        "data": {
            "login": {
                "location": "San Francisco, CA",
                "device": "Chrome on Mac OS",
                "timestamp": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S"),
                "ipAddress": "192.168.1.100"
            },
            "app": {
                "changePasswordUrl": "http://localhost:3000/change-password",
                "securitySettingsUrl": "http://localhost:3000/preferences#security",
                "unsubscribeUrl": "http://localhost:3000/preferences",
                "preferencesUrl": "http://localhost:3000/preferences"
            }
        },
        "priority": "critical",
        "scheduledFor": datetime.utcnow()
    },
    
    # 5. favorited
    {
        "trigger": "favorited",
        "channel": "email",
        "recipient": {
            "username": "testuser5",
            "email": "test5@example.com",
            "firstName": "Lisa"
        },
        "data": {
            "match": {
                "firstName": "Tom",
                "age": "32",
                "location": "Boston, MA"
            },
            "app": {
                "profileUrl": "http://localhost:3000/profile/tom",
                "favoriteBackUrl": "http://localhost:3000/favorites",
                "unsubscribeUrl": "http://localhost:3000/preferences",
                "preferencesUrl": "http://localhost:3000/preferences"
            }
        },
        "priority": "medium",
        "scheduledFor": datetime.utcnow()
    }
]


async def create_test_notifications():
    """Create test notifications in the queue"""
    print("=" * 60)
    print("CREATING TEST NOTIFICATIONS")
    print("=" * 60)
    
    collection = db.notification_queue
    
    # Clear old test notifications
    deleted = await collection.delete_many({"recipient.email": {"$regex": "^test.*@example.com$"}})
    print(f"\n🗑️  Cleared {deleted.deleted_count} old test notifications")
    
    # Insert new test notifications
    print(f"\n📨 Creating {len(TEST_NOTIFICATIONS)} test notifications...\n")
    
    for notif in TEST_NOTIFICATIONS:
        # Add required fields
        notif["status"] = "pending"
        notif["attempts"] = 0
        notif["createdAt"] = datetime.utcnow()
        notif["updatedAt"] = datetime.utcnow()
        
        result = await collection.insert_one(notif)
        print(f"   ✅ Created: {notif['trigger']} → {notif['recipient']['email']}")
    
    print(f"\n🎉 All test notifications created!")
    print(f"📊 Queue status:")
    
    pending = await collection.count_documents({"status": "pending"})
    print(f"   Pending: {pending}")
    
    print("\n" + "=" * 60)
    print("NEXT STEPS:")
    print("=" * 60)
    print("1. Go to Event Queue Manager in admin UI")
    print("2. You should see the test notifications")
    print("3. Or run: python3 -c \"from job_templates.email_notifier_template import execute_job; import asyncio; asyncio.run(execute_job())\"")
    print("4. Check notification_log collection for results")
    print("=" * 60)
    
    client.close()


async def check_queue_status():
    """Check current queue status"""
    print("\n📊 Current Queue Status:")
    print("-" * 60)
    
    queue = db.notification_queue
    log = db.notification_log
    
    pending = await queue.count_documents({"status": "pending"})
    sent = await log.count_documents({"status": "sent"})
    failed = await log.count_documents({"status": "failed"})
    
    print(f"   📬 Pending: {pending}")
    print(f"   ✅ Sent: {sent}")
    print(f"   ❌ Failed: {failed}")
    
    if pending > 0:
        print(f"\n📝 Next pending notifications:")
        notifications = await queue.find({"status": "pending"}).limit(5).to_list(length=5)
        for n in notifications:
            print(f"   • {n['trigger']} → {n['recipient']['email']}")
    
    client.close()


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == "status":
        asyncio.run(check_queue_status())
    else:
        asyncio.run(create_test_notifications())
