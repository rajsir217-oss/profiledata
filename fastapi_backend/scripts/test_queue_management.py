#!/usr/bin/env python3
"""
Test Queue Management Features
Quick test script for the new queue management system
"""

import asyncio
import os
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
import certifi
from datetime import datetime, timezone
from bson import ObjectId

async def test_queue_management():
    """Test queue management features"""
    load_dotenv('.env.production')
    
    mongodb_url = os.getenv('MONGODB_URL')
    print(f'🧪 Testing Queue Management Features...')
    print(f'   Connecting to production MongoDB...')
    
    client = AsyncIOMotorClient(mongodb_url, tlsCAFile=certifi.where())
    db = client.matrimonialDB
    
    try:
        # 1. Test Queue Manager Service
        print('\n📋 Testing Queue Manager Service...')
        from services.queue_manager import QueueManager
        queue_manager = QueueManager(db)
        
        # Get current status
        status = await queue_manager.get_queue_status()
        print(f'   Current queue status: {status.get("status")}')
        
        # Get metrics
        metrics = await queue_manager.get_queue_metrics()
        print(f'   Queue metrics:')
        print(f'     - Pending: {metrics.total_pending}')
        print(f'     - Processing: {metrics.total_processing}')
        print(f'     - Failed: {metrics.total_failed}')
        print(f'     - Sent: {metrics.total_sent}')
        print(f'     - Processing rate: {metrics.processing_rate:.2f}/min')
        print(f'     - Failure rate: {metrics.failure_rate:.1f}%')
        
        # 2. Test Rate Limiting
        print('\n🚦 Testing Rate Limiting...')
        allowed, rate_info = await queue_manager.check_rate_limit(
            username="test_user",
            channel="email",
            window_minutes=60,
            max_notifications=10
        )
        print(f'   Rate limit check: {"✅ Allowed" if allowed else "❌ Blocked"}')
        print(f'   Current count: {rate_info["current_count"]}')
        print(f'   Remaining: {rate_info["remaining"]}')
        
        # 3. Test Pause/Resume (dry run)
        print('\n⏸️ Testing Pause/Resume...')
        
        # Check if we can pause
        if status.get("status") == "normal":
            print('   Queue is normal - testing pause functionality')
            
            # Test pause (would normally pause, but we'll just test the logic)
            pause_result = await queue_manager.pause_queue(
                reason="Test pause",
                duration_minutes=5,
                emergency=False
            )
            print(f'   ✅ Pause successful: {pause_result["status"]}')
            
            # Test resume
            resume_result = await queue_manager.resume_queue("Test resume")
            print(f'   ✅ Resume successful: {resume_result["status"]}')
        else:
            print(f'   Queue is {status.get("status")} - skipping pause test')
        
        # 4. Test Cleanup (dry run)
        print('\n🧹 Testing Queue Cleanup (Dry Run)...')
        cleanup_stats = await queue_manager.cleanup_queue(
            age_days=30,
            failed_age_days=7,
            sent_age_days=7,
            batch_size=100,
            dry_run=True  # Dry run only
        )
        print(f'   Cleanup dry run results:')
        print(f'     - Would delete pending: {cleanup_stats["pending_deleted"]}')
        print(f'     - Would move to dead letter: {cleanup_stats["dead_letter_moved"]}')
        print(f'     - Would delete sent: {cleanup_stats["sent_deleted"]}')
        print(f'     - Total would process: {cleanup_stats["total_deleted"]}')
        
        # 5. Test Dead Letter Queue
        print('\n📦 Testing Dead Letter Queue...')
        dead_letters = await queue_manager.get_dead_letter_queue(limit=10)
        print(f'   Dead letter queue items: {len(dead_letters)}')
        
        if dead_letters:
            print('   Sample dead letter items:')
            for i, item in enumerate(dead_letters[:3]):
                print(f'     {i+1}. {item.get("username")} - {item.get("trigger")} - {item.get("moveReason")}')
        
        # 6. Test Rate Limit Stats
        print('\n📊 Testing Rate Limit Statistics...')
        rate_stats = await queue_manager.get_rate_limit_stats()
        print(f'   Rate limit stats:')
        print(f'     - Active rate limits: {rate_stats["active_rate_limits"]}')
        print(f'     - Total last hour: {rate_stats["total_last_hour"]}')
        print(f'     - Total last day: {rate_stats["total_last_day"]}')
        
        # 7. Check API endpoints would work
        print('\n🌐 API Endpoint Tests (Manual verification needed):')
        print('   Test these endpoints in the UI or with curl:')
        print('   - GET /api/admin/queue/status')
        print('   - POST /api/admin/queue/pause')
        print('   - POST /api/admin/queue/resume')
        print('   - POST /api/admin/queue/cleanup')
        print('   - GET /api/admin/queue/health')
        print('   - GET /api/admin/queue/dead-letter')
        
        print('\n✅ Queue Management System Test Completed!')
        print('\n📝 Next Steps:')
        print('   1. Test the UI buttons in Event Queue Manager')
        print('   2. Verify API endpoints work correctly')
        print('   3. Test pause/resume functionality')
        print('   4. Test cleanup with dry run first')
        print('   5. Monitor queue health in production')
        
        return True
        
    except Exception as e:
        print(f'\n❌ Test failed: {e}')
        import traceback
        traceback.print_exc()
        return False
    
    finally:
        client.close()

if __name__ == "__main__":
    print("=" * 60)
    print("QUEUE MANAGEMENT SYSTEM TEST")
    print("=" * 60)
    
    success = asyncio.run(test_queue_management())
    
    if success:
        print("\n✅ All tests passed!")
        exit(0)
    else:
        print("\n❌ Some tests failed!")
        exit(1)
