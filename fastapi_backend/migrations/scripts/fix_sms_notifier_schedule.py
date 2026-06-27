"""
Migration: Fix SMS Notifier Job Schedule
Changes SMS Notifier from running once daily to every 5 minutes
"""
import asyncio
from datetime import datetime, timedelta
from motor.motor_asyncio import AsyncIOMotorClient


async def migrate(db):
    """
    Fix SMS Notifier job to run every 5 minutes instead of once daily
    """
    print("🔧 Fixing SMS Notifier job schedule...")
    
    job = await db.dynamic_jobs.find_one({
        "template_type": "sms_notifier"
    })
    
    if job:
        print(f"   Current schedule_type: {job.get('schedule_type')}")
        print(f"   Current interval: {job.get('interval_seconds')} seconds")
        
        # Fix the schedule
        result = await db.dynamic_jobs.update_one(
            {"_id": job.get('_id')},
            {"$set": {
                "schedule_type": "interval",
                "interval_seconds": 300,  # 5 minutes
                "cron_expression": None,
                "nextRunAt": datetime.utcnow() + timedelta(seconds=300)
            }}
        )
        
        if result.modified_count > 0:
            print("   ✅ SMS Notifier now runs every 5 minutes")
            print(f"   Next run: {datetime.utcnow() + timedelta(seconds=300)}")
        else:
            print("   ℹ️  No changes needed (already configured)")
    else:
        print("   ⚠️  SMS Notifier job not found - creating it...")
        
        # Create the job
        await db.dynamic_jobs.insert_one({
            "template_type": "sms_notifier",
            "template_name": "SMS Notifier",
            "enabled": True,
            "schedule_type": "interval",
            "interval_seconds": 300,  # 5 minutes
            "parameters": {
                "batchSize": 50,
                "costLimit": 100.0,
                "priorityOnly": True,
                "verifiedUsersOnly": True,
                "testMode": False
            },
            "nextRunAt": datetime.utcnow() + timedelta(seconds=300),
            "createdAt": datetime.utcnow(),
            "status": "active"
        })
        print("   ✅ Created SMS Notifier job (runs every 5 minutes)")
    
    print("   ✅ Migration complete")


if __name__ == "__main__":
    import os
    from motor.motor_asyncio import AsyncIOMotorClient
    
    mongodb_url = os.getenv("MONGODB_URL")
    if not mongodb_url:
        print("❌ MONGODB_URL environment variable not set")
        exit(1)
    
    client = AsyncIOMotorClient(mongodb_url)
    db = client.matrimonialDB
    
    asyncio.run(migrate(db))
    
    client.close()
