"""
Migration 004: Add region field for searchable location data
Purpose: Create an unencrypted 'region' field from encrypted 'location' for search purposes
Date: 2025-11-10
"""

import sys
import os
from pathlib import Path
from datetime import datetime

# Add parent directories to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from crypto_utils import get_encryptor
import logging

logger = logging.getLogger(__name__)


async def up(db):
    """
    Migration: Add region field to users for searchable location
    
    Background:
    - location field is encrypted for PII protection
    - MongoDB cannot perform regex search on encrypted fields
    - region field stores unencrypted city/state for search functionality
    """
    
    logger.info("=" * 60)
    logger.info("MIGRATION 004: Add region field")
    logger.info("=" * 60)
    
    try:
        # Get encryptor
        try:
            encryptor = get_encryptor()
            logger.info("✅ Encryption engine initialized")
        except Exception as e:
            logger.warning(f"⚠️  Encryption not available: {e}")
            logger.info("💡 Will use existing location data if unencrypted")
            encryptor = None
        
        # Find users without region field
        query = {"$or": [{"region": {"$exists": False}}, {"region": None}, {"region": ""}]}
        users_without_region = await db.users.find(query).to_list(length=None)
        
        total_users = len(users_without_region)
        logger.info(f"📊 Found {total_users} users without region field")
        
        if total_users == 0:
            logger.info("✅ All users already have region field!")
            logger.info("=" * 60)
            return
        
        updated_count = 0
        error_count = 0
        
        # Process in batches
        for i, user in enumerate(users_without_region, 1):
            username = user.get('username', 'UNKNOWN')
            location_data = user.get('location')
            
            region = None
            
            # Try to extract region from location data
            if location_data:
                try:
                    # Try to decrypt location if encrypted
                    if encryptor:
                        try:
                            decrypted_location = encryptor.decrypt(location_data)
                            # Extract city/state from location (e.g., "New York, NY" -> "New York")
                            region = decrypted_location.split(',')[0].strip()
                        except Exception:
                            # If decryption fails, location might already be plain text
                            region = location_data.split(',')[0].strip()
                    else:
                        # No encryption, use as-is
                        region = location_data.split(',')[0].strip()
                except Exception as e:
                    logger.warning(f"⚠️  Could not process location for {username}: {e}")
            
            # Fallback: Try other location-related fields
            if not region:
                region = user.get('city') or user.get('state') or "Unknown"
            
            # Update user with region field
            try:
                result = await db.users.update_one(
                    {"username": username},
                    {
                        "$set": {
                            "region": region,
                            "updatedAt": datetime.now()
                        }
                    }
                )
                
                if result.modified_count > 0:
                    updated_count += 1
                    if i % 100 == 0:
                        logger.info(f"   Progress: {i}/{total_users} users processed...")
                        
            except Exception as e:
                logger.error(f"❌ Failed to update {username}: {e}")
                error_count += 1
        
        logger.info("=" * 60)
        logger.info(f"✅ Migration 004 complete!")
        logger.info(f"   Total users: {total_users}")
        logger.info(f"   Updated: {updated_count}")
        logger.info(f"   Errors: {error_count}")
        logger.info("=" * 60)
        
    except Exception as e:
        logger.error(f"❌ Migration 004 failed: {e}")
        raise


async def down(db):
    """Rollback: Remove region field"""
    logger.info("🔄 Rolling back migration 004: Removing region field")
    
    result = await db.users.update_many(
        {},
        {"$unset": {"region": ""}}
    )
    
    logger.info(f"✅ Removed region field from {result.modified_count} users")
