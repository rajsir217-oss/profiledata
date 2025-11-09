"""
Cleanup Duplicate Email Templates
Removes duplicate templates and keeps only the most recent version
"""

import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime
import certifi

# Get MongoDB URL from environment
MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
DATABASE_NAME = "matrimonialDB"

async def cleanup_duplicates():
    """Remove duplicate email templates, keep most recent"""
    print("=" * 60)
    print("🧹 CLEANUP DUPLICATE EMAIL TEMPLATES")
    print("=" * 60)
    print(f"MongoDB URL: {MONGODB_URL[:50]}...")
    print(f"Database: {DATABASE_NAME}")
    print("=" * 60)
    
    try:
        # Connect with proper SSL certificate handling
        client = AsyncIOMotorClient(MONGODB_URL, tlsCAFile=certifi.where())
        db = client[DATABASE_NAME]
        collection = db.notification_templates
        
        # Test connection
        await db.command('ping')
        print("✅ Connected to MongoDB\n")
        
        # Get all email templates
        all_templates = await collection.find({"channel": "email"}).to_list(length=1000)
        print(f"📊 Found {len(all_templates)} total email templates\n")
        
        # Group by trigger to find duplicates
        trigger_groups = {}
        for template in all_templates:
            trigger = template.get('trigger')
            if trigger not in trigger_groups:
                trigger_groups[trigger] = []
            trigger_groups[trigger].append(template)
        
        # Find and remove duplicates
        removed = 0
        kept = 0
        
        print("🔍 Checking for duplicates...\n")
        
        for trigger, templates in trigger_groups.items():
            if len(templates) > 1:
                # Sort by updatedAt (most recent first)
                templates.sort(key=lambda x: x.get('updatedAt', x.get('createdAt', datetime.min)), reverse=True)
                
                # Keep the first (most recent), remove the rest
                keep = templates[0]
                duplicates = templates[1:]
                
                print(f"   📝 {trigger}: Found {len(templates)} copies")
                print(f"      ✅ Keeping: {keep['_id']} (updated: {keep.get('updatedAt', 'N/A')})")
                
                for dup in duplicates:
                    await collection.delete_one({"_id": dup["_id"]})
                    print(f"      ❌ Removed: {dup['_id']} (updated: {dup.get('updatedAt', 'N/A')})")
                    removed += 1
                
                kept += 1
            else:
                kept += 1
        
        # Get final count
        final_count = await collection.count_documents({"channel": "email"})
        
        print("\n" + "=" * 60)
        print("🎉 CLEANUP COMPLETE!")
        print("=" * 60)
        print(f"   ✅ Templates kept: {kept}")
        print(f"   ❌ Duplicates removed: {removed}")
        print(f"   📊 Final template count: {final_count}")
        print("=" * 60)
        
        if removed > 0:
            print("\n💡 Run the seed script again to ensure all templates have latest content")
        
        client.close()
        
    except Exception as e:
        print(f"\n❌ Cleanup failed: {e}")
        raise

if __name__ == "__main__":
    import sys
    
    # Check if running with --auto flag (for scripted execution)
    auto_mode = '--auto' in sys.argv
    
    if not auto_mode:
        print("\n⚠️  This will remove duplicate email templates from the database!")
        print(f"MongoDB: {os.getenv('MONGODB_URL', 'NOT SET')[:50]}...")
        response = input("\nContinue? (yes/no): ")
        
        if response.lower() != 'yes':
            print("❌ Cancelled")
            sys.exit(0)
    
    asyncio.run(cleanup_duplicates())
