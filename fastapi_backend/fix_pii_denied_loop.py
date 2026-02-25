#!/usr/bin/env python3
"""
Fix PII Denied Email Loop
Checks for and fixes stuck pii_denied notifications that might be causing infinite loops
"""

import asyncio
import sys
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import os
from datetime import datetime, timedelta

async def fix_pii_denied_loop():
    """Fix stuck pii_denied notifications"""
    load_dotenv('.env')
    client = AsyncIOMotorClient(os.getenv('MONGODB_URL', 'mongodb://localhost:27017'))
    db = client[os.getenv('DATABASE_NAME', 'matrimonialDB')]
    
    print("🔧 Fixing PII Denied Email Loop")
    print("=" * 50)
    
    # Check for pii_denied notifications in various states
    queue_collection = db.notification_queue
    
    # 1. Check for stuck PROCESSING notifications
    stuck_processing = await queue_collection.find({
        "trigger": "pii_denied",
        "status": "PROCESSING"
    }).to_list(None)
    
    print(f"📊 Found {len(stuck_processing)} pii_denied notifications stuck in PROCESSING")
    
    if stuck_processing:
        # Reset stuck notifications to PENDING
        result = await queue_collection.update_many(
            {
                "trigger": "pii_denied",
                "status": "PROCESSING"
            },
            {
                "$set": {
                    "status": "PENDING",
                    "processingStartedAt": None,
                    "updatedAt": datetime.utcnow()
                }
            }
        )
        print(f"✅ Reset {result.modified_count} stuck PROCESSING notifications to PENDING")
    
    # 2. Check for notifications with high attempts (possible loop)
    high_attempts = await queue_collection.find({
        "trigger": "pii_denied",
        "attempts": {"$gte": 3}
    }).to_list(None)
    
    print(f"📊 Found {len(high_attempts)} pii_denied notifications with 3+ attempts")
    
    if high_attempts:
        for notification in high_attempts:
            print(f"   - {notification['username']}: {notification.get('attempts', 0)} attempts, status: {notification.get('status')}")
            print(f"     Created: {notification.get('createdAt')}")
            print(f"     Last attempt: {notification.get('lastAttempt')}")
    
    # 3. Check for recent pii_denied notifications (last hour)
    one_hour_ago = datetime.utcnow() - timedelta(hours=1)
    recent_denied = await queue_collection.find({
        "trigger": "pii_denied",
        "createdAt": {"$gte": one_hour_ago}
    }).to_list(None)
    
    print(f"📊 Found {len(recent_denied)} pii_denied notifications created in the last hour")
    
    if recent_denied:
        print("   Recent pii_denied notifications:")
        for notification in recent_denied:
            print(f"   - {notification['username']}: {notification.get('status')} (created {notification.get('createdAt')})")
    
    # 4. Check notification logs for pii_denied
    log_collection = db.notification_log
    recent_logs = await log_collection.find({
        "trigger": "pii_denied",
        "createdAt": {"$gte": one_hour_ago}
    }).sort("createdAt", -1).limit(10).to_list(None)
    
    print(f"📊 Found {len(recent_logs)} pii_denied notification logs in the last hour")
    
    if recent_logs:
        print("   Recent pii_denied logs:")
        for log in recent_logs:
            print(f"   - {log['username']}: {log.get('status')} ({log.get('createdAt')})")
    
    # 5. Offer to clean up problematic notifications
    if high_attempts or stuck_processing:
        print(f"\n🧹 Cleanup Options:")
        print(f"1. Reset {len(stuck_processing)} stuck PROCESSING notifications")
        print(f"2. Mark {len(high_attempts)} high-attempt notifications as FAILED")
        print(f"3. Show details of problematic notifications")
        
        # Auto-cleanup stuck notifications
        if stuck_processing:
            print(f"\n🔄 Auto-cleaning stuck notifications...")
            reset_result = await queue_collection.update_many(
                {
                    "trigger": "pii_denied",
                    "status": "PROCESSING",
                    "processingStartedAt": {"$lte": datetime.utcnow() - timedelta(minutes=10)}
                },
                {
                    "$set": {
                        "status": "PENDING",
                        "processingStartedAt": None,
                        "updatedAt": datetime.utcnow()
                    }
                }
            )
            print(f"✅ Auto-cleaned {reset_result.modified_count} stuck notifications")
        
        # Mark high-attempt notifications as FAILED to stop the loop
        if high_attempts:
            print(f"\n❌ Marking high-attempt notifications as FAILED to stop loop...")
            failed_result = await queue_collection.update_many(
                {
                    "trigger": "pii_denied",
                    "attempts": {"$gte": 3}
                },
                {
                    "$set": {
                        "status": "FAILED",
                        "statusReason": "Too many attempts - possible infinite loop detected",
                        "failedAt": datetime.utcnow(),
                        "updatedAt": datetime.utcnow()
                    }
                }
            )
            print(f"✅ Marked {failed_result.modified_count} notifications as FAILED")
    
    # 6. Summary
    total_pending = await queue_collection.count_documents({
        "trigger": "pii_denied",
        "status": {"$in": ["PENDING", "SCHEDULED"]}
    })
    
    print(f"\n📋 Summary:")
    print(f"   - Stuck PROCESSING: {len(stuck_processing)}")
    print(f"   - High attempts (3+): {len(high_attempts)}")
    print(f"   - Recent (last hour): {len(recent_denied)}")
    print(f"   - Still pending: {total_pending}")
    
    if total_pending > 10:
        print(f"\n⚠️  WARNING: {total_pending} pii_denied notifications still pending!")
        print(f"   This indicates the loop might continue. Consider:")
        print(f"   1. Checking if the email notifier job is running")
        print(f"   2. Verifying the fix was deployed")
        print(f"   3. Monitoring the queue for new notifications")
    else:
        print(f"\n✅ Loop appears to be under control")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(fix_pii_denied_loop())
