#!/usr/bin/env python3
"""
Simple test to check if basic deletion works
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from datetime import datetime, timedelta
import os

load_dotenv()

async def test_simple_deletion():
    """Test basic deletion without archiving"""
    
    # Connect to MongoDB
    client = AsyncIOMotorClient(os.getenv('MONGODB_URL', 'mongodb://localhost:27017'))
    db = client.matrimonialDB
    
    try:
        print("🧪 Testing simple deletion...")
        
        # Check total count
        total_count = await db.contribution_activity.count_documents({})
        print(f"📊 Total records: {total_count}")
        
        # Get cutoff date (9 days ago like the job)
        cutoff_date = datetime.utcnow() - timedelta(days=9)
        print(f"📅 Cutoff date: {cutoff_date}")
        
        # Count old records
        old_count = await db.contribution_activity.count_documents({
            "timestamp": {"$lt": cutoff_date}
        })
        print(f"📊 Old records to delete: {old_count}")
        
        if old_count == 0:
            print("✅ No old records to delete")
            return
        
        # Get a sample document to check ID type
        sample = await db.contribution_activity.find_one({
            "timestamp": {"$lt": cutoff_date}
        })
        
        if sample:
            print(f"📝 Sample document ID: {sample['_id']} (type: {type(sample['_id'])})")
            print(f"📝 Sample timestamp: {sample['timestamp']}")
        
        # Try to delete just one record first
        print("\n🗑️  Deleting one record as test...")
        one_result = await db.contribution_activity.delete_one({
            "_id": sample["_id"]
        })
        print(f"✅ Deleted: {one_result.deleted_count} record")
        
        # Count again
        remaining_old = await db.contribution_activity.count_documents({
            "timestamp": {"$lt": cutoff_date}
        })
        print(f"📊 Remaining old records: {remaining_old}")
        
        # If that worked, delete the rest
        if one_result.deleted_count > 0:
            print("\n🗑️  Deleting remaining records...")
            delete_result = await db.contribution_activity.delete_many({
                "timestamp": {"$lt": cutoff_date}
            })
            print(f"✅ Deleted: {delete_result.deleted_count} records")
        
        # Final count
        final_count = await db.contribution_activity.count_documents({})
        print(f"\n📊 Final total records: {final_count}")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        client.close()

if __name__ == "__main__":
    asyncio.run(test_simple_deletion())
