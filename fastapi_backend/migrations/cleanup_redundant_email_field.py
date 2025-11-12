#!/usr/bin/env python3
"""
Database Migration: Remove redundant 'email' field
==================================================

contactEmail is the standard field. Remove redundant 'email' field from 
users who have both.

Usage:
    python cleanup_redundant_email_field.py [--dry-run]
"""

import sys
from pathlib import Path
sys.path.append(str(Path(__file__).parent.parent))

from motor.motor_asyncio import AsyncIOMotorClient
from config import Settings
import asyncio
import argparse

settings = Settings()

async def cleanup_email_field(dry_run: bool = False):
    """Remove redundant email field"""
    client = AsyncIOMotorClient(settings.mongodb_url)
    db = client[settings.database_name]
    
    try:
        print("🔍 Starting cleanup: Remove redundant 'email' field")
        print(f"📍 Database: {settings.database_name}")
        print(f"🔧 Mode: {'DRY RUN (no changes)' if dry_run else 'LIVE (making changes)'}")
        print("-" * 70)
        
        # Find users with both fields
        users_with_both = await db.users.find({
            'email': {'$exists': True},
            'contactEmail': {'$exists': True}
        }).to_list(None)
        
        if not users_with_both:
            print("✅ No users found with both fields. Nothing to clean up!")
            return
        
        print(f"📊 Found {len(users_with_both)} users with both 'email' and 'contactEmail' fields")
        print()
        
        for user in users_with_both:
            username = user.get('username', 'unknown')
            email_val = user.get('email', 'None')
            contactEmail_val = user.get('contactEmail', 'None')
            
            print(f"User: {username}")
            print(f"  • email: {email_val}")
            print(f"  • contactEmail: {contactEmail_val[:50]}... (encrypted)")
            
            if dry_run:
                print(f"  • [DRY RUN] Would remove 'email' field")
            else:
                result = await db.users.update_one(
                    {'_id': user['_id']},
                    {'$unset': {'email': ''}}
                )
                if result.modified_count > 0:
                    print(f"  • ✅ Removed redundant 'email' field")
                else:
                    print(f"  • ⚠️  No changes made")
            print()
        
        print("=" * 70)
        print("📊 Summary:")
        print(f"   • Users processed: {len(users_with_both)}")
        if dry_run:
            print(f"   • Would remove 'email' field from: {len(users_with_both)} users")
        else:
            print(f"   • Removed 'email' field from: {len(users_with_both)} users")
        print("=" * 70)
        
        if dry_run:
            print()
            print("ℹ️  This was a DRY RUN. No changes were made.")
            print("   Run without --dry-run to perform cleanup.")
        else:
            print()
            print("✅ Cleanup completed!")
            print("   All users now use only 'contactEmail' field.")
        
    finally:
        client.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Remove redundant 'email' field (contactEmail is standard)"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be cleaned without making changes"
    )
    
    args = parser.parse_args()
    asyncio.run(cleanup_email_field(dry_run=args.dry_run))
