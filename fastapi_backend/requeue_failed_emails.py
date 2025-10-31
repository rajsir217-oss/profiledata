"""
Re-queue failed emails to test retry logic
Resets failed notifications to pending so they can be retried
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime

MONGODB_URL = "mongodb://localhost:27017"
DATABASE_NAME = "matrimonialDB"

async def requeue_failed():
    """Reset failed notifications to pending for retry"""
    client = AsyncIOMotorClient(MONGODB_URL)
    db = client[DATABASE_NAME]
    queue = db.notification_queue
    
    # Find failed email notifications
    failed = await queue.find({
        "status": "failed",
        "channels": "email"
    }).to_list(100)
    
    print(f"Found {len(failed)} failed email notifications")
    
    if not failed:
        print("No failed emails to requeue")
        client.close()
        return
    
    # Reset each to pending for retry
    requeued = 0
    for notification in failed:
        print(f"\n📧 Requeuing: {notification['trigger']} for {notification['username']}")
        print(f"   Previous attempts: {notification.get('attempts', 0)}")
        print(f"   Previous error: {notification.get('statusReason', 'Unknown')}")
        
        # Reset to pending with cleared retry fields
        update = {
            "$set": {
                "status": "pending",
                "updatedAt": datetime.utcnow(),
                "nextRetryAt": None,  # Ready for immediate retry
                "attempts": 0,  # Reset attempt counter
                "lastAttempt": None,
                "statusReason": "Requeued for retry test",
                "failedAt": None
            },
            "$unset": {
                "error": ""  # Clear old error
            }
        }
        
        result = await queue.update_one(
            {"_id": notification["_id"]},
            update
        )
        
        if result.modified_count > 0:
            requeued += 1
            print(f"   ✅ Reset to pending")
        else:
            print(f"   ❌ Failed to update")
    
    print(f"\n🎉 Requeued {requeued}/{len(failed)} notifications")
    print("\nNext steps:")
    print("1. Run email_notifier job in Dynamic Scheduler")
    print("2. Check logs for retry attempts")
    print("3. Verify emails sent or retries scheduled")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(requeue_failed())
