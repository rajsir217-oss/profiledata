#!/usr/bin/env python3
"""
Check occupation field data
"""
import asyncio
import sys
import os
sys.path.append('.')
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from config import settings

async def check_occupation_field():
    load_dotenv('.env.local')
    client = AsyncIOMotorClient(settings.mongodb_url)
    db = client[settings.database_name]
    
    print("🔍 Checking occupation field data...")
    
    # Find users with occupation field
    users_with_occupation = await db.users.find({"occupation": {"$exists": True, "$ne": ""}}).limit(10).to_list(None)
    print(f"\nFound {len(users_with_occupation)} users with occupation field:")
    
    for user in users_with_occupation:
        print(f"  - {user.get('username', 'unknown')}: '{user.get('occupation', 'N/A')}'")
    
    # Search specifically for Marketing Manager in occupation field
    print("\n" + "="*50)
    print("🔍 Searching for 'Marketing Manager' in occupation field:")
    
    results = await db.users.find({"occupation": {"$regex": "Marketing Manager", "$options": "i"}}).limit(5).to_list(None)
    print(f"Found {len(results)} users with 'Marketing Manager' in occupation:")
    
    for user in results:
        print(f"  - {user.get('username', 'unknown')}: '{user.get('occupation', 'N/A')}'")
        print(f"    status: {user.get('status', 'N/A')}")
        print(f"    accountStatus: {user.get('accountStatus', 'N/A')}")
    
    await client.close()

if __name__ == "__main__":
    asyncio.run(check_occupation_field())
