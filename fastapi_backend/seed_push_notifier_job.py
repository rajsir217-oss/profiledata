"""
Seed Push Notifier Job
Creates the push_notifier job in dynamic_jobs collection

Run with: python seed_push_notifier_job.py
"""

import asyncio
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv()

MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "matrimonialDB")


async def seed_push_notifier_job():
    """Create push notifier job in dynamic_jobs collection"""
    
    client = AsyncIOMotorClient(MONGODB_URL)
    db = client[DB_NAME]
    
    # Check if job already exists
    existing = await db.dynamic_jobs.find_one({"name": "push_notifier"})
    
    if existing:
        print(f"✅ Push notifier job already exists (ID: {existing['_id']})")
        print(f"   Status: {'enabled' if existing.get('isEnabled') else 'disabled'}")
        print(f"   Schedule: {existing.get('schedule_type')} - {existing.get('interval', existing.get('cron_expression', 'N/A'))}")
        return
    
    # Create push notifier job
    job = {
        "name": "push_notifier",
        "displayName": "Push Notifier",
        "description": "Process push notification queue and send via Firebase Cloud Messaging (FCM)",
        "template_type": "push_notifier",
        "schedule_type": "interval",
        "interval": 60,  # Run every 60 seconds
        "cron_expression": None,
        "parameters": {
            "batch_size": 50,
            "retry_failed": True,
            "max_attempts": 3
        },
        "isEnabled": True,
        "createdAt": datetime.utcnow(),
        "updatedAt": datetime.utcnow(),
        "lastRunAt": None,
        "nextRunAt": datetime.utcnow(),
        "runCount": 0,
        "successCount": 0,
        "failureCount": 0,
        "tags": ["notifications", "push", "fcm"],
        "priority": "high",
        "timeout": 300  # 5 minute timeout
    }
    
    result = await db.dynamic_jobs.insert_one(job)
    print(f"✅ Created push notifier job (ID: {result.inserted_id})")
    print(f"   Schedule: Every 60 seconds")
    print(f"   Batch size: 50")
    print(f"   Status: Enabled")
    
    # Verify
    created = await db.dynamic_jobs.find_one({"_id": result.inserted_id})
    print(f"\n📋 Job details:")
    print(f"   Name: {created['name']}")
    print(f"   Template: {created['template_type']}")
    print(f"   Interval: {created['interval']}s")
    
    client.close()


if __name__ == "__main__":
    asyncio.run(seed_push_notifier_job())
