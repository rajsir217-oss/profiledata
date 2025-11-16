#!/usr/bin/env python3
"""
Migration: Fix createdAt fields stored as ISO strings
Convert to proper datetime objects for MongoDB date queries

Collections affected:
- favorites
- shortlists
- exclusions
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
import sys
from datetime import datetime
from dotenv import load_dotenv

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

load_dotenv('.env.local')

async def fix_collection(db, collection_name: str):
    """Fix createdAt field in a collection"""
    collection = db[collection_name]
    
    print(f"\n🔧 Fixing {collection_name}...")
    print("=" * 60)
    
    # Find all documents with string createdAt
    cursor = collection.find({"createdAt": {"$type": "string"}})
    documents = await cursor.to_list(None)
    
    if not documents:
        print(f"   ✅ No string dates found in {collection_name}")
        return 0
    
    print(f"   Found {len(documents)} documents with string dates")
    
    fixed_count = 0
    error_count = 0
    
    for doc in documents:
        try:
            # Parse ISO string to datetime
            created_at_str = doc["createdAt"]
            
            # Handle ISO format with or without microseconds
            if "." in created_at_str:
                # Has microseconds: 2025-11-16T02:37:53.105211
                created_at_dt = datetime.fromisoformat(created_at_str)
            else:
                # No microseconds: 2025-11-16T02:37:53
                created_at_dt = datetime.fromisoformat(created_at_str)
            
            # Update document
            result = await collection.update_one(
                {"_id": doc["_id"]},
                {"$set": {"createdAt": created_at_dt}}
            )
            
            if result.modified_count > 0:
                fixed_count += 1
                
        except Exception as e:
            error_count += 1
            print(f"   ⚠️  Error fixing document {doc['_id']}: {e}")
    
    print(f"   ✅ Fixed {fixed_count} documents")
    if error_count > 0:
        print(f"   ⚠️  {error_count} errors")
    
    return fixed_count

async def main():
    print("=" * 60)
    print("🔄 DateTime Migration Script")
    print("=" * 60)
    print("\nFixing createdAt fields stored as ISO strings...")
    print("Converting to datetime objects for proper MongoDB queries\n")
    
    client = AsyncIOMotorClient(os.getenv("MONGODB_URL"))
    db = client.matrimonialDB
    
    try:
        # Fix each collection
        total_fixed = 0
        
        total_fixed += await fix_collection(db, "favorites")
        total_fixed += await fix_collection(db, "shortlists")
        total_fixed += await fix_collection(db, "exclusions")
        
        print("\n" + "=" * 60)
        print(f"\n✅ Migration complete!")
        print(f"   Total documents fixed: {total_fixed}")
        print("\n💡 New records will automatically use datetime objects")
        print("   Dashboard should now show 'Favorited By' count correctly!\n")
        print("=" * 60)
        
    except Exception as e:
        print(f"\n❌ Migration failed: {e}")
        import traceback
        traceback.print_exc()
    finally:
        client.close()

if __name__ == "__main__":
    asyncio.run(main())
