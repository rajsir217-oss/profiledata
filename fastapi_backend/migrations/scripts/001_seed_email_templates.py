"""
Migration: Seed Initial Email Templates
Created: 2025-11-07
Description: Seeds 21 notification email templates for the dating app
"""

import sys
import os
from pathlib import Path

# Add parent directory for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))
import seed_email_templates

async def up(db):
    """
    Seed email templates into notification_templates collection
    """
    print("      📧 Seeding 21 email templates...")
    
    templates = seed_email_templates.EMAIL_TEMPLATES
    collection = db.notification_templates
    
    inserted = 0
    updated = 0
    
    for template in templates:
        # Check if exists
        existing = await collection.find_one({"trigger": template["trigger"]})
        
        if existing:
            # Update existing
            await collection.update_one(
                {"trigger": template["trigger"]},
                {"$set": template}
            )
            updated += 1
        else:
            # Insert new
            await collection.insert_one(template)
            inserted += 1
    
    print(f"      ✅ Inserted: {inserted}, Updated: {updated}")
    return True


async def down(db):
    """
    Rollback: Remove seeded templates
    """
    print("      🔙 Rolling back email templates...")
    
    templates = seed_email_templates.EMAIL_TEMPLATES
    collection = db.notification_templates
    
    triggers = [t["trigger"] for t in templates]
    result = await collection.delete_many({"trigger": {"$in": triggers}})
    
    print(f"      ✅ Removed {result.deleted_count} templates")
    return True
