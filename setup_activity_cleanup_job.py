#!/usr/bin/env python3
"""
Script to set up the activity cleanup job in the dynamic scheduler
"""

import asyncio
import sys
import os
from datetime import datetime

# Add the backend directory to the path
sys.path.append(os.path.join(os.path.dirname(__file__), 'fastapi_backend'))

from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from services.job_registry import JobRegistryService

load_dotenv()

async def setup_activity_cleanup_job():
    """Set up the activity cleanup job in the scheduler"""
    
    # Connect to MongoDB
    client = AsyncIOMotorClient(os.getenv('MONGODB_URL', 'mongodb://localhost:27017'))
    db = client.matrimonialDB
    
    try:
        print("🔧 Setting up Activity Cleanup Job...\n")
        
        # Create job registry
        job_registry = JobRegistryService(db)
        
        # Job definition
        job_definition = {
            "name": "Contribution Popup Activity Cleanup",
            "description": "Automatically clean up old contribution popup activity records",
            "template_type": "contribution_popup_activity_cleanup",
            "schedule": "0 2 * * *",  # Daily at 2 AM
            "enabled": True,
            "parameters": {
                "retention_days": 120,
                "batch_size": 1000,
                "dry_run": False,
                "archive": True
            },
            "retry_config": {
                "max_retries": 3,
                "retry_delay": 300
            },
            "timeout": 1800,  # 30 minutes
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        
        # Check if job already exists
        existing_job = await db.dynamic_jobs.find_one({"template_type": "contribution_popup_activity_cleanup"})
        
        if existing_job:
            print(f"⚠️ Job '{existing_job['name']}' already exists")
            print("Updating job configuration...")
            
            # Update the job
            job_registry.update_job(
                str(existing_job["_id"]),
                {
                    "schedule": job_definition["schedule"],
                    "parameters": job_definition["parameters"],
                    "enabled": job_definition["enabled"]
                }
            )
            
            print("✅ Job updated successfully!")
        else:
            print("Creating new job...")
            
            # Create the job
            job = await job_registry.create_job(job_definition, created_by="system")
            
            print(f"✅ Job created successfully!")
            print(f"   Job ID: {job.id}")
        
        # Display job details
        print("\n📋 Job Configuration:")
        print(f"   Name: {job_definition['name']}")
        print(f"   Schedule: {job_definition['schedule']} (Daily at 2 AM)")
        print(f"   Retention Days: {job_definition['parameters']['retention_days']}")
        print(f"   Batch Size: {job_definition['parameters']['batch_size']}")
        print(f"   Archive: {job_definition['parameters']['archive']}")
        print(f"   Enabled: {job_definition['enabled']}")
        
        print("\n📍 Next runs:")
        print("   - Daily at 2:00 AM UTC")
        print("   - You can also run it manually from the Dynamic Scheduler UI")
        
        print("\n💡 To manage this job:")
        print("   1. Go to http://localhost:8000/dynamic-scheduler")
        print("   2. Look for 'Activity Log Cleanup' in the jobs list")
        print("   3. You can edit schedule, run manually, or view logs")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        client.close()

if __name__ == "__main__":
    asyncio.run(setup_activity_cleanup_job())
