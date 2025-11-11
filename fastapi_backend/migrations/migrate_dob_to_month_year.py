#!/usr/bin/env python3
"""
Database Migration: Convert dateOfBirth to birthMonth and birthYear
================================================================

This script migrates user data from the old dateOfBirth field (full date)
to the new birthMonth and birthYear fields (privacy-focused).

What it does:
1. Reads all users with dateOfBirth field
2. Extracts month and year from dateOfBirth
3. Calculates current age
4. Updates user document with birthMonth, birthYear, and age
5. Optionally removes the dateOfBirth field (for privacy)

Usage:
    python migrate_dob_to_month_year.py [--remove-dob] [--dry-run]

Options:
    --remove-dob    Remove the dateOfBirth field after migration (for privacy)
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
from crypto_utils import PIIEncryption
import asyncio

settings = Settings()

# Initialize encryption for decrypting dateOfBirth
try:
    encryption = PIIEncryption()
    print("✅ Encryption initialized successfully")
except Exception as e:
    print(f"⚠️  Warning: Could not initialize encryption: {e}")
    print("    Encrypted dates will be skipped. Set ENCRYPTION_KEY in .env to decrypt them.")
    encryption = None


async def calculate_age(birth_month: int, birth_year: int) -> int:
    """Calculate age from birth month and year"""
    today = datetime.now()
    current_month = today.month
    current_year = today.year
    
    age = current_year - birth_year
    
    # If current month hasn't reached birth month yet, subtract 1
    if current_month < birth_month:
        age -= 1
    
    return age


async def migrate_dob_to_month_year(remove_dob: bool = False, dry_run: bool = False):
    """
    Migrate dateOfBirth field to birthMonth, birthYear, and age
    
    Args:
        remove_dob: Whether to remove the dateOfBirth field after migration
        dry_run: If True, only show what would be migrated
    """
    client = AsyncIOMotorClient(settings.mongodb_url)
    db = client[settings.database_name]
    users_collection = db.users
    
    try:
        print("🔍 Starting migration: dateOfBirth → birthMonth + birthYear + age")
        print(f"📍 Database: {settings.database_name}")
        print(f"🔧 Mode: {'DRY RUN (no changes)' if dry_run else 'LIVE (making changes)'}")
        print(f"🔐 Encryption: {'Enabled (will decrypt encrypted dates)' if encryption else 'DISABLED (encrypted dates will be skipped)'}")
        print(f"🗑️  Remove dateOfBirth after migration: {remove_dob}")
        print("-" * 70)
        
        # Find all users with dateOfBirth field
        users_with_dob = await users_collection.find({"dateOfBirth": {"$exists": True}}).to_list(None)
        
        if not users_with_dob:
            print("✅ No users found with dateOfBirth field. Migration not needed.")
            return
        
        print(f"📊 Found {len(users_with_dob)} users with dateOfBirth field")
        print()
        
        migrated_count = 0
        error_count = 0
        skipped_count = 0
        
        for user in users_with_dob:
            username = user.get("username", "unknown")
            date_of_birth = user.get("dateOfBirth")
            
            try:
                # Decrypt dateOfBirth if it's encrypted
                if isinstance(date_of_birth, str) and date_of_birth.startswith('gAAAAA'):
                    if encryption is None:
                        print(f"⚠️  Skipping {username}: dateOfBirth is encrypted but ENCRYPTION_KEY not available")
                        skipped_count += 1
                        continue
                    
                    try:
                        date_of_birth = encryption.decrypt(date_of_birth)
                        if date_of_birth is None:
                            print(f"⚠️  Skipping {username}: Failed to decrypt dateOfBirth")
                            skipped_count += 1
                            continue
                    except Exception as decrypt_err:
                        print(f"⚠️  Skipping {username}: Decryption error - {decrypt_err}")
                        skipped_count += 1
                        continue
                
                # Parse dateOfBirth (could be string or datetime)
                if isinstance(date_of_birth, str):
                    # Try different date formats
                    for date_format in ["%Y-%m-%d", "%m/%d/%Y", "%d/%m/%Y", "%Y-%m-%dT%H:%M:%S"]:
                        try:
                            birth_date = datetime.strptime(date_of_birth, date_format)
                            break
                        except ValueError:
                            continue
                    else:
                        print(f"⚠️  Skipping {username}: Could not parse date '{date_of_birth}'")
                        skipped_count += 1
                        continue
                elif isinstance(date_of_birth, datetime):
                    birth_date = date_of_birth
                else:
                    print(f"⚠️  Skipping {username}: Invalid dateOfBirth type {type(date_of_birth)}")
                    skipped_count += 1
                    continue
                
                # Extract month and year
                birth_month = birth_date.month
                birth_year = birth_date.year
                
                # Calculate age
                age = await calculate_age(birth_month, birth_year)
                
                # Prepare update
                update_doc = {
                    "$set": {
                        "birthMonth": birth_month,
                        "birthYear": birth_year,
                        "age": age
                    }
                }
                
                # Optionally remove dateOfBirth
                if remove_dob:
                    update_doc["$unset"] = {"dateOfBirth": ""}
                
                if dry_run:
                    # Show if date was encrypted
                    was_encrypted = user.get("dateOfBirth", "").startswith('gAAAAA')
                    print(f"[DRY RUN] {username}:")
                    if was_encrypted:
                        print(f"  • dateOfBirth: [ENCRYPTED] → decrypted to {date_of_birth}")
                    else:
                        print(f"  • dateOfBirth: {date_of_birth}")
                    print(f"  • → birthMonth: {birth_month}")
                    print(f"  • → birthYear: {birth_year}")
                    print(f"  • → age: {age}")
                    if remove_dob:
                        print(f"  • → Would remove dateOfBirth field")
                    print()
                else:
                    # Perform update
                    result = await users_collection.update_one(
                        {"_id": user["_id"]},
                        update_doc
                    )
                    
                    if result.modified_count > 0:
                        print(f"✅ {username}: Migrated successfully (age: {age})")
                        migrated_count += 1
                    else:
                        print(f"⚠️  {username}: No changes made (already migrated?)")
                        skipped_count += 1
                
            except Exception as e:
                print(f"❌ Error processing {username}: {str(e)}")
                error_count += 1
        
        # Summary
        print()
        print("=" * 70)
        print("📊 Migration Summary:")
        print(f"  • Total users found: {len(users_with_dob)}")
        if dry_run:
            print(f"  • Would migrate: {len(users_with_dob) - skipped_count}")
            print(f"  • Would skip: {skipped_count}")
        else:
            print(f"  • Successfully migrated: {migrated_count}")
            print(f"  • Skipped: {skipped_count}")
            print(f"  • Errors: {error_count}")
        print("=" * 70)
        
        if dry_run:
            print()
            print("ℹ️  This was a DRY RUN. No changes were made to the database.")
            print("   Run without --dry-run to perform the actual migration.")
        else:
            print()
            print("✅ Migration completed!")
            if remove_dob:
                print("   Note: dateOfBirth field has been removed for privacy.")
            else:
                print("   Note: dateOfBirth field kept for backward compatibility.")
                print("         Use --remove-dob flag to remove it if desired.")
        
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
        
        # Count users with new fields
        with_new_fields = await users_collection.count_documents({
            "birthMonth": {"$exists": True},
            "birthYear": {"$exists": True}
        })
        
        # Count users still with old field
        with_old_field = await users_collection.count_documents({
            "dateOfBirth": {"$exists": True}
        })
        
        # Sample a few users
        sample_users = await users_collection.find({
            "birthMonth": {"$exists": True}
        }).limit(3).to_list(3)
        
        print(f"✅ Users with birthMonth/birthYear: {with_new_fields}")
        print(f"📅 Users still with dateOfBirth: {with_old_field}")
        print()
        
        if sample_users:
            print("Sample migrated users:")
            for user in sample_users:
                print(f"  • {user.get('username')}: "
                      f"birthMonth={user.get('birthMonth')}, "
                      f"birthYear={user.get('birthYear')}, "
                      f"age={user.get('age')}")
        
        print("-" * 70)
        
    finally:
        client.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Migrate dateOfBirth to birthMonth and birthYear"
    )
    parser.add_argument(
        "--remove-dob",
        action="store_true",
        help="Remove the dateOfBirth field after migration (for privacy)"
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
    asyncio.run(migrate_dob_to_month_year(
        remove_dob=args.remove_dob,
        dry_run=args.dry_run
    ))
    
    # Optionally verify
    if args.verify and not args.dry_run:
        asyncio.run(verify_migration())
