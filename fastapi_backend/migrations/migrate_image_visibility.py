#!/usr/bin/env python3
"""
Migration Script: Image Visibility System
==========================================
Migrates existing users from publicImages to the new 3-bucket imageVisibility system.

Migration Rules:
1. profilePic = images[0] (first image)
2. memberVisible = images[1:] (remaining images - ALL become member visible)
3. onRequest = [] (empty by default)
4. REMOVE publicImages field
5. CLEANUP pii_access records with accessType="images"

Usage:
    python migrate_image_visibility.py [--dry-run] [--cleanup-pii]

Options:
    --dry-run       Show what would be changed without making changes
    --cleanup-pii   Also cleanup old pii_access records with accessType="images"
"""

import asyncio
import sys
import os
from datetime import datetime

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from motor.motor_asyncio import AsyncIOMotorClient
from config import Settings

settings = Settings()


async def migrate_image_visibility(dry_run: bool = False, cleanup_pii: bool = False):
    """Migrate users to new imageVisibility system."""
    
    print("=" * 60)
    print("Image Visibility Migration")
    print("=" * 60)
    print(f"Mode: {'DRY RUN' if dry_run else 'LIVE'}")
    print(f"Cleanup PII Access: {cleanup_pii}")
    print(f"Database: {settings.mongodb_url}")
    print("=" * 60)
    
    # Connect to MongoDB
    client = AsyncIOMotorClient(settings.mongodb_url)
    db = client[settings.database_name]
    
    try:
        # Find all users with images
        users_with_images = await db.users.find(
            {"images": {"$exists": True, "$ne": []}},
            {"username": 1, "images": 1, "publicImages": 1, "imageVisibility": 1}
        ).to_list(None)
        
        print(f"\nFound {len(users_with_images)} users with images")
        
        migrated_count = 0
        skipped_count = 0
        error_count = 0
        
        for user in users_with_images:
            username = user.get("username")
            images = user.get("images", [])
            existing_visibility = user.get("imageVisibility")
            
            # Skip if already migrated
            if existing_visibility:
                print(f"  ⏭️  {username}: Already migrated, skipping")
                skipped_count += 1
                continue
            
            # Build new imageVisibility
            profile_pic = images[0] if images else None
            member_visible = images[1:] if len(images) > 1 else []
            on_request = []
            
            image_visibility = {
                "profilePic": profile_pic,
                "memberVisible": member_visible,
                "onRequest": on_request
            }
            
            print(f"  📸 {username}:")
            print(f"      Profile Pic: {profile_pic}")
            print(f"      Member Visible: {len(member_visible)} images")
            print(f"      On Request: {len(on_request)} images")
            
            if not dry_run:
                try:
                    # Update user with new imageVisibility and remove publicImages
                    await db.users.update_one(
                        {"username": username},
                        {
                            "$set": {
                                "imageVisibility": image_visibility,
                                "updatedAt": datetime.utcnow().isoformat()
                            },
                            "$unset": {"publicImages": ""}
                        }
                    )
                    migrated_count += 1
                    print(f"      ✅ Migrated successfully")
                except Exception as e:
                    error_count += 1
                    print(f"      ❌ Error: {e}")
            else:
                migrated_count += 1
                print(f"      🔍 Would migrate (dry run)")
        
        print("\n" + "=" * 60)
        print("Migration Summary")
        print("=" * 60)
        print(f"Total users with images: {len(users_with_images)}")
        print(f"Migrated: {migrated_count}")
        print(f"Skipped (already migrated): {skipped_count}")
        print(f"Errors: {error_count}")
        
        # Cleanup PII access records if requested
        if cleanup_pii:
            print("\n" + "=" * 60)
            print("PII Access Cleanup")
            print("=" * 60)
            
            # Count records to delete
            pii_count = await db.pii_access.count_documents({"accessType": "images"})
            print(f"Found {pii_count} pii_access records with accessType='images'")
            
            if not dry_run and pii_count > 0:
                result = await db.pii_access.delete_many({"accessType": "images"})
                print(f"✅ Deleted {result.deleted_count} pii_access records")
            elif dry_run and pii_count > 0:
                print(f"🔍 Would delete {pii_count} records (dry run)")
        
        print("\n" + "=" * 60)
        print("Migration Complete!")
        print("=" * 60)
        
    finally:
        client.close()


async def rollback_migration(dry_run: bool = False):
    """Rollback migration - restore publicImages from imageVisibility."""
    
    print("=" * 60)
    print("Image Visibility Rollback")
    print("=" * 60)
    print(f"Mode: {'DRY RUN' if dry_run else 'LIVE'}")
    print("=" * 60)
    
    client = AsyncIOMotorClient(settings.mongodb_url)
    db = client[settings.database_name]
    
    try:
        # Find all users with imageVisibility
        users_with_visibility = await db.users.find(
            {"imageVisibility": {"$exists": True}},
            {"username": 1, "images": 1, "imageVisibility": 1}
        ).to_list(None)
        
        print(f"\nFound {len(users_with_visibility)} users with imageVisibility")
        
        for user in users_with_visibility:
            username = user.get("username")
            visibility = user.get("imageVisibility", {})
            
            # Restore publicImages from memberVisible
            member_visible = visibility.get("memberVisible", [])
            profile_pic = visibility.get("profilePic")
            
            # publicImages = profilePic + memberVisible (all visible images)
            public_images = []
            if profile_pic:
                public_images.append(profile_pic)
            public_images.extend(member_visible)
            
            print(f"  📸 {username}: Restoring {len(public_images)} publicImages")
            
            if not dry_run:
                await db.users.update_one(
                    {"username": username},
                    {
                        "$set": {"publicImages": public_images},
                        "$unset": {"imageVisibility": ""}
                    }
                )
                print(f"      ✅ Rolled back")
            else:
                print(f"      🔍 Would rollback (dry run)")
        
        print("\nRollback complete!")
        
    finally:
        client.close()


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Migrate to new image visibility system")
    parser.add_argument("--dry-run", action="store_true", help="Show changes without applying")
    parser.add_argument("--cleanup-pii", action="store_true", help="Cleanup old pii_access records")
    parser.add_argument("--rollback", action="store_true", help="Rollback migration")
    
    args = parser.parse_args()
    
    if args.rollback:
        asyncio.run(rollback_migration(dry_run=args.dry_run))
    else:
        asyncio.run(migrate_image_visibility(dry_run=args.dry_run, cleanup_pii=args.cleanup_pii))
