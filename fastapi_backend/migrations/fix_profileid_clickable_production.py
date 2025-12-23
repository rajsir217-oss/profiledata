#!/usr/bin/env python3
"""
Migration: Make Profile ID clickable in email templates (PRODUCTION)

This migration updates existing email templates to make the Profile ID
a clickable link that takes users to the profile page.

Run on production with: ENV=production python migrations/fix_profileid_clickable_production.py
"""

import asyncio
import os
import sys
import re

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Force production environment
os.environ['ENV'] = 'production'

from motor.motor_asyncio import AsyncIOMotorClient
from config import settings


# The correct clickable format
CLICKABLE_FORMAT = 'Profile ID: <a href="{profile_url}" style="color: #667eea; font-weight: bold; text-decoration: none;">{match.profileId}</a>'

# Various old formats that need to be replaced
OLD_FORMATS = [
    # Format 1: Bold but not clickable
    'Profile ID: <strong>{match.profileId}</strong>',
    # Format 2: Plain text with match.profileId
    'Profile ID: {match.profileId}',
    # Format 3: With span styling but not clickable
    r'Profile ID:\s*<span[^>]*>\{match\.profileId\}</span>',
]


async def run_migration():
    """Update all email templates to make Profile ID clickable"""
    
    print("=" * 60)
    print("Migration: Make Profile ID Clickable in Email Templates")
    print(f"Environment: {os.environ.get('ENV', 'unknown')}")
    print(f"Database: {settings.database_name}")
    print("=" * 60)
    
    # Connect to MongoDB
    client = AsyncIOMotorClient(settings.mongodb_url)
    db = client[settings.database_name]
    
    try:
        # Get ALL templates that contain profileId
        all_templates = await db.notification_templates.find({
            "body": {"$regex": "profileId", "$options": "i"}
        }).to_list(length=None)
        
        print(f"\n📧 Found {len(all_templates)} templates containing profileId")
        
        updated_count = 0
        skipped_count = 0
        already_clickable = 0
        
        for template in all_templates:
            trigger = template.get("trigger", "unknown")
            body = template.get("body", "")
            
            # Skip if already has clickable format
            if 'href="{profile_url}"' in body and '{match.profileId}</a>' in body:
                print(f"  ✓ Already clickable: {trigger}")
                already_clickable += 1
                continue
            
            new_body = body
            was_updated = False
            
            # Try each old format
            for old_format in OLD_FORMATS:
                if '{' in old_format and '}' in old_format and not old_format.startswith('r'):
                    # Simple string replacement
                    if old_format in new_body:
                        new_body = new_body.replace(old_format, CLICKABLE_FORMAT)
                        was_updated = True
                        break
                else:
                    # Regex replacement
                    pattern = old_format.replace(r'\{', '{').replace(r'\}', '}')
                    if re.search(pattern, new_body):
                        new_body = re.sub(pattern, CLICKABLE_FORMAT, new_body)
                        was_updated = True
                        break
            
            # Also check for plain "Profile ID: {match.profileId}" without any wrapper
            plain_pattern = r'Profile ID:\s*\{match\.profileId\}'
            if not was_updated and re.search(plain_pattern, new_body):
                new_body = re.sub(plain_pattern, CLICKABLE_FORMAT, new_body)
                was_updated = True
            
            if was_updated:
                await db.notification_templates.update_one(
                    {"_id": template["_id"]},
                    {"$set": {"body": new_body}}
                )
                print(f"  ✅ Updated: {trigger}")
                updated_count += 1
            else:
                print(f"  ⏭️  Skipped (no matching pattern): {trigger}")
                skipped_count += 1
        
        print(f"\n🎉 Migration complete!")
        print(f"   Already clickable: {already_clickable} templates")
        print(f"   Updated: {updated_count} templates")
        print(f"   Skipped: {skipped_count} templates")
        
    except Exception as e:
        print(f"\n❌ Migration failed: {e}")
        raise
    finally:
        client.close()


if __name__ == "__main__":
    asyncio.run(run_migration())
