# fastapi_backend/database.py
from motor.motor_asyncio import AsyncIOMotorClient
from config import settings
import logging

logger = logging.getLogger(__name__)

client = None
database = None

async def connect_to_mongo():
    global client, database
    try:
        logger.info(f"🔌 Attempting to connect to MongoDB at {settings.mongodb_url}...")
        client = AsyncIOMotorClient(
            settings.mongodb_url,
            # Server selection
            serverSelectionTimeoutMS=5000,
            # Connection pool settings
            maxPoolSize=50,              # Max connections in pool (default 100, reduced to avoid Atlas limits)
            minPoolSize=5,               # Keep 5 warm connections ready
            maxIdleTimeMS=45000,         # Close idle connections after 45s (prevents stale connections)
            # Timeouts to prevent hung connections
            connectTimeoutMS=10000,      # 10s to establish a connection
            socketTimeoutMS=30000,       # 30s max for any single operation
            waitQueueTimeoutMS=10000,    # 10s max waiting for a pool connection (fail fast instead of 300s hang)
            # Keep-alive and retry
            retryWrites=True,
            retryReads=True,
            heartbeatFrequencyMS=10000,  # Check server health every 10s
        )
        database = client[settings.database_name]
        
        # Test the connection with short timeout
        await client.admin.command('ping')
        logger.info(f"✅ Successfully connected to MongoDB database: {settings.database_name}")
        logger.info(f"   Pool: maxPoolSize=50, minPoolSize=5, maxIdleTimeMS=45s, socketTimeoutMS=30s")
    except Exception as e:
        logger.warning(f"⚠️ Failed to connect to MongoDB: {e}")
        logger.warning("⚠️ App will start without database connection. Some features may not work.")
        # Don't raise - allow app to start without database for testing
        client = None
        database = None

async def close_mongo_connection():
    global client
    if client:
        logger.info("🔌 Closing MongoDB connection...")
        client.close()
        logger.info("✅ MongoDB connection closed")

def get_database():
    if database is None:
        logger.error("❌ Database not initialized. MongoDB connection may have failed.")
        raise RuntimeError("Database not initialized. Make sure MongoDB is running and the app has started properly.")
    return database
