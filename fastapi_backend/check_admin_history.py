#!/usr/bin/env python3
"""
Check admin user contact info history
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
from bson import ObjectId

load_dotenv()

async def check_admin():
    mongodb_url = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
    client = AsyncIOMotorClient(mongodb_url)
    db = client.matrimonialDB
    
    print("🔍 Checking admin user contact information...\n")
    
    # Get admin user
    admin = await db.users.find_one({"username": "admin"})
    
    if not admin:
        print("❌ Admin user not found")
        return
    
    print("📋 Current Admin User Document:")
    print("="*60)
    print(f"Username: {admin.get('username')}")
    print(f"Contact Email: {admin.get('contactEmail')}")
    print(f"Contact Number: {admin.get('contactNumber')}")
    print(f"SMS Opt-In: {admin.get('smsOptIn')}")
    print(f"Created At: {admin.get('createdAt', 'N/A')}")
    print(f"Updated At: {admin.get('updatedAt', 'N/A')}")
    
    # Check MFA settings
    mfa = admin.get('mfa', {})
    print(f"\n🔐 MFA Settings:")
    print(f"MFA Enabled: {mfa.get('mfa_enabled')}")
    print(f"MFA Type: {mfa.get('mfa_type')}")
    print(f"MFA Enabled At: {mfa.get('mfa_enabled_at', 'N/A')}")
    
    # Check if contactNumber field exists at all
    print(f"\n🔎 Field Analysis:")
    print(f"'contactNumber' in document: {'contactNumber' in admin}")
    print(f"'contactEmail' in document: {'contactEmail' in admin}")
    
    # Check activity logs for admin changes
    print(f"\n📜 Recent Activity Logs (last 10):")
    logs = await db.activity_logs.find(
        {"username": "admin"}
    ).sort("timestamp", -1).limit(10).to_list(length=10)
    
    if logs:
        for log in logs:
            timestamp = log.get('timestamp', 'N/A')
            action = log.get('action', 'N/A')
            details = log.get('details', {})
            print(f"  {timestamp} - {action}")
            if 'changes' in details:
                print(f"    Changes: {details['changes']}")
    else:
        print("  No activity logs found")
    
    client.close()
    print("\n" + "="*60)

if __name__ == "__main__":
    asyncio.run(check_admin())
