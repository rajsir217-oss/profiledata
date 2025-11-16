#!/usr/bin/env python3
"""
Check if new notification was created with correct template data
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
import json

load_dotenv('.env.local')

async def check_notification():
    client = AsyncIOMotorClient(os.getenv("MONGODB_URL"))
    db = client.matrimonialDB
    
    print("🔍 Checking for new shortlist_added notification...\n")
    
    # Find the most recent shortlist_added notification
    notification = await db.notification_queue.find_one(
        {
            "trigger": "shortlist_added",
            "username": "admin"
        },
        sort=[("createdAt", -1)]
    )
    
    if not notification:
        print("❌ NO notification found!")
        print("\n🚨 PROBLEM: Event dispatcher not running or not processing events")
        print("\n✅ SOLUTION:")
        print("   1. Make sure backend is running: ./bstart.sh")
        print("   2. Check backend logs for errors")
        print("   3. Verify Redis is running")
        client.close()
        return
    
    print(f"✅ Found notification (ID: {notification['_id']})")
    print(f"   Status: {notification.get('status')}")
    print(f"   Created: {notification.get('createdAt')}")
    print(f"\n📊 Template Data:")
    
    template_data = notification.get('templateData', {})
    print(json.dumps(template_data, indent=2))
    
    # Check if it has the NEW data structure
    actor = template_data.get('actor', {})
    user = template_data.get('user', {})
    
    print("\n🔍 Validation:")
    
    if 'actor' in template_data:
        print("   ✅ Has 'actor' data")
        if actor.get('firstName') and actor.get('firstName') != 'siddharthdas007':
            print(f"   ✅ Actor firstName: {actor.get('firstName')} (REAL NAME!)")
        else:
            print(f"   ❌ Actor firstName: {actor.get('firstName')} (still username!)")
        
        if actor.get('lastName'):
            print(f"   ✅ Actor lastName: {actor.get('lastName')}")
        
        if actor.get('location'):
            print(f"   ✅ Actor location: {actor.get('location')}")
        
        if actor.get('occupation'):
            print(f"   ✅ Actor occupation: {actor.get('occupation')}")
        
        if actor.get('age'):
            print(f"   ✅ Actor age: {actor.get('age')}")
    else:
        print("   ❌ NO 'actor' data!")
    
    if 'user' in template_data:
        print(f"   ✅ Has 'user' data")
        if user.get('firstName'):
            print(f"   ✅ User firstName: {user.get('firstName')}")
    else:
        print("   ❌ NO 'user' data!")
    
    print("\n")
    
    if actor.get('firstName') and actor.get('firstName') != 'siddharthdas007' and 'user' in template_data:
        print("🎉 SUCCESS! Notification has CORRECT template data!")
        print("📧 Now run the Email Notifier job to send it.")
    else:
        print("🚨 PROBLEM: Template data is still incorrect!")
        print("\n❌ Backend was NOT restarted with new code!")
        print("✅ SOLUTION: Restart backend now:")
        print("   cd /Users/rajsiripuram02/opt/appsrc/profiledata")
        print("   ./bstart.sh")
        print("\n   Then run this script again to trigger a new event:")
        print("   python3 delete_and_recreate_notification.py")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(check_notification())
