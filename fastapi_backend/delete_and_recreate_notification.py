#!/usr/bin/env python3
"""
Delete old notification and trigger a fresh shortlist event
This will use the NEW event dispatcher code with fixed template data
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv('.env.local')

async def recreate_notification():
    client = AsyncIOMotorClient(os.getenv("MONGODB_URL"))
    db = client.matrimonialDB
    
    print("🗑️ Step 1: Delete old notification with bad template data...\n")
    
    # Delete the old notification
    result = await db.notification_queue.delete_one({
        "_id": "6902f7ea88384902a279451a"
    })
    
    if result.deleted_count > 0:
        print("✅ Deleted old notification\n")
    else:
        print("⚠️ Notification not found (may already be deleted)\n")
    
    print("📤 Step 2: Trigger fresh shortlist_added event...\n")
    
    # Publish event via Redis to trigger the NEW event dispatcher
    import redis
    redis_client = redis.from_url(os.getenv("REDIS_URL", "redis://localhost:6379"))
    
    event_data = {
        "event_type": "shortlist_added",
        "actor": "siddharthdas007",  # Username who added to shortlist
        "target": "admin",            # Username who was added
        "timestamp": "2025-11-15T21:05:00Z"
    }
    
    import json
    redis_client.publish("user_events", json.dumps(event_data))
    
    print("✅ Published shortlist_added event to Redis")
    print("   Actor: siddharthdas007")
    print("   Target: admin")
    print("\n🔄 Event dispatcher will now:")
    print("   1. Fetch both users' full data from database")
    print("   2. Decrypt PII fields")
    print("   3. Pass complete actor + user data to template")
    print("   4. Queue new notification with CORRECT data")
    print("\n⏱️ Wait 5 seconds, then run Email Notifier job!\n")
    
    client.close()
    redis_client.close()

if __name__ == "__main__":
    asyncio.run(recreate_notification())
