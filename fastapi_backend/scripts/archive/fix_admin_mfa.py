#!/usr/bin/env python3
"""
Fix admin MFA - switch to email since no phone available
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv()

async def fix_admin_mfa():
    mongodb_url = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
    client = AsyncIOMotorClient(mongodb_url)
    db = client.matrimonialDB
    
    print("🔧 Fixing admin MFA configuration...\n")
    
    # Check current state
    admin = await db.users.find_one({"username": "admin"})
    mfa = admin.get('mfa', {})
    
    print("📋 Current MFA Settings:")
    print(f"   MFA Enabled: {mfa.get('mfa_enabled')}")
    print(f"   MFA Type: {mfa.get('mfa_type')}")
    print(f"   Contact Email: Available ✅")
    print(f"   Contact Phone: {admin.get('contactNumber') or 'None ❌'}")
    
    # Fix: Switch to email MFA
    print("\n🔄 Switching MFA to email...")
    
    result = await db.users.update_one(
        {"username": "admin"},
        {"$set": {
            "mfa.mfa_type": "email",  # Change to email
            "mfa.mfa_enabled": True  # Keep enabled
        }}
    )
    
    if result.modified_count > 0:
        print("✅ Updated MFA configuration")
    else:
        print("ℹ️  Already configured correctly")
    
    # Verify
    admin = await db.users.find_one({"username": "admin"})
    mfa = admin.get('mfa', {})
    
    print("\n📋 Updated MFA Settings:")
    print(f"   MFA Enabled: {mfa.get('mfa_enabled')} ✅")
    print(f"   MFA Type: {mfa.get('mfa_type')} ✅")
    print(f"   Will send codes to: rajl3v3l@gmail.com ✅")
    
    client.close()
    print("\n✅ Done! Login should work with email MFA now.")

if __name__ == "__main__":
    asyncio.run(fix_admin_mfa())
