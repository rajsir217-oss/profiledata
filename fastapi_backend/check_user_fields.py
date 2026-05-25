#!/usr/bin/env python3
"""
Check education and profession fields for a specific user
"""
import os
from dotenv import load_dotenv
from pymongo import MongoClient

def check_user_fields(username):
    load_dotenv('.env.local')
    mongo_url = os.getenv('MONGODB_URL', 'mongodb://localhost:27017')
    db_name = os.getenv('DATABASE_NAME', 'matrimonialDB')
    
    print(f"🔍 Checking fields for user: {username}")
    
    client = MongoClient(mongo_url)
    db = client[db_name]
    
    user = db.users.find_one(
        {'username': username},
        {'username': 1, 'educationHistory': 1, 'workExperience': 1, 'education': 1, 'occupation': 1, '_id': 0}
    )
    
    if not user:
        print(f"❌ User '{username}' not found")
        client.close()
        return
    
    print(f"\n✅ Found user: {user.get('username')}")
    
    # Check educationHistory
    edu_history = user.get('educationHistory', [])
    print(f"\n📚 educationHistory (array, {len(edu_history)} entries):")
    if edu_history:
        for i, edu in enumerate(edu_history):
            print(f"  [{i}] {edu}")
    else:
        print("  (empty or missing)")
    
    # Check legacy education field
    education = user.get('education')
    print(f"\n📚 education (legacy field): {education}")
    
    # Check workExperience
    work_exp = user.get('workExperience', [])
    print(f"\n💼 workExperience (array, {len(work_exp)} entries):")
    if work_exp:
        for i, work in enumerate(work_exp):
            print(f"  [{i}] {work}")
    else:
        print("  (empty or missing)")
    
    # Check legacy occupation field
    occupation = user.get('occupation')
    print(f"\n💼 occupation (legacy field): {occupation}")
    
    client.close()

if __name__ == "__main__":
    check_user_fields('aditipatel031')
