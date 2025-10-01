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
        client = AsyncIOMotorClient(settings.mongodb_url)
        database = client[settings.database_name]
        
        # Test the connection
        await client.admin.command('ping')
        logger.info(f"✅ Successfully connected to MongoDB database: {settings.database_name}")
    except Exception as e:
        logger.error(f"❌ Failed to connect to MongoDB: {e}", exc_info=True)
        raise

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
