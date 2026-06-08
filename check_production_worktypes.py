#!/usr/bin/env python3
"""
Check all workType values in production
"""

import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import certifi

async def check_production_worktypes():
    """Check all workType values in production"""
    
    # Load production environment
    load_dotenv('.env.production')
    mongodb_url = os.getenv('MONGODB_URL')
    
    print("🔍 Checking all workType values in production...")
    
    try:
        client = AsyncIOMotorClient(mongodb_url, tlsCAFile=certifi.where())
        db = client.matrimonialDB
        
        # Get all unique workType values
        pipeline = [
            {"$match": {"workExperience": {"$exists": True, "$ne": []}}},
            {"$unwind": "$workExperience"},
            {"$match": {"workExperience.workType": {"$exists": True, "$ne": ""}}},
            {"$group": {"_id": "$workExperience.workType", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}}
        ]
        
        results = await db.users.aggregate(pipeline).to_list(None)
        
        print(f"\nFound {len(results)} unique workType values:")
        print("-" * 50)
        
        for result in results:
            work_type = result["_id"]
            count = result["count"]
            print(f"{work_type:20} : {count:3} users")
        
        # Check specifically for medical-related entries
        print("\n" + "="*50)
        print("🔍 Checking for medical-related descriptions:")
        
        medical_pipeline = [
            {"$match": {"workExperience": {"$exists": True, "$ne": []}}},
            {"$unwind": "$workExperience"},
            {"$match": {
                "workExperience.description": {"$regex": "doctor|physician|resident|medical|hospital|clinic", "$options": "i"}
            }},
            {"$limit": 10}
        ]
        
        medical_results = await db.users.aggregate(medical_pipeline).to_list(None)
        
        for result in medical_results:
            username = result.get("username", "unknown")
            work_exp = result.get("workExperience", {})
            work_type = work_exp.get("workType", "N/A")
            description = work_exp.get("description", "N/A")
            print(f"\n{username}:")
            print(f"  workType: {work_type}")
            print(f"  description: {description}")
        
        client.close()
        
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(check_production_worktypes())
