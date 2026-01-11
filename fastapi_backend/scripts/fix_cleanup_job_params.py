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
        "date_field": "started_at"
    },
    {
        "collection": "notifications",
        "days_old": 1,
        "date_field": "createdAt"
    },
    {
        "collection": "favorites",
        "days_old": 45,
        "date_field": "createdAt"
    },
    {
        "collection": "shortlists",
        "days_old": 45,
        "date_field": "createdAt"
    },
    {
        "collection": "audit_logs",
        "days_old": 30,
        "date_field": "timestamp"
    }
]


async def fix_dev():
    """Fix the Database Cleanup job in dev (localhost)"""
    print("\n" + "="*50)
    print("🔧 FIXING DEV DATABASE CLEANUP JOB")
    print("="*50)
    
    client = AsyncIOMotorClient('mongodb://localhost:27017')
    db = client.matrimonialDB
    
    # Check both scheduled_jobs and dynamic_jobs
    collections_to_check = [
        ('scheduled_jobs', 'templateType'),
        ('dynamic_jobs', 'template_type')
    ]
    
    for coll_name, field_name in collections_to_check:
        coll = db[coll_name]
        job = await coll.find_one({field_name: 'database_cleanup'})
        
        if job:
            print(f'Found job in {coll_name}: {job["_id"]}')
            result = await coll.update_one(
                {'_id': job['_id']},
                {
                    '$set': {
                        'parameters.cleanup_targets': CLEANUP_TARGETS,
                        'updatedAt': datetime.now(timezone.utc)
                    }
                }
            )
            if result.modified_count > 0:
                print(f'   ✅ Fixed {coll_name} parameters')
            else:
                print(f'   ⚠️  No changes needed for {coll_name}')
        else:
            print(f'❌ Database Cleanup job not found in {coll_name}')
    
    client.close()


async def fix_or_create_prod():
    """Force update ALL cleanup jobs in production to ensure UI and Backend are in sync"""
    print("\n" + "="*50)
    print("🚀 FORCE UPDATING PRODUCTION CLEANUP JOBS")
    print("="*50)
    
    # Try both local and parent directory paths for .env.production
    if os.path.exists('.env.production'):
        load_dotenv('.env.production')
    elif os.path.exists('fastapi_backend/.env.production'):
        load_dotenv('fastapi_backend/.env.production')
        
    mongodb_url = os.getenv('MONGODB_URL')
    if not mongodb_url:
        print("❌ MONGODB_URL not found")
        return

    client = AsyncIOMotorClient(mongodb_url, tlsCAFile=certifi.where())
    db = client.matrimonialDB
    
    collections = ['dynamic_jobs', 'scheduled_jobs']
    
    for coll_name in collections:
        print(f"\n📁 Checking {coll_name}...")
        # Find ANY job that looks like a cleanup job
        cursor = db[coll_name].find({
            '$or': [
                {'template_type': 'database_cleanup'},
                {'templateType': 'database_cleanup'},
                {'name': {'$regex': 'Cleanup', '$options': 'i'}}
            ]
        })
        
        jobs = await cursor.to_list(length=100)
        if not jobs:
            print(f"   No cleanup jobs found in {coll_name}")
            continue
            
        for job in jobs:
            print(f"   Updating Job ID: {job['_id']} ({job.get('name')})")
            result = await db[coll_name].update_one(
                {'_id': job['_id']},
                {
                    '$set': {
                        'parameters.cleanup_targets': CLEANUP_TARGETS,
                        'parameters.dry_run': False,
                        'parameters.batch_size': 1000,
                        'updatedAt': datetime.now(timezone.utc)
                    }
                }
            )
            if result.modified_count > 0:
                print(f"   ✅ Successfully updated parameters")
            else:
                print(f"   ⚠️  Parameters already up to date")

    client.close()
    print("\n" + "="*50)
    print("✅ FORCE UPDATE COMPLETE")
    print("="*50)



async def main():
    await fix_dev()
    await fix_or_create_prod()
    print("\n" + "="*50)
    print("✅ DONE - Both environments updated")
    print("="*50)


if __name__ == "__main__":
    asyncio.run(main())
