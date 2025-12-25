#!/usr/bin/env python3
"""
Fix admin user's SMS opt-in status
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv()

async def fix_admin_sms():
    # Connect to MongoDB
    mongodb_url = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
    client = AsyncIOMotorClient(mongodb_url)
    db = client.matrimonialDB
    
    print("🔍 Checking admin user...")
    
    # Find admin user
    admin = await db.users.find_one({"username": "admin"})
    
    if not admin:
        print("❌ Admin user not found")
        return
    
    print(f"\n📋 Current admin settings:")
    print(f"   Username: {admin.get('username')}")
    print(f"   Contact Number: {admin.get('contactNumber', 'N/A')}")
    print(f"   SMS Opt-In: {admin.get('smsOptIn', 'NOT SET')}")
    print(f"   MFA Enabled: {admin.get('mfa', {}).get('mfa_enabled', False)}")
    print(f"   MFA Type: {admin.get('mfa', {}).get('mfa_type', 'N/A')}")
    
    # Fix smsOptIn
    if admin.get("smsOptIn") == False:
        print("\n⚠️  SMS Opt-In is FALSE - fixing...")
        result = await db.users.update_one(
            {"username": "admin"},
            {"$set": {"smsOptIn": True}}
        )
        if result.modified_count > 0:
            print("✅ Updated smsOptIn to True")
        else:
            print("ℹ️  No update needed")
    else:
        print("\n✅ SMS Opt-In is already True or not set (defaults to True)")
    
    # Check again
    admin = await db.users.find_one({"username": "admin"})
    print(f"\n📋 Updated admin settings:")
    print(f"   SMS Opt-In: {admin.get('smsOptIn', 'NOT SET (defaults to True)')}")
    
    client.close()
    print("\n✅ Done!")

if __name__ == "__main__":
    asyncio.run(fix_admin_sms())
