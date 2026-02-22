#!/usr/bin/env python3
"""
Check workType field in production database
"""

import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import certifi

async def check_production_worktype():
    """Check workType field in production"""
    
    # Load production environment
    load_dotenv('.env.production')
    mongodb_url = os.getenv('MONGODB_URL')
    
    print("🔍 Checking workType field in production...")
    
    try:
        client = AsyncIOMotorClient(mongodb_url, tlsCAFile=certifi.where())
        db = client.matrimonialDB
        
        # Check if workType field exists in production
        print("\n1. Checking workType field existence:")
        work_type_count = await db.users.count_documents({
            "workExperience.workType": {"$exists": True}
        })
        print(f"   Users with workType field: {work_type_count}")
        
        # Check for doctors specifically
        print("\n2. Checking for doctors:")
        doctor_count = await db.users.count_documents({
            "workExperience.workType": "doctor"
        })
        print(f"   Users with workType='doctor': {doctor_count}")
        
        # Check sample user structure
        print("\n3. Sample user structure:")
        sample = await db.users.find_one(
            {"workExperience.workType": {"$exists": True}},
            {"username": 1, "workExperience": 1, "_id": 0}
        )
        if sample:
            print(f"   Username: {sample.get('username')}")
            work_exp = sample.get('workExperience', [])
            if work_exp:
                print(f"   First workExperience entry:")
                print(f"     - workType: {work_exp[0].get('workType', 'N/A')}")
                print(f"     - description: {work_exp[0].get('description', 'N/A')}")
        
        # Check if we need to update the field name
        print("\n4. Checking field names in workExperience:")
        pipeline = [
            {"$match": {"workExperience": {"$exists": True, "$ne": []}}},
            {"$unwind": "$workExperience"},
            {"$limit": 1}
        ]
        sample = await db.users.aggregate(pipeline).to_list(1)
        if sample:
            work_exp = sample[0].get('workExperience', {})
            print("   Fields in workExperience:")
            for key in work_exp.keys():
                print(f"     - {key}: {type(work_exp[key]).__name__}")
        
        await client.close()
        
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(check_production_worktype())
