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
        client = AsyncIOMotorClient(settings.mongodb_url, serverSelectionTimeoutMS=5000)
        database = client[settings.database_name]
        
        # Test the connection with short timeout
        await client.admin.command('ping')
        logger.info(f"✅ Successfully connected to MongoDB database: {settings.database_name}")
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
