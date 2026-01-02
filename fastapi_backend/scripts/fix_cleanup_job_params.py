#!/usr/bin/env python3
"""
Fix Database Cleanup job parameters - change job_executions date_field from 'createdAt' to 'started_at'
"""

import asyncio
import os
import certifi
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone
from dotenv import load_dotenv

async def fix_job_params():
    load_dotenv('.env.production')
    
    mongodb_url = os.getenv('MONGODB_URL')
    print('Connecting to production MongoDB...')
    
    client = AsyncIOMotorClient(mongodb_url, tlsCAFile=certifi.where())
    db = client.matrimonialDB
    
    # Find the Database Cleanup job
    job = await db.scheduled_jobs.find_one({
        'templateType': 'database_cleanup'
    })
    
    if not job:
        print('❌ Database Cleanup job not found')
        client.close()
        return
    
    print(f'Found job: {job["_id"]}')
    print(f'Current parameters:')
    print(job.get('parameters', {}))
    
    # Update the cleanup_targets to fix job_executions date_field
    new_cleanup_targets = [
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
            "date_field": "started_at"  # FIXED: was 'createdAt'
        },
        {
            "collection": "notifications",
            "days_old": 1,
            "date_field": "createdAt"
        }
    ]
    
    # Update the job
    result = await db.scheduled_jobs.update_one(
        {'_id': job['_id']},
        {
            '$set': {
                'parameters.cleanup_targets': new_cleanup_targets,
                'updatedAt': datetime.now(timezone.utc)
            }
        }
    )
    
    if result.modified_count > 0:
        print(f'\n✅ Fixed job parameters')
        print(f'   Changed job_executions date_field: createdAt → started_at')
    else:
        print(f'\n⚠️  No changes made')
    
    client.close()

if __name__ == "__main__":
    asyncio.run(fix_job_params())
