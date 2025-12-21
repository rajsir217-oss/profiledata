#!/usr/bin/env python3
"""
Migration: Make Profile ID clickable in email templates

This migration updates existing email templates to make the Profile ID
a clickable link that takes users to the profile page.

Run with: python migrations/fix_profileid_clickable.py
"""

import asyncio
import os
import sys

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from motor.motor_asyncio import AsyncIOMotorClient
from config import settings


async def run_migration():
    """Update all email templates to make Profile ID clickable"""
    
    print("=" * 60)
    print("Migration: Make Profile ID Clickable in Email Templates")
    print("=" * 60)
    
    # Connect to MongoDB
    client = AsyncIOMotorClient(settings.mongodb_url)
    db = client[settings.database_name]
    
    try:
        # Find all templates with the old format
        old_format = 'Profile ID: <strong>{match.profileId}</strong>'
        new_format = 'Profile ID: <a href="{profile_url}" style="color: #667eea; font-weight: bold; text-decoration: none;">{match.profileId}</a>'
        
        # Count templates to update
        templates = await db.notification_templates.find({
            "body": {"$regex": old_format.replace("{", "\\{").replace("}", "\\}")}
        }).to_list(length=None)
        
        print(f"\n📧 Found {len(templates)} templates with old Profile ID format")
        
        updated_count = 0
        for template in templates:
            trigger = template.get("trigger", "unknown")
            body = template.get("body", "")
            
            if old_format in body:
                new_body = body.replace(old_format, new_format)
                
                await db.notification_templates.update_one(
                    {"_id": template["_id"]},
                    {"$set": {"body": new_body}}
                )
                
                print(f"  ✅ Updated: {trigger}")
                updated_count += 1
            else:
                print(f"  ⏭️  Skipped (no match): {trigger}")
        
        print(f"\n🎉 Migration complete!")
        print(f"   Updated: {updated_count} templates")
        print(f"   Skipped: {len(templates) - updated_count} templates")
        
    except Exception as e:
        print(f"\n❌ Migration failed: {e}")
        raise
    finally:
        client.close()


if __name__ == "__main__":
    asyncio.run(run_migration())
