#!/usr/bin/env python3
"""
Database Migration: Drop dateOfBirth field
==========================================

We now use birthMonth + birthYear for all age calculations.
The dateOfBirth field is deprecated and should be removed.

Usage:
    python drop_dateofbirth_field.py [--dry-run]
"""

import sys
from pathlib import Path
sys.path.append(str(Path(__file__).parent.parent))

from motor.motor_asyncio import AsyncIOMotorClient
from config import Settings
import asyncio
import argparse

settings = Settings()

async def drop_dateofbirth_field(dry_run: bool = False):
    """Remove dateOfBirth field from all users"""
    client = AsyncIOMotorClient(settings.mongodb_url)
    db = client[settings.database_name]
    
    try:
        print("🔍 Starting cleanup: Drop dateOfBirth field")
        print(f"📍 Database: {settings.database_name}")
        print(f"🔧 Mode: {'DRY RUN (no changes)' if dry_run else 'LIVE (making changes)'}")
        print("-" * 70)
        
        # Check how many users have dateOfBirth
        users_with_field = await db.users.count_documents({
            'dateOfBirth': {'$exists': True}
        })
        
        print(f"📊 Found {users_with_field} users with dateOfBirth field")
        
        if users_with_field == 0:
            print("✅ No users have dateOfBirth field. Nothing to clean up!")
            return
        
        # Sample a few users
        sample = await db.users.find({
            'dateOfBirth': {'$exists': True}
        }).limit(5).to_list(5)
        
        print(f"\n📝 Sample users:")
        for user in sample:
            print(f"   • {user.get('username')}: "
                  f"birthMonth={user.get('birthMonth')}, "
                  f"birthYear={user.get('birthYear')}, "
                  f"has_dateOfBirth=True")
        
        if dry_run:
            print(f"\n[DRY RUN] Would drop dateOfBirth field from {users_with_field} users")
        else:
            # Drop the field from all users
            result = await db.users.update_many(
                {'dateOfBirth': {'$exists': True}},
                {'$unset': {'dateOfBirth': ''}}
            )
            print(f"\n✅ Dropped dateOfBirth field from {result.modified_count} users")
            
            # Drop the index on dateOfBirth if it exists
            try:
                await db.users.drop_index('dateOfBirth_1')
                print(f"✅ Dropped index: dateOfBirth_1")
            except Exception as index_err:
                print(f"ℹ️  Index dateOfBirth_1 not found or already dropped: {index_err}")
        
        print("\n" + "=" * 70)
        print("📊 Summary:")
        print(f"   • Users processed: {users_with_field}")
        if dry_run:
            print(f"   • Would drop dateOfBirth field")
            print(f"   • Would drop dateOfBirth index")
        else:
            print(f"   • ✅ Dropped dateOfBirth field")
            print(f"   • ✅ Dropped dateOfBirth index")
        print("=" * 70)
        
        if dry_run:
            print()
            print("ℹ️  This was a DRY RUN. No changes were made.")
            print("   Run without --dry-run to perform cleanup.")
        else:
            print()
            print("✅ Cleanup completed!")
            print("   All users now use only birthMonth + birthYear for age.")
        
    finally:
        client.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Drop dateOfBirth field (use birthMonth + birthYear instead)"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be dropped without making changes"
    )
    
    args = parser.parse_args()
    asyncio.run(drop_dateofbirth_field(dry_run=args.dry_run))
