#!/usr/bin/env python3
"""
Deploy Queue Management System
Creates queue cleanup job and initializes queue management collections
"""

import asyncio
import os
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
import certifi
from datetime import datetime, timezone
from bson import ObjectId

async def deploy_queue_management():
    """Deploy queue management system"""
    load_dotenv('.env.production')
    
    mongodb_url = os.getenv('MONGODB_URL')
    frontend_url = os.getenv('FRONTEND_URL', 'https://usvedika.com')
    print(f'🚀 Deploying Queue Management System...')
    print(f'   Connecting to production MongoDB...')
    
    client = AsyncIOMotorClient(mongodb_url, tlsCAFile=certifi.where())
    db = client.matrimonialDB
    
    try:
        # 1. Create indexes for queue management collections
        print('\n📋 Creating indexes...')
        
        # Queue status collection
        await db.queue_status.create_index("_id", unique=True)
        await db.queue_status.create_index("paused_at")
        await db.queue_status.create_index("resume_at")
        print('   ✅ Queue status indexes created')
        
        # Dead letter queue collection
        await db.notification_dead_letter.create_index("movedToDeadLetterAt")
        await db.notification_dead_letter.create_index("username")
        await db.notification_dead_letter.create_index("originalQueueId")
        await db.notification_dead_letter.create_index([("username", 1), ("movedToDeadLetterAt", -1)])
        print('   ✅ Dead letter queue indexes created')
        
        # Rate limit collection
        await db.notification_rate_limits.create_index("username")
        await db.notification_rate_limits.create_index("channel")
        await db.notification_rate_limits.create_index("expiresAt")
        await db.notification_rate_limits.create_index([("username", "channel"), ("expiresAt", 1)])
        print('   ✅ Rate limit indexes created')
        
        # 2. Create queue cleanup job
        print('\n⚙️ Creating queue cleanup job...')
        
        existing_job = await db.dynamic_jobs.find_one({
            'template_type': 'queue_cleanup'
        })
        
        if existing_job:
            print(f'   ⚠️ Queue cleanup job already exists: {existing_job["_id"]}')
            print(f'      Status: {existing_job.get("enabled")}')
            print(f'      Schedule: {existing_job.get("schedule", {}).get("expression", "Not set")}')
        else:
            job = {
                '_id': ObjectId(),
                'name': 'Queue Cleanup',
                'template_type': 'queue_cleanup',
                'schedule': {
                    'type': 'cron',
                    'expression': '0 2 * * *',  # Daily at 2 AM
                    'timezone': 'America/Los_Angeles'
                },
                'enabled': True,
                'parameters': {
                    'age_days': 30,        # Clean pending/sent older than 30 days
                    'failed_age_days': 7,  # Move failed to dead letter after 7 days
                    'sent_age_days': 7,    # Delete sent after 7 days
                    'batch_size': 1000,    # Process in batches
                    'dry_run': False,
                    'cleanup_dead_letter': True
                },
                'createdAt': datetime.now(timezone.utc),
                'updatedAt': datetime.now(timezone.utc),
                'createdBy': 'admin',
                'description': 'Automated cleanup of notification queue with dead letter management'
            }
            
            result = await db.dynamic_jobs.insert_one(job)
            print(f'   ✅ Created queue cleanup job: {result.inserted_id}')
            print(f'      Schedule: Daily at 2 AM Pacific')
            print(f'      Parameters: age_days=30, failed_age_days=7, sent_age_days=7')
        
        # 3. Initialize queue status
        print('\n🎛️ Initializing queue status...')
        
        existing_status = await db.queue_status.find_one({"_id": "queue_control"})
        if not existing_status:
            await db.queue_status.update_one(
                {"_id": "queue_control"},
                {
                    "$set": {
                        "status": "normal",
                        "createdAt": datetime.utcnow(),
                        "createdBy": "system"
                    }
                },
                upsert=True
            )
            print('   ✅ Queue status initialized to "normal"')
        else:
            print(f'   ℹ️ Queue status already exists: {existing_status.get("status")}')
        
        # 4. Check current queue state
        print('\n📊 Current queue state:')
        
        pending = await db.notification_queue.count_documents({"status": "pending"})
        processing = await db.notification_queue.count_documents({"status": "processing"})
        failed = await db.notification_queue.count_documents({"status": "failed"})
        sent = await db.notification_queue.count_documents({"status": "sent"})
        dead_letter = await db.notification_dead_letter.count_documents()
        
        print(f'   Pending: {pending}')
        print(f'   Processing: {processing}')
        print(f'   Failed: {failed}')
        print(f'   Sent: {sent}')
        print(f'   Dead Letter: {dead_letter}')
        
        # 5. Check for stuck notifications
        from datetime import timedelta
        stuck_cutoff = datetime.utcnow() - timedelta(minutes=10)
        stuck_count = await db.notification_queue.count_documents({
            "status": "processing",
            "processingStartedAt": {"$lt": stuck_cutoff}
        })
        
        if stuck_count > 0:
            print(f'\n⚠️ Found {stuck_count} stuck notifications (>10 minutes in processing)')
            print('   Consider running: POST /api/admin/queue/reset-stuck')
        else:
            print('\n✅ No stuck notifications found')
        
        # 6. Test queue manager service
        print('\n🧪 Testing Queue Manager service...')
        try:
            from services.queue_manager import QueueManager
            queue_manager = QueueManager(db)
            
            metrics = await queue_manager.get_queue_metrics()
            status = await queue_manager.get_queue_status()
            
            print(f'   ✅ Queue Manager working')
            print(f'   Status: {status.get("status")}')
            print(f'   Processing rate: {metrics.processing_rate:.2f}/min')
            print(f'   Failure rate: {metrics.failure_rate:.1f}%')
            
        except Exception as e:
            print(f'   ❌ Queue Manager test failed: {e}')
        
        print('\n🎉 Queue Management System deployment completed!')
        print('\n📚 Next steps:')
        print('   1. Test the API endpoints: /api/admin/queue/*')
        print('   2. Monitor queue health: /api/admin/queue/health')
        print('   3. Configure cleanup schedule as needed')
        print('   4. Set up monitoring alerts for queue issues')
        
        return True
        
    except Exception as e:
        print(f'\n❌ Deployment failed: {e}')
        import traceback
        traceback.print_exc()
        return False
    
    finally:
        client.close()

if __name__ == "__main__":
    print("=" * 60)
    print("QUEUE MANAGEMENT SYSTEM DEPLOYMENT")
    print("=" * 60)
    
    success = asyncio.run(deploy_queue_management())
    
    if success:
        print("\n✅ Deployment completed successfully!")
        exit(0)
    else:
        print("\n❌ Deployment failed!")
        exit(1)
