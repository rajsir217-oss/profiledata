#!/usr/bin/env python3
"""
Test saved search matches notifier in production
1. Clear notification tracking
2. Find the job ID
3. Trigger manual run via API
"""

import asyncio
import os
import certifi
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

async def prepare_and_get_job_id():
    load_dotenv('.env.production')
    
    mongodb_url = os.getenv('MONGODB_URL')
    print(f'Connecting to production MongoDB...')
    
    client = AsyncIOMotorClient(mongodb_url, tlsCAFile=certifi.where())
    db = client.matrimonialDB
    
    # 1. Check saved searches with notifications enabled
    searches = await db.saved_searches.find({
        'notifications.enabled': True
    }).to_list(100)
    print(f'\n📋 Found {len(searches)} saved searches with notifications enabled')
    for s in searches[:3]:
        print(f'   - {s.get("username")}: "{s.get("name")}"')
    
    # 2. Clear notification tracking for saved_search_matches
    tracking_result = await db.notification_tracking.delete_many({
        'trigger': 'saved_search_matches'
    })
    print(f'\n🗑️  Cleared {tracking_result.deleted_count} notification tracking records')
    
    # 3. Clear pending notifications in queue
    queue_result = await db.notification_queue.delete_many({
        'trigger': 'saved_search_matches',
        'status': 'pending'
    })
    print(f'🗑️  Cleared {queue_result.deleted_count} pending notifications from queue')
    
    # 4. Find the saved search matches notifier job
    job = await db.scheduled_jobs.find_one({
        'templateType': 'saved_search_matches_notifier'
    })
    
    if job:
        print(f'\n✅ Found job:')
        print(f'   ID: {job["_id"]}')
        print(f'   Name: {job.get("name")}')
        print(f'   Status: {job.get("status")}')
        print(f'\n🚀 To trigger manually, click the Run button in the Dynamic Scheduler UI')
        print(f'   Or use this job ID: {job["_id"]}')
    else:
        print('\n❌ Job not found! Available jobs:')
        jobs = await db.scheduled_jobs.find({}).to_list(20)
        for j in jobs:
            print(f'   - {j["_id"]}: {j.get("name")} ({j.get("templateType")})')
    
    client.close()
    return str(job["_id"]) if job else None

if __name__ == "__main__":
    asyncio.run(prepare_and_get_job_id())
