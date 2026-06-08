"""
Setup script to create email and SMS notifier jobs in Dynamic Scheduler
Run this once to enable automatic notification delivery
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime
import sys

async def setup_notification_jobs():
    """Create email and SMS notifier jobs"""
    
    # Connect to MongoDB
    client = AsyncIOMotorClient("mongodb://localhost:27017")
    db = client.matrimonialDB
    
    print("📬 Setting up Notification Jobs...")
    
    # Check if jobs already exist
    existing_email = await db.dynamic_jobs.find_one({"templateType": "email_notifier"})
    existing_sms = await db.dynamic_jobs.find_one({"templateType": "sms_notifier"})
    
    jobs_created = []
    
    # Create Email Notifier Job
    if not existing_email:
        email_job = {
            "name": "Email Notification Sender",
            "description": "Processes pending email notifications from queue and sends them via SMTP",
            "templateType": "email_notifier",
            "scheduleType": "interval",
            "intervalSeconds": 300,  # Every 5 minutes
            "parameters": {
                "batch_size": 100,
                "max_retries": 3
            },
            "enabled": True,
            "createdAt": datetime.utcnow(),
            "createdBy": "system",
            "nextRunAt": datetime.utcnow(),
            "lastRunAt": None,
            "lastStatus": None,
            "executionCount": 0
        }
        
        result = await db.dynamic_jobs.insert_one(email_job)
        print(f"✅ Created Email Notifier Job (ID: {result.inserted_id})")
        print(f"   Schedule: Every 5 minutes")
        print(f"   Batch size: 100 emails per run")
        jobs_created.append("email_notifier")
    else:
        print(f"⚠️  Email Notifier Job already exists (ID: {existing_email['_id']})")
    
    # Create SMS Notifier Job
    if not existing_sms:
        sms_job = {
            "name": "SMS Notification Sender",
            "description": "Processes pending SMS notifications from queue with cost optimization",
            "templateType": "sms_notifier",
            "scheduleType": "interval",
            "intervalSeconds": 600,  # Every 10 minutes
            "parameters": {
                "batch_size": 50,
                "max_retries": 3,
                "daily_limit_usd": 100.0
            },
            "enabled": True,
            "createdAt": datetime.utcnow(),
            "createdBy": "system",
            "nextRunAt": datetime.utcnow(),
            "lastRunAt": None,
            "lastStatus": None,
            "executionCount": 0
        }
        
        result = await db.dynamic_jobs.insert_one(sms_job)
        print(f"✅ Created SMS Notifier Job (ID: {result.inserted_id})")
        print(f"   Schedule: Every 10 minutes")
        print(f"   Batch size: 50 SMS per run")
        print(f"   Daily limit: $100")
        jobs_created.append("sms_notifier")
    else:
        print(f"⚠️  SMS Notifier Job already exists (ID: {existing_sms['_id']})")
    
    client.close()
    
    if jobs_created:
        print(f"\n🎉 Successfully created {len(jobs_created)} notification job(s)!")
        print(f"   Jobs created: {', '.join(jobs_created)}")
        print(f"\n📋 Next steps:")
        print(f"   1. Configure SMTP settings in .env file")
        print(f"   2. Jobs will run automatically via Unified Scheduler")
        print(f"   3. Check Dynamic Scheduler UI to monitor execution")
    else:
        print(f"\n✅ All notification jobs already exist")
    
    return len(jobs_created)

if __name__ == "__main__":
    try:
        created_count = asyncio.run(setup_notification_jobs())
        sys.exit(0 if created_count >= 0 else 1)
    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)
