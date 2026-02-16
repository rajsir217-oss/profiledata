#!/usr/bin/env python3
"""
Test the fixed regex pattern
"""
import asyncio
import sys
import os
sys.path.append('.')
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from config import settings

async def test_fixed_regex():
    load_dotenv('.env.local')
    client = AsyncIOMotorClient(settings.mongodb_url)
    db = client[settings.database_name]
    
    print("🔍 Testing fixed regex pattern...")
    
    # Test the new regex without re.escape()
    occ_text = "Marketing Manager"
    exact_regex = f".*{occ_text}.*"
    print(f"Regex pattern: {exact_regex}")
    
    # Test occupation field
    print("\n1. Testing occupation field:")
    occ_results = await db.users.find({"occupation": {"$regex": exact_regex, "$options": "i"}}).limit(5).to_list(None)
    print(f"Found {len(occ_results)} users")
    for user in occ_results:
        print(f"  - {user.get('username', 'unknown')}: '{user.get('occupation', 'N/A')}'")
    
    # Test workExperience.position field
    print("\n2. Testing workExperience.position field:")
    work_results = await db.users.find({"workExperience.position": {"$regex": exact_regex, "$options": "i"}}).limit(5).to_list(None)
    print(f"Found {len(work_results)} users")
    for user in work_results:
        print(f"  - {user.get('username', 'unknown')}")
        work = user.get('workExperience', [])
        for job in work:
            if 'marketing manager' in job.get('position', '').lower():
                print(f"    -> {job.get('position', 'N/A')}")
    
    # Test combined OR query
    print("\n3. Testing combined OR query:")
    combined_results = await db.users.find({
        "$or": [
            {"occupation": {"$regex": exact_regex, "$options": "i"}},
            {"workExperience.position": {"$regex": exact_regex, "$options": "i"}}
        ]
    }).limit(5).to_list(None)
    print(f"Found {len(combined_results)} users")
    for user in combined_results:
        print(f"  - {user.get('username', 'unknown')}: occupation='{user.get('occupation', 'N/A')}'")
    
    await client.close()

if __name__ == "__main__":
    asyncio.run(test_fixed_regex())
