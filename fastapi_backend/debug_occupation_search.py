#!/usr/bin/env python3
"""
Debug script to test occupation search
"""
import asyncio
import sys
import os
sys.path.append('.')
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from config import settings
import re

async def debug_occupation_search():
    load_dotenv('.env.local')
    client = AsyncIOMotorClient(settings.mongodb_url)
    db = client[settings.database_name]
    
    print("🔍 Debugging occupation search...")
    
    # Test 1: Find users with "Marketing Manager" in workExperience.position
    print("\n1. Exact match search:")
    pipeline_exact = [
        {"$match": {"workExperience.position": "Marketing Manager"}},
        {"$limit": 5}
    ]
    cursor = db.users.aggregate(pipeline_exact)
    exact_results = await cursor.to_list(None)
    print(f"   Exact 'Marketing Manager' matches: {len(exact_results)}")
    for user in exact_results:
        print(f"   - {user.get('username', 'unknown')}")
    
    # Test 2: Case-insensitive search
    print("\n2. Case-insensitive search:")
    pipeline_case = [
        {"$match": {"workExperience.position": {"$regex": "Marketing Manager", "$options": "i"}}},
        {"$limit": 5}
    ]
    cursor = db.users.aggregate(pipeline_case)
    case_results = await cursor.to_list(None)
    print(f"   Case-insensitive matches: {len(case_results)}")
    for user in case_results:
        print(f"   - {user.get('username', 'unknown')}")
    
    # Test 3: Check occupation field
    print("\n3. Occupation field search:")
    occupation_results = await db.users.find({"occupation": {"$regex": "Marketing Manager", "$options": "i"}}).limit(5).to_list(None)
    print(f"   Occupation field matches: {len(occupation_results)}")
    for user in occupation_results:
        print(f"   - {user.get('username', 'unknown')}: '{user.get('occupation', 'N/A')}' (status: {user.get('status', 'N/A')}, accountStatus: {user.get('accountStatus', 'N/A')})")
    
    # Test 4: Partial match in workExperience
    print("\n4. Partial match 'marketing' in workExperience:")
    pipeline_partial = [
        {"$match": {"workExperience.position": {"$regex": "marketing", "$options": "i"}}},
        {"$limit": 5}
    ]
    cursor = db.users.aggregate(pipeline_partial)
    partial_results = await cursor.to_list(None)
    print(f"   Partial 'marketing' matches: {len(partial_results)}")
    for user in partial_results:
        print(f"   - {user.get('username', 'unknown')}")
        work = user.get('workExperience', [])
        for job in work:
            pos = job.get('position', '')
            if 'marketing' in pos.lower():
                print(f"     -> Found: '{pos}'")
    
    # Test 5: Check actual data structure
    print("\n5. Sample user data structure:")
    sample_users = await db.users.find({}).limit(3).to_list(None)
    for i, user in enumerate(sample_users):
        print(f"   User {i+1}: {user.get('username', 'unknown')}")
        print(f"     Has workExperience: {'workExperience' in user}")
        print(f"     Has occupation: {'occupation' in user}")
        if 'occupation' in user:
            print(f"     occupation: '{user.get('occupation', 'N/A')}'")
        # Check all keys that might contain job info
        all_keys = list(user.keys())
        job_related_keys = [k for k in all_keys if any(word in k.lower() for word in ['work', 'job', 'occupation', 'career', 'position'])]
        print(f"     Job-related keys: {job_related_keys}")
        print(f"     All keys: {all_keys[:10]}...")  # Show first 10 keys
        print('---')
    
    # Test 6: Test our actual search logic
    print("\n6. Testing actual search logic:")
    occupation_list = ["Marketing Manager"]
    occupation_queries = []
    for occ in occupation_list:
        if occ.strip():
            occ_regex = re.escape(occ.strip())
            occupation_queries.extend([
                {"occupation": {"$regex": occ_regex, "$options": "i"}},
                {"workExperience.position": {"$regex": occ_regex, "$options": "i"}}
            ])
    
    if occupation_queries:
        search_query = {"$or": occupation_queries}
        print(f"   Search query: {search_query}")
        
        # Also need to add status filter like in actual search
        final_query = {
            "$and": [
                {"status": "active"},
                search_query
            ]
        }
        
        cursor = db.users.find(final_query).limit(5)
        search_results = await cursor.to_list(None)
        print(f"   Final search results: {len(search_results)}")
        for user in search_results:
            print(f"   - {user.get('username', 'unknown')} (status: {user.get('status', 'unknown')})")
    
    if client:
        await client.close()

if __name__ == "__main__":
    asyncio.run(debug_occupation_search())
