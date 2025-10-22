"""
Test Event Dispatcher - Verify notification queueing works
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from services.event_dispatcher import EventDispatcher, UserEventType

MONGODB_URL = "mongodb://localhost:27017"
DATABASE_NAME = "matrimonialDB"


async def test_event_dispatch():
    """Test event dispatching and notification queueing"""
    
    client = AsyncIOMotorClient(MONGODB_URL)
    db = client[DATABASE_NAME]
    
    print("🧪 Testing Event Dispatcher...")
    print("-" * 50)
    
    # Initialize dispatcher
    dispatcher = EventDispatcher(db)
    
    # Test 1: Check if dispatcher initialized
    print("\n1️⃣ Dispatcher initialized:", "✅" if dispatcher else "❌")
    
    # Test 2: Dispatch favorite event
    print("\n2️⃣ Dispatching FAVORITE_ADDED event...")
    try:
        await dispatcher.dispatch(
            UserEventType.FAVORITE_ADDED,
            actor_username="aadhyadubey079",
            target_username="Ritesh Pandey",
            metadata={"source": "test_script"}
        )
        print("   ✅ Event dispatched successfully")
    except Exception as e:
        print(f"   ❌ Error: {e}")
        import traceback
        traceback.print_exc()
        client.close()
        return
    
    # Test 3: Check if notification was queued
    print("\n3️⃣ Checking notification queue...")
    await asyncio.sleep(1)  # Wait for async operations
    
    queue_count = await db.notification_queue.count_documents({
        "username": "Ritesh Pandey",
        "trigger": "favorited"
    })
    
    if queue_count > 0:
        print(f"   ✅ Found {queue_count} notification(s) in queue!")
        
        # Show the notification
        notification = await db.notification_queue.find_one({
            "username": "Ritesh Pandey",
            "trigger": "favorited"
        })
        
        print("\n   📧 Notification details:")
        print(f"      Username: {notification.get('username')}")
        print(f"      Trigger: {notification.get('trigger')}")
        print(f"      Channels: {notification.get('channels')}")
        print(f"      Status: {notification.get('status')}")
        print(f"      Created: {notification.get('createdAt')}")
    else:
        print("   ❌ No notification found in queue!")
        print("\n   🔍 Checking user preferences...")
        
        prefs = await db.notification_preferences.find_one({
            "username": "Ritesh Pandey"
        })
        
        if prefs:
            channels = prefs.get("channels", {})
            favorited = channels.get("favorited", None)
            print(f"      Preferences exist: ✅")
            print(f"      'favorited' trigger: {favorited if favorited else '❌ MISSING!'}")
            
            if not favorited:
                print("\n   ⚠️  PROBLEM FOUND: User preferences missing 'favorited' trigger!")
                print("   💡 Solution: Run migrate_notification_preferences.py")
        else:
            print("      ❌ No preferences found for user!")
            print("   💡 Solution: Run migrate_notification_preferences.py")
    
    print("\n" + "=" * 50)
    print("✅ Test complete!")
    
    client.close()


if __name__ == "__main__":
    asyncio.run(test_event_dispatch())
