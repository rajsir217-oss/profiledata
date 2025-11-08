"""
Seed Missing Email Templates for Notification System
Creates 15 additional email templates to complete the notification system
Priority 1: High Impact (5), Priority 2: Medium Impact (6), Priority 3: Nice to Have (4)
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime
from email_templates_priority1 import get_priority1_templates

# MongoDB connection
MONGODB_URL = "mongodb://localhost:27017"
DATABASE_NAME = "matrimonialDB"

# Priority 1: High Impact Templates (5)
PRIORITY_1_TEMPLATES = get_priority1_templates()

# Priority 2: Medium Impact Templates (6)  
PRIORITY_2_TEMPLATES = []  # TODO: Create priority 2 templates

# Priority 3: Nice to Have Templates (4)
PRIORITY_3_TEMPLATES = []  # TODO: Create priority 3 templates

# Combined list (starting with Priority 1 only for now)
EMAIL_TEMPLATES = PRIORITY_1_TEMPLATES + PRIORITY_2_TEMPLATES + PRIORITY_3_TEMPLATES


async def seed_templates():
    """Seed missing email templates into MongoDB"""
    client = AsyncIOMotorClient(MONGODB_URL)
    db = client[DATABASE_NAME]
    collection = db.notification_templates
    
    print(f"🔌 Connected to MongoDB: {DATABASE_NAME}")
    print(f"📧 Seeding {len(EMAIL_TEMPLATES)} missing email templates...")
    
    inserted_count = 0
    skipped_count = 0
    
    for template in EMAIL_TEMPLATES:
        # Check if template already exists
        existing = await collection.find_one({"trigger": template["trigger"]})
        
        if existing:
            print(f"⏭️  Skipped: {template['trigger']} (already exists)")
            skipped_count += 1
        else:
            await collection.insert_one(template)
            print(f"✅ Inserted: {template['trigger']} ({template['category']}, {template['priority']})")
            inserted_count += 1
    
    print(f"\n🎉 Seeding complete!")
    print(f"   ✅ Inserted: {inserted_count}")
    print(f"   ⏭️  Skipped: {skipped_count}")
    print(f"   📊 Total: {len(EMAIL_TEMPLATES)}")
    
    # Show summary by category
    from collections import Counter
    categories = Counter(t['category'] for t in EMAIL_TEMPLATES)
    print(f"\n📊 Templates by category:")
    for category, count in categories.items():
        print(f"   {category}: {count}")
    
    client.close()


if __name__ == "__main__":
    print("=" * 60)
    print("EMAIL TEMPLATE SEEDING SCRIPT")
    print("=" * 60)
    asyncio.run(seed_templates())
