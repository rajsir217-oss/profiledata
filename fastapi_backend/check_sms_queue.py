"""
Check SMS notification queue status
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timedelta

async def check_sms_queue():
    client = AsyncIOMotorClient("mongodb://localhost:27017")
    db = client.matrimonialDB
    
    print("🔍 Checking SMS notification queue...\n")
    print("=" * 60)
    
    # Count all SMS notifications
    total_sms = await db.notification_queue.count_documents({
        "channels": "sms"
    })
    print(f"\n📊 Total SMS in queue: {total_sms}")
    
    # Check by status
    statuses = ["pending", "processing", "sent", "failed"]
    for status in statuses:
        count = await db.notification_queue.count_documents({
            "channels": "sms",
            "status": status
        })
        print(f"   {status}: {count}")
    
    # Show recent pending SMS
    print("\n" + "=" * 60)
    print("\n📬 Recent Pending SMS (last 10):\n")
    pending = await db.notification_queue.find({
        "channels": "sms",
        "status": "pending"
    }).sort("createdAt", -1).limit(10).to_list(10)
    
    if pending:
        for sms in pending:
            print(f"   Username: {sms.get('username')}")
            print(f"   Trigger: {sms.get('trigger')}")
            print(f"   Created: {sms.get('createdAt')}")
            print(f"   Status: {sms.get('status')}")
            print()
    else:
        print("   No pending SMS found")
    
    # Show recent failed SMS
    print("\n" + "=" * 60)
    print("\n❌ Recent Failed SMS (last 10):\n")
    failed = await db.notification_queue.find({
        "channels": "sms",
        "status": "failed"
    }).sort("createdAt", -1).limit(10).to_list(10)
    
    if failed:
        for sms in failed:
            print(f"   Username: {sms.get('username')}")
            print(f"   Trigger: {sms.get('trigger')}")
            print(f"   Error: {sms.get('error', 'No error info')}")
            print(f"   Created: {sms.get('createdAt')}")
            print()
    else:
        print("   No failed SMS found")
    
    # Check if SMS notifier job is running
    print("\n" + "=" * 60)
    print("\n⚙️  SMS Notifier Job Status:\n")
    job = await db.dynamic_jobs.find_one({
        "template_type": "sms_notifier"
    })
    
    if job:
        print(f"   Job ID: {job.get('_id')}")
        print(f"   Enabled: {job.get('enabled')}")
        print(f"   Last Run: {job.get('lastRunAt')}")
        print(f"   Next Run: {job.get('nextRunAt')}")
        print(f"   Status: {job.get('status')}")
    else:
        print("   SMS Notifier job not found in dynamic_jobs")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(check_sms_queue())
