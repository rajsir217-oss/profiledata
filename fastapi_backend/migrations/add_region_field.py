"""
Migration: Add region field for searchable location data
Purpose: Create an unencrypted 'region' field from encrypted 'location' for search purposes
Date: 2025-11-10
"""

import asyncio
import os
import sys
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime

# Add parent directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from crypto_utils import get_encryptor
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


async def add_region_field():
    """Add region field to users who don't have it"""
    
    # Get MongoDB connection string from environment
    mongodb_url = os.getenv('MONGODB_URL', 'mongodb://localhost:27017')
    db_name = os.getenv('MONGODB_DB', 'matrimonialDB')
    
    logger.info(f"📡 Connecting to MongoDB: {mongodb_url}")
    client = AsyncIOMotorClient(mongodb_url)
    db = client[db_name]
    
    try:
        # Get encryptor
        try:
            encryptor = get_encryptor()
            logger.info("✅ Encryption engine initialized")
        except Exception as e:
            logger.error(f"❌ Failed to initialize encryption: {e}")
            logger.info("💡 Will extract region from any available location data")
            encryptor = None
        
        # Find users without region field
        query = {"$or": [{"region": {"$exists": False}}, {"region": None}, {"region": ""}]}
        users_without_region = await db.users.find(query).to_list(length=None)
        
        logger.info(f"📊 Found {len(users_without_region)} users without region field")
        
        if len(users_without_region) == 0:
            logger.info("✅ All users already have region field!")
            return
        
        updated_count = 0
        skipped_count = 0
        
        for user in users_without_region:
            username = user.get('username', 'UNKNOWN')
            location_data = user.get('location')
            
            region = None
            
            # Try to get region from location data
            if location_data:
                try:
                    # Decrypt location if encrypted
                    if encryptor:
                        decrypted_location = encryptor.decrypt(location_data)
                        # Extract city/state from location (e.g., "New York, NY" -> "New York")
                        region = decrypted_location.split(',')[0].strip()
                    else:
                        # If not encrypted, use as-is
                        region = location_data.split(',')[0].strip()
                except Exception as e:
                    logger.warning(f"⚠️  Could not process location for {username}: {e}")
            
            # If no location, try other fields
            if not region:
                # Try city field
                if user.get('city'):
                    region = user.get('city')
                # Try state field
                elif user.get('state'):
                    region = user.get('state')
                # Default to "Unknown"
                else:
                    region = "Unknown"
                    logger.info(f"   ℹ️  {username}: No location data, using 'Unknown'")
            
            # Update user with region field
            try:
                result = await db.users.update_one(
                    {"username": username},
                    {
                        "$set": {
                            "region": region,
                            "updatedAt": datetime.utcnow()
                        }
                    }
                )
                
                if result.modified_count > 0:
                    updated_count += 1
                    logger.info(f"✅ {username}: Added region = '{region}'")
                else:
                    skipped_count += 1
                    
            except Exception as e:
                logger.error(f"❌ Failed to update {username}: {e}")
                skipped_count += 1
        
        logger.info("=" * 60)
        logger.info(f"✅ Migration complete!")
        logger.info(f"   Updated: {updated_count} users")
        logger.info(f"   Skipped: {skipped_count} users")
        logger.info("=" * 60)
        
    finally:
        client.close()


if __name__ == "__main__":
    asyncio.run(add_region_field())
