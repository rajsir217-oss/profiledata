"""Check what notifications are in the queue"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def check_queue():
    client = AsyncIOMotorClient("mongodb://localhost:27017")
    db = client.matrimonialDB
    
    print("📬 Checking notification_queue collection...\n")
    
    # Get all pending notifications
    cursor = db.notification_queue.find({"status": {"$in": ["pending", "scheduled"]}})
    notifications = await cursor.to_list(length=100)
    
    if not notifications:
        print("✅ No pending notifications in queue")
    else:
        print(f"📋 Found {len(notifications)} pending notification(s):\n")
        for i, notif in enumerate(notifications, 1):
            print(f"Notification #{i}:")
            print(f"  Username: {notif.get('username', 'NOT SET')}")
            print(f"  Trigger: {notif.get('trigger', 'NOT SET')}")
            print(f"  Channels: {notif.get('channels', [])}")
            print(f"  Status: {notif.get('status', 'NOT SET')}")
            print(f"  Created: {notif.get('createdAt', 'NOT SET')}")
            print()
    
    # Also check failed ones
    cursor = db.notification_queue.find({"status": "failed"}).limit(5)
    failed = await cursor.to_list(length=5)
    
    if failed:
        print(f"\n❌ Recent failed notifications ({len(failed)}):")
        for notif in failed:
            print(f"  - {notif.get('trigger')} for {notif.get('username')} via {notif.get('channels')}")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(check_queue())
