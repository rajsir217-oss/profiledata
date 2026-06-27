"""
Check and fix SMS Notifier job schedule
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timedelta

async def check_and_fix_sms_notifier():
    client = AsyncIOMotorClient("mongodb://localhost:27017")
    db = client.matrimonialDB
    
    print("🔍 Checking SMS Notifier job schedule...\n")
    print("=" * 60)
    
    job = await db.dynamic_jobs.find_one({
        "template_type": "sms_notifier"
    })
    
    if job:
        print(f"\nCurrent SMS Notifier Job:")
        print(f"   Job ID: {job.get('_id')}")
        print(f"   Enabled: {job.get('enabled')}")
        print(f"   Schedule Type: {job.get('schedule_type')}")
        print(f"   Interval: {job.get('interval_seconds')} seconds")
        print(f"   Cron: {job.get('cron_expression')}")
        print(f"   Last Run: {job.get('lastRunAt')}")
        print(f"   Next Run: {job.get('nextRunAt')}")
        print(f"   Status: {job.get('status')}")
        
        # Calculate time until next run
        if job.get('nextRunAt'):
            next_run = job.get('nextRunAt')
            if isinstance(next_run, str):
                next_run = datetime.fromisoformat(next_run.replace('Z', '+00:00'))
            time_until = next_run - datetime.utcnow()
            print(f"   Time until next run: {time_until}")
        
        # Check if schedule is too infrequent or missing
        schedule_type = job.get('schedule_type')
        interval = job.get('interval_seconds')
        
        if not schedule_type or not interval:
            print(f"\n⚠️  WARNING: SMS notifier has no schedule configuration!")
            print("   Schedule type: {schedule_type}")
            print("   Interval: {interval}")
            print("   This means SMS notifications won't be processed regularly!")
            print("\n🔧 Fixing to run every 5 minutes...")
            
            await db.dynamic_jobs.update_one(
                {"_id": job.get('_id')},
                {"$set": {
                    "schedule_type": "interval",
                    "interval_seconds": 300,  # 5 minutes
                    "cron_expression": None,
                    "nextRunAt": datetime.utcnow() + timedelta(seconds=300)
                }}
            )
            print("   ✅ Fixed! Now runs every 5 minutes")
        elif schedule_type == 'interval' and interval > 600:  # More than 10 minutes
            print(f"\n⚠️  WARNING: SMS notifier runs every {interval} seconds ({interval/60:.1f} minutes)")
            print("   This is too slow for real-time SMS delivery!")
            print("\n🔧 Fixing to run every 5 minutes...")
            
            await db.dynamic_jobs.update_one(
                {"_id": job.get('_id')},
                {"$set": {
                    "interval_seconds": 300,  # 5 minutes
                    "nextRunAt": datetime.utcnow() + timedelta(seconds=300)
                }}
            )
            print("   ✅ Fixed! Now runs every 5 minutes")
        elif schedule_type == 'cron':
            print(f"\n⚠️  WARNING: Using cron schedule: {job.get('cron_expression')}")
            print("   Cron schedules may be too infrequent for SMS")
            print("\n🔧 Switching to interval schedule (every 5 minutes)...")
            
            await db.dynamic_jobs.update_one(
                {"_id": job.get('_id')},
                {"$set": {
                    "schedule_type": "interval",
                    "interval_seconds": 300,
                    "cron_expression": None,
                    "nextRunAt": datetime.utcnow() + timedelta(seconds=300)
                }}
            )
            print("   ✅ Fixed! Now runs every 5 minutes")
        else:
            print(f"\n✅ Schedule looks good (every {interval} seconds)")
    else:
        print("\n❌ SMS Notifier job not found!")
        print("   Creating SMS Notifier job...")
        
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
    
    client.close()

if __name__ == "__main__":
    asyncio.run(check_and_fix_sms_notifier())
