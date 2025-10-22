"""
Debug Notification Flow - Find where the issue is
"""

import asyncio
import sys
from motor.motor_asyncio import AsyncIOMotorClient
from services.event_dispatcher import EventDispatcher, UserEventType
from services.notification_service import NotificationService

MONGODB_URL = "mongodb://localhost:27017"
DATABASE_NAME = "matrimonialDB"


async def debug_flow():
    """Debug the entire notification flow"""
    
    client = AsyncIOMotorClient(MONGODB_URL)
    db = client[DATABASE_NAME]
    
    print("=" * 60)
    print("🐛 DEBUGGING NOTIFICATION FLOW")
    print("=" * 60)
    
    target_username = "riteshpandey052"
    actor_username = "aadhyadubey079"
    
    # Step 1: Check user preferences
    print("\n📋 Step 1: Checking user preferences...")
    prefs = await db.notification_preferences.find_one({"username": target_username})
    
    if not prefs:
        print(f"   ❌ No preferences found for {target_username}")
        print("   💡 Run: python3 migrate_notification_preferences.py")
        client.close()
        return
    
    print(f"   ✅ Preferences exist for {target_username}")
    
    favorited_channels = prefs.get("channels", {}).get("favorited")
    if not favorited_channels:
        print("   ❌ 'favorited' trigger NOT in channels!")
        print("   💡 Run: python3 migrate_notification_preferences.py")
        client.close()
        return
    
    print(f"   ✅ 'favorited' channels: {favorited_channels}")
    
    # Step 2: Test NotificationService directly
    print("\n📧 Step 2: Testing NotificationService.queue_notification()...")
    service = NotificationService(db)
    
    try:
        result = await service.queue_notification(
            username=target_username,
            trigger="favorited",
            channels=["email", "push"],
            template_data={
                "match": {
                    "firstName": actor_username,
                    "username": actor_username
                }
            }
        )
        
        if result:
            print(f"   ✅ Notification queued successfully!")
            print(f"      ID: {result._id if hasattr(result, '_id') else 'N/A'}")
        else:
            print("   ❌ queue_notification returned None!")
            
    except Exception as e:
        print(f"   ❌ Error: {e}")
        import traceback
        traceback.print_exc()
    
    # Step 3: Check queue
    print("\n🔍 Step 3: Checking notification_queue...")
    count = await db.notification_queue.count_documents({
        "username": target_username,
        "trigger": "favorited"
    })
    
    if count > 0:
        print(f"   ✅ Found {count} notification(s) in queue!")
        notification = await db.notification_queue.find_one({
            "username": target_username,
            "trigger": "favorited"
        })
        print(f"\n   📄 Notification details:")
        print(f"      Username: {notification.get('username')}")
        print(f"      Trigger: {notification.get('trigger')}")
        print(f"      Channels: {notification.get('channels')}")
        print(f"      Status: {notification.get('status')}")
        print(f"      Created: {notification.get('createdAt')}")
    else:
        print("   ❌ No notifications in queue!")
    
    # Step 4: Test EventDispatcher
    print("\n📤 Step 4: Testing EventDispatcher.dispatch()...")
    
    # Clear any existing test notifications first
    await db.notification_queue.delete_many({
        "username": target_username,
        "trigger": "favorited",
        "templateData.match.username": actor_username
    })
    print("   🧹 Cleared old test notifications")
    
    dispatcher = EventDispatcher(db)
    
    try:
        success = await dispatcher.dispatch(
            event_type=UserEventType.FAVORITE_ADDED,
            actor_username=actor_username,
            target_username=target_username,
            metadata={"source": "debug_script"}
        )
        
        if success:
            print("   ✅ Event dispatched successfully!")
        else:
            print("   ❌ Event dispatch returned False!")
            
    except Exception as e:
        print(f"   ❌ Error: {e}")
        import traceback
        traceback.print_exc()
    
    # Step 5: Check queue again
    print("\n🔍 Step 5: Checking queue after dispatch...")
    await asyncio.sleep(1)  # Wait for async operations
    
    count = await db.notification_queue.count_documents({
        "username": target_username,
        "trigger": "favorited"
    })
    
    if count > 0:
        print(f"   ✅ SUCCESS! Found {count} notification(s) in queue!")
    else:
        print("   ❌ FAILED! No notifications in queue after dispatch!")
        print("\n   🔍 Let's check the handler registration...")
        
        handlers = dispatcher.handlers.get(UserEventType.FAVORITE_ADDED, [])
        print(f"      Handlers registered for FAVORITE_ADDED: {len(handlers)}")
        
        if handlers:
            print("      ✅ Handler is registered")
            print("      ⚠️  Handler executed but didn't queue notification")
            print("      💡 Check backend logs for warnings/errors")
        else:
            print("      ❌ NO HANDLER REGISTERED!")
            print("      💡 Check _register_default_handlers() method")
    
    print("\n" + "=" * 60)
    print("🏁 DEBUG COMPLETE")
    print("=" * 60)
    
    client.close()


if __name__ == "__main__":
    try:
        asyncio.run(debug_flow())
    except KeyboardInterrupt:
        print("\n\n⚠️  Interrupted by user")
        sys.exit(1)
