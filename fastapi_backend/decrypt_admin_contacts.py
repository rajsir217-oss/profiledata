#!/usr/bin/env python3
"""
Decrypt admin contact information
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
from crypto_utils import get_encryptor

load_dotenv()

async def decrypt_admin():
    mongodb_url = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
    client = AsyncIOMotorClient(mongodb_url)
    db = client.matrimonialDB
    
    print("🔓 Decrypting admin contact information...\n")
    
    # Get admin user
    admin = await db.users.find_one({"username": "admin"})
    
    if not admin:
        print("❌ Admin user not found")
        return
    
    encryptor = get_encryptor()
    
    # Decrypt contact info
    encrypted_email = admin.get('contactEmail', '')
    encrypted_phone = admin.get('contactNumber', '')
    
    print("📋 Encrypted Values:")
    if encrypted_email:
        print(f"Email: {encrypted_email[:50]}...")
    else:
        print(f"Email: None")
    
    if encrypted_phone:
        print(f"Phone: {encrypted_phone[:50]}...")
    else:
        print(f"Phone: None")
    
    print("\n🔓 Decrypted Values:")
    
    if encrypted_email and encrypted_email.startswith("gAAAAA"):
        try:
            decrypted_email = encryptor.decrypt(encrypted_email)
            print(f"✅ Email: {decrypted_email}")
        except Exception as e:
            print(f"❌ Email decryption failed: {e}")
    else:
        print(f"ℹ️  Email (not encrypted): {encrypted_email}")
    
    if encrypted_phone and encrypted_phone.startswith("gAAAAA"):
        try:
            decrypted_phone = encryptor.decrypt(encrypted_phone)
            print(f"✅ Phone: {decrypted_phone}")
        except Exception as e:
            print(f"❌ Phone decryption failed: {e}")
    else:
        print(f"ℹ️  Phone (not encrypted): {encrypted_phone}")
    
    # Check MFA status too
    print(f"\n🔐 MFA Settings:")
    mfa = admin.get('mfa', {})
    print(f"MFA Enabled: {mfa.get('mfa_enabled', False)}")
    print(f"MFA Type: {mfa.get('mfa_type', 'None')}")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(decrypt_admin())
