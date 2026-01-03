#!/usr/bin/env python3
"""
Migration: Create search performance indexes
Run this script on production MongoDB to improve search performance.

Usage:
    python create_search_indexes.py

For production, set MONGODB_URL environment variable or update the connection string.
"""

import os
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

# Get MongoDB URL from environment or use default
MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
DATABASE_NAME = os.getenv("DATABASE_NAME", "matrimonialDB")


async def create_indexes():
    """Create search performance indexes on users collection"""
    
    print(f"🔗 Connecting to MongoDB: {MONGODB_URL[:30]}...")
    client = AsyncIOMotorClient(MONGODB_URL)
    db = client[DATABASE_NAME]
    
    print(f"📊 Database: {DATABASE_NAME}")
    print(f"📋 Collection: users")
    
    # Get existing indexes
    existing = await db.users.index_information()
    print(f"\n📌 Existing indexes: {len(existing)}")
    for name in existing.keys():
        print(f"   - {name}")
    
    indexes_to_create = [
        {
            "keys": [("accountStatus", 1), ("gender", 1), ("createdAt", -1)],
            "name": "search_status_gender_created",
            "description": "Compound index for status + gender + newest sorting"
        },
        {
            "keys": [("accountStatus", 1), ("createdAt", -1)],
            "name": "search_status_created",
            "description": "Compound index for status + newest sorting"
        },
        {
            "keys": [("birthYear", 1)],
            "name": "birthYear_1",
            "description": "Index for age filtering"
        },
        {
            "keys": [("heightInches", 1)],
            "name": "heightInches_1",
            "description": "Index for height filtering"
        },
        {
            "keys": [("religion", 1)],
            "name": "religion_1",
            "description": "Index for religion filtering"
        },
        {
            "keys": [("gender", 1)],
            "name": "gender_1",
            "description": "Index for gender filtering"
        },
    ]
    
    print(f"\n🔧 Creating {len(indexes_to_create)} indexes...")
    
    created = 0
    skipped = 0
    
    for idx in indexes_to_create:
        if idx["name"] in existing:
            print(f"   ⏭️  {idx['name']} - already exists, skipping")
            skipped += 1
        else:
            try:
                await db.users.create_index(idx["keys"], name=idx["name"], background=True)
                print(f"   ✅ {idx['name']} - created ({idx['description']})")
                created += 1
            except Exception as e:
                print(f"   ❌ {idx['name']} - failed: {e}")
    
    print(f"\n📊 Summary:")
    print(f"   Created: {created}")
    print(f"   Skipped: {skipped}")
    print(f"   Total indexes now: {len(existing) + created}")
    
    # Verify
    final_indexes = await db.users.index_information()
    print(f"\n✅ Final indexes on users collection:")
    for name, info in final_indexes.items():
        print(f"   - {name}: {info.get('key')}")
    
    client.close()
    print("\n🎉 Done!")


if __name__ == "__main__":
    asyncio.run(create_indexes())
