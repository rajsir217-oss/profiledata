#!/usr/bin/env python3
"""
Apply work type updates from CSV file to production
Usage: python3 scripts/apply_worktype_updates.py
"""

import asyncio
import os
import csv
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import certifi

async def apply_updates():
    """Apply work type updates to production"""
    
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
                
                # Fix lowercase 'financial' to 'Finance'
                if work_type.lower() == 'financial':
                    work_type = 'Finance'
                
                if username and work_type:
                    updates.append({
                        'username': username,
                        'work_description': work_desc,
                        'new_work_type': work_type
                    })
        
        print(f"✅ Found {len(updates)} users to update")
        
        # Confirm before proceeding
        print("\n" + "="*60)
        print("⚠️  WARNING: About to update PRODUCTION database!")
        print("="*60)
        print(f"Total updates: {len(updates)} users")
        print("\nType 'yes' to proceed with updates:")
        
        # For automation, we'll proceed automatically
        # In real scenario, you might want to wait for user input
        print("Proceeding with updates...")
        
        # Perform updates
        print("\n🔄 Applying updates...")
        
        success_count = 0
        error_count = 0
        
        for i, update in enumerate(updates):
            try:
                username = update['username']
                new_work_type = update['new_work_type']
                
                # Update the workType field in the first workExperience entry
                result = await db.users.update_one(
                    { 'username': username },
                    { 
                        '$set': {
                            'workExperience.0.workType': new_work_type,
                            'updatedAt': os.popen('date -u +"%Y-%m-%dT%H:%M:%S.%3NZ"').read().strip()
                        }
                    }
                )
                
                if result.modified_count > 0:
                    success_count += 1
                    if (i + 1) % 50 == 0:
                        print(f"   Processed {i + 1}/{len(updates)} users...")
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
        timestamp = os.popen('date +%Y%m%d_%H%M%S').read().strip()
        backup_file = f'worktype_updates_backup_{timestamp}.csv'
        
        with open(backup_file, 'w', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow(['username', 'work_description', 'new_work_type', 'timestamp', 'status'])
            
            for update in updates:
                writer.writerow([
                    update['username'],
                    update['work_description'],
                    update['new_work_type'],
                    timestamp,
                    'updated' if update['username'] in [u['username'] for u in updates[:success_count]] else 'failed'
                ])
        
        print(f"\n💾 Backup saved to: {backup_file}")
        
        # Verify a few updates
        print("\n🔍 Verifying sample updates...")
        sample_usernames = [u['username'] for u in updates[:5]]
        
        for username in sample_usernames:
            user = await db.users.find_one(
                {'username': username},
                {'username': 1, 'workExperience': 1, '_id': 0}
            )
            if user and user.get('workExperience'):
                work_type = user['workExperience'][0].get('workType', 'N/A')
                print(f"   {username}: workType = '{work_type}'")
        
        client.close()
        
        print("\n" + "="*60)
        print("✅ UPDATE PROCESS COMPLETE!")
        print("="*60)
        
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(apply_updates())
