#!/usr/bin/env python3
# fastapi_backend/migrations/rotate_encryption_key.py
"""
Encryption Key Rotation Script

Decrypts all PII with OLD key and re-encrypts with NEW key.

Usage:
    # Preview changes
    ENCRYPTION_KEY_OLD="old-key" ENCRYPTION_KEY_NEW="new-key" python rotate_encryption_key.py --dry-run
    
    # Execute rotation
    ENCRYPTION_KEY_OLD="old-key" ENCRYPTION_KEY_NEW="new-key" python rotate_encryption_key.py
    
    # Verify rotation
    ENCRYPTION_KEY_NEW="new-key" python rotate_encryption_key.py --verify
"""

import asyncio
import sys
import os
from pathlib import Path
from datetime import datetime
import argparse

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from motor.motor_asyncio import AsyncIOMotorClient
from config import settings
from crypto_utils import PIIEncryption
import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


async def rotate_encryption_key(dry_run=False):
    """
    Rotate encryption key - decrypt with old key, encrypt with new key
    
    Args:
        dry_run: If True, preview changes without applying
    """
    logger.info("=" * 60)
    logger.info("🔄 ENCRYPTION KEY ROTATION")
    logger.info("=" * 60)
    
    if dry_run:
        logger.info("🔍 DRY RUN MODE - No changes will be made")
    
    # Get keys from environment
    old_key = os.getenv('ENCRYPTION_KEY_OLD')
    new_key = os.getenv('ENCRYPTION_KEY_NEW') or os.getenv('ENCRYPTION_KEY')
    
    if not old_key:
        logger.error("❌ ENCRYPTION_KEY_OLD environment variable required")
        logger.error("💡 Usage: ENCRYPTION_KEY_OLD='old-key' ENCRYPTION_KEY_NEW='new-key' python rotate_encryption_key.py")
        return
    
    if not new_key:
        logger.error("❌ ENCRYPTION_KEY_NEW environment variable required")
        return
    
    if old_key == new_key:
        logger.error("❌ Old and new keys are the same!")
        return
    
    logger.info(f"🔑 Old key: {old_key[:20]}...")
    logger.info(f"🔑 New key: {new_key[:20]}...")
    
    # Initialize encryptors
    logger.info("🔧 Initializing encryption engines...")
    try:
        old_encryptor = PIIEncryption(old_key)
        new_encryptor = PIIEncryption(new_key)
    except Exception as e:
        logger.error(f"❌ Failed to initialize encryptors: {e}")
        return
    
    # Connect to MongoDB
    logger.info(f"📡 Connecting to MongoDB: {settings.mongodb_url}")
    client = AsyncIOMotorClient(settings.mongodb_url)
    db = client[settings.database_name]
    
    try:
        await client.admin.command('ping')
        logger.info("✅ Connected to MongoDB")
    except Exception as e:
        logger.error(f"❌ Failed to connect to MongoDB: {e}")
        return
    
    # Fields to rotate
    encrypted_fields = list(PIIEncryption.ENCRYPTED_FIELDS)
    logger.info(f"🔐 Fields to rotate: {', '.join(encrypted_fields)}")
    
    # Count total users
    total_users = await db.users.count_documents({})
    logger.info(f"👥 Total users in database: {total_users}")
    
    if total_users == 0:
        logger.info("ℹ️  No users to rotate")
        client.close()
        return
    
    # Process users
    logger.info(f"🚀 Starting rotation...")
    print()
    
    processed = 0
    rotated_count = 0
    skipped_count = 0
    error_count = 0
    
    cursor = db.users.find({})
    
    async for user in cursor:
        username = user.get('username', 'UNKNOWN')
        
        try:
            update_doc = {}
            fields_rotated = []
            
            for field in encrypted_fields:
                if field not in user or not user[field]:
                    continue
                
                encrypted_value = user[field]
                
                # Check if already encrypted (shouldn't be with old key after rotation)
                if not old_encryptor.is_encrypted(encrypted_value):
                    logger.debug(f"  ⏭️  {field} not encrypted, skipping")
                    continue
                
                try:
                    # Decrypt with OLD key
                    decrypted_value = old_encryptor.decrypt(encrypted_value)
                    
                    if decrypted_value is None:
                        logger.warning(f"  ⚠️  {field} decryption returned None")
                        continue
                    
                    # Re-encrypt with NEW key
                    re_encrypted_value = new_encryptor.encrypt(decrypted_value)
                    
                    update_doc[field] = re_encrypted_value
                    fields_rotated.append(field)
                    
                    logger.debug(f"  🔄 {field}: decrypted → re-encrypted")
                    
                except Exception as field_err:
                    logger.error(f"  ❌ Failed to rotate {field}: {field_err}")
                    error_count += 1
            
            if update_doc:
                if not dry_run:
                    # Apply update
                    result = await db.users.update_one(
                        {"username": username},
                        {"$set": update_doc}
                    )
                    
                    if result.modified_count > 0:
                        logger.info(f"✅ {username}: Re-encrypted {len(fields_rotated)} fields: {', '.join(fields_rotated)}")
                        rotated_count += 1
                    else:
                        logger.warning(f"⚠️  {username}: Update did not modify document")
                else:
                    logger.info(f"🔍 [DRY RUN] Would re-encrypt {username}: {', '.join(fields_rotated)}")
                    rotated_count += 1
            else:
                logger.debug(f"⏭️  Skipping {username} (no fields to rotate)")
                skipped_count += 1
            
            processed += 1
            
            # Progress indicator
            if processed % 10 == 0:
                logger.info(f"📊 Progress: {processed}/{total_users} users processed...")
        
        except Exception as user_err:
            logger.error(f"❌ Error processing {username}: {user_err}")
            error_count += 1
            processed += 1
    
    # Summary
    print()
    logger.info("=" * 60)
    logger.info("📊 ROTATION SUMMARY")
    logger.info("=" * 60)
    logger.info(f"Total users:      {total_users}")
    logger.info(f"Processed:        {processed}")
    logger.info(f"Re-encrypted:     {rotated_count}")
    logger.info(f"Skipped:          {skipped_count}")
    logger.info(f"Errors:           {error_count}")
    
    if dry_run:
        logger.info("=" * 60)
        logger.info("🔍 DRY RUN COMPLETE - No changes were made")
        logger.info("💡 Run without --dry-run to apply changes")
    else:
        logger.info("=" * 60)
        logger.info("✅ KEY ROTATION COMPLETE")
        logger.info("⚠️  IMPORTANT: Verify rotation before disabling old key!")
    
    logger.info("=" * 60)
    
    client.close()


