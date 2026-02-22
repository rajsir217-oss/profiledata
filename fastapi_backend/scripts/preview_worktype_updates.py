#!/usr/bin/env python3
"""
Preview work type updates before applying them
Usage: python3 scripts/preview_worktype_updates.py
"""

import asyncio
import os
import csv
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import certifi

async def preview_updates():
    """Preview what work type updates will be made"""
    
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
    
    csv_file = '/Users/rajsiripuram02/opt/appsrc/profiledata/updateworktype.csv'
    
    if not os.path.exists(csv_file):
        print(f"❌ CSV file {csv_file} not found!")
        return
    
    try:
        client = AsyncIOMotorClient(mongodb_url, tlsCAFile=certifi.where())
        db = client.matrimonialDB
        
        # Test connection
        await db.command('ping')
        print("✅ Connected to MongoDB")
        
        # Read CSV file
        print(f"\n📖 Reading CSV file: {csv_file}")
        
        updates = []
        with open(csv_file, 'r', encoding='utf-8-sig') as f:  # Use utf-8-sig to remove BOM
            reader = csv.DictReader(f)
            for row in reader:
                # Handle possible spaces in column names
                username = row.get('USERNAME ', '') or row.get('USERNAME', '') or ''
                username = username.strip()
                
                work_desc = row.get(' WORK DESCRIPTION', '') or row.get('WORK DESCRIPTION', '') or ''
                work_desc = work_desc.strip()
                
                work_type = row.get('Work Type', '') or row.get('WORK TYPE', '') or ''
                work_type = work_type.strip()
                
                if username and work_type:
                    updates.append({
                        'username': username,
                        'work_description': work_desc,
                        'new_work_type': work_type
                    })
        
        print(f"✅ Found {len(updates)} users to update")
        
        # Group by work type for summary
        work_type_counts = {}
        for update in updates:
            work_type = update['new_work_type']
            if work_type in work_type_counts:
                work_type_counts[work_type] += 1
            else:
                work_type_counts[work_type] = 1
        
        print("\n📊 Summary of Updates by Work Type:")
        print("-" * 50)
        for work_type, count in sorted(work_type_counts.items()):
            print(f"{work_type:20} : {count:3} users")
        
        # Show first 20 updates as preview
        print(f"\n📋 Preview of First 20 Updates:")
        print("-" * 100)
        print(f"{'Username':20} | {'Current Description':40} | {'New Work Type':15}")
        print("-" * 100)
        
        # Get current data for first 20 users
        for i, update in enumerate(updates[:20]):
            username = update['username']
            user = await db.users.find_one(
                {'username': username},
                {'workExperience': 1, '_id': 0}
            )
            
            current_desc = "Not found"
            if user and user.get('workExperience'):
                current_desc = user['workExperience'][0].get('description', 'N/A')
            
            # Truncate long descriptions
            if len(current_desc) > 37:
                current_desc = current_desc[:37] + "..."
            
            print(f"{username[:20]:20} | {current_desc:40} | {update['new_work_type']:15}")
        
        if len(updates) > 20:
            print(f"\n... and {len(updates) - 20} more updates")
        
        # Check for any potential issues
        print("\n⚠️  Checking for potential issues...")
        
        # Check if all users exist
        missing_users = []
        for update in updates:
            username = update['username']
            user = await db.users.find_one({'username': username}, {'_id': 1})
            if not user:
                missing_users.append(username)
        
        if missing_users:
            print(f"❌ {len(missing_users)} users not found in database:")
            for user in missing_users[:10]:
                print(f"   - {user}")
            if len(missing_users) > 10:
                print(f"   ... and {len(missing_users) - 10} more")
        else:
            print("✅ All users found in database")
        
        # Check for invalid work types
        valid_work_types = {
            'accountant', 'analyst', 'artist', 'attorney', 'consultant',
            'customer service', 'dentist', 'designer', 'developer', 'doctor',
            'engineer', 'entrepreneur', 'finance', 'freelancer', 'hr',
            'manager', 'marketing', 'nurse', 'operations', 'others',
            'pharma', 'physical therapy', 'researcher', 'sales', 'scientist',
            'software', 'student', 'teacher', 'writer'
        }
        
        invalid_types = []
        for update in updates:
            work_type = update['new_work_type'].lower()
            if work_type not in valid_work_types:
                invalid_types.append((update['username'], work_type))
        
        if invalid_types:
            print(f"\n⚠️  {len(invalid_types)} users have invalid work types:")
            for username, work_type in invalid_types[:10]:
                print(f"   - {username}: '{work_type}'")
            if len(invalid_types) > 10:
                print(f"   ... and {len(invalid_types) - 10} more")
        else:
            print("✅ All work types are valid")
        
        await client.close()
        
        print("\n" + "="*60)
        print("📝 PREVIEW COMPLETE")
        print("="*60)
        print("To apply these updates, run:")
        print("python3 scripts/apply_worktype_updates.py")
        
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(preview_updates())
