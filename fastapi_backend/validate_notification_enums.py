#!/usr/bin/env python3
"""
Validate notification queue and log entries against Pydantic models.
Run this to identify any enum mismatches in production.
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from models.notification_models import (
    NotificationTrigger, 
    NotificationChannel, 
    NotificationPriority, 
    NotificationStatus,
    NotificationQueueItem
)
import os

# Use EnvironmentManager to auto-detect and load correct environment
from env_config import EnvironmentManager

env_manager = EnvironmentManager()
current_env = env_manager.detect_environment()
env_manager.load_environment_config(current_env)

MONGO_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
DB_NAME = os.getenv("DATABASE_NAME", "matrimonialDB")


async def validate_queue():
    """Validate all notification_queue entries"""
    import certifi
    
    if "mongodb+srv" in MONGO_URL or "mongodb.net" in MONGO_URL:
        client = AsyncIOMotorClient(MONGO_URL, tlsCAFile=certifi.where())
    else:
        client = AsyncIOMotorClient(MONGO_URL)
    
    db = client[DB_NAME]
    
    print(f"🔍 Validating notification_queue in {current_env} environment...")
    print(f"📍 Database: {DB_NAME}")
    print("-" * 60)
    
    # Get valid enum values
    valid_triggers = [e.value for e in NotificationTrigger]
    valid_channels = [e.value for e in NotificationChannel]
    valid_priorities = [e.value for e in NotificationPriority]
    valid_statuses = [e.value for e in NotificationStatus]
    
    print(f"Valid triggers: {len(valid_triggers)}")
    print(f"Valid channels: {valid_channels}")
    print(f"Valid priorities: {valid_priorities}")
    print(f"Valid statuses: {valid_statuses}")
    print("-" * 60)
    
    # Check notification_queue
    queue_count = await db.notification_queue.count_documents({})
    print(f"\n📋 notification_queue: {queue_count} documents")
    
    invalid_items = []
    async for doc in db.notification_queue.find({}):
        errors = []
        
        # Check trigger
        trigger = doc.get("trigger")
        if trigger and trigger not in valid_triggers:
            errors.append(f"Invalid trigger: '{trigger}'")
        
        # Check channels
        channels = doc.get("channels", [])
        for ch in channels:
            if ch not in valid_channels:
                errors.append(f"Invalid channel: '{ch}'")
        
        # Check priority
        priority = doc.get("priority")
        if priority and priority not in valid_priorities:
            errors.append(f"Invalid priority: '{priority}'")
        
        # Check status
        status = doc.get("status")
        if status and status not in valid_statuses:
            errors.append(f"Invalid status: '{status}'")
        
        if errors:
            invalid_items.append({
                "_id": str(doc.get("_id")),
                "username": doc.get("username"),
                "trigger": trigger,
                "status": status,
                "errors": errors
            })
    
    if invalid_items:
        print(f"\n❌ Found {len(invalid_items)} invalid queue items:")
        for item in invalid_items[:10]:  # Show first 10
            print(f"  - {item['_id']} ({item['username']}): {item['errors']}")
    else:
        print("✅ All queue items have valid enum values")
    
    # Check notification_log
    log_count = await db.notification_log.count_documents({})
    print(f"\n📋 notification_log: {log_count} documents")
    
    invalid_logs = []
    async for doc in db.notification_log.find({}):
        errors = []
        
        trigger = doc.get("trigger")
        if trigger and trigger not in valid_triggers:
            errors.append(f"Invalid trigger: '{trigger}'")
        
        channel = doc.get("channel")
        if channel and channel not in valid_channels:
            errors.append(f"Invalid channel: '{channel}'")
        
        priority = doc.get("priority")
        if priority and priority not in valid_priorities:
            errors.append(f"Invalid priority: '{priority}'")
        
        status = doc.get("status")
        if status and status not in valid_statuses:
            errors.append(f"Invalid status: '{status}'")
        
        if errors:
            invalid_logs.append({
                "_id": str(doc.get("_id")),
                "username": doc.get("username"),
                "trigger": trigger,
                "errors": errors
            })
    
    if invalid_logs:
        print(f"\n❌ Found {len(invalid_logs)} invalid log items:")
        for item in invalid_logs[:10]:
            print(f"  - {item['_id']} ({item['username']}): {item['errors']}")
    else:
        print("✅ All log items have valid enum values")
    
    # Test Pydantic validation on a sample
    print("\n" + "-" * 60)
    print("🧪 Testing Pydantic validation on recent queue items...")
    
    async for doc in db.notification_queue.find({}).sort("createdAt", -1).limit(5):
        doc_id = str(doc.get("_id"))
        try:
            # Transform like the API does
            transformed = {
                "_id": doc_id,
                "username": doc.get("username", "unknown"),
                "trigger": doc.get("trigger"),
                "priority": doc.get("priority", "medium"),
                "channels": doc.get("channels", ["email"]),
                "templateData": doc.get("templateData", {}),
                "status": doc.get("status", "pending"),
                "scheduledFor": doc.get("scheduledFor"),
                "attempts": doc.get("attempts", 0),
                "lastAttempt": doc.get("lastAttempt"),
                "error": doc.get("error"),
                "createdAt": doc.get("createdAt"),
                "updatedAt": doc.get("updatedAt")
            }
            item = NotificationQueueItem(**transformed)
            print(f"  ✅ {doc_id[:8]}... ({doc.get('username')}) - Valid")
        except Exception as e:
            print(f"  ❌ {doc_id[:8]}... ({doc.get('username')}) - Error: {e}")
    
    client.close()
    print("\n✅ Validation complete!")


if __name__ == "__main__":
    asyncio.run(validate_queue())
