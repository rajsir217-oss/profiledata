#!/usr/bin/env python3
"""
Test the chart aggregation pipeline directly
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timedelta

async def test_chart_aggregation():
    try:
        # Connect to MongoDB
        client = AsyncIOMotorClient("mongodb://localhost:27017")
        db = client.matrimonialDB
        collection = db.activity_logs
        
        print("🔍 Testing chart aggregation pipeline...")
        
        # Calculate date range (same as backend)
        days = 30
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=days)
        
        print(f"📅 Date range: {start_date} to {end_date}")
        
        # Test the aggregation pipeline
        pipeline = [
            {
                "$match": {
                    "timestamp": {"$gte": start_date, "$lte": end_date}
                }
            },
            {
                "$group": {
                    "_id": {
                        "date": {"$dateToString": {"format": "%Y-%m-%d", "date": "$timestamp"}},
                        "action_type": "$action_type"
                    },
                    "count": {"$sum": 1}
                }
            },
            {
                "$sort": {"_id.date": 1}
            }
        ]
        
        print("🔍 Running aggregation...")
        cursor = collection.aggregate(pipeline)
        results = await cursor.to_list(length=None)
        
        print(f"📊 Aggregation returned {len(results)} results")
        
        # Show first few results
        print("\n📋 Sample results:")
        for i, doc in enumerate(results[:5]):
            print(f"  {i+1}. Date: {doc['_id']['date']}, Action: {doc['_id']['action_type']}, Count: {doc['count']}")
        
        # Test transformation logic
        dates_set = set()
        action_data = {}
        
        for doc in results:
            date = doc["_id"]["date"]
            action_type = doc["_id"]["action_type"]
            count = doc["count"]
            
            dates_set.add(date)
            if action_type not in action_data:
                action_data[action_type] = {}
            action_data[action_type][date] = count
        
        dates = sorted(list(dates_set))
        
        # Build series
        series = {}
        for action_type, date_counts in action_data.items():
            series[action_type] = [date_counts.get(date, 0) for date in dates]
        
        # Calculate totals
        totals = []
        for date in dates:
            total = sum(action_data.get(at, {}).get(date, 0) for at in action_data)
            totals.append(total)
        
        print(f"\n📈 Transformed data:")
        print(f"  Dates: {len(dates)} ({dates[0] if dates else 'N/A'} to {dates[-1] if dates else 'N/A'})")
        print(f"  Series: {list(series.keys())}")
        print(f"  Totals sum: {sum(totals)}")
        print(f"  Sample totals: {totals[:5]}...")
        
        client.close()
        
    except Exception as e:
        print(f"❌ Error in aggregation test: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_chart_aggregation())
