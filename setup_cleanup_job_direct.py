#!/usr/bin/env python3
"""
Script to directly insert the activity cleanup job into MongoDB
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from datetime import datetime
import os

load_dotenv()

async def setup_job_directly():
    """Insert job directly into MongoDB"""
    
    # Connect to MongoDB
    client = AsyncIOMotorClient(os.getenv('MONGODB_URL', 'mongodb://localhost:27017'))
    db = client.matrimonialDB
    
    try:
        print("🔧 Setting up Activity Cleanup Job directly in MongoDB...\n")
        
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
            "created_at": datetime.now(),
            "updated_at": datetime.now(),
            "created_by": "system",
            "last_run": None,
            "next_run": None,
            "run_count": 0,
            "success_count": 0,
            "error_count": 0
        }
        
        # Check if job already exists
        existing_job = await db.dynamic_jobs.find_one({"template_type": "contribution_popup_activity_cleanup"})
        
        if existing_job:
            print(f"⚠️ Job '{existing_job['name']}' already exists")
            print("Updating job configuration...")
            
            # Update the job
            await db.dynamic_jobs.update_one(
                {"_id": existing_job["_id"]},
                {
                    "$set": {
                        "schedule": job_definition["schedule"],
                        "parameters": job_definition["parameters"],
                        "enabled": job_definition["enabled"],
                        "updated_at": datetime.now()
                    }
                }
            )
            
            print("✅ Job updated successfully!")
        else:
            print("Creating new job...")
            
            # Insert the job
            result = await db.dynamic_jobs.insert_one(job_definition)
            
            print(f"✅ Job created successfully!")
            print(f"   Job ID: {result.inserted_id}")
        
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
        print("   1. Start the FastAPI server")
        print("   2. Go to http://localhost:8000/dynamic-scheduler")
        print("   3. Look for 'Contribution Popup Activity Cleanup' in the jobs list")
        print("   4. You can edit schedule, run manually, or view logs")
        
        print("\n⚠️  Note: The job will only be executable after:")
        print("   - The FastAPI server is restarted (to register the template)")
        print("   - The template is properly registered in the system")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        client.close()

if __name__ == "__main__":
    asyncio.run(setup_job_directly())
