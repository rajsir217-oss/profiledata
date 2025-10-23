"""
Fix Message Counts - Sync user message statistics with actual messages
Run this to fix inconsistencies between displayed counts and actual messages
"""
import asyncio
import sys
import os
from motor.motor_asyncio import AsyncIOMotorClient

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import get_database

async def fix_message_counts():
    """Reset and recalculate all user message counts based on actual messages"""
    print("🔧 Starting message count fix...")
    
    db = await get_database()
    
    # Get all users
    users = await db.users.find({}).to_list(length=None)
    print(f"📊 Found {len(users)} users to check")
    
    fixed_count = 0
    
    for user in users:
        username = user.get('username')
        
        # Count actual sent messages
        sent_count = await db.messages.count_documents({'fromUsername': username})
        
        # Count actual received messages
        received_count = await db.messages.count_documents({'toUsername': username})
        
        # Count pending replies (received but no reply sent back)
        pending_count = 0
        received_msgs = await db.messages.find({'toUsername': username}).to_list(length=None)
        for msg in received_msgs:
            sender = msg.get('fromUsername')
            # Check if user replied to this sender
            reply_exists = await db.messages.find_one({
                'fromUsername': username,
                'toUsername': sender,
                'createdAt': {'$gte': msg.get('createdAt')}
            })
            if not reply_exists:
                pending_count += 1
        
        # Get current counts from user document
        current_sent = user.get('messagesSent', 0)
        current_received = user.get('messagesReceived', 0)
        current_pending = user.get('pendingReplies', 0)
        
        # Update if different
        if (current_sent != sent_count or 
            current_received != received_count or 
            current_pending != pending_count):
            
            await db.users.update_one(
                {'username': username},
                {'$set': {
                    'messagesSent': sent_count,
                    'messagesReceived': received_count,
                    'pendingReplies': pending_count
                }}
            )
            
            print(f"✅ Fixed {username}: Sent {current_sent}→{sent_count}, "
                  f"Rcvd {current_received}→{received_count}, "
                  f"Pending {current_pending}→{pending_count}")
            fixed_count += 1
    
    print(f"\n🎉 Fixed {fixed_count} users with incorrect counts")
    print(f"✅ All message counts are now accurate!")

if __name__ == "__main__":
    asyncio.run(fix_message_counts())
