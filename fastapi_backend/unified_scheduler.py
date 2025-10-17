# fastapi_backend/unified_scheduler.py
"""
Unified Scheduler - Single scheduler engine for all background jobs
Handles both test scheduling and data cleanup
"""

import asyncio
import logging
from datetime import datetime
from typing import Optional, Callable, Dict, List
from motor.motor_asyncio import AsyncIOMotorDatabase

logger = logging.getLogger(__name__)

class ScheduledJob:
    """Represents a scheduled job"""
    def __init__(self, name: str, interval_seconds: int, func: Callable, is_async: bool = True):
        self.name = name
        self.interval_seconds = interval_seconds
        self.func = func
        self.is_async = is_async
        self.last_run = None
        self.next_run = datetime.utcnow()
        self.enabled = True
        
    def should_run(self) -> bool:
        """Check if job should run now"""
        if not self.enabled:
            return False
        return datetime.utcnow() >= self.next_run
    
    def update_next_run(self):
        """Update next run time"""
        from datetime import timedelta
        self.last_run = datetime.utcnow()
        self.next_run = self.last_run + timedelta(seconds=self.interval_seconds)


class UnifiedScheduler:
    """Unified scheduler for all background jobs"""
    
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.jobs: Dict[str, ScheduledJob] = {}
        self.is_running = False
        self._task = None
        
    def add_job(self, name: str, interval_seconds: int, func: Callable, is_async: bool = True):
        """
        Add a job to the scheduler
        
        Args:
            name: Unique job name
            interval_seconds: How often to run (in seconds)
            func: Function to execute
            is_async: Whether the function is async (default: True)
        """
        job = ScheduledJob(name, interval_seconds, func, is_async)
        self.jobs[name] = job
        logger.info(f"📅 Scheduled job added: '{name}' (runs every {interval_seconds}s)")
        
    def remove_job(self, name: str):
        """Remove a job from the scheduler"""
        if name in self.jobs:
            del self.jobs[name]
            logger.info(f"❌ Scheduled job removed: '{name}'")
            
    def enable_job(self, name: str):
        """Enable a job"""
        if name in self.jobs:
            self.jobs[name].enabled = True
            logger.info(f"✅ Job enabled: '{name}'")
            
    def disable_job(self, name: str):
        """Disable a job"""
        if name in self.jobs:
            self.jobs[name].enabled = False
            logger.info(f"⏸️ Job disabled: '{name}'")
    
    async def run_job(self, job: ScheduledJob):
        """Execute a single job"""
        try:
            logger.info(f"▶️ Running job: '{job.name}'")
            
            if job.is_async:
                await job.func()
            else:
                # Run sync function in thread pool
                loop = asyncio.get_event_loop()
                await loop.run_in_executor(None, job.func)
            
            logger.info(f"✅ Job completed: '{job.name}'")
            
        except Exception as e:
            logger.error(f"❌ Error in job '{job.name}': {e}", exc_info=True)
        finally:
            job.update_next_run()
    
    async def start(self):
        """Start the unified scheduler"""
        if self.is_running:
            logger.warning("⚠️ Unified scheduler already running")
            return
            
        self.is_running = True
        logger.info("🚀 Unified Scheduler started")
        logger.info(f"📋 Total jobs: {len(self.jobs)}")
        
        # Main scheduler loop
        while self.is_running:
            try:
                # Check which jobs should run
                jobs_to_run = [job for job in self.jobs.values() if job.should_run()]
                
                if jobs_to_run:
                    logger.debug(f"Running {len(jobs_to_run)} job(s)")
                    # Run jobs concurrently
                    await asyncio.gather(*[self.run_job(job) for job in jobs_to_run])
                
                # Sleep for a short interval (check every 30 seconds)
                await asyncio.sleep(30)
                
            except Exception as e:
                logger.error(f"❌ Error in scheduler loop: {e}", exc_info=True)
                await asyncio.sleep(60)  # Wait longer on error
    
    async def stop(self):
        """Stop the unified scheduler"""
        self.is_running = False
        logger.info("🛑 Unified Scheduler stopped")
        
    def get_job_status(self) -> List[Dict]:
        """Get status of all jobs"""
        status = []
        for job in self.jobs.values():
            status.append({
                "name": job.name,
                "enabled": job.enabled,
                "interval_seconds": job.interval_seconds,
                "last_run": job.last_run.isoformat() if job.last_run else None,
                "next_run": job.next_run.isoformat() if job.next_run else None
            })
        return status


