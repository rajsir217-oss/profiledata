#!/usr/bin/env python3
"""
Fix orphaned job: pending_approvals_sms_notifier
The template file was deleted but the job still exists in the database
"""

import asyncio
import os
import certifi
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

async def fix_orphaned_job():
    load_dotenv('.env.production')
    mongodb_url = os.getenv('MONGODB_URL')
    
    print('Connecting to production MongoDB...')
    client = AsyncIOMotorClient(mongodb_url, tlsCAFile=certifi.where())
    db = client.matrimonialDB
    
    # Find the orphaned job
    job = await db.scheduled_jobs.find_one({
        'templateType': 'pending_approvals_sms_notifier'
    })
    
    if job:
        print(f'Found orphaned job:')
        print(f'  ID: {job["_id"]}')
        print(f'  Name: {job.get("name")}')
        print(f'  Status: {job.get("status")}')
        print(f'  Schedule: {job.get("schedule")}')
        
        # Delete the orphaned job
        result = await db.scheduled_jobs.delete_one({'_id': job['_id']})
        print(f'\n✅ Deleted orphaned job: {result.deleted_count} document(s)')
    else:
        print('Job not found - already cleaned up')
    
    client.close()

if __name__ == "__main__":
    asyncio.run(fix_orphaned_job())
