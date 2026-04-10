"""
Migration: Add verification badges to all existing users
Since registration is invitation-only, all existing users earn communityVerified badge.

Run: python -m migrations.add_badges_to_existing_users
"""

import asyncio
import logging
import sys
import os
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorClient

# Add parent dir to path so config is importable
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import Settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def migrate():
    settings = Settings()
    client = AsyncIOMotorClient(settings.mongodb_url)
    db = client[settings.database_name]
    
    # Count users without badges field
    without_badges = await db.users.count_documents({"badges": {"$exists": False}})
    total_users = await db.users.count_documents({})
    
    logger.info(f"Total users: {total_users}")
    logger.info(f"Users without badges: {without_badges}")
    
    if without_badges == 0:
        logger.info("All users already have badges field. Nothing to do.")
        client.close()
        return
    
    now = datetime.utcnow()
    
    # Set communityVerified for all users who don't have badges yet
    result = await db.users.update_many(
        {"badges": {"$exists": False}},
        {
            "$set": {
                "badges": {
                    "idVerified": False,
                    "idVerifiedAt": None,
                    "communityVerified": True,
                    "communityVerifiedAt": now,
                    "referredBy": None,
                    "verificationPath": "invitation"
                }
            }
        }
    )
    
    logger.info(f"✅ Updated {result.modified_count} users with communityVerified badge")
    
    # Verify
    with_badges = await db.users.count_documents({"badges.communityVerified": True})
    logger.info(f"Users with communityVerified badge: {with_badges}/{total_users}")
    
    client.close()


if __name__ == "__main__":
    asyncio.run(migrate())
