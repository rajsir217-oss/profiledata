#!/usr/bin/env python3
"""
Migration: Add contactEmailHash and contactNumberHash fields to existing users
This enables O(1) uniqueness checking for encrypted email/phone fields.

Run: python -m migrations.add_email_phone_hash
"""

import asyncio
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from motor.motor_asyncio import AsyncIOMotorClient
from crypto_utils import PIIEncryption, get_encryptor
from config import settings
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def migrate():
    """Add hash fields to all existing users for email/phone uniqueness checking"""
    
    # Connect to MongoDB
    client = AsyncIOMotorClient(settings.mongodb_url)
    db = client[settings.database_name]
    
    logger.info("🚀 Starting migration: Add email/phone hash fields")
    
    # Get encryptor for decrypting existing data
    try:
        encryptor = get_encryptor()
    except Exception as e:
        logger.error(f"❌ Failed to initialize encryptor: {e}")
        return
    
    # Find all users
    total_users = await db.users.count_documents({})
    logger.info(f"📊 Total users to process: {total_users}")
    
    updated_count = 0
    skipped_count = 0
    error_count = 0
    
    cursor = db.users.find({})
    
    async for user in cursor:
        username = user.get("username", "unknown")
        update_fields = {}
        
        try:
            # Process contactEmail
            contact_email = user.get("contactEmail")
            if contact_email:
                # Check if already has hash
                if not user.get("contactEmailHash"):
                    # Decrypt if encrypted
                    if encryptor.is_encrypted(contact_email):
                        plain_email = encryptor.decrypt(contact_email)
                    else:
                        plain_email = contact_email
                    
                    if plain_email:
                        email_hash = PIIEncryption.hash_for_lookup(plain_email)
                        update_fields["contactEmailHash"] = email_hash
            
            # Process contactNumber
            contact_number = user.get("contactNumber")
            if contact_number:
                # Check if already has hash
                if not user.get("contactNumberHash"):
                    # Decrypt if encrypted
                    if encryptor.is_encrypted(contact_number):
                        plain_phone = encryptor.decrypt(contact_number)
                    else:
                        plain_phone = contact_number
                    
                    if plain_phone:
                        phone_hash = PIIEncryption.hash_for_lookup(plain_phone)
                        update_fields["contactNumberHash"] = phone_hash
            
            # Update user if we have new fields
            if update_fields:
                await db.users.update_one(
                    {"_id": user["_id"]},
                    {"$set": update_fields}
                )
                updated_count += 1
                logger.debug(f"✅ Updated user: {username}")
            else:
                skipped_count += 1
                
        except Exception as e:
            error_count += 1
            logger.error(f"❌ Error processing user {username}: {e}")
    
    logger.info(f"\n📊 Migration Complete:")
    logger.info(f"   ✅ Updated: {updated_count}")
    logger.info(f"   ⏭️  Skipped (already has hash or no email/phone): {skipped_count}")
    logger.info(f"   ❌ Errors: {error_count}")
    
    # Create indexes for the hash fields
    logger.info("\n🔧 Creating indexes...")
    try:
        await db.users.create_index("contactEmailHash", unique=True, sparse=True)
        logger.info("   ✅ Created unique sparse index on contactEmailHash")
    except Exception as e:
        logger.warning(f"   ⚠️ Index contactEmailHash may already exist: {e}")
    
    try:
        await db.users.create_index("contactNumberHash", unique=True, sparse=True)
        logger.info("   ✅ Created unique sparse index on contactNumberHash")
    except Exception as e:
        logger.warning(f"   ⚠️ Index contactNumberHash may already exist: {e}")
    
    logger.info("\n✅ Migration complete!")
    
    client.close()


if __name__ == "__main__":
    asyncio.run(migrate())
