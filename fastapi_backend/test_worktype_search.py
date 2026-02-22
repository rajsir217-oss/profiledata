#!/usr/bin/env python3
"""
Test script to verify workType search functionality
"""

import asyncio
import sys
import os
sys.path.append('.')
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import certifi

async def test_worktype_search():
    """Test workType search functionality"""
    
    # Load environment
    load_dotenv('.env.local')
    mongodb_url = os.getenv('MONGODB_URL')
    
    if not mongodb_url:
        print("❌ MONGODB_URL not found!")
        return
    
    print("🔍 Testing workType search functionality...")
    
    try:
        # For local MongoDB, don't use SSL
        if 'localhost' in mongodb_url or '127.0.0.1' in mongodb_url:
            client = AsyncIOMotorClient(mongodb_url)
        else:
            client = AsyncIOMotorClient(mongodb_url, tlsCAFile=certifi.where())
        db = client.matrimonialDB
        
        # Test 1: Count users by workType
        print("\n1. Counting users by workType:")
        work_types = ['doctor', 'software', 'engineer', 'manager', 'analyst']
        
        for work_type in work_types:
            count = await db.users.count_documents({
                "workExperience.workType": work_type
            })
            print(f"   {work_type}: {count} users")
        
        # Test 2: Sample search for doctors
        print("\n2. Sample users with workType='doctor':")
        cursor = db.users.find(
            {"workExperience.workType": "doctor"},
            {"username": 1, "workExperience": 1, "_id": 0}
        ).limit(5)
        
        doctors = await cursor.to_list(None)
        for doctor in doctors:
            username = doctor.get('username', 'unknown')
            work_exp = doctor.get('workExperience', [])
            if work_exp:
                work_type = work_exp[0].get('workType', 'N/A')
                description = work_exp[0].get('description', 'N/A')
                print(f"   {username}: workType='{work_type}', description='{description}'")
        
        # Test 3: Verify search query structure
        print("\n3. Testing search query structure:")
        search_query = {
            "$and": [
                {"accountStatus": "active"},
                {
                    "$or": [
                        {"workExperience.workType": "doctor"},
                        {"occupation": {"$regex": "doctor", "$options": "i"}}
                    ]
                }
            ]
        }
        
        cursor = db.users.find(search_query, {"username": 1, "_id": 0}).limit(5)
        results = await cursor.to_list(None)
        print(f"   Query results: {len(results)} users found")
        for result in results:
            print(f"   - {result['username']}")
        
        await client.close()
        print("\n✅ Test completed!")
        
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()
    finally:
        if 'client' in locals():
            client.close()

if __name__ == "__main__":
    asyncio.run(test_worktype_search())
