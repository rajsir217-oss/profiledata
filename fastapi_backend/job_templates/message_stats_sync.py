"""
Message Statistics Sync Job
Automatically syncs user message statistics with actual message counts in database.

This job recalculates and updates:
- messagesSent: Total messages sent by each user
- messagesReceived: Total messages received by each user
- pendingReplies: Messages received but not replied to

Recommended Schedule: Daily at 2 AM (cron: 0 2 * * *)
"""

import logging
from datetime import datetime

logger = logging.getLogger(__name__)

async def execute(db, params=None):
    """
    Sync message statistics for all users
    
    Args:
        db: MongoDB database instance
        params: Optional parameters (not used in this job)
    
    Returns:
        dict: Execution results with counts of fixed users
    """
    logger.info("🔧 Starting message statistics sync job...")
    
    # Get all users
    users = await db.users.find({}).to_list(length=None)
    total_users = len(users)
    logger.info(f"📊 Found {total_users} users to process")
    
    fixed_count = 0
    error_count = 0
    
    for user in users:
        try:
            username = user.get('username')
            if not username:
                continue
            
            # Count actual sent messages
            sent_count = await db.messages.count_documents({'fromUsername': username})
            
            # Count actual received messages
            received_count = await db.messages.count_documents({'toUsername': username})
            
            # Count pending replies (received messages without a reply)
            pending_count = 0
            received_msgs = await db.messages.find({'toUsername': username}).to_list(length=None)
            
            # Check each received message for a reply
            for msg in received_msgs:
                sender = msg.get('fromUsername')
                msg_time = msg.get('createdAt')
                
                if not sender or not msg_time:
                    continue
                
                # Check if user replied to this sender after receiving the message
                reply_exists = await db.messages.find_one({
                    'fromUsername': username,
                    'toUsername': sender,
                    'createdAt': {'$gte': msg_time}
                })
                
                if not reply_exists:
                    pending_count += 1
            
            # Get current counts from user document
            current_sent = user.get('messagesSent', 0)
            current_received = user.get('messagesReceived', 0)
            current_pending = user.get('pendingReplies', 0)
            
            # Update if any count is different
            if (current_sent != sent_count or 
                current_received != received_count or 
                current_pending != pending_count):
                
                await db.users.update_one(
                    {'username': username},
                    {'$set': {
                        'messagesSent': sent_count,
                        'messagesReceived': received_count,
                        'pendingReplies': pending_count,
                        'messageStatsLastSynced': datetime.utcnow()
                    }}
                )
                
                logger.info(f"  ✅ Synced {username}: "
                      f"Sent {current_sent}→{sent_count}, "
                      f"Rcvd {current_received}→{received_count}, "
                      f"Pending {current_pending}→{pending_count}")
                fixed_count += 1
        
        except Exception as e:
            logger.error(f"  ❌ Error processing user {username}: {e}")
            error_count += 1
            continue
    
    result = {
        "status": "completed",
        "total_users": total_users,
        "users_synced": fixed_count,
        "users_unchanged": total_users - fixed_count - error_count,
        "errors": error_count,
        "message": f"Synced {fixed_count} users, {total_users - fixed_count - error_count} already accurate"
    }
    
    logger.info(f"🎉 Message stats sync completed:")
    logger.info(f"   Total users: {total_users}")
    logger.info(f"   Updated: {fixed_count}")
    logger.info(f"   Already accurate: {total_users - fixed_count - error_count}")
    logger.info(f"   Errors: {error_count}")
    
    return result


# Job metadata for Dynamic Scheduler UI
TEMPLATE_INFO = {
    "name": "message_stats_sync",
    "display_name": "Message Statistics Sync",
    "description": "Sync user message counts with actual messages in database",
    "category": "maintenance",
    "recommended_schedule": "Daily at 2 AM",
    "recommended_cron": "0 2 * * *",
    "timeout_seconds": 600,  # 10 minutes
    "parameters": {}  # No parameters needed
}
