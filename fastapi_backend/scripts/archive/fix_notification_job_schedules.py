"""
Fix Notification Job Schedules
Updates email_notifier and sms_notifier to run more frequently
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

MONGODB_URL = "mongodb://localhost:27017"
DATABASE_NAME = "matrimonialDB"


async def fix_schedules():
    """Update notification job schedules to correct intervals"""
    
    client = AsyncIOMotorClient(MONGODB_URL)
    db = client[DATABASE_NAME]
    
    print("🔧 Fixing notification job schedules...")
    
    # Update email_notifier schedule
    result1 = await db.dynamic_jobs.update_one(
        {"name": "email_notifier"},
        {
            "$set": {
                "schedule": "* * * * *",  # Every 1 minute (cron format) - fast for testing!
                "interval": 60,  # 1 minute in seconds
                "updatedAt": "2025-10-21T18:00:00Z",
                "updatedBy": "system_fix"
            }
        }
    )
    
    if result1.modified_count > 0:
        print("✅ Updated email_notifier: Every 1 minute (fast testing mode!)")
    else:
        print("⚠️ email_notifier not found or already correct")
    
    # Update sms_notifier schedule
    result2 = await db.dynamic_jobs.update_one(
        {"name": "sms_notifier"},
        {
            "$set": {
                "schedule": "*/2 * * * *",  # Every 2 minutes (cron format) - fast for testing!
                "interval": 120,  # 2 minutes in seconds
                "updatedAt": "2025-10-21T18:00:00Z",
                "updatedBy": "system_fix"
            }
        }
    )
    
    if result2.modified_count > 0:
        print("✅ Updated sms_notifier: Every 2 minutes (fast testing mode!)")
    else:
        print("⚠️ sms_notifier not found or already correct")
    
    # Verify changes
    print("\n📊 Current schedules:")
    
    email_job = await db.dynamic_jobs.find_one({"name": "email_notifier"})
    if email_job:
        print(f"  email_notifier: {email_job.get('schedule')} (interval: {email_job.get('interval')}s)")
    
    sms_job = await db.dynamic_jobs.find_one({"name": "sms_notifier"})
    if sms_job:
        print(f"  sms_notifier: {sms_job.get('schedule')} (interval: {sms_job.get('interval')}s)")
    
    print("\n🎉 Done! Notification jobs will now run VERY frequently for testing!")
    print("   - email_notifier: Every 1 minute (60s) 🚀")
    print("   - sms_notifier: Every 2 minutes (120s) 🚀")
    print("\n⚡ FAST MODE: Perfect for testing! Change to 5-10 min for production.")
    
    client.close()


if __name__ == "__main__":
    asyncio.run(fix_schedules())
