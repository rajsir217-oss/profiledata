#!/usr/bin/env python3
"""
Database Migration: Consolidate sex field to gender
===================================================

This script consolidates the legacy 'sex' field into the 'gender' field
and removes the redundant 'sex' field.

What it does:
1. Copies sex → gender for users missing gender field
2. Ensures all users have gender field
3. Removes the sex field (optional with --remove-sex flag)

Usage:
    python consolidate_sex_to_gender.py [--remove-sex] [--dry-run]

Options:
    --remove-sex    Remove the sex field after migration (cleanup)
    --dry-run       Show what would be migrated without making changes
"""

import sys
from pathlib import Path
from datetime import datetime
import argparse

# Add parent directory to path for imports
sys.path.append(str(Path(__file__).parent.parent))

from motor.motor_asyncio import AsyncIOMotorClient
from config import Settings
import asyncio

settings = Settings()


async def consolidate_sex_to_gender(remove_sex: bool = False, dry_run: bool = False):
    """
    Consolidate sex field to gender field
    
    Args:
        remove_sex: Whether to remove the sex field after migration
        dry_run: If True, only show what would be migrated
    """
    client = AsyncIOMotorClient(settings.mongodb_url)
    db = client[settings.database_name]
    users_collection = db.users
    
    try:
        print("🔍 Starting migration: sex → gender consolidation")
        print(f"📍 Database: {settings.database_name}")
        print(f"🔧 Mode: {'DRY RUN (no changes)' if dry_run else 'LIVE (making changes)'}")
        print(f"🗑️  Remove sex field after migration: {remove_sex}")
        print("-" * 70)
        
        # Find all users
        all_users = await users_collection.find({}).to_list(None)
        
        if not all_users:
            print("⚠️  No users found in database")
            return
        
        print(f"📊 Found {len(all_users)} total users")
        print()
        
        # Statistics
        has_both = 0
        has_only_sex = 0
        has_only_gender = 0
        has_neither = 0
        mismatched = 0
        
        # Categorize users
        users_to_update = []
        
        for user in all_users:
            username = user.get("username", "unknown")
            sex_value = user.get("sex")
            gender_value = user.get("gender")
            
            if sex_value and gender_value:
                has_both += 1
                if sex_value != gender_value:
                    mismatched += 1
                    print(f"⚠️  Mismatch: {username} - sex={sex_value}, gender={gender_value}")
            elif sex_value and not gender_value:
                has_only_sex += 1
                users_to_update.append((user, sex_value, "sex_only"))
            elif gender_value and not sex_value:
                has_only_gender += 1
            else:
                has_neither += 1
        
        print("📊 Current State:")
        print(f"   • Has both fields: {has_both}")
        print(f"   • Has only sex: {has_only_sex}")
        print(f"   • Has only gender: {has_only_gender}")
        print(f"   • Has neither: {has_neither}")
        if mismatched > 0:
            print(f"   • ⚠️  Mismatched values: {mismatched}")
        print()
        
        if not users_to_update and not remove_sex:
            print("✅ All users already have gender field. No migration needed.")
            if has_both > 0:
                print(f"💡 Tip: Run with --remove-sex to clean up {has_both} redundant sex fields")
            return
        
        # Perform migration
        updated_count = 0
        removed_count = 0
        error_count = 0
        
        # Update users missing gender field
        if users_to_update:
            print(f"🔄 Copying sex → gender for {len(users_to_update)} users...")
            print()
            
            for user, sex_value, reason in users_to_update:
                username = user.get("username", "unknown")
                
                try:
                    if dry_run:
                        print(f"[DRY RUN] {username}:")
                        print(f"  • sex: {sex_value}")
                        print(f"  • → gender: {sex_value} (would be added)")
                        if remove_sex:
                            print(f"  • → Would remove sex field")
                        print()
                    else:
                        update_doc = {
                            "$set": {"gender": sex_value}
                        }
                        
                        if remove_sex:
                            update_doc["$unset"] = {"sex": ""}
                        
                        result = await users_collection.update_one(
                            {"_id": user["_id"]},
                            update_doc
                        )
                        
                        if result.modified_count > 0:
                            print(f"✅ {username}: sex → gender = {sex_value}")
                            updated_count += 1
                        else:
                            print(f"⚠️  {username}: No changes made")
                
                except Exception as e:
                    print(f"❌ Error processing {username}: {str(e)}")
                    error_count += 1
        
        # Remove sex field from users who have both
        if remove_sex and has_both > 0:
            print()
            print(f"🗑️  Removing redundant sex field from {has_both} users...")
            print()
            
            if dry_run:
                print(f"[DRY RUN] Would remove sex field from {has_both} users with both fields")
            else:
                result = await users_collection.update_many(
                    {"sex": {"$exists": True}, "gender": {"$exists": True}},
                    {"$unset": {"sex": ""}}
                )
                removed_count = result.modified_count
                print(f"✅ Removed sex field from {removed_count} users")
        
        # Summary
        print()
        print("=" * 70)
        print("📊 Migration Summary:")
        print(f"  • Total users: {len(all_users)}")
        if dry_run:
            print(f"  • Would update (sex → gender): {len(users_to_update)}")
            if remove_sex:
                print(f"  • Would remove sex field: {has_both + len(users_to_update)}")
        else:
            print(f"  • Updated (sex → gender): {updated_count}")
            if remove_sex:
                print(f"  • Removed sex field: {removed_count}")
            print(f"  • Errors: {error_count}")
        print("=" * 70)
        
        if dry_run:
            print()
            print("ℹ️  This was a DRY RUN. No changes were made to the database.")
            print("   Run without --dry-run to perform the actual migration.")
        else:
            print()
            print("✅ Migration completed!")
            if remove_sex:
                print("   Note: sex field has been removed.")
            else:
                print("   Note: sex field kept. Use --remove-sex to clean it up.")
        
    finally:
        client.close()


