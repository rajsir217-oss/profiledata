#!/usr/bin/env python3
"""
Reset shortlist notification to pending so it can be sent again
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv('.env.local')

async def reset():
    client = AsyncIOMotorClient(os.getenv("MONGODB_URL"))
    db = client.matrimonialDB
    
    print("🔄 Resetting shortlist notification to pending...\n")
    
    # Find the notification
    notification = await db.notification_queue.find_one({
        "username": "admin",
        "trigger": "shortlist_added",
        "channels": {"$in": ["email"]}
    })
    
    if not notification:
        print("❌ Notification not found in queue")
        client.close()
        return
    
    print(f"✅ Found notification (ID: {notification['_id']})")
    print(f"   Current status: {notification.get('status')}")
    print(f"   Attempts: {notification.get('attempts', 0)}")
    
    # Reset to pending
    result = await db.notification_queue.update_one(
        {"_id": notification["_id"]},
        {
            "$set": {
                "status": "pending",
                "attempts": 0,
                "lastError": None,
                "processedAt": None
            }
        }
    )
    
    if result.modified_count > 0:
        print("\n✅ Notification reset to PENDING")
        print("\n📧 Now run the Email Notifier job to send it!")
        print("   The template now exists, so it should work.\n")
    else:
        print("\n⚠️  No changes made")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(reset())