async def verify_rotation():
    """
    Verify that all data is encrypted with NEW key
    """
    logger.info("=" * 60)
    logger.info("🔍 VERIFYING KEY ROTATION")
    logger.info("=" * 60)
    
    new_key = os.getenv('ENCRYPTION_KEY_NEW') or os.getenv('ENCRYPTION_KEY')
    
    if not new_key:
        logger.error("❌ ENCRYPTION_KEY_NEW environment variable required")
        return
    
    # Initialize new encryptor
    new_encryptor = PIIEncryption(new_key)
    
    # Connect to MongoDB
    client = AsyncIOMotorClient(settings.mongodb_url)
    db = client[settings.database_name]
    
    logger.info("📡 Checking encrypted data...")
    
    encrypted_fields = list(PIIEncryption.ENCRYPTED_FIELDS)
    
    # Sample 10 users
    users = await db.users.find({}).limit(10).to_list(length=10)
    
    if not users:
        logger.warning("⚠️  No users found to verify")
        client.close()
        return
    
    all_good = True
    
    for user in users:
        username = user.get('username', 'UNKNOWN')
        logger.info(f"\n👤 Checking {username}...")
        
        for field in encrypted_fields:
            if field not in user or not user[field]:
                continue
            
            encrypted_value = user[field]
            
            # Check if encrypted
            if not new_encryptor.is_encrypted(encrypted_value):
                logger.error(f"  ❌ {field} is NOT encrypted!")
                all_good = False
                continue
            
            # Try to decrypt with NEW key
            try:
                decrypted_value = new_encryptor.decrypt(encrypted_value)
                if decrypted_value:
                    logger.info(f"  ✅ {field}: Encrypted with NEW key & decryptable")
                else:
                    logger.error(f"  ❌ {field}: Decryption returned None")
                    all_good = False
            except Exception as e:
                logger.error(f"  ❌ {field}: Cannot decrypt with NEW key: {e}")
                logger.error(f"      This field may still be encrypted with OLD key!")
                all_good = False
    
    if all_good:
        logger.info("\n" + "=" * 60)
        logger.info("✅ VERIFICATION PASSED")
        logger.info("All sampled data is encrypted with NEW key")
        logger.info("=" * 60)
    else:
        logger.error("\n" + "=" * 60)
        logger.error("❌ VERIFICATION FAILED")
        logger.error("Some data may still use OLD key or is corrupted")
        logger.error("DO NOT disable old key yet!")
        logger.error("=" * 60)
    
    client.close()


def main():
    parser = argparse.ArgumentParser(description='Rotate encryption key')
    parser.add_argument('--dry-run', action='store_true', help='Preview changes without applying')
    parser.add_argument('--verify', action='store_true', help='Verify rotation after completion')
    
    args = parser.parse_args()
    
    if args.verify:
        # Verify rotation
        asyncio.run(verify_rotation())
    else:
        # Run rotation
        asyncio.run(rotate_encryption_key(dry_run=args.dry_run))


if __name__ == "__main__":
    main()
