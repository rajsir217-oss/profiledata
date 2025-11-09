#!/usr/bin/env python3
# fastapi_backend/migrations/encrypt_existing_pii.py
"""
Migration Script: Encrypt existing PII data in database

This script encrypts all PII fields in existing user documents.
Run this ONCE after deploying the encryption feature.

Usage:
    python migrations/encrypt_existing_pii.py [--dry-run] [--batch-size 100]

Options:
    --dry-run: Preview changes without applying them
    --batch-size N: Process N users at a time (default: 100)
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
from crypto_utils import PIIEncryption, get_encryptor
import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


async def encrypt_existing_pii(dry_run=False, batch_size=100):
    """
    Encrypt PII fields in all existing user documents
    
    Args:
        dry_run: If True, preview changes without applying
        batch_size: Number of users to process per batch
    """
    logger.info("=" * 60)
    logger.info("🔒 PII ENCRYPTION MIGRATION")
    logger.info("=" * 60)
    
    if dry_run:
        logger.info("🔍 DRY RUN MODE - No changes will be made")
    
    # Connect to MongoDB
    logger.info(f"📡 Connecting to MongoDB: {settings.mongodb_url}")
    client = AsyncIOMotorClient(settings.mongodb_url)
    db = client[settings.database_name]
    
    try:
        # Test connection
        await client.admin.command('ping')
        logger.info("✅ Connected to MongoDB")
    except Exception as e:
        logger.error(f"❌ Failed to connect to MongoDB: {e}")
        return
    
    # Initialize encryptor
    try:
        encryptor = get_encryptor()
        logger.info("✅ Encryption engine initialized")
    except Exception as e:
        logger.error(f"❌ Failed to initialize encryption: {e}")
        logger.error("💡 Make sure ENCRYPTION_KEY is set in .env")
        return
    
    # Fields to encrypt
    fields_to_encrypt = list(PIIEncryption.ENCRYPTED_FIELDS)
    logger.info(f"🔐 Fields to encrypt: {', '.join(fields_to_encrypt)}")
    
    # Count total users
    total_users = await db.users.count_documents({})
    logger.info(f"👥 Total users in database: {total_users}")
    
    if total_users == 0:
        logger.info("ℹ️  No users to migrate")
        return
    
    # Process in batches
    processed = 0
    encrypted_count = 0
    skipped_count = 0
    error_count = 0
    
    cursor = db.users.find({})
    
    logger.info(f"🚀 Starting migration (batch size: {batch_size})...")
    print()
    
    async for user in cursor:
        username = user.get('username', 'UNKNOWN')
        
        try:
            # Check if already encrypted (basic check)
            already_encrypted = False
            for field in fields_to_encrypt:
                if field in user and user[field]:
                    value = user[field]
                    if isinstance(value, str) and encryptor.is_encrypted(value):
                        already_encrypted = True
                        break
            
            if already_encrypted:
                logger.debug(f"⏭️  Skipping {username} (already encrypted)")
                skipped_count += 1
                processed += 1
                continue
            
            # Build update document
            update_doc = {}
            fields_encrypted = []
            
            for field in fields_to_encrypt:
                if field in user and user[field]:
                    original_value = user[field]
                    
                    # Skip if already encrypted
                    if isinstance(original_value, str) and encryptor.is_encrypted(original_value):
                        continue
                    
                    try:
                        encrypted_value = encryptor.encrypt(original_value)
                        update_doc[field] = encrypted_value
                        fields_encrypted.append(field)
                        logger.debug(f"  🔒 {field}: {original_value[:20]}... → [encrypted]")
                    except Exception as field_err:
                        logger.error(f"  ❌ Failed to encrypt {field}: {field_err}")
            
            if update_doc:
                if not dry_run:
                    # Apply update
                    result = await db.users.update_one(
                        {"username": username},
                        {"$set": update_doc}
                    )
                    
                    if result.modified_count > 0:
                        logger.info(f"✅ {username}: Encrypted {len(fields_encrypted)} fields: {', '.join(fields_encrypted)}")
                        encrypted_count += 1
                    else:
                        logger.warning(f"⚠️  {username}: Update did not modify document")
                else:
                    logger.info(f"🔍 [DRY RUN] Would encrypt {username}: {', '.join(fields_encrypted)}")
                    encrypted_count += 1
            else:
                logger.debug(f"⏭️  Skipping {username} (no PII to encrypt)")
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
    logger.info("📊 MIGRATION SUMMARY")
    logger.info("=" * 60)
    logger.info(f"Total users:      {total_users}")
    logger.info(f"Processed:        {processed}")
    logger.info(f"Encrypted:        {encrypted_count}")
    logger.info(f"Skipped:          {skipped_count}")
    logger.info(f"Errors:           {error_count}")
    
    if dry_run:
        logger.info("=" * 60)
        logger.info("🔍 DRY RUN COMPLETE - No changes were made")
        logger.info("💡 Run without --dry-run to apply changes")
    else:
        logger.info("=" * 60)
        logger.info("✅ MIGRATION COMPLETE")
        logger.info("⚠️  IMPORTANT: Keep your ENCRYPTION_KEY safe!")
        logger.info("⚠️  Data cannot be decrypted without it!")
    
    logger.info("=" * 60)
    
    # Close connection
    client.close()


async def verify_encryption():
    """
    Verify that encrypted data can be decrypted correctly
    Sample a few users and check round-trip encryption
    """
    logger.info("=" * 60)
    logger.info("🔍 VERIFYING ENCRYPTION")
    logger.info("=" * 60)
    
    client = AsyncIOMotorClient(settings.mongodb_url)
    db = client[settings.database_name]
    
    try:
        encryptor = get_encryptor()
        
        # Sample 5 users
        users = await db.users.find({}).limit(5).to_list(length=5)
        
        if not users:
            logger.warning("⚠️  No users found to verify")
            return
        
        all_good = True
        
        for user in users:
            username = user.get('username', 'UNKNOWN')
            logger.info(f"\n👤 Checking {username}...")
            
            for field in PIIEncryption.ENCRYPTED_FIELDS:
                if field in user and user[field]:
                    encrypted_value = user[field]
                    
                    # Check if encrypted
                    if not encryptor.is_encrypted(encrypted_value):
                        logger.warning(f"  ⚠️  {field} is NOT encrypted!")
                        all_good = False
                        continue
                    
                    # Try to decrypt
                    try:
                        decrypted_value = encryptor.decrypt(encrypted_value)
                        if decrypted_value:
                            logger.info(f"  ✅ {field}: Encrypted & decryptable")
                        else:
                            logger.error(f"  ❌ {field}: Decryption returned None")
                            all_good = False
                    except Exception as e:
                        logger.error(f"  ❌ {field}: Decryption failed: {e}")
                        all_good = False
        
        if all_good:
            logger.info("\n" + "=" * 60)
            logger.info("✅ VERIFICATION PASSED - All data encrypted correctly")
            logger.info("=" * 60)
        else:
            logger.error("\n" + "=" * 60)
            logger.error("❌ VERIFICATION FAILED - Issues detected")
            logger.error("=" * 60)
    
    except Exception as e:
        logger.error(f"❌ Verification error: {e}")
    finally:
        client.close()


def main():
    parser = argparse.ArgumentParser(description='Encrypt existing PII data in database')
    parser.add_argument('--dry-run', action='store_true', help='Preview changes without applying')
    parser.add_argument('--batch-size', type=int, default=100, help='Batch size for processing')
    parser.add_argument('--verify', action='store_true', help='Verify encryption after migration')
    
    args = parser.parse_args()
    
    # Run migration
    asyncio.run(encrypt_existing_pii(dry_run=args.dry_run, batch_size=args.batch_size))
    
    # Verify if requested
    if args.verify and not args.dry_run:
        print("\n")
        asyncio.run(verify_encryption())


if __name__ == "__main__":
    main()
