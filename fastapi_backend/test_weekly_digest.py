"""
Test Weekly Digest Email Template
Creates a test notification for weekly digest
"""

from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime
import asyncio
from config import Settings

settings = Settings()

async def test_weekly_digest():
    # Connect to MongoDB
    client = AsyncIOMotorClient(settings.mongodb_url)
    db = client[settings.database_name]
    
    print("=" * 60)
    print("TESTING WEEKLY DIGEST EMAIL TEMPLATE")
    print("=" * 60)
    
    # Create test notification
    notification = {
        "trigger": "new_users_matching",
        "channel": "email",
        "recipient": {
            "username": "admin",
            "email": "admin@example.com",  # Change to your email
            "firstName": "Admin"
        },
        "data": {
            "recipient": {
                "firstName": "Admin"
            },
            "matches": {
                "count": "5"
            },
            "app": {
                "dashboardUrl": f"{settings.frontend_url}/dashboard",
                "searchUrl": f"{settings.frontend_url}/search",
                "unsubscribeUrl": f"{settings.frontend_url}/preferences"
            }
        },
        "priority": "low",
        "status": "pending",
        "attempts": 0,
        "scheduledFor": datetime.now(),
        "createdAt": datetime.now(),
        "updatedAt": datetime.now()
    }
    
    # Insert into queue
    result = await db.notification_queue.insert_one(notification)
    
    print(f"\n✅ Test notification created!")
    print(f"   ID: {result.inserted_id}")
    print(f"   Trigger: new_users_matching")
    print(f"   Template: Weekly Digest")
    print(f"   Subject: 📬 5 new people match your preferences")
    print(f"\n📊 Next steps:")
    print(f"   1. Check Event Queue Manager")
    print(f"   2. Wait for email_notifier job (~5 min)")
    print(f"   3. Check your email inbox")
    print("=" * 60)
    
    client.close()

if __name__ == "__main__":
    asyncio.run(test_weekly_digest())
