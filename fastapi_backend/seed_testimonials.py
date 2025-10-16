"""
Seed some test testimonials to the database
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from config import settings
from datetime import datetime, timedelta
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def seed_testimonials():
    """Add test testimonials"""
    
    # Connect to MongoDB
    client = AsyncIOMotorClient(settings.mongodb_url)
    db = client[settings.database_name]
    
    logger.info("🌱 Seeding testimonials...")
    
    try:
        # Sample testimonials
        testimonials = [
            {
                "username": "admin",
                "content": "L3V3L's matching algorithm is incredible! I found my perfect match within the first week. The personality compatibility scores are spot-on!",
                "rating": 5,
                "isAnonymous": False,
                "status": "approved",
                "createdAt": datetime.utcnow() - timedelta(days=30),
                "updatedAt": datetime.utcnow() - timedelta(days=30)
            },
            {
                "username": "falguniroy021",
                "content": "Best matchmaking platform I've used! The interface is beautiful and the L3V3L score really helps identify compatible matches quickly.",
                "rating": 5,
                "isAnonymous": False,
                "status": "approved",
                "createdAt": datetime.utcnow() - timedelta(days=20),
                "updatedAt": datetime.utcnow() - timedelta(days=20)
            },
            {
                "username": "rishidas032",
                "content": "I was skeptical at first, but L3V3L's scientific approach to matchmaking really works. Met someone amazing who shares my values and interests.",
                "rating": 5,
                "isAnonymous": False,
                "status": "approved",
                "createdAt": datetime.utcnow() - timedelta(days=15),
                "updatedAt": datetime.utcnow() - timedelta(days=15)
            },
            {
                "username": "admin",
                "content": "This is a pending testimonial that needs admin review. Great platform, would recommend!",
                "rating": 4,
                "isAnonymous": False,
                "status": "pending",
                "createdAt": datetime.utcnow() - timedelta(days=2),
                "updatedAt": datetime.utcnow() - timedelta(days=2)
            },
            {
                "username": "falguniroy021",
                "content": "Anonymous testimonial: Privacy features are excellent. I appreciate being able to control what information I share.",
                "rating": 5,
                "isAnonymous": True,
                "status": "approved",
                "createdAt": datetime.utcnow() - timedelta(days=10),
                "updatedAt": datetime.utcnow() - timedelta(days=10)
            },
            {
                "username": "rishidas032",
                "content": "This testimonial was rejected for testing purposes. Testing rejection workflow.",
                "rating": 3,
                "isAnonymous": False,
                "status": "rejected",
                "createdAt": datetime.utcnow() - timedelta(days=5),
                "updatedAt": datetime.utcnow() - timedelta(days=5)
            }
        ]
        
        # Clear existing test testimonials (optional)
        # await db.testimonials.delete_many({})
        
        # Insert testimonials
        result = await db.testimonials.insert_many(testimonials)
        
        logger.info(f"✅ Inserted {len(result.inserted_ids)} testimonials!")
        logger.info(f"   - Approved: 3")
        logger.info(f"   - Pending: 1")
        logger.info(f"   - Rejected: 1")
        logger.info(f"   - Anonymous: 1")
        
    except Exception as e:
        logger.error(f"❌ Error seeding testimonials: {e}", exc_info=True)
    finally:
        client.close()
        logger.info("🔌 MongoDB connection closed")

if __name__ == "__main__":
    asyncio.run(seed_testimonials())
