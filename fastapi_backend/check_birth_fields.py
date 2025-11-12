#!/usr/bin/env python3
"""
Check if any users are missing birthMonth or birthYear
"""

import sys
from pathlib import Path
sys.path.append(str(Path(__file__).parent))

from motor.motor_asyncio import AsyncIOMotorClient
from config import Settings
import asyncio

settings = Settings()

async def check_birth_fields():
    """Check users missing birthMonth or birthYear"""
    client = AsyncIOMotorClient(settings.mongodb_url)
    db = client[settings.database_name]
    
    try:
        print("🔍 Checking birthMonth and birthYear fields...")
        print(f"📍 Database: {settings.database_name}")
        print("-" * 70)
        
        # Total users
        total = await db.users.count_documents({})
        print(f"📊 Total users: {total}")
        
        # Users with both fields
        with_both = await db.users.count_documents({
            "birthMonth": {"$exists": True, "$ne": None},
            "birthYear": {"$exists": True, "$ne": None}
        })
        print(f"✅ Users WITH birthMonth & birthYear: {with_both}")
        
        # Missing birthMonth
        missing_month = await db.users.count_documents({
            "$or": [
                {"birthMonth": {"$exists": False}},
                {"birthMonth": None}
            ]
        })
        print(f"❌ Users MISSING birthMonth: {missing_month}")
        
        # Missing birthYear
        missing_year = await db.users.count_documents({
            "$or": [
                {"birthYear": {"$exists": False}},
                {"birthYear": None}
            ]
        })
        print(f"❌ Users MISSING birthYear: {missing_year}")
        
        # Sample users missing either field
        if missing_month > 0 or missing_year > 0:
            print(f"\n📝 Sample users missing birth fields:")
            sample = await db.users.find({
                "$or": [
                    {"birthMonth": {"$exists": False}},
                    {"birthMonth": None},
                    {"birthYear": {"$exists": False}},
                    {"birthYear": None}
                ]
            }).limit(10).to_list(10)
            
            for user in sample:
                print(f"   • {user.get('username')}: "
                      f"birthMonth={user.get('birthMonth')}, "
                      f"birthYear={user.get('birthYear')}, "
                      f"dateOfBirth={user.get('dateOfBirth')}")
        else:
            print(f"\n✅ All users have birthMonth and birthYear!")
        
    finally:
        client.close()

if __name__ == "__main__":
    asyncio.run(check_birth_fields())
