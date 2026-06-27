"""
Fix SMS Notifier job schedule in PRODUCTION database
Run this script to fix the SMS notifier to run every 5 minutes instead of once daily
"""
import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timedelta

async def fix_production_sms_schedule():
    # Get production MongoDB URL from environment or prompt
    mongodb_url = os.getenv("MONGODB_URL")
    if not mongodb_url:
        print("❌ MONGODB_URL environment variable not set")
        print("Please set it to your production MongoDB connection string:")
        print("export MONGODB_URL='mongodb+srv://...'")
        return
    
    print("🔧 Fixing SMS Notifier schedule in PRODUCTION...")
    print(f"   MongoDB: {mongodb_url[:30]}...")
    print()
    
    client = AsyncIOMotorClient(mongodb_url)
    db = client.matrimonialDB
    
    job = await db.dynamic_jobs.find_one({
        "template_type": "sms_notifier"
    })
    
    if job:
        print(f"Current SMS Notifier Job:")
        print(f"   Schedule Type: {job.get('schedule_type')}")
        print(f"   Interval: {job.get('interval_seconds')} seconds")
        print(f"   Next Run: {job.get('nextRunAt')}")
        print()
        
        # Fix the schedule
        await db.dynamic_jobs.update_one(
            {"_id": job.get('_id')},
            {"$set": {
                "schedule_type": "interval",
                "interval_seconds": 300,  # 5 minutes
                "cron_expression": None,
                "nextRunAt": datetime.utcnow() + timedelta(seconds=300)
            }}
        )
        print("✅ Fixed! SMS Notifier now runs every 5 minutes")
        print(f"   Next run: {datetime.utcnow() + timedelta(seconds=300)}")
    else:
        print("❌ SMS Notifier job not found in production!")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(fix_production_sms_schedule())
