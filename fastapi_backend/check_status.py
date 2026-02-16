#!/usr/bin/env python3
"""
Check status of the marketing manager users
"""
import asyncio
import sys
import os
sys.path.append('.')
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from config import settings

async def check_status():
    load_dotenv('.env.local')
    client = AsyncIOMotorClient(settings.mongodb_url)
    db = client[settings.database_name]
    
    print("🔍 Checking status of Marketing Manager users...")
    
    # Find all marketing manager users
    exact_regex = ".*Marketing Manager.*"
    marketing_users = await db.users.find({
        "$or": [
            {"occupation": {"$regex": exact_regex, "$options": "i"}},
            {"workExperience.description": {"$regex": exact_regex, "$options": "i"}}
        ]
    }).to_list(None)
    
    print(f"Found {len(marketing_users)} Marketing Manager users:")
    
    active_count = 0
    for user in marketing_users:
        username = user.get('username', 'unknown')
        occupation = user.get('occupation', 'N/A')
        status = user.get('status', 'N/A')
        accountStatus = user.get('accountStatus', 'N/A')
        
        # Check if user would pass status filter
        passes_status = False
        if accountStatus == 'active':
            passes_status = True
        elif isinstance(status, dict) and status.get('status') == 'active':
            passes_status = True
        
        status_icon = "✅" if passes_status else "❌"
        print(f"  {status_icon} {username}: occupation='{occupation}', status={status}, accountStatus={accountStatus}")
        
        if passes_status:
            active_count += 1
    
    print(f"\n📊 Summary: {active_count}/{len(marketing_users)} users pass status filter")
    
    # Test the full query with status filter
    print("\n🔍 Testing full query with status filter:")
    full_query = {
        "$and": [
            {"$or": [
                {"accountStatus": "active"},
                {"status.status": "active"}
            ]},
            {"$or": [
                {"occupation": {"$regex": exact_regex, "$options": "i"}},
                {"workExperience.description": {"$regex": exact_regex, "$options": "i"}}
            ]}
        ]
    }
    
    print(f"Full query: {full_query}")
    final_results = await db.users.find(full_query).to_list(None)
    print(f"Final results: {len(final_results)} users")
    for user in final_results:
        print(f"  - {user.get('username', 'unknown')}: '{user.get('occupation', 'N/A')}'")
    
    await client.close()

if __name__ == "__main__":
    asyncio.run(check_status())
