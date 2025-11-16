#!/usr/bin/env python3
"""
Check notification queue structure
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv('.env.local')

async def check_queue():
    client = AsyncIOMotorClient(os.getenv("MONGODB_URL"))
    db = client.matrimonialDB
    
    print("🔍 Checking notification queue structure...\n")
    print("=" * 60)
    
    # Get the pii_request notification
    notification = await db.notification_queue.find_one({
        "username": "admin",
        "trigger": "pii_request"
    })
    
    if not notification:
        print("❌ No pii_request notification found for admin")
        client.close()
        return
    
    print("✅ Found notification:\n")
    print(f"   ID: {notification.get('_id')}")
    print(f"   Username: {notification.get('username')}")
    print(f"   Trigger: {notification.get('trigger')}")
    print(f"   Status: {notification.get('status')}")
    print(f"   Channels: {notification.get('channels')}")
    print(f"   Channels Type: {type(notification.get('channels'))}")
    print(f"   Priority: {notification.get('priority')}")
    print(f"   Created: {notification.get('createdAt')}")
    print(f"   Scheduled For: {notification.get('scheduledFor')}")
    print(f"   Next Retry: {notification.get('nextRetryAt')}")
    
    # Test queries
    print("\n" + "=" * 60)
    print("\n🧪 Testing queries:\n")
    
    # Query 1: Wrong way (exact match)
    wrong_query = {
        "status": "pending",
        "channels": "sms"
    }
    count_wrong = await db.notification_queue.count_documents(wrong_query)
    print(f"1. Exact match (channels = 'sms'): {count_wrong} results ❌")
    
    # Query 2: Right way (array contains)
    right_query = {
        "status": "pending",
        "channels": {"$in": ["sms"]}
    }
    count_right = await db.notification_queue.count_documents(right_query)
    print(f"2. Array contains (channels $in ['sms']): {count_right} results ✅")
    
    # Query 3: What the job actually uses
    job_query = {
        "status": {"$in": ["pending", "scheduled"]},
        "channels": "sms"  # Wrong!
    }
    count_job = await db.notification_queue.count_documents(job_query)
    print(f"3. Current job query: {count_job} results ❌")
    
    # Query 4: Fixed job query
    fixed_query = {
        "status": {"$in": ["pending", "scheduled"]},
        "channels": {"$in": ["sms"]}  # Right!
    }
    count_fixed = await db.notification_queue.count_documents(fixed_query)
    print(f"4. Fixed job query: {count_fixed} results ✅")
    
    print("\n" + "=" * 60)
    print("\n💡 The issue: Job uses exact match, but channels is an array!")
    print("   Fix: Change `query['channels'] = channel` to `query['channels'] = {'$in': [channel]}`\n")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(check_queue())
