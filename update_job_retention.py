#!/usr/bin/env python3
"""
Update the job to use 120 days retention
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from datetime import datetime
import os

load_dotenv()

async def update_job():
    """Update job retention to 120 days"""
    
    client = AsyncIOMotorClient(os.getenv('MONGODB_URL', 'mongodb://localhost:27017'))
    db = client.matrimonialDB
    
    try:
        # Update the job
        result = await db.dynamic_jobs.update_one(
            {"template_type": "contribution_popup_activity_cleanup"},
            {
                "$set": {
                    "parameters.retention_days": 120,
                    "updated_at": datetime.now()
                }
            }
        )
        
        if result.modified_count > 0:
            print("✅ Updated job retention to 120 days")
        else:
            print("❌ Job not found or already updated")
        
        # Verify the update
        job = await db.dynamic_jobs.find_one({"template_type": "contribution_popup_activity_cleanup"})
        if job:
            print(f"\nCurrent job parameters:")
            print(f"  Retention Days: {job['parameters'].get('retention_days')}")
            print(f"  Enabled: {job.get('enabled')}")
        
    except Exception as e:
        print(f"❌ Error: {e}")
    finally:
        client.close()

if __name__ == "__main__":
    asyncio.run(update_job())
