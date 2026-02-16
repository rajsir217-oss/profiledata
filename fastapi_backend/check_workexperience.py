#!/usr/bin/env python3
"""
Check workExperience data structure
"""
import asyncio
import sys
import os
sys.path.append('.')
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from config import settings

async def check_workexperience():
    load_dotenv('.env.local')
    client = AsyncIOMotorClient(settings.mongodb_url)
    db = client[settings.database_name]
    
    print("🔍 Checking workExperience data structure...")
    
    # Find users with workExperience
    users_with_work = await db.users.find({"workExperience": {"$exists": True, "$ne": []}}).limit(5).to_list(None)
    print(f"\nFound {len(users_with_work)} users with workExperience:")
    
    for i, user in enumerate(users_with_work):
        print(f"\nUser {i+1}: {user.get('username', 'unknown')}")
        work = user.get('workExperience', [])
        print(f"  workExperience length: {len(work)}")
        
        for j, job in enumerate(work):
            print(f"  Job {j+1}:")
            print(f"    position: '{job.get('position', 'N/A')}'")
            print(f"    company: '{job.get('company', 'N/A')}'")
            print(f"    All keys: {list(job.keys())}")
            
            # Check if position contains "Marketing Manager"
            position = job.get('position', '')
            if 'marketing' in position.lower() and 'manager' in position.lower():
                print(f"    🎯 FOUND MARKETING MANAGER!")
    
    # Search specifically for Marketing Manager in workExperience.position
    print("\n" + "="*50)
    print("🔍 Searching for 'Marketing Manager' in workExperience.position:")
    
    pipeline = [
        {"$match": {"workExperience.position": {"$regex": "Marketing Manager", "$options": "i"}}},
        {"$limit": 5}
    ]
    
    cursor = db.users.aggregate(pipeline)
    results = await cursor.to_list(None)
    print(f"Found {len(results)} users with 'Marketing Manager' in workExperience:")
    
    for user in results:
        print(f"  - {user.get('username', 'unknown')}")
        work = user.get('workExperience', [])
        for job in work:
            if 'marketing manager' in job.get('position', '').lower():
                print(f"    -> {job.get('position', 'N/A')} at {job.get('company', 'N/A')}")
    
    await client.close()

if __name__ == "__main__":
    asyncio.run(check_workexperience())
