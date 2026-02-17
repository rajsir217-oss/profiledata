#!/usr/bin/env python3
"""
Test age aggregation with simplified logic
"""

import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from datetime import datetime

# Load production environment
load_dotenv('fastapi_backend/.env.production')

async def test_age_aggregation():
    """Test the simplified age aggregation"""
    
    # Get MongoDB URL from production env
    mongodb_url = os.getenv('MONGODB_URL')
    database_name = os.getenv('DATABASE_NAME', 'matrimonialDB')
    
    if not mongodb_url:
        print("❌ MONGODB_URL not found in .env.production")
        return
    
    print(f"🔗 Connecting to MongoDB: {database_name}")
    
    try:
        # Connect to MongoDB
        client = AsyncIOMotorClient(mongodb_url)
        db = client[database_name]
        
        # Test connection
        await client.server_info()
        print("✅ Connected to production MongoDB")
        
        # Current date for age calculation
        now = datetime.now()
        current_year = now.year
        current_month = now.month
        
        # Simplified aggregation pipeline
        pipeline = [
            {"$match": {"accountStatus": "active"}},
            {"$addFields": {
                "calculatedAge": {
                    "$cond": {
                        "if": {"$and": [
                            {"$ne": ["$birthYear", None]},
                            {"$gt": ["$birthYear", 0]}
                        ]},
                        "then": {
                            "$subtract": [
                                {"$subtract": [current_year, "$birthYear"]},
                                {
                                    "$cond": {
                                        "if": {"$and": [
                                            {"$ne": ["$birthMonth", None]},
                                            {"$lt": [current_month, "$birthMonth"]]
                                        ]},
                                        "then": 1,
                                        "else": 0
                                    }
                                }
                            ]
                        },
                        "else": None
                    }
                },
                "normalizedGender": {"$toLower": {"$ifNull": ["$gender", "other"]}}
            }},
            {"$match": {"calculatedAge": {"$ne": None, "$gte": 18, "$lte": 100}}},
            {"$group": {
                "_id": "$calculatedAge",
                "count": {"$sum": 1},
                "maleCount": {
                    "$sum": {"$cond": [{"$eq": ["$normalizedGender", "male"]}, 1, 0]}
                },
                "femaleCount": {
                    "$sum": {"$cond": [{"$eq": ["$normalizedGender", "female"]}, 1, 0]}
                }
            }},
            {"$sort": {"_id": 1}},
            {"$limit": 20}
        ]
        
        results = await db.users.aggregate(pipeline).to_list(20)
        
        print(f"\n📊 Individual Age Distribution (first 20):")
        print("=" * 50)
        total_count = sum(r["count"] for r in results)
        
        for result in results:
            age = result["_id"]
            count = result["count"]
            male = result["maleCount"]
            female = result["femaleCount"]
            print(f"Age {age:2d}: {count:3d} users (M:{male:2d} F:{female:2d})")
        
        print(f"\n📈 Total in sample: {total_count} users")
        
        # Now test 5-year grouping
        print(f"\n📊 5-Year Age Grouping:")
        print("=" * 50)
        
        # Group the results manually
        age_groups = {}
        for result in results:
            age = result["_id"]
            count = result["count"]
            male = result["maleCount"]
            female = result["femaleCount"]
            
            # Determine age group
            if age <= 19:
                group = 18
                range_label = "18-19"
            elif age <= 24:
                group = 20
                range_label = "20-24"
            elif age <= 29:
                group = 25
                range_label = "25-29"
            elif age <= 34:
                group = 30
                range_label = "30-34"
            elif age <= 39:
                group = 35
                range_label = "35-39"
            elif age <= 44:
                group = 40
                range_label = "40-44"
            elif age <= 49:
                group = 45
                range_label = "45-49"
            else:
                group = (age // 5) * 5
                range_label = f"{group}-{group+4}"
            
            if group not in age_groups:
                age_groups[group] = {
                    "range": range_label,
                    "count": 0,
                    "maleCount": 0,
                    "femaleCount": 0
                }
            
            age_groups[group]["count"] += count
            age_groups[group]["maleCount"] += male
            age_groups[group]["femaleCount"] += female
        
        # Display grouped results
        for group in sorted(age_groups.keys()):
            data = age_groups[group]
            print(f"{data['range']:6s}: {data['count']:3d} users (M:{data['maleCount']:2d} F:{data['femaleCount']:2d})")
        
        grouped_total = sum(data["count"] for data in age_groups.values())
        print(f"\n📈 Total grouped: {grouped_total} users")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        if 'client' in locals() and client is not None:
            client.close()
            print("🔌 Disconnected from MongoDB")

if __name__ == "__main__":
    asyncio.run(test_age_aggregation())
