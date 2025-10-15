"""
Migration script to add isVisible field to existing messages
Sets isVisible=true for all messages that don't have this field
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from config import settings
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def migrate_visibility():
    """Add isVisible field to messages that don't have it"""
    
    # Connect to MongoDB
    logger.info(f"🔌 Connecting to MongoDB at {settings.mongodb_url}...")
    client = AsyncIOMotorClient(settings.mongodb_url)
    db = client[settings.database_name]
    
    logger.info("🔄 Starting visibility migration...")
    
    try:
        # Find all messages without isVisible field
        messages_without_field = await db.messages.count_documents({
            "isVisible": {"$exists": False}
        })
        
        logger.info(f"📊 Found {messages_without_field} messages without isVisible field")
        
        if messages_without_field == 0:
            logger.info("✅ All messages already have isVisible field. No migration needed!")
            return
        
        # Update all messages without isVisible to have isVisible=true
        result = await db.messages.update_many(
            {"isVisible": {"$exists": False}},
            {"$set": {"isVisible": True}}
        )
        
        logger.info(f"""
╔══════════════════════════════════════╗
║     MIGRATION SUMMARY                ║
╠══════════════════════════════════════╣
║ ✅ Updated messages:  {result.modified_count:<14} ║
║ 📊 Matched messages:  {result.matched_count:<14} ║
╚══════════════════════════════════════╝
""")
        
        logger.info("✅ Migration completed successfully!")
        
    except Exception as e:
        logger.error(f"❌ Migration failed: {e}", exc_info=True)
        raise
    finally:
        client.close()
        logger.info("🔌 MongoDB connection closed")

if __name__ == "__main__":
    asyncio.run(migrate_visibility())
