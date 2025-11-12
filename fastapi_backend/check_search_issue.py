#!/usr/bin/env python3
"""
Check why search is returning no results
"""

import sys
from pathlib import Path
sys.path.append(str(Path(__file__).parent))

from motor.motor_asyncio import AsyncIOMotorClient
from config import Settings
import asyncio

settings = Settings()

async def check_search_issue():
    """Check users in database"""
    client = AsyncIOMotorClient(settings.mongodb_url)
    db = client[settings.database_name]
    
    try:
        print("🔍 Checking search issue...")
        print(f"📍 Database: {settings.database_name}")
        print("-" * 70)
        
        # Check total users
        total_users = await db.users.count_documents({})
        print(f"📊 Total users in database: {total_users}")
        
        # Check users by status
        status_counts = {}
        statuses = await db.users.distinct("status.status")
        for status in statuses:
            count = await db.users.count_documents({"status.status": status})
            status_counts[status] = count
        
        print(f"\n📋 Users by status:")
        for status, count in status_counts.items():
            print(f"   • {status}: {count}")
        
        # Check active users
        active_users = await db.users.count_documents({
            "status.status": {"$regex": "^active$", "$options": "i"}
        })
        print(f"\n✅ Active users (case-insensitive): {active_users}")
        
        # Check paused users
        paused_users = await db.users.count_documents({
            "accountStatus": "paused"
        })
        print(f"⏸️  Paused users: {paused_users}")
        
        # Check active AND not paused
        active_not_paused = await db.users.count_documents({
            "$and": [
                {"status.status": {"$regex": "^active$", "$options": "i"}},
                {"accountStatus": {"$ne": "paused"}}
            ]
        })
        print(f"🎯 Active & not paused: {active_not_paused}")
        
        # Check users by gender
        print(f"\n👥 Users by gender:")
        genders = await db.users.distinct("gender")
        for gender in genders:
            count = await db.users.count_documents({
                "gender": gender,
                "status.status": {"$regex": "^active$", "$options": "i"},
                "accountStatus": {"$ne": "paused"}
            })
            print(f"   • {gender}: {count} (active & not paused)")
        
        # Sample a few active users
        print(f"\n📝 Sample active users:")
        sample_users = await db.users.find({
            "status.status": {"$regex": "^active$", "$options": "i"},
            "accountStatus": {"$ne": "paused"}
        }).limit(5).to_list(5)
        
        for user in sample_users:
            print(f"   • {user.get('username')}: "
                  f"gender={user.get('gender')}, "
                  f"status={user.get('status', {}).get('status')}, "
                  f"accountStatus={user.get('accountStatus', 'not set')}, "
                  f"role={user.get('role', 'user')}")
        
        # Check if search query would match
        print(f"\n🔍 Testing typical search query:")
        test_query = {
            "accountStatus": {"$ne": "paused"},
            "status.status": {"$regex": "^active$", "$options": "i"},
            "gender": {"$regex": "^female$", "$options": "i"}
        }
        test_count = await db.users.count_documents(test_query)
        print(f"   Query: {test_query}")
        print(f"   Results: {test_count} users")
        
    finally:
        client.close()

if __name__ == "__main__":
    asyncio.run(check_search_issue())
