#!/usr/bin/env python3
"""
Manual test to insert activity log directly
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from config import settings
from datetime import datetime

async def test_insert():
    """Test direct database insertion"""
    print("🧪 Testing activity log insertion...")
    
    # Connect to database
    client = AsyncIOMotorClient(settings.mongodb_url)
    db = client[settings.database_name]
    collection = db.activity_logs
    
    # Create a test log
    test_log = {
        "username": "admin",
        "action_type": "user_login",
        "target_username": None,
        "metadata": {"test": True, "manual": True},
        "ip_address": "127.0.0.1",
        "user_agent": "Mozilla Test",
        "page_url": "/login",
        "referrer_url": None,
        "session_id": "test123",
        "timestamp": datetime.utcnow(),
        "duration_ms": None,
        "pii_logged": False
    }
    
    try:
        result = await collection.insert_one(test_log)
        print(f"✅ Inserted test log with ID: {result.inserted_id}")
        
        # Verify it was inserted
        count = await collection.count_documents({})
        print(f"📊 Total logs in database: {count}")
        
        # Show the log
        log = await collection.find_one({"_id": result.inserted_id})
        print(f"\n📝 Inserted log:")
        print(f"  Username: {log['username']}")
        print(f"  Action: {log['action_type']}")
        print(f"  Timestamp: {log['timestamp']}")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
    
    client.close()

if __name__ == "__main__":
    asyncio.run(test_insert())
