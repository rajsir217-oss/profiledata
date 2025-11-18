#!/usr/bin/env python3
"""
Data Migration: dateOfBirth → birthMonth + birthYear
=====================================================

This script migrates existing dateOfBirth fields to separate birthMonth and birthYear fields.

Handles various date formats:
- ISO format: "1990-05-15" or "1990-05-15T00:00:00"
- Slash format: "05/15/1990" or "5/15/1990"
- Other formats as needed

Usage:
    python migrate_dateofbirth_to_birth_fields.py [--dry-run]
"""

import asyncio
import argparse
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime
import sys
import os
import re

# Add parent directory to path to import config
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config import settings

def parse_date_of_birth(dob):
    """
    Parse various dateOfBirth formats and return (month, year)
    
    Returns:
        tuple: (birthMonth, birthYear) or (None, None) if parsing fails
    """
    if not dob:
        return None, None
    
    # Convert to string if it's not already
    dob_str = str(dob).strip()
    
    if not dob_str:
        return None, None
    
    try:
        # Try ISO format: "1990-05-15" or "1990-05-15T00:00:00"
        if '-' in dob_str:
            parts = dob_str.split('T')[0].split('-')
            if len(parts) >= 2:
                year = int(parts[0])
                month = int(parts[1])
                return month, year
        
        # Try slash format: "05/15/1990" or "5/15/1990" (MM/DD/YYYY)
        if '/' in dob_str:
            parts = dob_str.split('/')
            if len(parts) == 3:
                month = int(parts[0])
                year = int(parts[2])
                return month, year
        
        # Try datetime object
        if isinstance(dob, datetime):
            return dob.month, dob.year
        
        # Try parsing as datetime string
        dt = datetime.fromisoformat(dob_str.replace('Z', '+00:00'))
        return dt.month, dt.year
        
    except (ValueError, IndexError, AttributeError) as e:
        print(f"⚠️  Failed to parse date: {dob_str} - {e}")
        return None, None
    
    return None, None

async def migrate_dateofbirth(dry_run=False, mongodb_url=None, db_name=None):
    """Migrate dateOfBirth field to birthMonth and birthYear"""
    
    # Connect to MongoDB
    connection_url = mongodb_url or settings.mongodb_url
    database_name = db_name or settings.database_name
    
    print(f"🔌 Connecting to: {connection_url}")
    print(f"📂 Database: {database_name}\n")
    
    # Configure MongoDB client with SSL settings for Atlas connections
    client_kwargs = {}
    if 'mongodb+srv://' in connection_url or 'mongodb.net' in connection_url:
        # MongoDB Atlas connection - configure SSL
        import ssl
        import certifi
        client_kwargs['tlsCAFile'] = certifi.where()
        client_kwargs['ssl'] = True
        print("🔒 Using SSL with certifi certificates for MongoDB Atlas")
    
    client = AsyncIOMotorClient(connection_url, **client_kwargs)
    db = client[database_name]
    
    print("🔄 Starting dateOfBirth migration...")
    print("=" * 70)
    
    if dry_run:
        print("🔍 DRY RUN MODE - No changes will be made to the database\n")
    
    # Find all users with dateOfBirth field
    query = {
        "dateOfBirth": {"$exists": True}
    }
    
    cursor = db.users.find(query)
    users_to_migrate = []
    
    async for user in cursor:
        users_to_migrate.append(user)
    
    total_users = len(users_to_migrate)
    print(f"📊 Found {total_users} users with dateOfBirth field\n")
    
    if total_users == 0:
        print("✅ No users need migration")
        client.close()
        return
    
    # Process each user
    success_count = 0
    failed_count = 0
    skipped_count = 0
    
    for i, user in enumerate(users_to_migrate, 1):
        username = user.get('username', 'unknown')
        dob = user.get('dateOfBirth')
        existing_month = user.get('birthMonth')
        existing_year = user.get('birthYear')
        
        # Skip if already has birthMonth and birthYear
        if existing_month and existing_year:
            print(f"{i}/{total_users} ⏭️  {username}: Already has birthMonth/birthYear, skipping")
            skipped_count += 1
            continue
        
        # Parse dateOfBirth
        birth_month, birth_year = parse_date_of_birth(dob)
        
        if birth_month and birth_year:
            # Validate ranges
            if birth_month < 1 or birth_month > 12:
                print(f"{i}/{total_users} ❌ {username}: Invalid month {birth_month} from {dob}")
                failed_count += 1
                continue
            
            current_year = datetime.now().year
            if birth_year < current_year - 100 or birth_year > current_year - 18:
                print(f"{i}/{total_users} ❌ {username}: Invalid year {birth_year} (age out of range) from {dob}")
                failed_count += 1
                continue
            
            # Update user
            if not dry_run:
                update_result = await db.users.update_one(
                    {"_id": user["_id"]},
                    {
                        "$set": {
                            "birthMonth": birth_month,
                            "birthYear": birth_year
                        }
                    }
                )
                
                if update_result.modified_count > 0:
                    print(f"{i}/{total_users} ✅ {username}: {dob} → birthMonth={birth_month}, birthYear={birth_year}")
                    success_count += 1
                else:
                    print(f"{i}/{total_users} ⚠️  {username}: Update failed")
                    failed_count += 1
            else:
                print(f"{i}/{total_users} 🔍 {username}: {dob} → birthMonth={birth_month}, birthYear={birth_year} (dry run)")
                success_count += 1
        else:
            print(f"{i}/{total_users} ❌ {username}: Could not parse dateOfBirth: {dob}")
            failed_count += 1
    
    # Summary
    print("\n" + "=" * 70)
    print("📊 Migration Summary:")
    print(f"   Total users: {total_users}")
    print(f"   ✅ Successfully migrated: {success_count}")
    print(f"   ⏭️  Skipped (already complete): {skipped_count}")
    print(f"   ❌ Failed: {failed_count}")
    
    if dry_run:
        print("\n💡 Run without --dry-run to apply changes to database")
    else:
        print("\n✅ Migration complete!")
    
    # Close connection
    client.close()
    print("=" * 70)

def main():
    parser = argparse.ArgumentParser(
        description='Migrate dateOfBirth to birthMonth and birthYear'
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Preview changes without modifying database'
    )
    parser.add_argument(
        '--mongodb-url',
        type=str,
        help='MongoDB connection URL (overrides config file)'
    )
    parser.add_argument(
        '--db-name',
        type=str,
        help='Database name (overrides config file)'
    )
    
    args = parser.parse_args()
    
    asyncio.run(migrate_dateofbirth(
        dry_run=args.dry_run,
        mongodb_url=args.mongodb_url,
        db_name=args.db_name
    ))

if __name__ == "__main__":
    main()
