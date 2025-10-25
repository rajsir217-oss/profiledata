"""
MongoDB Migration Script: dob → dateOfBirth
===========================================
This script renames the 'dob' field to 'dateOfBirth' across all user documents.

Run with: python migrate_dob_to_dateofbirth.py
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime

# MongoDB connection settings
MONGODB_URL = "mongodb://localhost:27017"
DATABASE_NAME = "matrimonialDB"

async def migrate_dob_to_dateofbirth():
    """Migrate dob field to dateOfBirth in users collection"""
    
    client = AsyncIOMotorClient(MONGODB_URL)
    db = client[DATABASE_NAME]
    
    print("🔄 Starting DOB Migration...")
    print("=" * 50)
    
    # Step 1: Count documents with 'dob' field
    dob_count = await db.users.count_documents({"dob": {"$exists": True}})
    dateofbirth_count = await db.users.count_documents({"dateOfBirth": {"$exists": True}})
    
    print(f"\n📊 Current State:")
    print(f"   Documents with 'dob': {dob_count}")
    print(f"   Documents with 'dateOfBirth': {dateofbirth_count}")
    
    # Step 2: Migrate documents that have ONLY 'dob' (not dateOfBirth)
    print(f"\n🔄 Migrating documents with only 'dob'...")
    
    result = await db.users.update_many(
        {
            "dob": {"$exists": True},
            "dateOfBirth": {"$exists": False}
        },
        [
            {"$set": {"dateOfBirth": "$dob"}}
        ]
    )
    
    print(f"   ✅ Copied 'dob' → 'dateOfBirth': {result.modified_count} documents")
    
    # Step 3: For documents with BOTH fields, keep dateOfBirth and remove dob
    print(f"\n🔄 Cleaning up documents with both fields...")
    
    # First, check if any documents have conflicting values
    cursor = db.users.find({
        "dob": {"$exists": True},
        "dateOfBirth": {"$exists": True}
    })
    
    conflicts = []
    async for doc in cursor:
        if doc.get("dob") != doc.get("dateOfBirth"):
            conflicts.append({
                "username": doc.get("username"),
                "dob": doc.get("dob"),
                "dateOfBirth": doc.get("dateOfBirth")
            })
    
    if conflicts:
        print(f"\n⚠️  WARNING: Found {len(conflicts)} documents with conflicting values:")
        for c in conflicts[:5]:  # Show first 5
            print(f"      {c['username']}: dob={c['dob']} vs dateOfBirth={c['dateOfBirth']}")
        if len(conflicts) > 5:
            print(f"      ... and {len(conflicts) - 5} more")
        
        print(f"\n   Keeping 'dateOfBirth' value (newer field)")
    
    # Step 4: Remove 'dob' field from all documents
    print(f"\n🗑️  Removing old 'dob' field...")
    
    result = await db.users.update_many(
        {"dob": {"$exists": True}},
        {"$unset": {"dob": ""}}
    )
    
    print(f"   ✅ Removed 'dob' field from {result.modified_count} documents")
    
    # Step 5: Verify migration
    print(f"\n✅ Verifying migration...")
    
    dob_remaining = await db.users.count_documents({"dob": {"$exists": True}})
    dateofbirth_final = await db.users.count_documents({"dateOfBirth": {"$exists": True}})
    
    print(f"\n📊 Final State:")
    print(f"   Documents with 'dob': {dob_remaining}")
    print(f"   Documents with 'dateOfBirth': {dateofbirth_final}")
    
    # Step 6: Create index on dateOfBirth for faster queries
    print(f"\n📑 Creating index on 'dateOfBirth'...")
    await db.users.create_index("dateOfBirth")
    print(f"   ✅ Index created")
    
    print(f"\n" + "=" * 50)
    print(f"🎉 Migration Complete!")
    print(f"   - Migrated: {result.modified_count} documents")
    print(f"   - Conflicts resolved: {len(conflicts)}")
    print(f"   - Final count: {dateofbirth_final} users with dateOfBirth")
    
    client.close()

if __name__ == "__main__":
    print("\n" + "=" * 50)
    print("MongoDB Migration: dob → dateOfBirth")
    print("=" * 50)
    print("\nThis will:")
    print("  1. Copy 'dob' → 'dateOfBirth' where missing")
    print("  2. Remove old 'dob' field")
    print("  3. Create index on 'dateOfBirth'")
    
    confirm = input("\n⚠️  Continue? (yes/no): ")
    
    if confirm.lower() == 'yes':
        asyncio.run(migrate_dob_to_dateofbirth())
    else:
        print("\n❌ Migration cancelled")
