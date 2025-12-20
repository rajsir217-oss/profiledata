"""
Migration: Add profileId to email templates
Date: December 19, 2025

This migration updates email templates to include the match's profileId
in the template body, making it easier for users to identify profiles.

Templates updated:
- favorited
- mutual_favorite
- shortlist_added
- profile_view
- new_message
- pii_request
- pii_granted
- message_read

Usage:
    python3 migrations/add_profileid_to_email_templates.py [local|production]
"""

import sys
import os

# Set environment before imports
if len(sys.argv) > 1:
    env = sys.argv[1].lower()
    if env in ["production", "local", "staging"]:
        os.environ["APP_ENVIRONMENT"] = env

import asyncio
import certifi
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, UTC

# Import settings after environment is set
from config import Settings

settings = Settings()

# Templates that should include profileId in the card section
TEMPLATES_WITH_PROFILE_ID = [
    "favorited",
    "mutual_favorite", 
    "shortlist_added",
    "profile_view",
    "new_message",
    "pii_request",
    "pii_granted",
    "pii_denied",
    "pii_expiring",
    "message_read",
    "new_match",
    "conversation_cold",
]

async def add_profileid_to_templates():
    """Add profileId display to email templates"""
    print("=" * 60)
    print("🔄 Adding profileId to email templates...")
    print(f"   Environment: {os.environ.get('APP_ENVIRONMENT', 'default')}")
    print(f"   Database: {settings.database_name}")
    print("=" * 60)
    
    # Connect to MongoDB
    if "mongodb+srv" in settings.mongodb_url:
        client = AsyncIOMotorClient(settings.mongodb_url, tlsCAFile=certifi.where())
    else:
        client = AsyncIOMotorClient(settings.mongodb_url)
    
    db = client[settings.database_name]
    
    try:
        # Test connection
        await db.command('ping')
        print("✅ Connected to MongoDB")
        
        updated_count = 0
        skipped_count = 0
        
        for trigger in TEMPLATES_WITH_PROFILE_ID:
            template = await db.notification_templates.find_one({
                "trigger": trigger,
                "channel": "email"
            })
            
            if not template:
                print(f"⚠️  Template not found: {trigger}")
                continue
            
            body = template.get("body", "")
            
            # Check if profileId is already in the template
            if "{match.profileId}" in body or "{match_profileId}" in body or "Profile ID:" in body:
                print(f"⏭️  Already has profileId: {trigger}")
                skipped_count += 1
                continue
            
            # Find the card section and add profileId after the description
            # Look for patterns like "</p>" followed by "</div>" in the card section
            # We'll add a small line showing the Profile ID
            
            # Pattern 1: Add after match info in card
            # Look for the closing </div> of the card and insert before it
            profile_id_line = """
                <p style="color: #666; font-size: 12px; margin-top: 10px;">
                    Profile ID: <strong>{match.profileId}</strong>
                </p>"""
            
            # Find a good insertion point - after the main description in the card
            # Most templates have a pattern like: <div class="card">...<p>DESCRIPTION</p>...</div>
            
            # Try to insert before the closing </div> of the card
            card_end_pattern = '</div>\n            \n            <center>'
            if card_end_pattern in body:
                new_body = body.replace(
                    card_end_pattern,
                    profile_id_line + '\n            </div>\n            \n            <center>'
                )
            else:
                # Alternative pattern - look for </div> followed by <center>
                alt_pattern = '</div>\n            <center>'
                if alt_pattern in body:
                    new_body = body.replace(
                        alt_pattern,
                        profile_id_line + '\n            </div>\n            <center>'
                    )
                else:
                    # Fallback: just add after the card div opening
                    # Find </p> inside card and add after
                    if '<div class="card">' in body:
                        # Find the card section
                        card_start = body.find('<div class="card">')
                        card_end = body.find('</div>', card_start)
                        if card_end > card_start:
                            # Insert before the closing </div> of the card
                            new_body = body[:card_end] + profile_id_line + body[card_end:]
                        else:
                            print(f"⚠️  Could not find insertion point for: {trigger}")
                            skipped_count += 1
                            continue
                    else:
                        print(f"⚠️  No card section found in: {trigger}")
                        skipped_count += 1
                        continue
            
            # Update the template
            result = await db.notification_templates.update_one(
                {"_id": template["_id"]},
                {
                    "$set": {
                        "body": new_body,
                        "updatedAt": datetime.now(UTC)
                    }
                }
            )
            
            if result.modified_count > 0:
                print(f"✅ Updated: {trigger}")
                updated_count += 1
            else:
                print(f"⚠️  No changes made to: {trigger}")
                skipped_count += 1
        
        print("\n" + "=" * 60)
        print("📊 Migration Summary:")
        print(f"   Templates updated: {updated_count}")
        print(f"   Templates skipped: {skipped_count}")
        print("=" * 60)
        
    except Exception as e:
        print(f"❌ Error: {e}")
        raise
    finally:
        client.close()

if __name__ == "__main__":
    asyncio.run(add_profileid_to_templates())
