#!/usr/bin/env python3
"""
Quick test script to generate sample activity logs
Run: python test_activity_logger.py
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from config import settings
from services.activity_logger import ActivityLogger
from models.activity_models import ActivityType

async def generate_test_logs():
    """Generate some test activity logs"""
    
    print("🧪 Generating test activity logs...")
    
    # Connect to database
    client = AsyncIOMotorClient(settings.mongodb_url)
    db = client[settings.database_name]
    
    # Initialize activity logger
    logger = ActivityLogger(db)
    
    # Generate various test activities
    test_activities = [
        {
            "username": "admin",
            "action_type": ActivityType.USER_LOGIN,
            "metadata": {"test": True, "ip": "127.0.0.1"}
        },
        {
            "username": "admin",
            "action_type": ActivityType.PROFILE_VIEWED,
            "target_username": "parthdaga035",
            "metadata": {"test": True}
        },
        {
            "username": "admin",
            "action_type": ActivityType.FAVORITE_ADDED,
            "target_username": "aadhyadubey079",
            "metadata": {"test": True}
        },
        {
            "username": "admin",
            "action_type": ActivityType.MESSAGE_SENT,
            "target_username": "parthdaga035",
            "metadata": {"test": True, "message_length": 50}
        },
        {
            "username": "admin",
            "action_type": ActivityType.SEARCH_PERFORMED,
            "metadata": {"test": True, "filters": {"age": "25-30"}}
        },
    ]
    
    print(f"📝 Creating {len(test_activities)} test activities...")
    
    for activity in test_activities:
        await logger.log_activity(**activity)
        print(f"  ✅ {activity['action_type'].value}")
    
    # Force flush (using private method)
    await logger._flush_batch()
    print(f"\n✅ Flushed batch logs to database")
    
    # Count logs
    count = await db.activity_logs.count_documents({})
    print(f"\n📊 Total activity logs in database: {count}")
    
    # Show recent logs
    recent = await db.activity_logs.find().sort("timestamp", -1).limit(5).to_list(5)
    print(f"\n📜 Recent logs:")
    for log in recent:
        print(f"  - {log['username']}: {log['action_type']} → {log.get('target_username', 'N/A')}")
    
    client.close()
    print("\n🎉 Test completed! Check Activity Logs page to see entries.")

if __name__ == "__main__":
    asyncio.run(generate_test_logs())
