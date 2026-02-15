#!/usr/bin/env python3
"""
Quick test for specific occupation
"""
import asyncio
import sys
import os
sys.path.append('.')
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from config import settings
import re

async def test_specific_occupation():
    load_dotenv('.env.local')
    client = AsyncIOMotorClient(settings.mongodb_url)
    db = client[settings.database_name]
    
    print("🔍 Testing 'Marketing Manager in Health Care Sector'...")
    
    # Test exact match
    print("\n1. Exact match:")
    exact_results = await db.users.find({
        "occupation": {"$regex": "Marketing Manager in Health Care Sector", "$options": "i"}
    }).limit(5).to_list(None)
    print(f"   Exact matches: {len(exact_results)}")
    for user in exact_results:
        print(f"   - {user.get('username', 'unknown')}: '{user.get('occupation', 'N/A')}'")
    
    # Test partial match
    print("\n2. Partial match 'Marketing Manager':")
    partial_results = await db.users.find({
        "occupation": {"$regex": "Marketing Manager", "$options": "i"}
    }).limit(5).to_list(None)
    print(f"   Partial matches: {len(partial_results)}")
    for user in partial_results:
        print(f"   - {user.get('username', 'unknown')}: '{user.get('occupation', 'N/A')}'")
    
    # Test with our new regex pattern
    print("\n3. New regex pattern:")
    occ_text = "Marketing Manager in Health Care Sector"
    partial_regex = f".*{re.escape(occ_text)}.*"
    print(f"   Using regex: {partial_regex}")
    
    new_results = await db.users.find({
        "occupation": {"$regex": partial_regex, "$options": "i"}
    }).limit(5).to_list(None)
    print(f"   New pattern matches: {len(new_results)}")
    for user in new_results:
        print(f"   - {user.get('username', 'unknown')}: '{user.get('occupation', 'N/A')}'")
    
    # Test new word-based logic
    print("\n4. New word-based search logic:")
    occ_text = "Marketing Manager in Health Care Sector"
    words = occ_text.split()
    print(f"   Words: {words}")
    
    # Build queries like the new logic
    occupation_queries = []
    if len(words) > 1:
        # Exact match
        exact_regex = f".*{re.escape(occ_text)}.*"
        occupation_queries.extend([
            {"occupation": {"$regex": exact_regex, "$options": "i"}},
            {"workExperience.position": {"$regex": exact_regex, "$options": "i"}}
        ])
        
        # Key word-based matches
        skip_words = {'in', 'the', 'of', 'and', 'or', 'at', 'to', 'for'}
        key_words = [w for w in words if w.lower() not in skip_words and len(w) > 2]
        print(f"   Key words: {key_words}")
        
        if key_words:
            word_or_queries = []
            for word in key_words:
                word_regex = f".*{re.escape(word)}.*"
                word_or_queries.extend([
                    {"occupation": {"$regex": word_regex, "$options": "i"}},
                    {"workExperience.position": {"$regex": word_regex, "$options": "i"}}
                ])
            
            if word_or_queries:
                word_query = {"$or": word_or_queries}
                occupation_queries.append(word_query)
    
    print(f"   Total queries built: {len(occupation_queries)}")
    
    # Test each query
    for i, query in enumerate(occupation_queries):
        print(f"\n   Query {i+1}: {query}")
        results = await db.users.find(query).limit(5).to_list(None)
        print(f"   Results: {len(results)}")
        for user in results:
            print(f"     - {user.get('username', 'unknown')}: '{user.get('occupation', 'N/A')}'")
    
    # Check all unique occupations with 'Marketing'
    print("\n5. All unique occupations with 'Marketing':")
    pipeline = [
        {"$match": {"occupation": {"$regex": "Marketing", "$options": "i"}}},
        {"$group": {"_id": "$occupation"}},
        {"$sort": {"_id": 1}}
    ]
    cursor = db.users.aggregate(pipeline)
    results = await cursor.to_list(None)
    for result in results:
        print(f"   - '{result['_id']}'")
    
    await client.close()

if __name__ == "__main__":
    asyncio.run(test_specific_occupation())
