"""
Migration: Ensure Email Notifier Job Exists

This migration ensures the Email Notifier job exists in the dynamic_jobs collection.
The Email Notifier processes the notification_queue and sends actual emails.

Run: python -m migrations.ensure_email_notifier_job
"""

import asyncio
import logging
import os
import sys
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config import settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def ensure_email_notifier_job():
    """Ensure the Email Notifier job exists in the database"""
    
    client = AsyncIOMotorClient(settings.mongodb_url)
    db = client[settings.database_name]
    
    try:
        # Check if already exists
        existing = await db.dynamic_jobs.find_one({'templateType': 'email_notifier'})
        
        if existing:
            logger.info(f"✅ Email Notifier job already exists (ID: {existing['_id']})")
            logger.info(f"   Enabled: {existing.get('enabled')}")
            logger.info(f"   Schedule: {existing.get('schedule')}")
            return
        
        # Create the job
        now = datetime.now(timezone.utc)
        job = {
            'name': 'Email Notifier',
            'description': 'Process notification queue and send emails',
            'templateType': 'email_notifier',
            'enabled': True,
            'schedule': {
                'type': 'interval',
                'intervalSeconds': 300  # Every 5 minutes
            },
            'parameters': {
                'batchSize': 50
            },
            'createdAt': now,
            'updatedAt': now,
            'createdBy': 'system-migration',
            'lastRunAt': None,
            'nextRunAt': now,
            'runCount': 0,
            'lastStatus': None
        }
        
        result = await db.dynamic_jobs.insert_one(job)
        logger.info(f"✅ Created Email Notifier job (ID: {result.inserted_id})")
        logger.info(f"   Schedule: Every 5 minutes")
        logger.info(f"   Batch Size: 50 emails per run")
        
    finally:
        client.close()


if __name__ == "__main__":
    asyncio.run(ensure_email_notifier_job())
