"""
Migration: Convert partnerCriteria.location from array to string
Date: 2025-12-05
Description: Convert location field from multi-select array format to comma-separated string format
"""

import asyncio
import os
import sys
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config import Settings

settings = Settings()

async def migrate_location_to_string():
    """Convert partnerCriteria.location from array to string format"""
    
    # Connect to MongoDB
    client = AsyncIOMotorClient(settings.mongodb_url)
    db = client[settings.database_name]
    users_collection = db.users
    
    print("🔍 Starting location field migration...")
    print(f"📦 Database: {settings.database_name}")
    
    # Find all users with location as an array
    query = {
        "partnerCriteria.location": {"$exists": True, "$type": "array"}
    }
    
    users_with_array_location = await users_collection.count_documents(query)
    print(f"📊 Found {users_with_array_location} users with array-based location")
    
    if users_with_array_location == 0:
        print("✅ No migration needed - all users already have string-based location")
        client.close()
        return
    
    # Process users in batches
    batch_size = 100
    updated_count = 0
    error_count = 0
    
    cursor = users_collection.find(query)
    
    async for user in cursor:
        try:
            username = user.get('username', 'unknown')
            current_location = user.get('partnerCriteria', {}).get('location', [])
            
            # Convert array to string
            if isinstance(current_location, list):
                if len(current_location) == 0:
                    new_location = "Any Location"
                elif "Any" in current_location or "Any Location" in current_location:
                    new_location = "Any Location"
                else:
                    # Join array elements with comma
                    new_location = ", ".join(current_location)
                
                # Update the document
                result = await users_collection.update_one(
                    {"_id": user["_id"]},
                    {
                        "$set": {
                            "partnerCriteria.location": new_location,
                            "migrationHistory.locationToString": {
                                "migratedAt": datetime.utcnow(),
                                "oldValue": current_location,
                                "newValue": new_location
                            }
                        }
                    }
                )
                
                if result.modified_count > 0:
                    updated_count += 1
                    print(f"✅ Updated user '{username}': {current_location} → '{new_location}'")
                else:
                    print(f"⚠️  User '{username}' not modified (possibly already updated)")
                    
        except Exception as e:
            error_count += 1
            print(f"❌ Error updating user '{username}': {str(e)}")
    
    # Summary
    print("\n" + "="*60)
    print("📊 Migration Summary:")
    print(f"   Total users found: {users_with_array_location}")
    print(f"   Successfully updated: {updated_count}")
    print(f"   Errors: {error_count}")
    print("="*60)
    
    if error_count == 0:
        print("✅ Migration completed successfully!")
    else:
        print(f"⚠️  Migration completed with {error_count} errors")
    
    client.close()

async def verify_migration():
    """Verify that migration was successful"""
    
    client = AsyncIOMotorClient(settings.mongodb_url)
    db = client[settings.database_name]
    users_collection = db.users
    
    print("\n🔍 Verifying migration...")
    
    # Count remaining array-based locations
    remaining_arrays = await users_collection.count_documents({
        "partnerCriteria.location": {"$exists": True, "$type": "array"}
    })
    
    # Count string-based locations
    string_locations = await users_collection.count_documents({
        "partnerCriteria.location": {"$exists": True, "$type": "string"}
    })
    
    print(f"📊 Verification Results:")
    print(f"   Array-based locations remaining: {remaining_arrays}")
    print(f"   String-based locations: {string_locations}")
    
    if remaining_arrays == 0:
        print("✅ All locations successfully migrated to string format!")
    else:
        print(f"⚠️  Warning: {remaining_arrays} array-based locations still exist")
    
    client.close()

async def rollback_migration():
    """Rollback migration using migration history"""
    
    client = AsyncIOMotorClient(settings.mongodb_url)
    db = client[settings.database_name]
    users_collection = db.users
    
    print("🔄 Rolling back location migration...")
    
    # Find users with migration history
    query = {
        "migrationHistory.locationToString": {"$exists": True}
    }
    
    rollback_count = 0
    
    cursor = users_collection.find(query)
    
    async for user in cursor:
        try:
            username = user.get('username', 'unknown')
            migration_data = user.get('migrationHistory', {}).get('locationToString', {})
            old_value = migration_data.get('oldValue')
            
            if old_value is not None:
                # Restore old array value
                result = await users_collection.update_one(
                    {"_id": user["_id"]},
                    {
                        "$set": {
                            "partnerCriteria.location": old_value
                        },
                        "$unset": {
                            "migrationHistory.locationToString": ""
                        }
                    }
                )
                
                if result.modified_count > 0:
                    rollback_count += 1
                    print(f"✅ Rolled back user '{username}'")
                    
        except Exception as e:
            print(f"❌ Error rolling back user '{username}': {str(e)}")
    
    print(f"\n✅ Rollback complete. Restored {rollback_count} users to array format.")
    
    client.close()

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description='Migrate location field from array to string')
    parser.add_argument('--verify', action='store_true', help='Verify migration status')
    parser.add_argument('--rollback', action='store_true', help='Rollback the migration')
    
    args = parser.parse_args()
    
    if args.rollback:
        asyncio.run(rollback_migration())
    elif args.verify:
        asyncio.run(verify_migration())
    else:
        asyncio.run(migrate_location_to_string())
        asyncio.run(verify_migration())