async def verify_migration():
    """Verify the migration was successful"""
    client = AsyncIOMotorClient(settings.mongodb_url)
    db = client[settings.database_name]
    users_collection = db.users
    
    try:
        print()
        print("🔍 Verifying migration...")
        print("-" * 70)
        
        # Count users with gender field
        with_gender = await users_collection.count_documents({"gender": {"$exists": True}})
        
        # Count users still with sex field
        with_sex = await users_collection.count_documents({"sex": {"$exists": True}})
        
        # Total users
        total = await users_collection.count_documents({})
        
        # Sample users
        sample_users = await users_collection.find({}).limit(5).to_list(5)
        
        print(f"✅ Users with gender field: {with_gender} / {total}")
        print(f"📅 Users still with sex field: {with_sex}")
        print()
        
        if sample_users:
            print("Sample users:")
            for user in sample_users:
                sex_val = user.get("sex", "None")
                gender_val = user.get("gender", "None")
                print(f"  • {user.get('username')}: sex={sex_val}, gender={gender_val}")
        
        print("-" * 70)
        
        if with_gender == total and with_sex == 0:
            print("✅ Perfect! All users have gender field and sex field is removed.")
        elif with_gender == total:
            print(f"⚠️  All users have gender, but {with_sex} still have sex field.")
            print("   Run with --remove-sex to clean up.")
        else:
            print(f"⚠️  Warning: {total - with_gender} users missing gender field!")
        
    finally:
        client.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Consolidate sex field to gender field"
    )
    parser.add_argument(
        "--remove-sex",
        action="store_true",
        help="Remove the sex field after migration (cleanup)"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be migrated without making changes"
    )
    parser.add_argument(
        "--verify",
        action="store_true",
        help="Verify migration results"
    )
    
    args = parser.parse_args()
    
    # Run migration
    asyncio.run(consolidate_sex_to_gender(
        remove_sex=args.remove_sex,
        dry_run=args.dry_run
    ))
    
    # Optionally verify
    if args.verify and not args.dry_run:
        asyncio.run(verify_migration())
