"""
Migration: Remove workplace field from all user profiles
Date: October 24, 2025
Reason: Consolidating to workLocation only (workplace was duplicate/redundant)

This migration:
1. Removes the 'workplace' field from all users
2. Keeps 'workLocation' field intact
3. Reports number of affected documents
"""

import asyncio
import sys
from pathlib import Path

# Add parent directory to path so we can import config
sys.path.insert(0, str(Path(__file__).parent.parent))

from motor.motor_asyncio import AsyncIOMotorClient
from config import Settings

settings = Settings()

async def remove_workplace_field():
    """Remove workplace field from all user documents"""
    print("🔄 Starting workplace field removal...")
    
    # Connect to MongoDB
    client = AsyncIOMotorClient(settings.mongodb_url)
    db = client[settings.database_name]
    
    try:
        # Count users with workplace field
        users_with_workplace = await db.users.count_documents(
            {"workplace": {"$exists": True}}
        )
        
        print(f"📊 Found {users_with_workplace} users with workplace field")
        
        if users_with_workplace == 0:
            print("✅ No workplace fields found. Migration not needed.")
            return
        
        # Remove workplace field from all users
        result = await db.users.update_many(
            {"workplace": {"$exists": True}},
            {"$unset": {"workplace": ""}}
        )
        
        print(f"\n📊 Migration Summary:")
        print(f"  🗑️  Removed workplace field from: {result.modified_count} users")
        print(f"  ✅ Migration completed successfully!")
        
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        raise
    finally:
        client.close()
        print("🔌 Database connection closed")

if __name__ == "__main__":
    asyncio.run(remove_workplace_field())
