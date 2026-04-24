"""
Platform Stats Snapshot Jobs Migration Script

Creates dynamic jobs in the database for platform stats snapshot system.
Run this script after registering the job templates.
"""

import asyncio
import sys
import os
from datetime import datetime

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import get_database


async def migrate_platform_stats_jobs():
    """Create dynamic jobs for platform stats snapshot system"""
    db = await get_database()
    
    jobs_to_create = [
        {
            "name": "Daily Platform Stats Snapshot",
            "template_type": "daily_platform_stats_snapshot",
            "enabled": True,
            "schedule": {
                "type": "cron",
                "value": "5 0 * * *"  # Daily at 00:05 UTC
            },
            "parameters": {},
            "timeout": 300,  # 5 minutes
            "retry_count": 3,
            "retry_delay": 60,
            "description": "Creates daily statistics snapshots from activity_logs for the previous day",
            "created_at": datetime.utcnow()
        },
        {
            "name": "Monthly Platform Stats Aggregation",
            "template_type": "monthly_platform_stats_aggregation",
            "enabled": True,
            "schedule": {
                "type": "cron",
                "value": "0 1 1 * *"  # 1st of month at 01:00 UTC
            },
            "parameters": {},
            "timeout": 600,  # 10 minutes
            "retry_count": 3,
            "retry_delay": 60,
            "description": "Aggregates previous month's daily snapshots into monthly snapshot and purges daily docs",
            "created_at": datetime.utcnow()
        },
        {
            "name": "Yearly Platform Stats Aggregation",
            "template_type": "yearly_platform_stats_aggregation",
            "enabled": True,
            "schedule": {
                "type": "cron",
                "value": "0 2 1 1 *"  # January 1st at 02:00 UTC
            },
            "parameters": {},
            "timeout": 600,  # 10 minutes
            "retry_count": 3,
            "retry_delay": 60,
            "description": "Aggregates previous year's monthly snapshots into yearly snapshot and purges monthly docs",
            "created_at": datetime.utcnow()
        },
        {
            "name": "Daily Platform Stats Purge",
            "template_type": "daily_platform_stats_purge",
            "enabled": True,
            "schedule": {
                "type": "cron",
                "value": "0 3 * * *"  # Daily at 03:00 UTC
            },
            "parameters": {},
            "timeout": 300,  # 5 minutes
            "retry_count": 3,
            "retry_delay": 60,
            "description": "Purges daily snapshots older than 90 days to maintain storage efficiency",
            "created_at": datetime.utcnow()
        },
        {
            "name": "Monthly Platform Stats Purge",
            "template_type": "monthly_platform_stats_purge",
            "enabled": True,
            "schedule": {
                "type": "cron",
                "value": "0 4 1 * *"  # 1st of month at 04:00 UTC
            },
            "parameters": {},
            "timeout": 300,  # 5 minutes
            "retry_count": 3,
            "retry_delay": 60,
            "description": "Purges monthly snapshots for years older than current year to maintain storage efficiency",
            "created_at": datetime.utcnow()
        }
    ]
    
    created_count = 0
    updated_count = 0
    
    for job in jobs_to_create:
        # Check if job already exists
        existing = await db.dynamic_jobs.find_one({
            "template_type": job["template_type"]
        })
        
        if existing:
            # Update existing job
            await db.dynamic_jobs.update_one(
                {"template_type": job["template_type"]},
                {"$set": job}
            )
            print(f"✅ Updated job: {job['name']}")
            updated_count += 1
        else:
            # Create new job
            await db.dynamic_jobs.insert_one(job)
            print(f"✅ Created job: {job['name']}")
            created_count += 1
    
    print(f"\n✅ Migration completed: {created_count} created, {updated_count} updated")
    return created_count, updated_count


async def main():
    """Main entry point"""
    print("🚀 Starting Platform Stats Jobs Migration...")
    print("=" * 60)
    
    try:
        created, updated = await migrate_platform_stats_jobs()
        print("=" * 60)
        print(f"✅ Migration successful!")
        print(f"   - Jobs created: {created}")
        print(f"   - Jobs updated: {updated}")
        print("\n📊 Next steps:")
        print("   1. Restart the backend server")
        print("   2. Verify jobs appear in Dynamic Scheduler UI")
        print("   3. Manually run daily snapshot job to test")
        print("   4. Monitor job execution logs")
        
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
