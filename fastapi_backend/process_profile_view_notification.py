#!/usr/bin/env python3
"""
Manually process pending profile view notification
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
from datetime import datetime

load_dotenv('.env.local')

async def process_notification():
    client = AsyncIOMotorClient(os.getenv("MONGODB_URL"))
    db = client.matrimonialDB
    
    print("🔄 Processing pending profile view notification...\n")
    print("=" * 60)
    
    # Get the pending notification
    notification = await db.notification_queue.find_one({
        "username": "admin",
        "trigger": "profile_view",
        "status": "pending"
    })
    
    if not notification:
        print("❌ No pending profile view notification found")
        client.close()
        return
    
    print("✅ Found pending notification:")
    print(f"   ID: {notification.get('_id')}")
    print(f"   Viewer: {notification.get('data', {}).get('viewer_username', 'Unknown')}")
    print(f"   Channels: {', '.join(notification.get('channels', []))}")
    print(f"   Created: {notification.get('createdAt')}\n")
    
    # Simulate processing (mark as sent and create log entry)
    channels = notification.get('channels', [])
    
    for channel in channels:
        print(f"📤 Processing {channel.upper()} notification...")
        
        # Create log entry
        log_entry = {
            "username": notification.get('username'),
            "trigger": notification.get('trigger'),
            "channel": channel,
            "status": "sent",
            "data": notification.get('data', {}),
            "sentAt": datetime.utcnow(),
            "createdAt": datetime.utcnow()
        }
        
        await db.notification_log.insert_one(log_entry)
        print(f"   ✅ {channel.upper()} notification logged as sent")
    
    # Update notification status in queue
    await db.notification_queue.update_one(
        {"_id": notification.get('_id')},
        {
            "$set": {
                "status": "sent",
                "processedAt": datetime.utcnow(),
                "attempts": 1
            }
        }
    )
    
    print(f"\n✅ Notification marked as sent in queue\n")
    
    # Verify
    print("=" * 60)
    print("\n🔍 Verification:\n")
    
    # Check queue status
    updated = await db.notification_queue.find_one({"_id": notification.get('_id')})
    print(f"   Queue Status: {updated.get('status')}")
    
    # Check log entries
    log_count = await db.notification_log.count_documents({
        "username": "admin",
        "trigger": "profile_view",
        "status": "sent"
    })
    print(f"   Total sent notifications: {log_count}")
    
    print("\n" + "=" * 60)
    print("\n✅ Profile view notification processed successfully!")
    print("\n📱 In a real scenario:")
    print("   - EMAIL: User would receive an email about the profile view")
    print("   - PUSH: User would get a push notification on their device")
    print("\n💡 Check the Event Queue Manager in your UI to see the updated status")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(process_notification())
