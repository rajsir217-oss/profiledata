
import asyncio
import logging
from database import connect_to_mongo, get_database, close_mongo_connection

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

async def ensure_indexes():
    await connect_to_mongo()
    db = get_database()
    
    if db is None:
        logger.error("❌ Failed to connect to database")
        return

    # Helper to clean up null usernames before creating unique indexes
    async def cleanup_nulls(collection_name):
        coll = db[collection_name]
        count = await coll.count_documents({"username": None})
        if count > 0:
            logger.warning(f"🧹 Cleaning up {count} documents with null username in {collection_name}")
            await coll.delete_many({"username": None})

    # 1. pii_access - critical for check_access_granted and get_per_field_access
    logger.info("Setting up pii_access indexes...")
    await db.pii_access.create_index([("granterUsername", 1), ("grantedToUsername", 1), ("isActive", 1)])
    await db.pii_access.create_index([("grantedToUsername", 1), ("isActive", 1)])
    
    # 2. favorites - critical for relationship check
    logger.info("Setting up favorites indexes...")
    await cleanup_nulls("favorites")
    await db.favorites.create_index([("username", 1)], unique=True)
    await db.favorites.create_index([("favorites", 1)]) # To count who favorited THIS user
    
    # 3. shortlist - critical for relationship check
    logger.info("Setting up shortlist indexes...")
    await cleanup_nulls("shortlist")
    await db.shortlist.create_index([("username", 1)], unique=True)
    await db.shortlist.create_index([("shortlist", 1)]) # To count who shortlisted THIS user
    
    # 4. exclusions - critical for relationship check
    logger.info("Setting up exclusions indexes...")
    await cleanup_nulls("exclusions")
    await db.exclusions.create_index([("username", 1)], unique=True)
    
    # 5. profile_views - critical for KPI stats
    logger.info("Setting up profile_views indexes...")
    await db.profile_views.create_index([("profileUsername", 1)])
    await db.profile_views.create_index([("profileUsername", 1), ("viewedByUsername", 1)])
    
    # 6. pii_requests - critical for checking pending requests
    logger.info("Setting up pii_requests indexes...")
    await db.pii_requests.create_index([("requesterId", 1), ("requestedUserId", 1), ("status", 1)])
    
    # 7. online_status - critical for real-time status
    logger.info("Setting up online_status indexes...")
    await db.online_status.create_index([("username", 1)], unique=True)
    
    logger.info("✅ All performance indexes ensured!")
    await close_mongo_connection()

if __name__ == "__main__":
    asyncio.run(ensure_indexes())
