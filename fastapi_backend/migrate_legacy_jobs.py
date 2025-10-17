#!/usr/bin/env python3
"""
Migration Script: Convert Legacy Hardcoded Jobs to Dynamic Scheduler
This script creates the 3 legacy jobs as dynamic jobs in the database.
"""

import asyncio
import sys
from datetime import datetime, time as dt_time, timedelta
from motor.motor_asyncio import AsyncIOMotorClient
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def migrate_legacy_jobs():
    """Create the 3 legacy jobs in the dynamic_jobs collection"""
    from config import settings
    
    # Connect to MongoDB using settings
    client = AsyncIOMotorClient(settings.mongodb_url)
    db = client[settings.database_name]
    
    logger.info(f"🔄 Starting migration of legacy jobs to database: {settings.database_name}...")
    
    jobs_to_create = [
        {
            "name": "Legacy: System Cleanup",
            "description": "System maintenance - clean up expired sessions, temporary files, and old data",
            "template_type": "system_cleanup",
            "parameters": {
                "cleanup_sessions": True,
                "cleanup_temp_files": True,
                "days_to_keep": 30
            },
            "schedule": {
                "type": "interval",
                "interval_seconds": 3600,  # Every hour
                "timezone": "UTC"
            },
            "enabled": True,
            "timeout_seconds": 300,  # 5 minutes
            "retry_policy": {
                "max_retries": 2,
                "retry_delay_seconds": 60
            },
            "notifications": {
                "on_success": [],
                "on_failure": ["admin@system.com"]
            },
            "created_by": "system_migration",
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        },
        {
            "name": "Legacy: Test Scheduler",
            "description": "Check and run scheduled tests automatically",
            "template_type": "test_scheduler",
            "parameters": {
                "check_interval": 60,
                "auto_run": True
            },
            "schedule": {
                "type": "interval",
                "interval_seconds": 60,  # Every minute
                "timezone": "UTC"
            },
            "enabled": True,
            "timeout_seconds": 600,  # 10 minutes
            "retry_policy": {
                "max_retries": 1,
                "retry_delay_seconds": 30
            },
            "notifications": {
                "on_success": [],
                "on_failure": []
            },
            "created_by": "system_migration",
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        },
        {
            "name": "Legacy: Auto Delete Resolved Tickets",
            "description": "Delete old resolved/closed support tickets and their attachments (runs daily at 7pm UTC)",
            "template_type": "ticket_cleanup",
            "parameters": {
                "delete_attachments": True,
                "batch_size": 100,
                "dry_run": False
            },
            "schedule": {
                "type": "cron",
                "expression": "0 19 * * *",  # Daily at 7pm UTC
                "timezone": "UTC"
            },
            "enabled": True,
            "timeout_seconds": 1800,  # 30 minutes
            "retry_policy": {
                "max_retries": 2,
                "retry_delay_seconds": 300
            },
            "notifications": {
                "on_success": [],
                "on_failure": ["admin@system.com"]
            },
            "created_by": "system_migration",
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
    ]
    
    created_count = 0
    skipped_count = 0
    
    for job_data in jobs_to_create:
        # Check if job already exists
        existing = await db.dynamic_jobs.find_one({"name": job_data["name"]})
        
        if existing:
            logger.info(f"⏭️  Skipping '{job_data['name']}' - already exists")
            skipped_count += 1
            continue
        
        # Create the job
        result = await db.dynamic_jobs.insert_one(job_data)
        logger.info(f"✅ Created job: {job_data['name']} (ID: {result.inserted_id})")
        created_count += 1
    
    logger.info(f"\n📊 Migration Summary:")
    logger.info(f"   ✅ Created: {created_count} jobs")
    logger.info(f"   ⏭️  Skipped: {skipped_count} jobs (already exist)")
    logger.info(f"   📝 Total: {len(jobs_to_create)} jobs processed")
    
    # Close connection
    client.close()
    
    logger.info("\n✅ Migration completed successfully!")
    logger.info("\n📌 Next steps:")
    logger.info("   1. Restart the backend server")
    logger.info("   2. Check Dynamic Scheduler page")
    logger.info("   3. The old hardcoded jobs will be automatically disabled")
    logger.info("   4. The new dynamic jobs will start running on their schedules")


if __name__ == "__main__":
    try:
        asyncio.run(migrate_legacy_jobs())
    except KeyboardInterrupt:
        logger.info("\n⚠️ Migration cancelled by user")
        sys.exit(1)
    except Exception as e:
        logger.error(f"\n❌ Migration failed: {e}", exc_info=True)
        sys.exit(1)
