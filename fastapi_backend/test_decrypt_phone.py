#!/usr/bin/env python3
"""
Test decrypting admin phone number
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from config import settings
from crypto_utils import get_encryptor

async def test_decrypt():
    """Decrypt admin phone"""
    # Connect to MongoDB
    client = AsyncIOMotorClient(settings.mongodb_url)
    db = client[settings.database_name]
    
    # Get admin user
    admin = await db.users.find_one({"username": "admin"})
    
    encrypted_phone = admin.get('contactNumber')
    print(f"Encrypted phone: {encrypted_phone}")
    
    # Decrypt
    encryptor = get_encryptor()
    decrypted_phone = encryptor.decrypt(encrypted_phone)
    print(f"Decrypted phone: {decrypted_phone}")
    print(f"Length: {len(decrypted_phone)}")
    print(f"Type: {type(decrypted_phone)}")
    
    # Close connection
    client.close()

if __name__ == "__main__":
    asyncio.run(test_decrypt())
