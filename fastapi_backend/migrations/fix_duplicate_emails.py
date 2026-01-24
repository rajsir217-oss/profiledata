#!/usr/bin/env python3
"""
Script to fix duplicate emails/phones by assigning random unique values to duplicates.
Keeps the first (oldest) occurrence, updates others with random emails/phones.

Run: python -m migrations.fix_duplicate_emails
"""

import asyncio
import sys
import os
import uuid
from collections import defaultdict

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from motor.motor_asyncio import AsyncIOMotorClient
from crypto_utils import PIIEncryption, get_encryptor
from config import settings
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def generate_random_email(username):
    """Generate a random unique email for a user"""
    random_id = uuid.uuid4().hex[:8]
    return f"{username}.{random_id}@placeholder.local"


def generate_random_phone():
    """Generate a random unique phone number"""
    import random
    return f"000{random.randint(1000000, 9999999)}"


async def fix_duplicates():
    """Fix duplicate emails/phones by assigning random values to duplicates"""
    
    # Connect to MongoDB
    client = AsyncIOMotorClient(settings.mongodb_url)
    db = client[settings.database_name]
    
    logger.info("🔧 Fixing duplicate emails and phone numbers...")
    
    # Get encryptor
    try:
        encryptor = get_encryptor()
    except Exception as e:
        logger.error(f"❌ Failed to initialize encryptor: {e}")
        return
    
    # Collect all emails and phones with their user info
    email_to_users = defaultdict(list)
    phone_to_users = defaultdict(list)
    
    cursor = db.users.find({}, {"_id": 1, "username": 1, "contactEmail": 1, "contactNumber": 1, "contactEmailHash": 1, "contactNumberHash": 1, "createdAt": 1})
    
    async for user in cursor:
        user_id = user.get("_id")
        username = user.get("username", "unknown")
        created_at = user.get("createdAt", "9999")
        
        # Process email
        contact_email = user.get("contactEmail")
        if contact_email:
            try:
                if encryptor.is_encrypted(contact_email):
                    plain_email = encryptor.decrypt(contact_email)
                else:
                    plain_email = contact_email
                
                if plain_email:
                    normalized = plain_email.lower().strip()
                    email_to_users[normalized].append({
                        "_id": user_id,
                        "username": username,
                        "created_at": str(created_at)
                    })
            except Exception as e:
                logger.warning(f"⚠️ Could not process email for {username}: {e}")
        
        # Process phone
        contact_number = user.get("contactNumber")
        if contact_number:
            try:
                if encryptor.is_encrypted(contact_number):
                    plain_phone = encryptor.decrypt(contact_number)
                else:
                    plain_phone = contact_number
                
                if plain_phone:
                    normalized = plain_phone.lower().strip()
                    phone_to_users[normalized].append({
                        "_id": user_id,
                        "username": username,
                        "created_at": str(created_at)
                    })
            except Exception as e:
                logger.warning(f"⚠️ Could not process phone for {username}: {e}")
    
    email_fixed = 0
    phone_fixed = 0
    
    # Fix duplicate emails
    for email, users in email_to_users.items():
        if len(users) > 1:
            # Sort by created_at to keep the oldest
            users.sort(key=lambda x: x["created_at"])
            kept = users[0]
            logger.info(f"📧 {email}: keeping {kept['username']}, fixing {len(users)-1} duplicates")
            
            # Update all except the first with random emails
            for user in users[1:]:
                new_email = generate_random_email(user["username"])
                encrypted_email = encryptor.encrypt(new_email)
                new_hash = PIIEncryption.hash_for_lookup(new_email)
                
                await db.users.update_one(
                    {"_id": user["_id"]},
                    {"$set": {
                        "contactEmail": encrypted_email,
                        "contactEmailHash": new_hash
                    }}
                )
                email_fixed += 1
                logger.info(f"   └── {user['username']}: {email} → {new_email}")
    
    # Fix duplicate phones
    for phone, users in phone_to_users.items():
        if len(users) > 1:
            # Sort by created_at to keep the oldest
            users.sort(key=lambda x: x["created_at"])
            kept = users[0]
            logger.info(f"📱 {phone}: keeping {kept['username']}, fixing {len(users)-1} duplicates")
            
            # Update all except the first with random phones
            for user in users[1:]:
                new_phone = generate_random_phone()
                encrypted_phone = encryptor.encrypt(new_phone)
                new_hash = PIIEncryption.hash_for_lookup(new_phone)
                
                await db.users.update_one(
                    {"_id": user["_id"]},
                    {"$set": {
                        "contactNumber": encrypted_phone,
                        "contactNumberHash": new_hash
                    }}
                )
                phone_fixed += 1
                logger.info(f"   └── {user['username']}: {phone} → {new_phone}")
    
    logger.info(f"\n📊 Fix Complete:")
    logger.info(f"   📧 Emails updated: {email_fixed}")
    logger.info(f"   📱 Phones updated: {phone_fixed}")
    
    # Now try to create the indexes
    logger.info("\n🔧 Creating unique indexes...")
    try:
        await db.users.create_index("contactEmailHash", unique=True, sparse=True)
        logger.info("   ✅ Created unique sparse index on contactEmailHash")
    except Exception as e:
        logger.error(f"   ❌ Failed to create contactEmailHash index: {e}")
    
    try:
        await db.users.create_index("contactNumberHash", unique=True, sparse=True)
        logger.info("   ✅ Created unique sparse index on contactNumberHash")
    except Exception as e:
        logger.error(f"   ❌ Failed to create contactNumberHash index: {e}")
    
    logger.info("\n✅ Done!")
    
    client.close()


if __name__ == "__main__":
    asyncio.run(fix_duplicates())
