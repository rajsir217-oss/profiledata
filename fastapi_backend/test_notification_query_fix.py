#!/usr/bin/env python3
"""
Test that notification query fix works
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
import sys
from dotenv import load_dotenv

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

load_dotenv('.env.local')

async def test_query():
    client = AsyncIOMotorClient(os.getenv("MONGODB_URL"))
    db = client.matrimonialDB
    
    print("🧪 Testing Notification Query Fix")
    print("=" * 60)
    
    # Import the fixed notification service
    from services.notification_service import NotificationService
    from models.notification_models import NotificationChannel
    
    service = NotificationService(db)
    
    # Test 1: Get pending EMAIL notifications
    print("\n1️⃣  Testing EMAIL channel:")
    email_notifications = await service.get_pending_notifications(
        channel=NotificationChannel.EMAIL,
        limit=10
    )
    print(f"   Found {len(email_notifications)} pending EMAIL notifications")
    for notif in email_notifications:
        print(f"   - {notif.username}: {notif.trigger} (channels: {notif.channels})")
    
    # Test 2: Get pending SMS notifications
    print("\n2️⃣  Testing SMS channel:")
    sms_notifications = await service.get_pending_notifications(
        channel=NotificationChannel.SMS,
        limit=10
    )
    print(f"   Found {len(sms_notifications)} pending SMS notifications")
    for notif in sms_notifications:
        print(f"   - {notif.username}: {notif.trigger} (channels: {notif.channels})")
    
    # Test 3: Get pending PUSH notifications
    print("\n3️⃣  Testing PUSH channel:")
    push_notifications = await service.get_pending_notifications(
        channel=NotificationChannel.PUSH,
        limit=10
    )
    print(f"   Found {len(push_notifications)} pending PUSH notifications")
    for notif in push_notifications:
        print(f"   - {notif.username}: {notif.trigger} (channels: {notif.channels})")
    
    # Test 4: Get ALL pending notifications (no channel filter)
    print("\n4️⃣  Testing NO channel filter:")
    all_notifications = await service.get_pending_notifications(limit=10)
    print(f"   Found {len(all_notifications)} total pending notifications")
    
    print("\n" + "=" * 60)
    
    if len(email_notifications) > 0 or len(sms_notifications) > 0 or len(push_notifications) > 0:
        print("\n✅ SUCCESS - Query is finding notifications!")
        print("\n💡 Now restart backend and run the Email/SMS notifier jobs")
        print("   They should pick up these notifications.\n")
    else:
        print("\n⚠️  No pending notifications found")
        print("   This might be expected if queue is empty or all sent.\n")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(test_query())
