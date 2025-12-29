#!/usr/bin/env python3
"""
Cleanup Broken/Orphaned Image Paths

This script:
1. Scans all users' images arrays
2. Checks if each image file exists on disk
3. Removes broken paths from images array
4. Updates imageVisibility to only include valid images
5. Generates a report of cleaned up paths

Usage:
    python cleanup_broken_images.py [--dry-run]
    
Options:
    --dry-run    Preview changes without modifying database
"""

import asyncio
import os
import sys
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorClient

# Configuration
MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
DB_NAME = "matrimonialDB"
UPLOADS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")

# Track statistics
stats = {
    "users_scanned": 0,
    "users_with_broken_images": 0,
    "broken_images_removed": 0,
    "users_updated": 0,
    "errors": []
}


def extract_filename(path: str) -> str:
    """Extract just the filename from any path format"""
    if not path:
        return ""
    # Handle full URLs
    if path.startswith("http"):
        if "/api/users/media/" in path:
            return path.split("/api/users/media/")[-1].split("?")[0]
        if "/uploads/" in path:
            return path.split("/uploads/")[-1].split("?")[0]
        return path.split("/")[-1].split("?")[0]
    # Handle /uploads/filename.jpg
    if "/uploads/" in path:
        return path.split("/uploads/")[-1]
    # Handle uploads/filename.jpg
    if path.startswith("uploads/"):
        return path[8:]
    # Handle /filename.jpg or filename.jpg
    return path.lstrip("/")


def file_exists(filename: str) -> bool:
    """Check if image file exists in uploads directory"""
    if not filename:
        return False
    filepath = os.path.join(UPLOADS_DIR, filename)
    return os.path.isfile(filepath)


def normalize_path(filename: str) -> str:
    """Normalize to /uploads/filename format"""
    if not filename:
        return ""
    clean = extract_filename(filename)
    return f"/uploads/{clean}" if clean else ""


async def cleanup_user_images(db, user: dict, dry_run: bool = True) -> dict:
    """Clean up broken images for a single user"""
    username = user.get("username", "unknown")
    images = user.get("images", [])
    image_visibility = user.get("imageVisibility", {})
    
    if not images:
        return None
    
    # Check each image
    valid_images = []
    broken_images = []
    
    for img_path in images:
        filename = extract_filename(img_path)
        if file_exists(filename):
            valid_images.append(normalize_path(filename))
        else:
            broken_images.append(img_path)
            stats["broken_images_removed"] += 1
    
    if not broken_images:
        return None  # No cleanup needed
    
    stats["users_with_broken_images"] += 1
    
    # Build new imageVisibility from valid images only
    new_visibility = {
        "profilePic": None,
        "memberVisible": [],
        "onRequest": []
    }
    
    # Check existing visibility and keep only valid paths
    if image_visibility:
        profile_pic = image_visibility.get("profilePic")
        if profile_pic and file_exists(extract_filename(profile_pic)):
            new_visibility["profilePic"] = normalize_path(profile_pic)
        
        for img in image_visibility.get("memberVisible", []):
            if file_exists(extract_filename(img)):
                new_visibility["memberVisible"].append(normalize_path(img))
        
        for img in image_visibility.get("onRequest", []):
            if file_exists(extract_filename(img)):
                new_visibility["onRequest"].append(normalize_path(img))
    
    # If no profile pic but we have valid images, use first one
    if not new_visibility["profilePic"] and valid_images:
        new_visibility["profilePic"] = valid_images[0]
        # Remove from memberVisible if it was there
        if valid_images[0] in new_visibility["memberVisible"]:
            new_visibility["memberVisible"].remove(valid_images[0])
    
    # Ensure all valid images are in some bucket
    all_in_visibility = set()
    if new_visibility["profilePic"]:
        all_in_visibility.add(new_visibility["profilePic"])
    all_in_visibility.update(new_visibility["memberVisible"])
    all_in_visibility.update(new_visibility["onRequest"])
    
    for img in valid_images:
        if img not in all_in_visibility:
            new_visibility["memberVisible"].append(img)
    
    result = {
        "username": username,
        "broken_images": broken_images,
        "valid_images": valid_images,
        "new_visibility": new_visibility
    }
    
    if not dry_run:
        try:
            await db.users.update_one(
                {"username": username},
                {
                    "$set": {
                        "images": valid_images,
                        "imageVisibility": new_visibility,
                        "updatedAt": datetime.utcnow().isoformat()
                    }
                }
            )
            stats["users_updated"] += 1
        except Exception as e:
            stats["errors"].append(f"{username}: {str(e)}")
    
    return result


async def main(dry_run: bool = True):
    print("=" * 60)
    print("🧹 Broken Image Cleanup Script")
    print("=" * 60)
    print(f"Mode: {'DRY RUN (no changes)' if dry_run else '⚠️  LIVE MODE (will modify database)'}")
    print(f"MongoDB: {MONGODB_URL}")
    print(f"Database: {DB_NAME}")
    print(f"Uploads Dir: {UPLOADS_DIR}")
    print()
    
    # Verify uploads directory exists
    if not os.path.isdir(UPLOADS_DIR):
        print(f"❌ Uploads directory not found: {UPLOADS_DIR}")
        return
    
    # Count files in uploads
    upload_files = os.listdir(UPLOADS_DIR)
    print(f"📁 Found {len(upload_files)} files in uploads directory")
    print()
    
    # Connect to MongoDB
    client = AsyncIOMotorClient(MONGODB_URL)
    db = client[DB_NAME]
    
    try:
        # Get all users with images
        cursor = db.users.find(
            {"images": {"$exists": True, "$ne": []}},
            {"username": 1, "images": 1, "imageVisibility": 1}
        )
        
        users = await cursor.to_list(length=None)
        print(f"👥 Found {len(users)} users with images")
        print()
        
        cleanup_results = []
        
        for user in users:
            stats["users_scanned"] += 1
            result = await cleanup_user_images(db, user, dry_run)
            if result:
                cleanup_results.append(result)
        
        # Print results
        print("=" * 60)
        print("📊 CLEANUP RESULTS")
        print("=" * 60)
        print(f"Users scanned: {stats['users_scanned']}")
        print(f"Users with broken images: {stats['users_with_broken_images']}")
        print(f"Broken images found: {stats['broken_images_removed']}")
        if not dry_run:
            print(f"Users updated: {stats['users_updated']}")
        print()
        
        if cleanup_results:
            print("📋 DETAILS:")
            print("-" * 40)
            for result in cleanup_results[:20]:  # Show first 20
                print(f"\n👤 {result['username']}:")
                print(f"   ❌ Broken: {len(result['broken_images'])}")
                for broken in result['broken_images']:
                    print(f"      - {extract_filename(broken)}")
                print(f"   ✅ Valid: {len(result['valid_images'])}")
            
            if len(cleanup_results) > 20:
                print(f"\n... and {len(cleanup_results) - 20} more users")
        
        if stats["errors"]:
            print("\n⚠️  ERRORS:")
            for error in stats["errors"]:
                print(f"   - {error}")
        
        print()
        if dry_run:
            print("💡 This was a DRY RUN. To apply changes, run:")
            print("   python cleanup_broken_images.py --apply")
        else:
            print("✅ Cleanup complete!")
        
    finally:
        client.close()


if __name__ == "__main__":
    dry_run = "--apply" not in sys.argv and "--live" not in sys.argv
    if "--help" in sys.argv or "-h" in sys.argv:
        print(__doc__)
    else:
        asyncio.run(main(dry_run=dry_run))
