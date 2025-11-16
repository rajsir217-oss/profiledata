#!/usr/bin/env python3
"""
Enable saved_search_matches notifications for a user
"""

import asyncio
import os
import sys
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv


async def enable_saved_search_notifications(username: str):
    load_dotenv('.env.local')
    
    # Connect to MongoDB
    mongodb_url = os.getenv('MONGODB_URL')
    client = AsyncIOMotorClient(mongodb_url)
    db = client.matrimonialDB
    
    # Get current preferences
    prefs = await db.notification_preferences.find_one({'username': username})
    
    if not prefs:
        print(f"⚠️  No notification preferences found for {username}")
        print("Creating default preferences...")
        prefs = {
            'username': username,
            'channels': {},
            'quietHours': {'enabled': False},
            'rateLimit': {}
        }
    
    # Enable saved_search_matches for email
    channels = prefs.get('channels', {})
    if 'saved_search_matches' not in channels:
        channels['saved_search_matches'] = ['email']
        print(f"✅ Enabled saved_search_matches notifications for {username}")
    else:
        if 'email' not in channels['saved_search_matches']:
            channels['saved_search_matches'].append('email')
            print(f"✅ Added email channel to saved_search_matches for {username}")
        else:
            print(f"ℹ️  saved_search_matches email notifications already enabled for {username}")
    
    # Update preferences
    await db.notification_preferences.update_one(
        {'username': username},
        {'$set': {'channels': channels}},
        upsert=True
    )
    
    print(f"\n📋 Updated notification preferences for {username}:")
    print(f"   saved_search_matches: {channels.get('saved_search_matches', [])}")
    
    # Close connection
    client.close()


if __name__ == "__main__":
    username = sys.argv[1] if len(sys.argv) > 1 else 'admin'
    asyncio.run(enable_saved_search_notifications(username))
