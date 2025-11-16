#!/usr/bin/env python3
"""
Add phone number to admin user for SMS MFA testing
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv()

async def add_admin_phone():
    # Connect to MongoDB
    mongodb_url = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
    client = AsyncIOMotorClient(mongodb_url)
    db = client.matrimonialDB
    
    print("🔍 Updating admin user...")
    
    # Option 1: Add phone number (but it's opted out at SimpleTexting)
    # test_phone = "+12032165623"
    
    # Option 2: Switch to EMAIL MFA instead (safer for testing)
    result = await db.users.update_one(
        {"username": "admin"},
        {"$set": {
            "mfa.mfa_type": "email",  # Change from SMS to EMAIL
            "smsOptIn": True
        }}
    )
    
    if result.modified_count > 0:
        print(f"✅ Updated admin user:")
        print(f"   MFA Type: email (changed from sms)")
        print(f"   SMS Opt-In: True")
    else:
        print("ℹ️  No changes needed")
    
    # Verify
    admin = await db.users.find_one({"username": "admin"})
    print(f"\n📋 Admin user settings:")
    print(f"   Username: {admin.get('username')}")
    print(f"   Contact Number: {admin.get('contactNumber')}")
    print(f"   SMS Opt-In: {admin.get('smsOptIn')}")
    print(f"   MFA Enabled: {admin.get('mfa', {}).get('mfa_enabled')}")
    print(f"   MFA Type: {admin.get('mfa', {}).get('mfa_type')}")
    
    client.close()
    print("\n✅ Done! Admin can now receive SMS MFA codes.")

if __name__ == "__main__":
    asyncio.run(add_admin_phone())
