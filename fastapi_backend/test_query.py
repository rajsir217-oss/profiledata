"""
Test script to debug conversation query
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from config import settings
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def test_conversations():
    """Test the conversations query"""
    
    # Connect to MongoDB
    client = AsyncIOMotorClient(settings.mongodb_url)
    db = client[settings.database_name]
    
    username = "falguniroy021"
    
    try:
        # Test 1: Count all messages for this user
        total_messages = await db.messages.count_documents({
            "$or": [
                {"fromUsername": username},
                {"toUsername": username}
            ]
        })
        logger.info(f"📊 Total messages for {username}: {total_messages}")
        
        # Test 2: Check isVisible field distribution
        with_visible_true = await db.messages.count_documents({
            "$or": [
                {"fromUsername": username},
                {"toUsername": username}
            ],
            "isVisible": True
        })
        
        with_visible_false = await db.messages.count_documents({
            "$or": [
                {"fromUsername": username},
                {"toUsername": username}
            ],
            "isVisible": False
        })
        
        without_field = await db.messages.count_documents({
            "$or": [
                {"fromUsername": username},
                {"toUsername": username}
            ],
            "isVisible": {"$exists": False}
        })
        
        logger.info(f"  isVisible=true:  {with_visible_true}")
        logger.info(f"  isVisible=false: {with_visible_false}")
        logger.info(f"  isVisible not set: {without_field}")
        
        # Test 3: Try the fixed query
        match_stage = {
            "$and": [
                {"$or": [
                    {"fromUsername": username},
                    {"toUsername": username}
                ]},
                {"$or": [
                    {"isVisible": {"$ne": False}},
                    {"isVisible": {"$exists": False}}
                ]}
            ]
        }
        
        pipeline = [
            {"$match": match_stage},
            {
                "$group": {
                    "_id": {
                        "$cond": [
                            {"$eq": ["$fromUsername", username]},
                            "$toUsername",
                            "$fromUsername"
                        ]
                    },
                    "lastMessage": {"$last": "$$ROOT"},
                    "unreadCount": {
                        "$sum": {
                            "$cond": [
                                {"$and": [
                                    {"$eq": ["$toUsername", username]},
                                    {"$eq": ["$isRead", False]}
                                ]},
                                1,
                                0
                            ]
                        }
                    }
                }
            },
            {"$sort": {"lastMessage.createdAt": -1}}
        ]
        
        logger.info(f"🔍 Running aggregation with match stage: {match_stage}")
        conversations = await db.messages.aggregate(pipeline).to_list(100)
        
        logger.info(f"✅ Aggregation returned {len(conversations)} conversations")
        
        for conv in conversations:
            logger.info(f"  Conversation with: {conv['_id']}")
            logger.info(f"    Last message: {conv['lastMessage'].get('content', 'N/A')[:50]}")
            logger.info(f"    Unread: {conv['unreadCount']}")
        
    except Exception as e:
        logger.error(f"❌ Error: {e}", exc_info=True)
    finally:
        client.close()

if __name__ == "__main__":
    asyncio.run(test_conversations())
