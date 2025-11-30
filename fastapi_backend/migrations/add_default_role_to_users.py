#!/usr/bin/env python3
"""
Migration: Add default role_name to existing users
Date: Nov 29, 2025
Purpose: Set role_name = "free_user" for all users where role_name is null/missing
"""

import asyncio
import sys
import os
from datetime import datetime

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import get_database


async def migrate_user_roles():
    """Add default role_name to users missing it"""
    db = await get_database()
    
    print("=" * 60)
    print("Migration: Add default role_name to existing users")
    print("=" * 60)
    
    # Find users without role_name or with null role_name
    users_without_role = await db.users.find({
        "$or": [
            {"role_name": {"$exists": False}},
            {"role_name": None}
        ]
    }).to_list(length=None)
    
    count = len(users_without_role)
    
    if count == 0:
        print("✅ No users found without role_name. All users already have roles assigned.")
        return
    
    print(f"\n📊 Found {count} users without role_name")
    print(f"Will set role_name = 'free_user' for these users")
    
    # Show sample of users that will be updated
    print("\nSample users to be updated:")
    for user in users_without_role[:5]:
        print(f"  - {user.get('username', 'N/A')} (profileId: {user.get('profileId', 'N/A')})")
    
    if count > 5:
        print(f"  ... and {count - 5} more")
    
    # Confirm
    response = input(f"\nProceed with updating {count} users? (yes/no): ")
    if response.lower() not in ['yes', 'y']:
        print("❌ Migration cancelled")
        return
    
    # Update all users
    result = await db.users.update_many(
        {
            "$or": [
                {"role_name": {"$exists": False}},
                {"role_name": None}
            ]
        },
        {
            "$set": {
                "role_name": "free_user",
                "updatedAt": datetime.utcnow().isoformat()
            }
        }
    )
    
    print(f"\n✅ Migration completed successfully!")
    print(f"   Matched: {result.matched_count} users")
    print(f"   Modified: {result.modified_count} users")
    
    # Verify
    remaining = await db.users.count_documents({
        "$or": [
            {"role_name": {"$exists": False}},
            {"role_name": None}
        ]
    })
    
    if remaining > 0:
        print(f"\n⚠️  Warning: {remaining} users still have null role_name")
    else:
        print("\n✅ All users now have role_name assigned!")


if __name__ == "__main__":
    asyncio.run(migrate_user_roles())
