#!/usr/bin/env python3
"""
Diagnostic script to check activity logs in production
"""
import asyncio
import sys
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timedelta

async def check_activity_logs():
    try:
        # Connect to MongoDB (adjust connection string as needed)
        client = AsyncIOMotorClient("mongodb://localhost:27017")
        db = client.matrimonialDB
        
        print("🔍 Checking activity logs collection...")
        
        # Check if collection exists
        collections = await db.list_collection_names()
        if "activity_logs" not in collections:
            print("❌ activity_logs collection does not exist!")
            return
        
        collection = db.activity_logs
        
        # Count total logs
        total_count = await collection.count_documents({})
        print(f"📊 Total activity logs: {total_count}")
        
        # Count logs in last 30 days
        thirty_days_ago = datetime.utcnow() - timedelta(days=30)
        recent_count = await collection.count_documents({
            "timestamp": {"$gte": thirty_days_ago}
        })
        print(f"📊 Logs in last 30 days: {recent_count}")
        
        # Get sample of recent logs
        recent_logs = await collection.find(
            {"timestamp": {"$gte": thirty_days_ago}}
        ).sort("timestamp", -1).limit(5).to_list(None)
        
        print("\n📋 Recent activity logs (last 5):")
        for log in recent_logs:
            print(f"  {log.get('timestamp')} - {log.get('username')} - {log.get('action_type')}")
        
        # Check logs by action type
        pipeline = [
            {"$match": {"timestamp": {"$gte": thirty_days_ago}}},
            {"$group": {"_id": "$action_type", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}}
        ]
        
        action_counts = await collection.aggregate(pipeline).to_list(None)
        print("\n📈 Activity types in last 30 days:")
        for item in action_counts:
            print(f"  {item['_id']}: {item['count']}")
        
        # Check if there are any logs at all
        if total_count == 0:
            print("\n❌ No activity logs found in database!")
            print("🔧 Possible causes:")
            print("  1. Activity logger not initialized properly")
            print("  2. Batch processing not flushing")
            print("  3. Activities not being logged")
            print("  4. Database connection issues")
        elif recent_count == 0:
            print("\n⚠️ No recent activity logs (last 30 days)!")
            print("🔧 Possible causes:")
            print("  1. Activity logging stopped working recently")
            print("  2. All logs expired (TTL index)")
            print("  3. No user activity in last 30 days")
        
        client.close()
        
    except Exception as e:
        print(f"❌ Error checking activity logs: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(check_activity_logs())
