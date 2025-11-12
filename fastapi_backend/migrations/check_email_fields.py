#!/usr/bin/env python3
"""
Quick script to check email vs contactEmail field usage
"""

import sys
from pathlib import Path
sys.path.append(str(Path(__file__).parent.parent))

from motor.motor_asyncio import AsyncIOMotorClient
from config import Settings
import asyncio

settings = Settings()

async def check_email_fields():
    client = AsyncIOMotorClient(settings.mongodb_url)
    db = client[settings.database_name]
    
    try:
        print("🔍 Checking email vs contactEmail field usage...")
        print(f"📍 Database: {settings.database_name}")
        print("-" * 70)
        
        # Check email vs contactEmail
        has_both = await db.users.count_documents({
            'email': {'$exists': True}, 
            'contactEmail': {'$exists': True}
        })
        has_only_email = await db.users.count_documents({
            'email': {'$exists': True}, 
            'contactEmail': {'$exists': False}
        })
        has_only_contactEmail = await db.users.count_documents({
            'contactEmail': {'$exists': True}, 
            'email': {'$exists': False}
        })
        has_neither = await db.users.count_documents({
            'email': {'$exists': False}, 
            'contactEmail': {'$exists': False}
        })
        total = await db.users.count_documents({})
        
        print(f"📊 Results:")
        print(f"   • Total users: {total}")
        print(f"   • Has both email & contactEmail: {has_both}")
        print(f"   • Has only email: {has_only_email}")
        print(f"   • Has only contactEmail: {has_only_contactEmail}")
        print(f"   • Has neither: {has_neither}")
        print()
        
        # Sample users
        print("Sample users (first 5):")
        samples = await db.users.find(
            {},
            {'username': 1, 'email': 1, 'contactEmail': 1}
        ).limit(5).to_list(5)
        
        for user in samples:
            email = user.get('email', 'None')
            contactEmail = user.get('contactEmail', 'None')
            print(f"   • {user.get('username')}: email={email}, contactEmail={contactEmail}")
        
        print("-" * 70)
        
        # Recommendation
        if has_only_email > 0 or has_both > 0:
            print("\n💡 Recommendation:")
            if has_both > 0:
                print(f"   • {has_both} users have BOTH fields (redundant)")
            if has_only_email > 0:
                print(f"   • {has_only_email} users have only 'email' (should be contactEmail)")
            print("\n   ✅ Should consolidate to contactEmail (standard field)")
            print("   Run: python3 migrations/consolidate_email_to_contactEmail.py")
        else:
            print("\n✅ All users use contactEmail field correctly!")
        
    finally:
        client.close()

if __name__ == "__main__":
    asyncio.run(check_email_fields())
