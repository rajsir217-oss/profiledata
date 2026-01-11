#!/usr/bin/env python3
"""
Test saved search matches notifier in production
1. Clear notification tracking
2. Run the job directly
"""

import asyncio
import os
import sys
import certifi
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

# IMPORTANT: Load production env BEFORE any other imports that might use config
# This must happen before importing anything that uses config.py
# First load local to get ENCRYPTION_KEY, then production to get MongoDB URL
load_dotenv('.env.local', override=True)  # Get encryption key
load_dotenv('.env.production', override=True)  # Get production MongoDB URL
# Re-load local encryption key since production doesn't have it
os.environ['ENCRYPTION_KEY'] = 'JYJiCzHWs7UY7he04gSxbpd7SWdS4KI426-Fh7MIZY0='

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from job_templates.saved_search_matches_notifier import run_saved_search_notifier

async def run_test():
    load_dotenv('.env.production')
    
    mongodb_url = os.getenv('MONGODB_URL')
    # Remove quotes if present
    if mongodb_url:
        mongodb_url = mongodb_url.strip('"').strip("'")
    
    print(f'Connecting to production MongoDB...')
    
    client = AsyncIOMotorClient(mongodb_url, tlsCAFile=certifi.where())
    db = client.matrimonialDB
    
    # 1. Check saved searches with notifications enabled
    searches = await db.saved_searches.find({
        'notifications.enabled': True
    }).to_list(100)
    print(f'\n📋 Found {len(searches)} saved searches with notifications enabled')
    for s in searches[:5]:
        print(f'   - {s.get("username")}: "{s.get("name")}"')
    
    # 2. Clear notification tracking to allow re-sending
    tracking_result = await db.saved_search_notifications.delete_many({})
    print(f'\n🗑️  Cleared {tracking_result.deleted_count} notification tracking records')
    
    # 3. Run the job directly
    print(f'\n🚀 Running saved search notifier job...\n')
    
    params = {
        "batchSize": 50,
        "lookbackHours": 0,  # 0 = check all profiles, not just recent
        "appUrl": "https://l3v3lmatches.com",
        "manualRun": True,  # Bypass schedule check
        "clearTracking": True,  # Clear tracking to resend
    }
    
    result = await run_saved_search_notifier(db, params)
    
    print(f'\n✅ Job finished')
    print(f'   Status: {result.status}')
    print(f'   Message: {result.message}')
    print(f'   Duration: {result.duration_seconds:.2f}s')
    print(f'   Emails sent: {result.details.get("emails_sent", 0)}')
    print(f'   Total matches found: {result.details.get("total_matches_found", 0)}')
    
    # 4. Check if any notifications were queued
    queued = await db.notification_queue.find({
        'trigger': 'saved_search_matches',
        'status': 'pending'
    }).to_list(10)
    print(f'\n📬 Queued notifications: {len(queued)}')
    for n in queued[:3]:
        print(f'   - {n.get("username")}: {n.get("templateData", {}).get("searchName", "?")}')
    
    client.close()

if __name__ == "__main__":
    asyncio.run(run_test())
