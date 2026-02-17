#!/usr/bin/env python3
"""
Debug age data in production database
"""

import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from datetime import datetime

# Load production environment
load_dotenv('fastapi_backend/.env.production')

async def debug_age_data():
    """Debug age data issues"""
    
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
        
        # Check total users
        total_users = await db.users.count_documents({})
        print(f"\n📊 Total users in database: {total_users}")
        
        # Check active users
        active_users = await db.users.count_documents({"accountStatus": "active"})
        print(f"📊 Active users: {active_users}")
        
        # Check users with birthYear
        users_with_birth_year = await db.users.count_documents({
            "accountStatus": "active",
            "birthYear": {"$ne": None, "$gt": 0}
        })
        print(f"📊 Active users with birthYear: {users_with_birth_year}")
        
        # Check users with both birthYear and birthMonth
        users_with_full_birth = await db.users.count_documents({
            "accountStatus": "active",
            "birthYear": {"$ne": None, "$gt": 0},
            "birthMonth": {"$ne": None, "$gt": 0, "$lte": 12}
        })
        print(f"📊 Active users with complete birth data: {users_with_full_birth}")
        
        # Sample some users to see actual data
        print(f"\n🔍 Sample user birth data:")
        print("=" * 60)
        
        sample_users_cursor = db.users.find(
            {"accountStatus": "active"},
            {"username": 1, "birthYear": 1, "birthMonth": 1, "age": 1}
        ).limit(10)
        sample_users = await sample_users_cursor.to_list(10)
        
        current_year = datetime.now().year
        current_month = datetime.now().month
        
        for i, user in enumerate(sample_users, 1):
            username = user.get("username", "unknown")
            birth_year = user.get("birthYear")
            birth_month = user.get("birthMonth")
            stored_age = user.get("age")
            
            # Calculate age
            calculated_age = None
            if birth_year and birth_year > 0:
                calculated_age = current_year - birth_year
                if birth_month and birth_month > 0 and current_month < birth_month:
                    calculated_age -= 1
            
            print(f"{i}. {username}")
            print(f"   Birth Year: {birth_year}, Birth Month: {birth_month}")
            print(f"   Stored Age: {stored_age}, Calculated Age: {calculated_age}")
            print()
        
        # Test the aggregation pipeline step by step
        print(f"🧪 Testing aggregation pipeline:")
        print("=" * 60)
        
        # Step 1: Match active users
        pipeline_step1 = {"$match": {"accountStatus": "active"}}
        step1_result = await db.users.aggregate([pipeline_step1]).to_list(5)
        print(f"Step 1 - Active users: {len(await db.users.aggregate([pipeline_step1]).to_list(None))}")
        
        # Step 2: Add calculated age field
        pipeline_step2 = {
            "$addFields": {
                "calculatedAge": {
                    "$cond": {
                        "if": {
                            "$and": [
                                {"$ne": ["$birthYear", None]},
                                {"$gt": ["$birthYear", 0]}
                            ]
                        },
                        "then": {
                            "$subtract": [
                                {"$subtract": [current_year, "$birthYear"]},
                                {
                                    "$cond": {
                                        "if": {
                                            "$and": [
                                                {"$ne": ["$birthMonth", None]},
                                                {"$lt": [current_month, "$birthMonth"]}
                                            ]
                                        },
                                        "then": 1,
                                        "else": 0
                                    }
                                }
                            ]
                        },
                        "else": None
                    }
                }
            }
        }
        
        step2_result = await db.users.aggregate([pipeline_step1, pipeline_step2]).to_list(5)
        print(f"Step 2 - Users with calculated age: {len(await db.users.aggregate([pipeline_step1, pipeline_step2]).to_list(None))}")
        
        if step2_result:
            sample_user = step2_result[0]
            print(f"   Sample calculated age: {sample_user.get('calculatedAge')}")
        
        # Step 3: Filter valid ages
        pipeline_step3 = {"$match": {"calculatedAge": {"$ne": None, "$gte": 18, "$lte": 100}}}
        step3_result = await db.users.aggregate([pipeline_step1, pipeline_step2, pipeline_step3]).to_list(None)
        print(f"Step 3 - Users with valid age (18-100): {len(step3_result)}")
        
        if step3_result:
            age_dist = {}
            for user in step3_result[:20]:  # Sample first 20
                age = user.get("calculatedAge")
                age_dist[age] = age_dist.get(age, 0) + 1
            print(f"   Sample age distribution: {dict(sorted(age_dist.items())[:10])}")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        if 'client' in locals() and client is not None:
            await client.close()
            print("🔌 Disconnected from MongoDB")

if __name__ == "__main__":
    asyncio.run(debug_age_data())
