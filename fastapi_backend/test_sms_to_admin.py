#!/usr/bin/env python3
"""
Test sending SMS to the newly registered admin phone
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
from services.simpletexting_service import SimpleTextingService

load_dotenv()

async def test_sms_admin():
    # Connect to MongoDB
    mongodb_url = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
    client = AsyncIOMotorClient(mongodb_url)
    db = client.matrimonialDB
    
    print("🔍 Checking admin user...\n")
    
    # Get admin
    admin = await db.users.find_one({"username": "admin"})
    
    if not admin:
        print("❌ Admin not found")
        return
    
    from crypto_utils import get_encryptor
    encryptor = get_encryptor()
    
    # Decrypt phone
    encrypted_phone = admin.get('contactNumber')
    
    if encrypted_phone and encrypted_phone.startswith("gAAAAA"):
        phone = encryptor.decrypt(encrypted_phone)
    else:
        phone = encrypted_phone
    
    print(f"📋 Admin Info:")
    print(f"   Username: {admin.get('username')}")
    print(f"   Phone: {phone}")
    print(f"   SMS Opt-In: {admin.get('smsOptIn')}")
    print(f"   MFA Enabled: {admin.get('mfa', {}).get('mfa_enabled')}")
    print(f"   MFA Type: {admin.get('mfa', {}).get('mfa_type')}")
    
    if not phone:
        print("\n❌ No phone number found!")
        client.close()
        return
    
    # Test sending SMS
    print(f"\n📤 Testing SMS send to {phone}...")
    
    service = SimpleTextingService()
    
    if not service.enabled:
        print("❌ SimpleTexting service not enabled!")
        print("   Check SIMPLETEXTING_API_TOKEN and SIMPLETEXTING_ACCOUNT_PHONE")
        client.close()
        return
    
    result = await service.send_otp(
        phone=phone,
        otp="123456",
        purpose="mfa",
        username="admin"
    )
    
    print("\n" + "="*60)
    if result["success"]:
        print("✅ SMS SENT SUCCESSFULLY!")
        print(f"   Message ID: {result.get('message_id')}")
        print(f"   Provider: {result.get('provider')}")
        print(f"\n📬 Check phone {phone} for message!")
    else:
        print("❌ SMS SEND FAILED!")
        print(f"   Error: {result.get('error')}")
        if "details" in result:
            print(f"   Details: {result['details']}")
    print("="*60)
    
    client.close()

if __name__ == "__main__":
    asyncio.run(test_sms_admin())
