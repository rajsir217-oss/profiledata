#!/usr/bin/env python3
"""
Populate heightInches Field Migration
======================================
Converts height strings (e.g., "5'6\"") to numeric heightInches field.
This enables proper height range filtering in search.
"""

import asyncio
import re
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv('.env.production')

MONGODB_URL = os.getenv('MONGODB_URL', 'mongodb+srv://rajl3v3l_db_user:3F01eZUHTY9tx07u@mongocluster0.rebdf0h.mongodb.net/matrimonialDB')
DATABASE_NAME = os.getenv('DATABASE_NAME', 'matrimonialDB')


def parse_height_to_inches(height_str):
    """
    Parse height string to total inches.
    Supports formats: "5'6\"", "5' 6\"", "5ft 6in", "5'6", etc.
    
    Returns:
        int: Total inches, or None if parsing fails
    """
    if not height_str or not isinstance(height_str, str):
        return None
    
    height_str = height_str.strip()
    
    # Pattern 1: 5'6" or 5' 6" or 5'6
    pattern1 = r"(\d+)'?\s*(\d+)?"
    match = re.match(pattern1, height_str)
    
    if match:
        feet = int(match.group(1))
        inches = int(match.group(2)) if match.group(2) else 0
        
        # Sanity check
        if 3 <= feet <= 8 and 0 <= inches < 12:
            return feet * 12 + inches
    
    return None


async def populate_height_inches():
    """Populate heightInches field for all users with height data"""
    
    client = AsyncIOMotorClient(MONGODB_URL)
    db = client[DATABASE_NAME]
    
    print("🔧 Starting heightInches population migration...")
    print(f"   Database: {DATABASE_NAME}")
    print()
    
    # Step 1: Count users with height field but missing heightInches
    total_users = await db.users.count_documents({})
    users_with_height = await db.users.count_documents({'height': {'$exists': True, '$ne': None, '$ne': ''}})
    users_with_height_inches = await db.users.count_documents({'heightInches': {'$exists': True, '$ne': None}})
    users_missing_height_inches = await db.users.count_documents({
        'height': {'$exists': True, '$ne': None, '$ne': ''},
        '$or': [
            {'heightInches': {'$exists': False}},
            {'heightInches': None}
        ]
    })
    
    print(f"📊 Current State:")
    print(f"   Total users: {total_users}")
    print(f"   Users with 'height' field: {users_with_height}")
    print(f"   Users with 'heightInches' field: {users_with_height_inches}")
    print(f"   Users missing 'heightInches': {users_missing_height_inches}")
    print()
    
    # Step 2: Get all users with height but missing heightInches
    users_to_update = await db.users.find({
        'height': {'$exists': True, '$ne': None, '$ne': ''},
        '$or': [
            {'heightInches': {'$exists': False}},
            {'heightInches': None}
        ]
    }, {'username': 1, 'height': 1}).to_list(length=None)
    
    print(f"🔄 Processing {len(users_to_update)} users...")
    print()
    
    # Step 3: Parse and update
    updated_count = 0
    failed_count = 0
    failed_users = []
    
    for user in users_to_update:
        username = user.get('username')
        height_str = user.get('height')
        
        height_inches = parse_height_to_inches(height_str)
        
        if height_inches is not None:
            # Update user with heightInches
            await db.users.update_one(
                {'username': username},
                {'$set': {'heightInches': height_inches}}
            )
            updated_count += 1
            
            if updated_count <= 10:  # Show first 10
                print(f"   ✅ {username}: '{height_str}' → {height_inches} inches")
        else:
            failed_count += 1
            failed_users.append({'username': username, 'height': height_str})
            
            if failed_count <= 5:  # Show first 5 failures
                print(f"   ❌ {username}: '{height_str}' → FAILED TO PARSE")
    
    print()
    print("✅ Migration completed!")
    print(f"   Users updated: {updated_count}")
    print(f"   Failed to parse: {failed_count}")
    print()
    
    # Step 4: Verify
    users_with_height_inches_after = await db.users.count_documents({'heightInches': {'$exists': True, '$ne': None}})
    print(f"📊 Verification:")
    print(f"   Users with heightInches before: {users_with_height_inches}")
    print(f"   Users with heightInches after: {users_with_height_inches_after}")
    print(f"   New heightInches fields added: {users_with_height_inches_after - users_with_height_inches}")
    print()
    
    # Step 5: Show sample of updated users
    print("📋 Sample of updated users:")
    sample_users = await db.users.find(
        {'heightInches': {'$exists': True, '$ne': None}},
        {'username': 1, 'height': 1, 'heightInches': 1, 'gender': 1}
    ).limit(10).to_list(length=10)
    
    for user in sample_users:
        print(f"   {user.get('username')} ({user.get('gender')}): {user.get('height')} = {user.get('heightInches')} inches")
    print()
    
    # Step 6: Show failed users if any
    if failed_users:
        print("⚠️  Failed to parse height for these users:")
        for user in failed_users[:10]:  # Show max 10
            print(f"   {user['username']}: '{user['height']}'")
        if len(failed_users) > 10:
            print(f"   ... and {len(failed_users) - 10} more")
        print()
    
    print("ℹ️  Important Notes:")
    print("   1. Height filter in search will now work correctly")
    print("   2. Users can update their height in profile settings")
    print("   3. New users will have heightInches auto-populated on profile save")
    print()
    
    client.close()


if __name__ == "__main__":
    asyncio.run(populate_height_inches())
