"""
Migration Script: Update Notification Preferences
Adds missing triggers (FAVORITED, SHORTLIST_ADDED, MUTUAL_FAVORITE, etc.)
to existing users' notification preferences
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from models.notification_models import NotificationTrigger, NotificationChannel

# MongoDB connection
MONGODB_URL = "mongodb://localhost:27017"
DATABASE_NAME = "matrimonialDB"


async def migrate_preferences():
    """Update existing users' notification preferences"""
    
    client = AsyncIOMotorClient(MONGODB_URL)
    db = client[DATABASE_NAME]
    
    # New triggers to add
    new_triggers = {
        NotificationTrigger.FAVORITED: [NotificationChannel.EMAIL, NotificationChannel.PUSH],
        NotificationTrigger.SHORTLIST_ADDED: [NotificationChannel.EMAIL],
        NotificationTrigger.MUTUAL_FAVORITE: [NotificationChannel.EMAIL, NotificationChannel.SMS, NotificationChannel.PUSH],
        NotificationTrigger.UNREAD_MESSAGES: [NotificationChannel.EMAIL],
        NotificationTrigger.PII_GRANTED: [NotificationChannel.EMAIL, NotificationChannel.PUSH],
        NotificationTrigger.SUSPICIOUS_LOGIN: [NotificationChannel.EMAIL, NotificationChannel.SMS],
    }
    
    print("🔄 Starting notification preferences migration...")
    
    # Get all existing preferences
    cursor = db.notification_preferences.find({})
    updated_count = 0
    
    async for pref in cursor:
        username = pref.get("username")
        channels = pref.get("channels", {})
        
        # Check which triggers are missing
        missing_triggers = {}
        for trigger, default_channels in new_triggers.items():
            if trigger.value not in channels:
                missing_triggers[trigger.value] = [ch.value for ch in default_channels]
        
        if missing_triggers:
            # Update with missing triggers
            update_data = {f"channels.{trigger}": channels for trigger, channels in missing_triggers.items()}
            
            await db.notification_preferences.update_one(
                {"username": username},
                {"$set": update_data}
            )
            
            updated_count += 1
            print(f"✅ Updated {username}: Added {len(missing_triggers)} triggers")
    
    print(f"\n🎉 Migration complete! Updated {updated_count} users")
    
    # Also ensure users without preferences get them created
    users_cursor = db.users.find({})
    created_count = 0
    
    async for user in users_cursor:
        username = user.get("username")
        
        # Check if preferences exist
        existing = await db.notification_preferences.find_one({"username": username})
        if not existing:
            # Create default preferences
            from services.notification_service import NotificationService
            service = NotificationService(db)
            await service.create_default_preferences(username)
            created_count += 1
            print(f"✅ Created preferences for {username}")
    
    print(f"🎉 Created preferences for {created_count} new users")
    
    client.close()


if __name__ == "__main__":
    asyncio.run(migrate_preferences())
