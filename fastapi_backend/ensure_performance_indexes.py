
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
    
    # 2. favorites - critical for relationship check (NEW SCHEMA: individual documents)
    logger.info("Setting up favorites indexes...")
    await db.favorites.create_index([("userUsername", 1), ("favoriteUsername", 1)], unique=True)
    await db.favorites.create_index([("favoriteUsername", 1)])  # To count who favorited THIS user
    await db.favorites.create_index([("userUsername", 1)])  # To get user's favorites list
    
    # 3. shortlists - critical for relationship check (NEW SCHEMA: individual documents)
    logger.info("Setting up shortlists indexes...")
    await db.shortlists.create_index([("userUsername", 1), ("shortlistedUsername", 1)], unique=True)
    await db.shortlists.create_index([("shortlistedUsername", 1)])  # To count who shortlisted THIS user
    await db.shortlists.create_index([("userUsername", 1)])  # To get user's shortlist
    
    # 4. exclusions - critical for search filtering and relationship check
    logger.info("Setting up exclusions indexes...")
    await cleanup_nulls("exclusions")
    await db.exclusions.create_index([("userUsername", 1), ("excludedUsername", 1)], unique=True)
    await db.exclusions.create_index([("excludedUsername", 1)])
    
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
    
    # 8. platform_stats_daily - critical for all-time aggregation from dailies
    logger.info("Setting up platform_stats_daily indexes...")
    await db.platform_stats_daily.create_index([("date", 1)], unique=True, background=True)
    
    # 9. platform_stats_monthly - critical for yearly aggregation
    logger.info("Setting up platform_stats_monthly indexes...")
    await db.platform_stats_monthly.create_index([("year", 1), ("month", 1)], unique=True, background=True)
    
    # 10. platform_stats_yearly - for quick year lookups
    logger.info("Setting up platform_stats_yearly indexes...")
    await db.platform_stats_yearly.create_index([("year", 1)], unique=True, background=True)
    
    # 11. activity_logs - critical for searches count and daily snapshot job
    logger.info("Setting up activity_logs indexes...")
    await db.activity_logs.create_index([("timestamp", 1), ("action_type", 1)], background=True)
    await db.activity_logs.create_index([("action_type", 1), ("timestamp", 1)], background=True)
    
    # 12. profile_views - critical for profile view counting in daily snapshots
    logger.info("Setting up profile_views indexes...")
    await db.profile_views.create_index([("lastViewedAt", 1)], background=True)
    await db.profile_views.create_index([("firstViewedAt", 1)], background=True)
    await db.profile_views.create_index([("createdAt", 1)], background=True)
    await db.profile_views.create_index([("profileUsername", 1), ("viewedByUsername", 1)], background=True)
    
    # 13. messages - for daily snapshot counting
    logger.info("Setting up messages indexes...")
    await db.messages.create_index([("createdAt", 1)], background=True)
    
    logger.info("✅ All performance indexes ensured!")
    await close_mongo_connection()

if __name__ == "__main__":
    asyncio.run(ensure_indexes())
