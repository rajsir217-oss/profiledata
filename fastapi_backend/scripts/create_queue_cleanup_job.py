#!/usr/bin/env python3
"""
Create queue cleanup job in production
"""

import asyncio
import os
import certifi
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone
from bson import ObjectId
from dotenv import load_dotenv

async def create_job():
    load_dotenv('.env.production')
    
    mongodb_url = os.getenv('MONGODB_URL')
    frontend_url = os.getenv('FRONTEND_URL', 'https://usvedika.com')
    print(f'Connecting to production MongoDB...')
    
    client = AsyncIOMotorClient(mongodb_url, tlsCAFile=certifi.where())
    db = client.matrimonialDB
    
    # Check if job already exists
    existing = await db.dynamic_jobs.find_one({
        'template_type': 'queue_cleanup'
    })
    
    if existing:
        print(f'⚠️  Queue cleanup job already exists with ID: {existing["_id"]}')
        print(f'   Name: {existing.get("name")}')
        print(f'   Status: {existing.get("status")}')
        client.close()
        return str(existing["_id"])
    
    # Create the job
    job = {
        '_id': ObjectId(),
        'name': 'Queue Cleanup',
        'template_type': 'queue_cleanup',
        'schedule': {
            'type': 'cron',
            'expression': '0 2 * * *',  # Daily at 2 AM
            'timezone': 'America/Los_Angeles'
        },
        'enabled': True,
        'parameters': {
            'age_days': 30,        # Clean notifications older than 30 days
            'failed_age_days': 7,  # Clean failed notifications older than 7 days
            'batch_size': 1000,    # Process in batches
            'dry_run': False
        },
        'createdAt': datetime.now(timezone.utc),
        'updatedAt': datetime.now(timezone.utc),
        'createdBy': 'admin'
    }
    
    result = await db.dynamic_jobs.insert_one(job)
    print(f'✅ Created queue cleanup job with ID: {result.inserted_id}')
    print(f'   Name: {job["name"]}')
    print(f'   Schedule: {job["schedule"]["expression"]}')
    print(f'   Status: {job["enabled"]}')
    
    client.close()
    return str(result.inserted_id)

if __name__ == "__main__":
    asyncio.run(create_job())
