#!/usr/bin/env python3
"""
Add phone number to admin for OTP testing
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv()

async def add_admin_phone():
    mongodb_url = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
    client = AsyncIOMotorClient(mongodb_url)
    db = client.matrimonialDB
    
    print("🔧 Adding phone to admin user...")
    
    # Use your personal phone for testing (replace with your number)
    your_phone = input("Enter phone number for admin (e.g., +15551234567): ").strip()
    
    if not your_phone:
        print("❌ No phone provided")
        return
    
    result = await db.users.update_one(
        {"username": "admin"},
        {"$set": {
            "contactNumber": your_phone,
            "smsOptIn": True
        }}
    )
    
    if result.modified_count > 0:
        print(f"✅ Updated admin:")
        print(f"   Phone: {your_phone}")
        print(f"   SMS Opt-In: True")
    else:
        print("ℹ️  Already set")
    
    # Verify
    admin = await db.users.find_one({"username": "admin"})
    print(f"\n📋 Admin settings:")
    print(f"   Contact Number: {admin.get('contactNumber')}")
    print(f"   Contact Email: {admin.get('contactEmail')}")
    print(f"   SMS Opt-In: {admin.get('smsOptIn')}")
    
    client.close()
    print("\n✅ Done!")

if __name__ == "__main__":
    asyncio.run(add_admin_phone())
