"""
Migration 006: Convert partnerCriteria.location from array to string
Date: 2025-12-05
Description: Convert location field from multi-select array format to comma-separated string format
"""

from datetime import datetime

async def up(db):
    """
    Migrate partnerCriteria.location from array to string
    """
    users_collection = db.users
    
    print("  🔍 Finding users with array-based location...")
    
    # Find all users with location as an array
    query = {
        "partnerCriteria.location": {"$exists": True, "$type": "array"}
    }
    
    users_count = await users_collection.count_documents(query)
    print(f"  📊 Found {users_count} users with array-based location")
    
    if users_count == 0:
        print("  ✅ No migration needed - all users already have string-based location")
        return
    
    # Process users
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
                    # Join array elements with comma and space
                    new_location = ", ".join(current_location)
                
                # Update the document
                result = await users_collection.update_one(
                    {"_id": user["_id"]},
                    {
                        "$set": {
                            "partnerCriteria.location": new_location
                        }
                    }
                )
                
                if result.modified_count > 0:
                    updated_count += 1
                    if updated_count % 10 == 0:  # Progress indicator
                        print(f"  ⏳ Progress: {updated_count}/{users_count}")
                        
        except Exception as e:
            error_count += 1
            print(f"  ❌ Error updating user '{username}': {str(e)}")
    
    # Summary
    print(f"  ✅ Successfully updated: {updated_count} users")
    if error_count > 0:
        print(f"  ⚠️  Errors: {error_count}")
    
    return True


async def down(db):
    """
    Rollback: This migration is not easily reversible as we don't store the original array format
    Manual intervention may be required to restore specific array formats
    """
    print("  ⚠️  Rollback not implemented for this migration")
    print("  ℹ️  Location data is now stored as comma-separated strings")
    print("  ℹ️  To restore array format, you would need to parse the strings")
    return False
