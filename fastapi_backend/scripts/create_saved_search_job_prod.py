#!/usr/bin/env python3
"""
Create saved search matches notifier job in production
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
    existing = await db.scheduled_jobs.find_one({
        'templateType': 'saved_search_matches_notifier'
    })
    
    if existing:
        print(f'⚠️  Job already exists with ID: {existing["_id"]}')
        print(f'   Name: {existing.get("name")}')
        print(f'   Status: {existing.get("status")}')
        client.close()
        return str(existing["_id"])
    
    # Create the job
    job = {
        '_id': ObjectId(),
        'name': 'Saved Search Matches Notifier',
        'templateType': 'saved_search_matches_notifier',
        'schedule': '0 */6 * * *',  # Every 6 hours
        'status': 'active',
        'parameters': {
            'batchSize': 50,
            'lookbackHours': 168,  # 7 days
            'appUrl': frontend_url
        },
        'createdAt': datetime.now(timezone.utc),
        'updatedAt': datetime.now(timezone.utc),
        'createdBy': 'admin'
    }
    
    result = await db.scheduled_jobs.insert_one(job)
    print(f'✅ Created job with ID: {result.inserted_id}')
    print(f'   Name: {job["name"]}')
    print(f'   Schedule: {job["schedule"]}')
    print(f'   Status: {job["status"]}')
    
    client.close()
    return str(result.inserted_id)

if __name__ == "__main__":
    asyncio.run(create_job())
