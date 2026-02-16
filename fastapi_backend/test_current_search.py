#!/usr/bin/env python3
"""
Test the current search logic
"""
import asyncio
import sys
import os
sys.path.append('.')
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from config import settings

async def test_current_search():
    load_dotenv('.env.local')
    client = AsyncIOMotorClient(settings.mongodb_url)
    db = client[settings.database_name]
    
    print("🔍 Testing current search logic...")
    
    # Test the exact query we're building
    occ_text = "Marketing Manager"
    exact_regex = f".*{occ_text}.*"
    print(f"Regex: {exact_regex}")
    
    # Test occupation field
    print("\n1. Occupation field:")
    occ_results = await db.users.find({"occupation": {"$regex": exact_regex, "$options": "i"}}).to_list(None)
    print(f"Found {len(occ_results)} users:")
    for user in occ_results:
        print(f"  - {user.get('username', 'unknown')}: '{user.get('occupation', 'N/A')}'")
    
    # Test workExperience.description field
    print("\n2. workExperience.description field:")
    work_results = await db.users.find({"workExperience.description": {"$regex": exact_regex, "$options": "i"}}).to_list(None)
    print(f"Found {len(work_results)} users:")
    for user in work_results:
        print(f"  - {user.get('username', 'unknown')}")
        work = user.get('workExperience', [])
        for job in work:
            print(f"    -> '{job.get('description', 'N/A')}'")
    
    # Test with $elemMatch
    print("\n3. workExperience with $elemMatch:")
    elem_results = await db.users.find({"workExperience": {"$elemMatch": {"description": {"$regex": exact_regex, "$options": "i"}}}}).to_list(None)
    print(f"Found {len(elem_results)} users:")
    for user in elem_results:
        print(f"  - {user.get('username', 'unknown')}")
        work = user.get('workExperience', [])
        for job in work:
            print(f"    -> '{job.get('description', 'N/A')}'")
    
    # Test combined OR query
    print("\n4. Combined OR query:")
    combined_results = await db.users.find({
        "$or": [
            {"occupation": {"$regex": exact_regex, "$options": "i"}},
            {"workExperience.description": {"$regex": exact_regex, "$options": "i"}},
            {"workExperience": {"$elemMatch": {"description": {"$regex": exact_regex, "$options": "i"}}}}
        ]
    }).to_list(None)
    print(f"Found {len(combined_results)} users:")
    for user in combined_results:
        print(f"  - {user.get('username', 'unknown')}: occupation='{user.get('occupation', 'N/A')}'")
        work = user.get('workExperience', [])
        for job in work:
            if job.get('description'):
                print(f"    -> workExperience.description: '{job.get('description', 'N/A')}'")
    
    await client.close()

if __name__ == "__main__":
    asyncio.run(test_current_search())
