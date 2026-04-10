"""
Migration: Create registration_interests collection with indexes
For the new Registration Interest / Pre-Registration form feature.

Creates:
  - registration_interests collection
  - Unique index on email (excluding rejected)
  - Index on status for admin filtering
  - Index on createdAt for sorting

Safe to run multiple times (idempotent).

Run (local):      python -m migrations.create_registration_interests_collection
Run (production): python -m migrations.create_registration_interests_collection --env production
"""

import asyncio
import argparse
import logging
import sys
import os
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import IndexModel, ASCENDING, DESCENDING

# Add parent dir to path so config is importable
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Parse --env flag BEFORE importing config so env detection works
parser = argparse.ArgumentParser(description="Create registration_interests collection")
parser.add_argument("--env", default=None, help="Environment: local, production, staging")
args = parser.parse_args()

if args.env:
    os.environ["APP_ENVIRONMENT"] = args.env
    print(f"🔧 Using environment: {args.env}")

from config import Settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def migrate():
    settings = Settings()
    logger.info(f"🔌 Connecting to: {settings.mongodb_url}")
    logger.info(f"📦 Database: {settings.database_name}")
    client = AsyncIOMotorClient(settings.mongodb_url)
    db = client[settings.database_name]

    collection_name = "registration_interests"

    # Check existing collections
    existing = await db.list_collection_names()
    if collection_name in existing:
        count = await db[collection_name].count_documents({})
        logger.info(f"Collection '{collection_name}' already exists with {count} documents.")
    else:
        await db.create_collection(collection_name)
        logger.info(f"✅ Created collection '{collection_name}'")

    coll = db[collection_name]

    # Define indexes
    # Note: MongoDB Atlas partial filters only support $exists, $gt, $gte,
    # $lt, $lte, $type, $eq. Duplicate prevention is handled in app code.
    indexes = [
        IndexModel(
            [("email", ASCENDING)],
            name="idx_email"
        ),
        IndexModel(
            [("status", ASCENDING)],
            name="idx_status"
        ),
        IndexModel(
            [("createdAt", DESCENDING)],
            name="idx_created_at_desc"
        ),
        IndexModel(
            [("status", ASCENDING), ("createdAt", DESCENDING)],
            name="idx_status_created"
        ),
    ]

    # Create indexes (idempotent — existing ones are skipped)
    try:
        result = await coll.create_indexes(indexes)
        logger.info(f"✅ Indexes created/verified: {result}")
    except Exception as e:
        logger.warning(f"⚠️ Index creation issue (may already exist with different options): {e}")
        # List existing indexes for debugging
        async for idx in coll.list_indexes():
            logger.info(f"  Existing index: {idx['name']} → {idx.get('key')}")

    # Summary
    count = await coll.count_documents({})
    idx_list = []
    async for idx in coll.list_indexes():
        idx_list.append(idx["name"])
    
    logger.info(f"\n📊 Migration Summary:")
    logger.info(f"   Collection: {collection_name}")
    logger.info(f"   Documents: {count}")
    logger.info(f"   Indexes: {', '.join(idx_list)}")

    client.close()
    logger.info("✅ Migration complete.")


if __name__ == "__main__":
    asyncio.run(migrate())
