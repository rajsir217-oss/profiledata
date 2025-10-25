"""
Migration: Remove workLocation field from all user profiles
Date: October 24, 2025
Reason: workLocation is now tracked per work experience entry, not as a separate field

This migration:
1. Removes the 'workLocation' field from all users
2. Work location is now stored in workExperience array entries
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

async def remove_worklocation_field():
    """Remove workLocation field from all user documents"""
    print("🔄 Starting workLocation field removal...")
    
    # Connect to MongoDB
    client = AsyncIOMotorClient(settings.mongodb_url)
    db = client[settings.database_name]
    
    try:
        # Count users with workLocation field
        users_with_worklocation = await db.users.count_documents(
            {"workLocation": {"$exists": True}}
        )
        
        print(f"📊 Found {users_with_worklocation} users with workLocation field")
        
        if users_with_worklocation == 0:
            print("✅ No workLocation fields found. Migration not needed.")
            return
        
        # Remove workLocation field from all users
        result = await db.users.update_many(
            {"workLocation": {"$exists": True}},
            {"$unset": {"workLocation": ""}}
        )
        
        print(f"\n📊 Migration Summary:")
        print(f"  🗑️  Removed workLocation field from: {result.modified_count} users")
        print(f"  ✅ Work location is now tracked in workExperience entries")
        print(f"  ✅ Migration completed successfully!")
        
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        raise
    finally:
        client.close()
        print("🔌 Database connection closed")

if __name__ == "__main__":
    asyncio.run(remove_worklocation_field())
