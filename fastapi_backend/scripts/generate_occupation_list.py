#!/usr/bin/env python3
"""
Generate list of users and their occupations from production
Usage: python3 scripts/generate_occupation_list.py
"""

import asyncio
import os
import sys
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import certifi

async def generate_occupation_list():
    """Generate list of all users with their occupations"""
    
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
    print(f"   URL: {mongodb_url[:50]}...")
    
    try:
        client = AsyncIOMotorClient(mongodb_url, tlsCAFile=certifi.where())
        db = client.matrimonialDB
        
        # Test connection
        await db.command('ping')
        print("✅ Connected to MongoDB")
        
        # Get all users with occupation or workExperience data
        print("\n🔍 Fetching users with occupation/work data...")
        
        # Query both occupation field and workExperience.position field
        cursor = db.users.find(
            { 
                '$or': [
                    { 'occupation': { '$exists': True, '$ne': '', '$ne': None } },
                    { 'workExperience': { '$exists': True, '$ne': [], '$ne': None } }
                ]
            },
            { 'username': 1, 'firstName': 1, 'lastName': 1, 'occupation': 1, 'workExperience': 1, '_id': 0 }
        ).sort('username', 1)
        
        users = []
        async for doc in cursor:
            users.append(doc)
        
        print(f"✅ Found {len(users)} users with occupation data")
        
        # Write to file
        output_file = 'occupation_list_production.txt'
        with open(output_file, 'w') as f:
            f.write("USERNAME | OCCUPATION | WORK EXPERIENCE\n")
            f.write("=" * 120 + "\n")
            
            for user in users:
                username = user.get('username', '')
                first_name = user.get('firstName', '')
                last_name = user.get('lastName', '')
                occupation = user.get('occupation', '')
                work_exp = user.get('workExperience', [])
                
                # Get work experience positions
                work_positions = []
                if work_exp and isinstance(work_exp, list):
                    for exp in work_exp:
                        if isinstance(exp, dict):
                            pos = exp.get('position', '')
                            if pos:
                                work_positions.append(pos)
                
                work_text = '; '.join(work_positions) if work_positions else ''
                
                # Format name
                full_name = f"{first_name} {last_name}".strip()
                if not full_name:
                    full_name = username
                
                # Write in requested format
                f.write(f"{username} | {occupation} | {work_text}\n")
        
        print(f"\n✅ List saved to: {output_file}")
        print(f"   Total users: {len(users)}")
        
        # Show some statistics
        print("\n📈 Occupation Statistics:")
        occupation_counts = {}
        for user in users:
            occ = user.get('occupation', '')
            if occ in occupation_counts:
                occupation_counts[occ] += 1
            else:
                occupation_counts[occ] = 1
        
        # Show top 10 most common occupations
        sorted_occs = sorted(occupation_counts.items(), key=lambda x: x[1], reverse=True)
        print("\n   Top 10 Occupations:")
        for occ, count in sorted_occs[:10]:
            print(f"   - {occ}: {count} users")
        
        # Show unique occupations
        unique_occs = len(occupation_counts)
        print(f"\n   Total unique occupations: {unique_occs}")
        
        await client.close()
        
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(generate_occupation_list())
