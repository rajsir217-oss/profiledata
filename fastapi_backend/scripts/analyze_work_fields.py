#!/usr/bin/env python3
"""
Analyze all work-related fields in production database
Usage: python3 scripts/analyze_work_fields.py
"""

import asyncio
import os
import sys
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import certifi

async def analyze_work_fields():
    """Analyze all work-related fields"""
    
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
        
        # Sample a few users to understand the schema
        print("\n🔍 Sampling 5 users to understand schema...")
        sample_users = await db.users.find({}).limit(5).to_list(None)
        
        all_fields = set()
        for user in sample_users:
            for key in user.keys():
                all_fields.add(key)
        
        print(f"Found fields: {sorted(all_fields)}")
        
        # Check work-related fields
        work_fields = ['occupation', 'workExperience', 'work', 'job', 'profession', 'career', 'employment']
        found_work_fields = []
        
        for field in work_fields:
            if any(field.lower() in f.lower() for f in all_fields):
                found_work_fields.append(field)
        
        print(f"\n🎯 Work-related fields found: {found_work_fields}")
        
        # Get statistics for each work-related field
        print("\n📈 Field Statistics:")
        
        for field in found_work_fields:
            if field == 'workExperience':
                # Special handling for workExperience array
                count = await db.users.count_documents({
                    field: { '$exists': True, '$ne': [], '$ne': None }
                })
                print(f"   - {field}: {count} users have non-empty array")
                
                # Sample some workExperience entries
                sample = await db.users.find(
                    { field: { '$exists': True, '$ne': [], '$ne': None } },
                    { 'username': 1, field: 1, '_id': 0 }
                ).limit(3).to_list(None)
                
                print(f"     Sample entries:")
                for user in sample:
                    username = user.get('username', 'unknown')
                    work_exp = user.get(field, [])
                    print(f"       {username}: {work_exp}")
            else:
                # Regular string fields
                count = await db.users.count_documents({
                    field: { '$exists': True, '$ne': '', '$ne': None }
                })
                print(f"   - {field}: {count} users have non-empty value")
                
                # Sample some values
                sample = await db.users.find(
                    { field: { '$exists': True, '$ne': '', '$ne': None } },
                    { 'username': 1, field: 1, '_id': 0 }
                ).limit(3).to_list(None)
                
                print(f"     Sample values:")
                for user in sample:
                    username = user.get('username', 'unknown')
                    value = user.get(field, '')
                    print(f"       {username}: '{value}'")
        
        # Generate comprehensive list
        print("\n📝 Generating comprehensive work data list...")
        
        # Build query for any work-related data
        work_query = {'$or': []}
        
        for field in found_work_fields:
            if field == 'workExperience':
                work_query['$or'].append({field: {'$exists': True, '$ne': [], '$ne': None}})
            else:
                work_query['$or'].append({field: {'$exists': True, '$ne': '', '$ne': None}})
        
        if work_query['$or']:
            cursor = db.users.find(
                work_query,
                { 'username': 1, 'firstName': 1, 'lastName': 1, **{f: 1 for f in found_work_fields} }
            ).sort('username', 1)
            
            users = []
            async for doc in cursor:
                users.append(doc)
            
            print(f"✅ Found {len(users)} users with any work-related data")
            
            # Write comprehensive file
            output_file = 'work_data_comprehensive.txt'
            with open(output_file, 'w') as f:
                # Header
                header = "USERNAME"
                for field in found_work_fields:
                    header += f" | {field.upper()}"
                f.write(header + "\n")
                f.write("=" * (len(header) + 20) + "\n")
                
                for user in users:
                    line = user.get('username', '')
                    for field in found_work_fields:
                        value = user.get(field, '')
                        if field == 'workExperience' and isinstance(value, list):
                            # Extract positions from work experience
                            positions = []
                            for exp in value:
                                if isinstance(exp, dict):
                                    pos = exp.get('position', '')
                                    if pos:
                                        positions.append(pos)
                            value = '; '.join(positions)
                        line += f" | {value}"
                    f.write(line + "\n")
            
            print(f"\n✅ Comprehensive list saved to: {output_file}")
        
        await client.close()
        
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(analyze_work_fields())
