#!/usr/bin/env python3
"""
Update work type for a single user
Usage: python3 scripts/update_single_user_worktype.py <username> <workType>
"""

import asyncio
import os
import sys
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import certifi

async def update_single_user(username, new_work_type):
    """Update work type for a single user"""
    
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
        
        # Get current user data
        print(f"\n🔍 Finding user: {username}")
        user = await db.users.find_one({'username': username})
        
        if not user:
            print(f"❌ User {username} not found!")
            return
        
        print(f"✅ Found user: {user.get('firstName', '')} {user.get('lastName', '')}")
        
        # Show current work experience
        work_exp = user.get('workExperience', [])
        if work_exp:
            print(f"\n📋 Current work experience:")
            for i, exp in enumerate(work_exp):
                print(f"   {i+1}. Type: {exp.get('workType', 'N/A')}")
                print(f"      Description: {exp.get('description', 'N/A')}")
                print(f"      Status: {exp.get('status', 'N/A')}")
        else:
            print("\n⚠️  No work experience found for user")
            return
        
        # Update the work type
        print(f"\n🔄 Updating work type to: {new_work_type}")
        
        # Update the first work experience entry
        result = await db.users.update_one(
            {'username': username},
            {
                '$set': {
                    'workExperience.0.workType': new_work_type,
                    'updatedAt': os.popen('date -u +"%Y-%m-%dT%H:%M:%S.%3NZ"').read().strip()
                }
            }
        )
        
        if result.modified_count > 0:
            print(f"✅ Successfully updated work type for {username}")
            
            # Verify the update
            updated_user = await db.users.find_one({'username': username})
            updated_exp = updated_user.get('workExperience', [])
            if updated_exp:
                print(f"\n📋 Updated work experience:")
                print(f"   Type: {updated_exp[0].get('workType', 'N/A')}")
                print(f"   Description: {updated_exp[0].get('description', 'N/A')}")
        else:
            print(f"⚠️  No changes made for {username}")
        
        await client.close()
        
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python3 scripts/update_single_user_worktype.py <username> <workType>")
        print("\nAvailable work types:")
        print("accountant, analyst, artist, attorney, consultant, customer service,")
        print("dentist, designer, developer, doctor, engineer, entrepreneur,")
        print("finance, freelancer, hr, manager, marketing, nurse, operations,")
        print("others, pharma, physical therapy, researcher, sales, scientist,")
        print("software, student, teacher, writer")
        sys.exit(1)
    
    username = sys.argv[1]
    work_type = sys.argv[2]
    
    asyncio.run(update_single_user(username, work_type))
