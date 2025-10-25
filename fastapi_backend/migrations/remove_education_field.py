"""
Migration: Remove legacy education field from all user profiles
Date: October 24, 2025
Reason: Education field has been replaced by structured educationHistory array

This migration:
1. Removes the 'education' field from all users
2. Keeps 'educationHistory' array intact
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

async def remove_education_field():
    """Remove legacy education field from all user documents"""
    print("🔄 Starting education field removal...")
    
    # Connect to MongoDB
    client = AsyncIOMotorClient(settings.mongodb_url)
    db = client[settings.database_name]
    
    try:
        # Count users with education field
        users_with_education = await db.users.count_documents(
            {"education": {"$exists": True}}
        )
        
        print(f"📊 Found {users_with_education} users with education field")
        
        if users_with_education == 0:
            print("✅ No education fields found. Migration not needed.")
            return
        
        # Remove education field from all users
        result = await db.users.update_many(
            {"education": {"$exists": True}},
            {"$unset": {"education": ""}}
        )
        
        print(f"\n📊 Migration Summary:")
        print(f"  🗑️  Removed education field from: {result.modified_count} users")
        print(f"  ✅ Migration completed successfully!")
        
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        raise
    finally:
        client.close()
        print("🔌 Database connection closed")

if __name__ == "__main__":
    asyncio.run(remove_education_field())
