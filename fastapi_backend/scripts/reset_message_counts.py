"""
Reset All Message Counts to Zero
Quick script to reset all message statistics if no actual messages exist
"""
import asyncio
import sys
import os
from motor.motor_asyncio import AsyncIOMotorClient

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import get_database

async def reset_all_message_counts():
    """Reset all user message counts to zero"""
    print("🔧 Resetting all message counts to zero...")
    
    db = await get_database()
    
    # Update all users
    result = await db.users.update_many(
        {},
        {'$set': {
            'messagesSent': 0,
            'messagesReceived': 0,
            'pendingReplies': 0
        }}
    )
    
    print(f"✅ Reset message counts for {result.modified_count} users")
    print(f"🎉 All counts are now zero!")

if __name__ == "__main__":
    asyncio.run(reset_all_message_counts())
