"""
Add Message Stats Sync Job to Dynamic Scheduler
Creates a scheduled job to automatically sync message statistics daily
"""
import asyncio
import sys
import os
from datetime import datetime

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import get_database

async def add_message_stats_job():
    """Add message stats sync job to dynamic scheduler"""
    print("📅 Adding Message Stats Sync job to Dynamic Scheduler...")
    
    db = await get_database()
    
    # Check if job already exists
    existing = await db.dynamic_jobs.find_one({"name": "Message Stats Sync"})
    
    if existing:
        print("⚠️  Job already exists. Updating configuration...")
        
        await db.dynamic_jobs.update_one(
            {"name": "Message Stats Sync"},
            {"$set": {
                "description": "Automatically sync user message counts with actual database records",
                "template": "message_stats_sync",
                "schedule_type": "cron",
                "cron_expression": "0 2 * * *",  # Daily at 2 AM
                "enabled": True,
                "parameters": {},
                "timeout_seconds": 600,
                "updated_at": datetime.utcnow(),
                "updated_by": "system_setup"
            }}
        )
        print("✅ Job configuration updated")
    else:
        # Create new job
        job_doc = {
            "name": "Message Stats Sync",
            "description": "Automatically sync user message counts with actual database records",
            "template": "message_stats_sync",
            "schedule_type": "cron",
            "cron_expression": "0 2 * * *",  # Daily at 2 AM
            "enabled": True,
            "parameters": {},
            "timeout_seconds": 600,  # 10 minutes
            "created_at": datetime.utcnow(),
            "created_by": "system_setup",
            "last_run": None,
            "next_run": None,
            "run_count": 0,
            "success_count": 0,
            "failure_count": 0
        }
        
        result = await db.dynamic_jobs.insert_one(job_doc)
        print(f"✅ Job created with ID: {result.inserted_id}")
    
    print("\n📋 Job Configuration:")
    print("   Name: Message Stats Sync")
    print("   Template: message_stats_sync")
    print("   Schedule: Daily at 2:00 AM UTC (0 2 * * *)")
    print("   Timeout: 10 minutes")
    print("   Status: Enabled")
    print("\n🎉 Message Stats Sync job is now scheduled!")
    print("💡 You can manage this job in the Dynamic Scheduler UI")

if __name__ == "__main__":
    asyncio.run(add_message_stats_job())
