#!/usr/bin/env python3
"""
Migration script: Convert saved searches from single occupation to occupations array

This script:
1. Finds all saved searches with criteria.occupation field
2. Converts the single occupation value to an occupations array
3. Removes the old occupation field
4. Preserves all other criteria fields

Run with: python3 migrations/migrate_saved_search_occupations.py
"""

import asyncio
import sys
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from bson import ObjectId

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import settings

async def migrate_saved_search_occupations():
    """Migrate saved searches from occupation to occupations array format"""
    
    load_dotenv('.env.local')
    
    # Connect to MongoDB
    client = AsyncIOMotorClient(settings.mongodb_url)
    db = client[settings.database_name]
    
    print("🔄 Starting migration: occupation -> occupations array")
    print(f"📂 Database: {settings.database_name}")
    
    try:
        # Find all saved searches with occupation field
        cursor = db.saved_searches.find({
            "criteria.occupation": {"$exists": True, "$ne": "", "$ne": None}
        })
        
        searches_to_migrate = await cursor.to_list(length=None)
        total_count = len(searches_to_migrate)
        
        if total_count == 0:
            print("✅ No saved searches found with occupation field. Migration complete.")
            return
        
        print(f"📊 Found {total_count} saved searches to migrate")
        
        migrated_count = 0
        error_count = 0
        
        for search in searches_to_migrate:
            try:
                search_id = str(search["_id"])
                username = search.get("username", "unknown")
                search_name = search.get("name", "unnamed")
                criteria = search.get("criteria", {})
                occupation = criteria.get("occupation", "")
                
                if not occupation:
                    print(f"⚠️  Skipping {search_id} - empty occupation field")
                    continue
                
                # Create occupations array from single occupation
                occupations = [occupation.strip()] if occupation.strip() else []
                
                # Update the saved search
                update_result = await db.saved_searches.update_one(
                    {"_id": ObjectId(search_id)},
                    {
                        "$set": {"criteria.occupations": occupations},
                        "$unset": {"criteria.occupation": 1}
                    }
                )
                
                if update_result.modified_count > 0:
                    migrated_count += 1
                    print(f"✅ Migrated: '{search_name}' for user '{username}' ({occupation} -> {occupations})")
                else:
                    print(f"⚠️  No changes made for: '{search_name}' (ID: {search_id})")
                
            except Exception as e:
                error_count += 1
                print(f"❌ Error migrating search {search.get('_id')}: {e}")
                continue
        
        print(f"\n📈 Migration Summary:")
        print(f"  ✅ Successfully migrated: {migrated_count}")
        print(f"  ❌ Errors: {error_count}")
        print(f"  📊 Total processed: {total_count}")
        
        # Verify migration
        print("\n🔍 Verifying migration...")
        remaining = await db.saved_searches.count_documents({
            "criteria.occupation": {"$exists": True}
        })
        
        if remaining == 0:
            print("✅ Verification passed: No saved searches with old occupation field")
        else:
            print(f"⚠️  Verification warning: {remaining} saved searches still have occupation field")
        
        # Check new format
        new_format = await db.saved_searches.count_documents({
            "criteria.occupations": {"$exists": True}
        })
        print(f"✅ Saved searches with new occupations format: {new_format}")
        
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        raise
    
    finally:
        await client.close()
        print("\n🎉 Migration completed!")

if __name__ == "__main__":
    asyncio.run(migrate_saved_search_occupations())
