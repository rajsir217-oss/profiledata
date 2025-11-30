#!/usr/bin/env python3
"""
Quick verification script to check if new users get role_name = "free_user"
"""

import asyncio
import sys
import os

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import get_database


async def verify_role_assignment():
    """Check the most recent user to verify role_name is set"""
    db = await get_database()
    
    print("🔍 Checking role_name assignment in MongoDB...")
    print("=" * 60)
    
    # Get the most recent user
    recent_user = await db.users.find_one(
        {},
        sort=[("createdAt", -1)]
    )
    
    if not recent_user:
        print("❌ No users found in database")
        return
    
    username = recent_user.get("username", "N/A")
    role_name = recent_user.get("role_name")
    created_at = recent_user.get("createdAt", "N/A")
    
    print(f"\n📊 Most Recent User:")
    print(f"   Username: {username}")
    print(f"   Created: {created_at}")
    print(f"   Role: {role_name}")
    
    if role_name == "free_user":
        print("\n✅ CONFIRMED: User has role_name = 'free_user'")
    elif role_name is None:
        print("\n⚠️  WARNING: User has role_name = null")
        print("   This user was created BEFORE the fix")
    else:
        print(f"\n✅ User has role_name = '{role_name}'")
    
    # Check for any users with null role_name
    null_count = await db.users.count_documents({
        "$or": [
            {"role_name": {"$exists": False}},
            {"role_name": None}
        ]
    })
    
    total_count = await db.users.count_documents({})
    
    print(f"\n📈 Database Statistics:")
    print(f"   Total users: {total_count}")
    print(f"   Users with null role_name: {null_count}")
    print(f"   Users with role assigned: {total_count - null_count}")
    
    if null_count > 0:
        print(f"\n⚠️  {null_count} users still need role assignment")
        print("   Run migration: python3 migrations/add_default_role_to_users.py")
    else:
        print("\n✅ All users have role_name assigned!")
    
    # Show role distribution
    print("\n📊 Role Distribution:")
    pipeline = [
        {"$group": {"_id": "$role_name", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    
    async for role_stat in db.users.aggregate(pipeline):
        role = role_stat["_id"] if role_stat["_id"] else "null"
        count = role_stat["count"]
        print(f"   {role}: {count} users")


if __name__ == "__main__":
    asyncio.run(verify_role_assignment())
