#!/usr/bin/env python3
"""
Check what the activity logs API is returning
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from config import settings
from services.activity_logger import ActivityLogger
from models.activity_models import ActivityLogFilter

async def check_logs():
    """Check logs via the service"""
    print("🔍 Checking activity logs via service...")
    
    # Connect to database
    client = AsyncIOMotorClient(settings.mongodb_url)
    db = client[settings.database_name]
    
    # Create activity logger
    logger = ActivityLogger(db)
    
    try:
        # Get logs with default filters
        filters = ActivityLogFilter(page=1, limit=50)
        logs, total = await logger.get_logs(filters)
        
        print(f"\n📊 Results:")
        print(f"  Total logs: {total}")
        print(f"  Returned logs: {len(logs)}")
        
        if logs:
            print(f"\n📝 Sample logs:")
            for i, log in enumerate(logs[:5], 1):
                print(f"\n  {i}. {log.username}: {log.action_type}")
                print(f"     Target: {log.target_username or 'N/A'}")
                print(f"     Time: {log.timestamp}")
                print(f"     Metadata: {log.metadata}")
        else:
            print("\n⚠️  No logs returned")
            
            # Check raw database
            print("\n🔍 Checking raw database...")
            count = await db.activity_logs.count_documents({})
            print(f"  Raw count: {count}")
            
            if count > 0:
                raw_logs = await db.activity_logs.find().limit(3).to_list(3)
                print(f"\n  Sample raw logs:")
                for log in raw_logs:
                    print(f"    - {log}")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
    
    client.close()

if __name__ == "__main__":
    asyncio.run(check_logs())
