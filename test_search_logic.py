#!/usr/bin/env python3
"""
Test the search logic directly
"""

import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import certifi

async def test_search_logic():
    """Test search logic directly against database"""
    
    # Load production environment
    load_dotenv('.env.production')
    mongodb_url = os.getenv('MONGODB_URL')
    
    print("🔍 Testing search logic...")
    
    try:
        client = AsyncIOMotorClient(mongodb_url, tlsCAFile=certifi.where())
        db = client.matrimonialDB
        
        # Test the exact query that would be generated
        print("\n1. Testing search for 'Doctor':")
        
        # This is what the search endpoint generates
        search_query = {
            "$and": [
                {"accountStatus": "active"},
                {
                    "$or": [
                        {"workExperience.workType": "Doctor"},
                        {"workExperience.workType": "doctor"},
                        {"occupation": {"$regex": "Doctor", "$options": "i"}}
                    ]
                }
            ]
        }
        
        print(f"   Query: {search_query}")
        
        # Execute the query
        cursor = db.users.find(search_query, {"username": 1, "_id": 0}).limit(5)
        results = await cursor.to_list(None)
        
        print(f"   Results: {len(results)} users found")
        for result in results:
            print(f"   - {result['username']}")
        
        # Test just the workType part
        print("\n2. Testing workType='Doctor' only:")
        work_type_query = {
            "workExperience.workType": "Doctor"
        }
        
        cursor = db.users.find(work_type_query, {"username": 1, "_id": 0}).limit(5)
        results = await cursor.to_list(None)
        
        print(f"   Results: {len(results)} users found")
        for result in results:
            print(f"   - {result['username']}")
        
        # Check accountStatus
        print("\n3. Checking accountStatus for doctors:")
        pipeline = [
            {"$match": {"workExperience.workType": "Doctor"}},
            {"$group": {"_id": "$accountStatus", "count": {"$sum": 1}}}
        ]
        
        status_results = await db.users.aggregate(pipeline).to_list(None)
        print(f"   Account status breakdown:")
        for result in status_results:
            print(f"   - {result['_id']}: {result['count']} users")
        
        await client.close()
        
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_search_logic())
