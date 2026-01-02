#!/usr/bin/env python3
"""
Fix Database Cleanup job parameters in both DEV and PRODUCTION
- Change job_executions date_field from 'createdAt' to 'started_at'
- Create job in production if it doesn't exist
"""

import asyncio
import os
import certifi
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone
from bson import ObjectId
from dotenv import load_dotenv

# Correct cleanup targets configuration
CLEANUP_TARGETS = [
    {
        "collection": "sessions",
        "days_old": 1,
        "date_field": "created_at"
    },
    {
        "collection": "logs",
        "days_old": 1,
        "date_field": "created_at"
    },
    {
        "collection": "activity_logs",
        "days_old": 1,
        "date_field": "timestamp"
    },
    {
        "collection": "job_executions",
        "days_old": 1,
        "date_field": "started_at"  # CORRECT field name
    },
    {
        "collection": "notifications",
        "days_old": 1,
        "date_field": "createdAt"
    }
]


async def fix_dev():
    """Fix the Database Cleanup job in dev (localhost)"""
    print("\n" + "="*50)
    print("🔧 FIXING DEV DATABASE CLEANUP JOB")
    print("="*50)
    
    client = AsyncIOMotorClient('mongodb://localhost:27017')
    db = client.matrimonialDB
    
    # Find the Database Cleanup job
    job = await db.scheduled_jobs.find_one({
        'templateType': 'database_cleanup'
    })
    
    if not job:
        print('❌ Database Cleanup job not found in dev')
        client.close()
        return
    
    print(f'Found job: {job["_id"]}')
    print(f'Name: {job.get("name")}')
    
    # Update the job
    result = await db.scheduled_jobs.update_one(
        {'_id': job['_id']},
        {
            '$set': {
                'parameters.cleanup_targets': CLEANUP_TARGETS,
                'updatedAt': datetime.now(timezone.utc)
            }
        }
    )
    
    if result.modified_count > 0:
        print(f'✅ Fixed dev job parameters')
        print(f'   Changed job_executions date_field: createdAt → started_at')
    else:
        print(f'⚠️  No changes made (may already be correct)')
    
    client.close()


async def fix_or_create_prod():
    """Fix or create the Database Cleanup job in production"""
    print("\n" + "="*50)
    print("🔧 FIXING/CREATING PRODUCTION DATABASE CLEANUP JOB")
    print("="*50)
    
    load_dotenv('.env.production')
    mongodb_url = os.getenv('MONGODB_URL')
    
    client = AsyncIOMotorClient(mongodb_url, tlsCAFile=certifi.where())
    db = client.matrimonialDB
    
    # Find the Database Cleanup job
    job = await db.scheduled_jobs.find_one({
        'templateType': 'database_cleanup'
    })
    
    if job:
        print(f'Found existing job: {job["_id"]}')
        # Update the job
        result = await db.scheduled_jobs.update_one(
            {'_id': job['_id']},
            {
                '$set': {
                    'parameters.cleanup_targets': CLEANUP_TARGETS,
                    'updatedAt': datetime.now(timezone.utc)
                }
            }
        )
        if result.modified_count > 0:
            print(f'✅ Fixed production job parameters')
        else:
            print(f'⚠️  No changes made (may already be correct)')
    else:
        print('Job not found - creating new Database Cleanup job...')
        
        new_job = {
            '_id': ObjectId(),
            'name': 'Database Cleanup',
            'description': 'Clean up expired sessions and temporary data',
            'templateType': 'database_cleanup',
            'schedule': '0 9 * * *',  # Daily at 9 AM UTC
            'status': 'active',
            'parameters': {
                'cleanup_targets': CLEANUP_TARGETS,
                'dry_run': False,
                'batch_size': 1000
            },
            'createdAt': datetime.now(timezone.utc),
            'updatedAt': datetime.now(timezone.utc),
            'createdBy': 'admin'
        }
        
        result = await db.scheduled_jobs.insert_one(new_job)
        print(f'✅ Created Database Cleanup job with ID: {result.inserted_id}')
        print(f'   Schedule: Daily at 9 AM UTC')
        print(f'   Collections: sessions, logs, activity_logs, job_executions, notifications')
    
    client.close()


async def main():
    await fix_dev()
    await fix_or_create_prod()
    print("\n" + "="*50)
    print("✅ DONE - Both environments updated")
    print("="*50)


if __name__ == "__main__":
    asyncio.run(main())
