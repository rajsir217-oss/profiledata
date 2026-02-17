#!/usr/bin/env python3
"""
Check password reset encryption issues
"""

import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

# Load production environment
load_dotenv('fastapi_backend/.env.production')

async def check_password_reset_issue():
    """Check password reset encryption issues"""
    
    # Get MongoDB URL from production env
    mongodb_url = os.getenv('MONGODB_URL')
    database_name = os.getenv('DATABASE_NAME', 'matrimonialDB')
    
    if not mongodb_url:
        print("❌ MONGODB_URL not found in .env.production")
        return
    
    print(f"🔗 Connecting to MongoDB: {database_name}")
    
    try:
        # Connect to MongoDB
        client = AsyncIOMotorClient(mongodb_url)
        db = client[database_name]
        
        # Test connection
        await client.server_info()
        print("✅ Connected to production MongoDB")
        
        # Get encryption key
        encryption_key = os.getenv('ENCRYPTION_KEY')
        if not encryption_key:
            print("❌ ENCRYPTION_KEY not found in environment")
            return
        
        print(f"🔑 Encryption key found: {encryption_key[:20]}...")
        
        # Initialize encryptor
        from crypto_utils import get_encryptor
        encryptor = get_encryptor()
        
        # Check a few users with encrypted emails
        users_cursor = db.users.find({}, {"username": 1, "contactEmail": 1, "email": 1}).limit(10)
        users = await users_cursor.to_list(10)
        
        print(f"\n📊 Checking {len(users)} users for encryption issues:")
        print("=" * 60)
        
        for i, user in enumerate(users, 1):
            username = user.get("username", "unknown")
            encrypted_email = user.get("contactEmail")
            plain_email = user.get("email")
            
            print(f"\n{i}. User: {username}")
            print(f"   Plain email field: {plain_email}")
            print(f"   Encrypted email: {encrypted_email[:50] if encrypted_email else 'None'}...")
            
            if encrypted_email:
                try:
                    decrypted_email = encryptor.decrypt(encrypted_email)
                    print(f"   ✅ Decrypted successfully: {decrypted_email}")
                except Exception as e:
                    print(f"   ❌ Decryption failed: {e}")
                    print(f"   🔍 This is likely the issue!")
        
        # Check password reset codes
        reset_codes_cursor = db.password_reset_codes.find({}).sort("created_at", -1).limit(5)
        reset_codes = await reset_codes_cursor.to_list(5)
        
        print(f"\n🔄 Recent password reset codes:")
        print("=" * 60)
        
        for i, code in enumerate(reset_codes, 1):
            username = code.get("username")
            created_at = code.get("created_at")
            used = code.get("used", False)
            expires_at = code.get("expires_at")
            
            print(f"{i}. User: {username}")
            print(f"   Created: {created_at}")
            print(f"   Used: {used}")
            print(f"   Expires: {expires_at}")
            print(f"   Code: {code.get('code')}")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        if 'client' in locals():
            await client.close()
            print("🔌 Disconnected from MongoDB")

if __name__ == "__main__":
    asyncio.run(check_password_reset_issue())
