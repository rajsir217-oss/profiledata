#!/usr/bin/env python3
"""
Check what's actually in the database
"""
import asyncio
import sys
import os
sys.path.append('.')
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from config import settings

async def check_actual_data():
    load_dotenv('.env.local')
    client = AsyncIOMotorClient(settings.mongodb_url)
    db = client[settings.database_name]
    
    print("🔍 Checking actual data in database...")
    
    # Check all users with any occupation field
    print("\n1. All users with occupation field:")
    occ_users = await db.users.find({"occupation": {"$exists": True, "$ne": ""}}).limit(10).to_list(None)
    print(f"Found {len(occ_users)} users:")
    for user in occ_users:
        print(f"  - {user.get('username', 'unknown')}: '{user.get('occupation', 'N/A')}'")
    
    # Check all users with workExperience
    print("\n2. All users with workExperience:")
    work_users = await db.users.find({"workExperience": {"$exists": True, "$ne": []}}).limit(5).to_list(None)
    print(f"Found {len(work_users)} users:")
    for user in work_users:
        print(f"  - {user.get('username', 'unknown')}:")
        work = user.get('workExperience', [])
        for i, job in enumerate(work):
            desc = job.get('description', '')
            if desc and desc != 'N/A':
                print(f"    Job {i+1}: '{desc}'")
    
    # Search for "marketing" anywhere
    print("\n3. Search for 'marketing' anywhere:")
    marketing_users = await db.users.find({
        "$or": [
            {"occupation": {"$regex": "marketing", "$options": "i"}},
            {"workExperience.description": {"$regex": "marketing", "$options": "i"}}
        ]
    }).limit(5).to_list(None)
    print(f"Found {len(marketing_users)} users with 'marketing':")
    for user in marketing_users:
        print(f"  - {user.get('username', 'unknown')}")
        print(f"    occupation: '{user.get('occupation', 'N/A')}'")
        work = user.get('workExperience', [])
        for job in work:
            desc = job.get('description', '')
            if 'marketing' in desc.lower():
                print(f"    workExperience.description: '{desc}'")
    
    await client.close()

if __name__ == "__main__":
    asyncio.run(check_actual_data())