# Global scheduler instance
unified_scheduler: Optional[UnifiedScheduler] = None


def get_unified_scheduler() -> Optional[UnifiedScheduler]:
    """Get the global unified scheduler instance"""
    return unified_scheduler


async def initialize_unified_scheduler(db: AsyncIOMotorDatabase):
    """Initialize and configure the unified scheduler with all jobs"""
    global unified_scheduler
    
    unified_scheduler = UnifiedScheduler(db)
    
    # ===== Register Jobs =====
    
    # 1. Data Cleanup Job (every hour)
    from cleanup_scheduler import CleanupScheduler
    cleanup_instance = CleanupScheduler(db)
    unified_scheduler.add_job(
        name="data_cleanup",
        interval_seconds=3600,  # 1 hour
        func=cleanup_instance.run_cleanup_cycle,
        is_async=True
    )
    
    # 2. Test Scheduler Job (every minute)
    from test_management import check_and_run_scheduled_tests
    unified_scheduler.add_job(
        name="test_scheduler",
        interval_seconds=60,  # 1 minute
        func=check_and_run_scheduled_tests,
        is_async=False  # It's a sync function
    )
    
    # 3. Ticket Cleanup Job (daily at 7pm)
    async def cleanup_expired_tickets():
        """Delete tickets that have passed their scheduled deletion time"""
        try:
            from pathlib import Path
            import os
            
            # Find tickets scheduled for deletion
            now = datetime.utcnow()
            tickets = await db.contact_tickets.find({
                "scheduledDeleteAt": {"$lte": now}
            }).to_list(length=None)
            
            if not tickets:
                logger.info("🗑️ No tickets scheduled for deletion")
                return
            
            logger.info(f"🗑️ Found {len(tickets)} tickets scheduled for deletion")
            
            for ticket in tickets:
                try:
                    # Delete attachments
                    if ticket.get("attachments"):
                        for attachment in ticket["attachments"]:
                            try:
                                file_path = Path(attachment.get('file_path', ''))
                                if file_path.exists():
                                    os.remove(file_path)
                                    logger.info(f"✅ Deleted attachment: {file_path}")
                            except Exception as file_err:
                                logger.error(f"⚠️ Failed to delete file: {file_err}")
                    
                    # Delete ticket
                    await db.contact_tickets.delete_one({"_id": ticket["_id"]})
                    logger.info(f"✅ Deleted ticket: {ticket['_id']}")
                    
                except Exception as ticket_err:
                    logger.error(f"❌ Error deleting ticket {ticket.get('_id')}: {ticket_err}")
            
            logger.info(f"✅ Ticket cleanup completed: {len(tickets)} tickets deleted")
            
        except Exception as e:
            logger.error(f"❌ Error in ticket cleanup job: {e}", exc_info=True)
    
    # Calculate next run time for 7pm (19:00 UTC)
    from datetime import timedelta, time as dt_time
    now = datetime.utcnow()
    today_7pm = datetime.combine(now.date(), dt_time(19, 0))
    
    # If it's already past 7pm today, schedule for tomorrow at 7pm
    if now >= today_7pm:
        next_run = today_7pm + timedelta(days=1)
    else:
        next_run = today_7pm
    
    job = ScheduledJob(
        name="auto_delete_resolved_tickets",
        interval_seconds=86400,  # 24 hours (daily)
        func=cleanup_expired_tickets,
        is_async=True
    )
    job.next_run = next_run  # Set to run at 7pm
    unified_scheduler.jobs["auto_delete_resolved_tickets"] = job
    logger.info(f"📅 Scheduled job added: 'auto_delete_resolved_tickets' (runs daily at 7pm UTC, next run: {next_run})")
    
    # Start the scheduler in background
    asyncio.create_task(unified_scheduler.start())
    
    logger.info("✅ Unified Scheduler initialized with all jobs")
    return unified_scheduler


async def shutdown_unified_scheduler():
    """Shutdown the unified scheduler"""
    global unified_scheduler
    if unified_scheduler:
        await unified_scheduler.stop()
        unified_scheduler = None
