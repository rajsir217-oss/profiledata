#!/usr/bin/env python3
"""
Test saved search email for rajadmin only
"""

import asyncio
import os
import sys
import certifi
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

# Load production env
load_dotenv('.env.production', override=True)

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

async def test_rajadmin():
    mongodb_url = os.getenv('MONGODB_URL')
    if mongodb_url:
        mongodb_url = mongodb_url.strip('"').strip("'")
    
    print('Connecting to production MongoDB...')
    client = AsyncIOMotorClient(mongodb_url, tlsCAFile=certifi.where())
    db = client.matrimonialDB
    
    # Get rajadmin's saved search
    search = await db.saved_searches.find_one({'username': 'rajadmin'})
    if not search:
        print('❌ No saved search found for rajadmin')
        client.close()
        return
    
    print(f'📋 Found saved search: "{search.get("name")}"')
    
    # Get rajadmin user
    user = await db.users.find_one({'username': 'rajadmin'})
    if not user:
        print('❌ User rajadmin not found')
        client.close()
        return
    
    user_email = user.get('contactEmail') or user.get('email')
    print(f'📧 User email field: {user_email[:20] if user_email else "None"}...')
    
    # Find matches for the search criteria
    criteria = search.get('criteria', {})
    print(f'🔍 Search criteria: {criteria}')
    
    # Build query
    query = {'username': {'$ne': 'rajadmin'}, 'accountStatus': 'active'}
    if criteria.get('gender'):
        query['gender'] = criteria['gender'].capitalize()
    
    # Get a few matches
    matches = await db.users.find(query).limit(5).to_list(5)
    print(f'✅ Found {len(matches)} matches')
    
    # Check image URLs for first match
    if matches:
        match = matches[0]
        print(f'\n📸 First match: {match.get("username")}')
        print(f'   images: {match.get("images", [])[:2]}')
        
        # Test URL generation
        images = match.get('images', [])
        if images:
            img = images[0]
            gcs_bucket = 'matrimonial-uploads-matrimonial-staging'
            
            if img.startswith('/uploads/'):
                filename = img.split('/uploads/')[-1]
                url = f"https://storage.googleapis.com/{gcs_bucket}/uploads/{filename}"
            elif img.startswith('https://'):
                url = img
            else:
                url = f"https://storage.googleapis.com/{gcs_bucket}/uploads/{img}"
            
            print(f'   Generated URL: {url}')
            
            # Test if URL is accessible
            import urllib.request
            try:
                req = urllib.request.Request(url, method='HEAD')
                with urllib.request.urlopen(req, timeout=5) as response:
                    print(f'   ✅ URL accessible: {response.status}')
            except Exception as e:
                print(f'   ❌ URL not accessible: {e}')
    
    client.close()

if __name__ == "__main__":
    asyncio.run(test_rajadmin())
