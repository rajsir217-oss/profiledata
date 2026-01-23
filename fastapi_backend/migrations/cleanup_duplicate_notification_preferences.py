#!/usr/bin/env python3
"""
Migration: Clean up duplicate notification_preferences and add unique index

This migration:
1. Finds duplicate entries in notification_preferences collection (same username)
2. Keeps the most recent document (by updatedAt or _id) and removes duplicates
3. Creates a unique index on username to prevent future duplicates

Date: 2026-01-23
"""

import asyncio
import sys
import os
from datetime import datetime

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from motor.motor_asyncio import AsyncIOMotorClient
from config import settings


async def run_migration(dry_run: bool = False):
    """Clean up duplicate notification_preferences and add unique index"""
    client = AsyncIOMotorClient(settings.mongodb_url)
    db = client[settings.database_name]
    
    print("=" * 80)
    print("MIGRATION: Clean Up Duplicate notification_preferences")
    print("=" * 80)
    if dry_run:
        print("🧪 DRY RUN MODE - No changes will be made")
    print()
    
    duplicates_found = 0
    duplicates_removed = 0
    
    try:
        # Step 1: Find all duplicates
        print("📋 Step 1: Finding duplicate usernames in notification_preferences...")
        
        pipeline = [
            {"$group": {
                "_id": "$username",
                "count": {"$sum": 1},
                "docs": {"$push": {
                    "doc_id": "$_id",
                    "updatedAt": {"$ifNull": ["$updatedAt", "$createdAt"]},
                    "createdAt": "$createdAt"
                }}
            }},
            {"$match": {"count": {"$gt": 1}}},
            {"$sort": {"count": -1}}
        ]
        
        duplicates = await db.notification_preferences.aggregate(pipeline).to_list(length=None)
        
        if not duplicates:
            print("   ✅ No duplicates found!")
        else:
            print(f"   ⚠️  Found {len(duplicates)} usernames with duplicate entries:")
            
            for dup in duplicates:
                username = dup["_id"]
                count = dup["count"]
                duplicates_found += count - 1  # Count extra documents
                
                print(f"\n   👤 {username}: {count} documents")
                
                # Sort docs to keep the most recent one
                docs = dup["docs"]
                # Sort by updatedAt descending, then by _id descending (newer ObjectIds are larger)
                docs_sorted = sorted(
                    docs,
                    key=lambda x: (x.get("updatedAt") or datetime.min, x["doc_id"]),
                    reverse=True
                )
                
                # Keep the first (most recent), delete the rest
                keep_doc = docs_sorted[0]
                delete_docs = docs_sorted[1:]
                
                print(f"      ✅ Keeping: {keep_doc['doc_id']} (updated: {keep_doc.get('updatedAt', 'N/A')})")
                
                for del_doc in delete_docs:
                    print(f"      🗑️  Removing: {del_doc['doc_id']} (updated: {del_doc.get('updatedAt', 'N/A')})")
                    
                    if not dry_run:
                        result = await db.notification_preferences.delete_one({"_id": del_doc["doc_id"]})
                        if result.deleted_count > 0:
                            duplicates_removed += 1
                    else:
                        duplicates_removed += 1  # Count what would be removed
        
        print(f"\n📊 Duplicates Summary:")
        print(f"   - Found: {duplicates_found} duplicate documents")
        print(f"   - {'Would remove' if dry_run else 'Removed'}: {duplicates_removed} documents")
        
        # Step 2: Verify no duplicates remain
        print("\n📋 Step 2: Verifying no duplicates remain...")
        remaining_dups = await db.notification_preferences.aggregate(pipeline).to_list(length=None)
        
        if remaining_dups and not dry_run:
            print(f"   ⚠️  Warning: {len(remaining_dups)} duplicates still remain!")
        else:
            print("   ✅ No duplicates remaining")
        
        # Step 3: Check existing indexes
        print("\n📋 Step 3: Checking existing indexes...")
        existing_indexes = await db.notification_preferences.index_information()
        print(f"   Found {len(existing_indexes)} existing indexes:")
        
        has_unique_username_index = False
        for idx_name, idx_info in existing_indexes.items():
            keys = idx_info.get("key", [])
            is_unique = idx_info.get("unique", False)
            print(f"   - {idx_name}: {keys} (unique: {is_unique})")
            
            # Check if username unique index exists
            if any(k[0] == "username" for k in keys) and is_unique:
                has_unique_username_index = True
                print(f"      ✅ Unique username index already exists!")
        
        # Step 4: Create unique index if it doesn't exist
        if not has_unique_username_index:
            print("\n📋 Step 4: Creating unique index on username...")
            
            if not dry_run:
                try:
                    index_name = await db.notification_preferences.create_index(
                        "username",
                        unique=True,
                        name="username_unique"
                    )
                    print(f"   ✅ Created unique index: {index_name}")
                except Exception as e:
                    if "duplicate key" in str(e).lower():
                        print(f"   ❌ Cannot create unique index - duplicates still exist!")
                        print(f"      Error: {e}")
                        print("      Please run migration again without dry_run to remove duplicates first.")
                    else:
                        raise
            else:
                print("   🧪 [DRY RUN] Would create unique index: username_unique")
        else:
            print("\n📋 Step 4: Skipped - unique index already exists")
        
        # Step 5: Final verification
        print("\n📋 Step 5: Final verification...")
        final_indexes = await db.notification_preferences.index_information()
        total_docs = await db.notification_preferences.count_documents({})
        unique_usernames = len(await db.notification_preferences.distinct("username"))
        
        print(f"   - Total documents: {total_docs}")
        print(f"   - Unique usernames: {unique_usernames}")
        print(f"   - Total indexes: {len(final_indexes)}")
        
        if total_docs == unique_usernames:
            print("   ✅ Document count matches unique username count - no duplicates!")
        else:
            print(f"   ⚠️  Mismatch: {total_docs - unique_usernames} potential duplicates remain")
        
        print("\n" + "=" * 80)
        if dry_run:
            print("🧪 DRY RUN COMPLETED - No changes were made")
            print("   Run with --execute to apply changes")
        else:
            print("✅ MIGRATION COMPLETED SUCCESSFULLY")
        print("=" * 80)
        
    except Exception as e:
        print(f"\n❌ ERROR during migration: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        client.close()
    
    return True


if __name__ == "__main__":
    # Check for --execute flag
    dry_run = "--execute" not in sys.argv
    
    if dry_run:
        print("\n⚠️  Running in DRY RUN mode (no changes will be made)")
        print("   To apply changes, run with: python cleanup_duplicate_notification_preferences.py --execute\n")
    
    success = asyncio.run(run_migration(dry_run=dry_run))
    sys.exit(0 if success else 1)
