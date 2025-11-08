"""
Seed Production Email Templates
One-time script to populate production MongoDB with email templates
"""

import asyncio
import os
import sys
from motor.motor_asyncio import AsyncIOMotorClient
from config import Settings

# Force production environment
os.environ['APP_ENVIRONMENT'] = 'production'

settings = Settings()

# Import templates from seed_email_templates
sys.path.insert(0, os.path.dirname(__file__))
import seed_email_templates
EMAIL_TEMPLATES = seed_email_templates.EMAIL_TEMPLATES

async def seed_production():
    print("=" * 60)
    print("SEEDING PRODUCTION EMAIL TEMPLATES")
    print("=" * 60)
    print(f"\nMongoDB URL: {settings.mongodb_url[:50]}...")
    print(f"Database: {settings.database_name}")
    
    # Confirm before proceeding
    response = input("\n⚠️  This will seed templates to PRODUCTION. Continue? (yes/no): ")
    if response.lower() != 'yes':
        print("❌ Aborted")
        return
    
    # Connect to MongoDB
    client = AsyncIOMotorClient(settings.mongodb_url)
    db = client[settings.database_name]
    
    print("\n📊 Checking existing templates...")
    existing_count = await db.notification_templates.count_documents({"channel": "email"})
    print(f"   Found {existing_count} email templates")
    
    # Seed email templates
    print(f"\n📧 Seeding {len(EMAIL_TEMPLATES)} email templates...")
    seeded = 0
    updated = 0
    
    for template in EMAIL_TEMPLATES:
        existing = await db.notification_templates.find_one({"trigger": template["trigger"]})
        
        if existing:
            # Update existing
            await db.notification_templates.update_one(
                {"trigger": template["trigger"]},
                {"$set": template}
            )
            print(f"   ✅ Updated: {template['trigger']}")
            updated += 1
        else:
            # Insert new
            await db.notification_templates.insert_one(template)
            print(f"   ✅ Created: {template['trigger']}")
            seeded += 1
    
    print("\n" + "=" * 60)
    print(f"✅ SEEDING COMPLETE")
    print(f"   New templates: {seeded}")
    print(f"   Updated templates: {updated}")
    print(f"   Total email templates: {await db.notification_templates.count_documents({'channel': 'email'})}")
    print("=" * 60)
    
    client.close()

if __name__ == "__main__":
    asyncio.run(seed_production())
