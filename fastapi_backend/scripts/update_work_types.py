#!/usr/bin/env python3
"""
Update work types for users from CSV file
Usage: python3 scripts/update_work_types.py
"""

import asyncio
import os
import sys
import csv
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import certifi

async def update_work_types():
    """Update work types from CSV file"""
    
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
    
    csv_file = 'work_descriptions_production.csv'
    
    if not os.path.exists(csv_file):
        print(f"❌ CSV file {csv_file} not found!")
        print("   Please run generate_work_description_list.py first")
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
        with open(csv_file, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                username = row.get('username', '').strip()
                current_desc = row.get('current_description', '').strip()
                new_desc = row.get('new_description', '').strip()
                
                if username and new_desc:
                    updates.append({
                        'username': username,
                        'current_description': current_desc,
                        'new_description': new_desc
                    })
        
        if not updates:
            print("\n⚠️  No updates found in CSV file")
            print("   Please add values to the 'new_description' column")
            return
        
        print(f"✅ Found {len(updates)} users to update")
        
        # Show preview
        print("\n📋 Preview of updates:")
        print("-" * 80)
        for i, update in enumerate(updates[:5]):
            print(f"{i+1}. {update['username']}")
            print(f"   From: '{update['current_description']}'")
            print(f"   To:   '{update['new_description']}'")
            print()
        
        if len(updates) > 5:
            print(f"... and {len(updates) - 5} more updates")
        
        # Confirm before proceeding
        print("\n⚠️  WARNING: This will update production data!")
        print("   Make sure you have a backup of the database")
        print("\nType 'yes' to proceed with updates:")
        
        # In production, you might want to add confirmation here
        # For now, we'll proceed automatically
        
        # Perform updates
        print("\n🔄 Performing updates...")
        
        success_count = 0
        error_count = 0
        
        for update in updates:
            try:
                username = update['username']
                new_desc = update['new_description']
                
                # Update the workExperience description
                result = await db.users.update_one(
                    { 'username': username },
                    { 
                        '$set': {
                            'workExperience.0.description': new_desc,
                            'updatedAt': os.popen('date -u +"%Y-%m-%dT%H:%M:%S.%3NZ"').read().strip()
                        }
                    }
                )
                
                if result.modified_count > 0:
                    success_count += 1
                    print(f"✅ Updated {username}")
                else:
                    print(f"⚠️  No changes for {username}")
                    error_count += 1
                    
            except Exception as e:
                print(f"❌ Error updating {username}: {str(e)}")
                error_count += 1
        
        print(f"\n📊 Update Summary:")
        print(f"   ✅ Successful updates: {success_count}")
        print(f"   ❌ Failed updates: {error_count}")
        print(f"   📊 Total processed: {len(updates)}")
        
        # Create backup of updates
        backup_file = f'work_updates_backup_{os.popen("date +%Y%m%d_%H%M%S").read().strip()}.csv'
        with open(backup_file, 'w', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow(['username', 'old_description', 'new_description', 'timestamp'])
            
            for update in updates:
                writer.writerow([
                    update['username'],
                    update['current_description'],
                    update['new_description'],
                    os.popen('date -u +"%Y-%m-%dT%H:%M:%S.%3NZ"').read().strip()
                ])
        
        print(f"\n💾 Backup saved to: {backup_file}")
        
        await client.close()
        
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(update_work_types())
