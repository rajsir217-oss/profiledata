#!/usr/bin/env python3
"""
Check what dates we actually have activity logs for
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timedelta

async def check_activity_dates():
    try:
        # Connect to MongoDB
        client = AsyncIOMotorClient("mongodb://localhost:27017")
        db = client.matrimonialDB
        collection = db.activity_logs
        
        print("🔍 Checking activity log dates...")
        
        # Get all distinct dates
        pipeline = [
            {
                "$project": {
                    "date": {"$dateToString": {"format": "%Y-%m-%d", "date": "$timestamp"}}
                }
            },
            {
                "$group": {
                    "_id": "$date",
                    "count": {"$sum": 1}
                }
            },
            {
                "$sort": {"_id": 1}
            }
        ]
        
        cursor = collection.aggregate(pipeline)
        results = await cursor.to_list(length=None)
        
        print(f"📊 Found activity logs for {len(results)} different dates:")
        for result in results:
            print(f"  {result['_id']}: {result['count']} logs")
        
        # Check earliest and latest timestamps
        earliest = await collection.find_one({}, sort=[("timestamp", 1)])
        latest = await collection.find_one({}, sort=[("timestamp", -1)])
        
        if earliest and latest:
            print(f"\n📅 Time range:")
            print(f"  Earliest: {earliest['timestamp']}")
            print(f"  Latest: {latest['timestamp']}")
            
            # Test different intervals
            intervals = [7, 30, 90, 365]
            print(f"\n🔍 Testing intervals:")
            
            for days in intervals:
                end_date = datetime.utcnow()
                start_date = end_date - timedelta(days=days)
                
                count = await collection.count_documents({
                    "timestamp": {"$gte": start_date, "$lte": end_date}
                })
                
                print(f"  {days} days ({start_date.date()} to {end_date.date()}): {count} logs")
        
        client.close()
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(check_activity_dates())
