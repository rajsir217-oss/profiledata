#!/usr/bin/env python3
"""
Create Monthly Digest jobs in production
- Weekly stats collection job (runs every Monday)
- Monthly digest send job (runs on 1st of each month)
"""

import asyncio
import os
import certifi
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone
from bson import ObjectId
from dotenv import load_dotenv


async def create_jobs():
    load_dotenv('.env.production')
    
    mongodb_url = os.getenv('MONGODB_URL')
    print('Connecting to production MongoDB...')
    
    client = AsyncIOMotorClient(mongodb_url, tlsCAFile=certifi.where())
    db = client.matrimonialDB
    
    now = datetime.now(timezone.utc)
    
    # Job 1: Weekly Stats Collection (runs every Monday at 6 AM UTC)
    weekly_job = await db.scheduled_jobs.find_one({
        'templateType': 'monthly_digest_notifier',
        'name': {'$regex': 'Weekly Stats'}
    })
    
    if weekly_job:
        print(f'⚠️  Weekly Stats Collection job already exists: {weekly_job["_id"]}')
    else:
        weekly_job_doc = {
            '_id': ObjectId(),
            'name': 'Weekly Stats Collection',
            'description': 'Collect weekly user activity metrics for monthly digest',
            'templateType': 'monthly_digest_notifier',
            'schedule': '0 6 * * 1',  # Every Monday at 6 AM UTC
            'status': 'active',
            'parameters': {
                'mode': 'collect_weekly'
            },
            'createdAt': now,
            'updatedAt': now,
            'createdBy': 'admin'
        }
        result = await db.scheduled_jobs.insert_one(weekly_job_doc)
        print(f'✅ Created Weekly Stats Collection job: {result.inserted_id}')
        print(f'   Schedule: Every Monday at 6 AM UTC')
    
    # Job 2: Monthly Digest Send (runs on 1st of each month at 9 AM UTC)
    monthly_job = await db.scheduled_jobs.find_one({
        'templateType': 'monthly_digest_notifier',
        'name': {'$regex': 'Monthly Digest'}
    })
    
    if monthly_job:
        print(f'⚠️  Monthly Digest Send job already exists: {monthly_job["_id"]}')
    else:
        monthly_job_doc = {
            '_id': ObjectId(),
            'name': 'Monthly Digest Email',
            'description': 'Send monthly activity digest with 4-week breakdown and graphs',
            'templateType': 'monthly_digest_notifier',
            'schedule': '0 9 1 * *',  # 1st of each month at 9 AM UTC
            'status': 'active',
            'parameters': {
                'mode': 'send_monthly',
                'dry_run': False
            },
            'createdAt': now,
            'updatedAt': now,
            'createdBy': 'admin'
        }
        result = await db.scheduled_jobs.insert_one(monthly_job_doc)
        print(f'✅ Created Monthly Digest Email job: {result.inserted_id}')
        print(f'   Schedule: 1st of each month at 9 AM UTC')
    
    # Create index for weekly_user_stats collection
    await db.weekly_user_stats.create_index([("username", 1), ("month", 1)], unique=True)
    print('✅ Created index on weekly_user_stats collection')
    
    client.close()
    print('\n✅ Done!')


if __name__ == "__main__":
    asyncio.run(create_jobs())
