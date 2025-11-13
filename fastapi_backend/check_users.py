#!/usr/bin/env python3
"""Quick script to check existing users for password reset testing"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from config import Settings

settings = Settings()

async def check_users():
    client = AsyncIOMotorClient(settings.mongodb_url)
    db = client[settings.database_name]
    
    print("\n" + "="*60)
    print("📊 EXISTING USERS IN DATABASE")
    print("="*60 + "\n")
    
    users = await db.users.find({}, {"username": 1, "contactEmail": 1, "firstName": 1, "lastName": 1}).to_list(100)
    
    if not users:
        print("❌ No users found in database!")
        return
    
    print(f"Found {len(users)} users:\n")
    for i, user in enumerate(users, 1):
        username = user.get("username", "N/A")
        email = user.get("contactEmail", "N/A")
        name = f"{user.get('firstName', '')} {user.get('lastName', '')}".strip() or "N/A"
        
        print(f"{i}. Username: {username}")
        print(f"   Email: {email}")
        print(f"   Name: {name}")
        print()
    
    print("="*60)
    print("💡 Use either username OR email for password reset")
    print("="*60 + "\n")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(check_users())
