#!/usr/bin/env python3
"""
Direct MongoDB query to update work types
Usage: python3 scripts/update_worktype_mongo_query.py
"""

import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import certifi

async def update_with_mongo_queries():
    """Update work types using direct MongoDB queries"""
    
    # Load production environment
    print("Loading production environment...")
    if os.path.exists('.env.production'):
        load_dotenv('.env.production', override=True)
        print("✅ Using .env.production")
    else:
        print("❌ .env.production file not found!")
        return
    
    mongodb_url = os.getenv('MONGODB_URL')
    if not mongodb_url:
        print("❌ MONGODB_URL not found in environment!")
        return
    
    # Clean up the URL
    mongodb_url = mongodb_url.strip('"').strip("'")
    
    print(f"\n📊 Connecting to production MongoDB...")
    
    try:
        client = AsyncIOMotorClient(mongodb_url, tlsCAFile=certifi.where())
        db = client.matrimonialDB
        
        # Test connection
        await db.command('ping')
        print("✅ Connected to MongoDB")
        
        print("\n" + "="*60)
        print("📝 EXAMPLE MONGODB QUERIES FOR UPDATING WORK TYPES")
        print("="*60)
        
        print("\n1️⃣ Update a single user:")
        print("db.users.updateOne(")
        print("  {'username': 'johndoe'},")
        print("  {'$set': {'workExperience.0.workType': 'software'}}")
        print(")")
        
        print("\n2️⃣ Update multiple users with similar descriptions:")
        print("db.users.updateMany(")
        print("  {'workExperience.0.description': {'$regex': 'Software Engineer', '$options': 'i'}},")
        print("  {'$set': {'workExperience.0.workType': 'software'}}")
        print(")")
        
        print("\n3️⃣ Bulk update operations:")
        print("bulk_ops = [")
        print("  {'updateOne': {'filter': {'username': 'user1'}, 'update': {'$set': {'workExperience.0.workType': 'doctor'}}}},")
        print("  {'updateOne': {'filter': {'username': 'user2'}, 'update': {'$set': {'workExperience.0.workType': 'engineer'}}}}")
        print("]")
        print("db.users.bulk_write(bulk_ops)")
        
        print("\n4️⃣ Common mappings you might need:")
        mappings = {
            'Software Engineer': 'software',
            'Software Engineer II': 'software',
            'Senior Software Engineer': 'software',
            'Marketing Manager': 'marketing',
            'Product Manager': 'manager',
            'Data Scientist': 'scientist',
            'Data Engineer': 'engineer',
            'Physician': 'doctor',
            'Doctor': 'doctor',
            'Dentist': 'dentist',
            'Resident': 'doctor',
            'Student': 'student'
        }
        
        for desc, work_type in mappings.items():
            print(f"   '{desc}' → '{work_type}'")
        
        print("\n" + "="*60)
        print("⚠️  REMINDER: Always backup before bulk updates!")
        print("="*60)
        
        await client.close()
        
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(update_with_mongo_queries())
