#!/usr/bin/env python3
"""
Generate list of users and their work descriptions from production
Usage: python3 scripts/generate_work_description_list.py
"""

import asyncio
import os
import sys
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import certifi

async def generate_work_list():
    """Generate list of all users with their work descriptions"""
    
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
        
        # Get all users with workExperience data
        print("\n🔍 Fetching users with work experience data...")
        
        cursor = db.users.find(
            { 
                'workExperience': { 
                    '$exists': True, 
                    '$ne': [], 
                    '$ne': None,
                    '$elemMatch': { 'description': { '$exists': True, '$ne': '', '$ne': None } }
                }
            },
            { 'username': 1, 'firstName': 1, 'lastName': 1, 'workExperience': 1, '_id': 0 }
        ).sort('username', 1)
        
        users = []
        async for doc in cursor:
            users.append(doc)
        
        print(f"✅ Found {len(users)} users with work descriptions")
        
        # Write to file
        output_file = 'work_descriptions_production.txt'
        with open(output_file, 'w') as f:
            f.write("USERNAME | WORK DESCRIPTION\n")
            f.write("=" * 100 + "\n")
            
            for user in users:
                username = user.get('username', '')
                first_name = user.get('firstName', '')
                last_name = user.get('lastName', '')
                work_exp = user.get('workExperience', [])
                
                # Extract descriptions from work experience
                descriptions = []
                if work_exp and isinstance(work_exp, list):
                    for exp in work_exp:
                        if isinstance(exp, dict):
                            desc = exp.get('description', '')
                            if desc and desc.strip():
                                descriptions.append(desc.strip())
                
                # Join multiple descriptions
                work_desc = '; '.join(descriptions) if descriptions else ''
                
                # Write in requested format
                f.write(f"{username} | {work_desc}\n")
        
        print(f"\n✅ List saved to: {output_file}")
        print(f"   Total users: {len(users)}")
        
        # Show some statistics
        print("\n📈 Work Description Statistics:")
        
        # Count unique descriptions
        desc_counts = {}
        for user in users:
            work_exp = user.get('workExperience', [])
            if work_exp and isinstance(work_exp, list):
                for exp in work_exp:
                    if isinstance(exp, dict):
                        desc = exp.get('description', '')
                        if desc and desc.strip():
                            desc = desc.strip()
                            if desc in desc_counts:
                                desc_counts[desc] += 1
                            else:
                                desc_counts[desc] = 1
        
        # Show top 15 most common descriptions
        sorted_descs = sorted(desc_counts.items(), key=lambda x: x[1], reverse=True)
        print("\n   Top 15 Work Descriptions:")
        for desc, count in sorted_descs[:15]:
            print(f"   - {desc}: {count} users")
        
        # Show unique descriptions
        unique_descs = len(desc_counts)
        print(f"\n   Total unique work descriptions: {unique_descs}")
        
        # Also create a CSV file for easy editing
        csv_file = 'work_descriptions_production.csv'
        with open(csv_file, 'w') as f:
            f.write("username,current_description,new_description\n")
            
            for user in users:
                username = user.get('username', '')
                work_exp = user.get('workExperience', [])
                
                # Extract descriptions
                descriptions = []
                if work_exp and isinstance(work_exp, list):
                    for exp in work_exp:
                        if isinstance(exp, dict):
                            desc = exp.get('description', '')
                            if desc and desc.strip():
                                descriptions.append(desc.strip())
                
                current_desc = '; '.join(descriptions) if descriptions else ''
                f.write(f"{username},\"{current_desc}\",\n")
        
        print(f"\n✅ CSV file created: {csv_file}")
        print("   You can edit this file to add new_description values for bulk updates")
        
        client.close()
        
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(generate_work_list())
