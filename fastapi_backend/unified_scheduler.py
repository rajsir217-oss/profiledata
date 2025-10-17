# fastapi_backend/unified_scheduler.py
"""
Unified Scheduler - THE ONLY scheduler engine for the entire application

⚠️ CRITICAL: This is the SINGLE SOURCE OF TRUTH for all scheduled jobs.
NO other scheduler instances should be created anywhere in the codebase.

This scheduler handles:
1. Static jobs (registered in code during initialization)
   - Database cleanup
   - Test scheduling  
   - System maintenance

2. Dynamic jobs (created through admin UI, stored in database)
   - Template-based jobs (cleanup, email, export, backup, webhook, reports)
   - User-defined schedules (interval or cron)

Architecture:
- Single global instance initialized at startup
- Polls every 30 seconds for jobs ready to execute
- Supports both sync and async job functions
- Handles timeouts, retries, and error logging

See /docs/SINGLE_SCHEDULER_ARCHITECTURE.md for complete documentation.
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
        logger.info(f"📋 Total static jobs: {len(self.jobs)}")
        
        # Main scheduler loop
        while self.is_running:
            try:
                # Check which static jobs should run
                jobs_to_run = [job for job in self.jobs.values() if job.should_run()]
                
                if jobs_to_run:
                    logger.debug(f"Running {len(jobs_to_run)} static job(s)")
                    # Run jobs concurrently
                    await asyncio.gather(*[self.run_job(job) for job in jobs_to_run])
                
                # Check and run dynamic jobs from database
                await self.check_dynamic_jobs()
                
                # Sleep for a short interval (check every 30 seconds)
                await asyncio.sleep(30)
                
            except Exception as e:
                logger.error(f"❌ Error in scheduler loop: {e}", exc_info=True)
                await asyncio.sleep(60)  # Wait longer on error
    
    async def check_dynamic_jobs(self):
        """Check for and execute dynamic jobs from database"""
        try:
            from services.job_registry import JobRegistryService
            from services.job_executor import JobExecutor
            
            registry = JobRegistryService(self.db)
            executor = JobExecutor(self.db)
            
            # Get jobs ready to run
            jobs_to_run = await registry.get_jobs_ready_to_run()
            
            if jobs_to_run:
                logger.info(f"📋 Found {len(jobs_to_run)} dynamic job(s) ready to run")
                
                for job in jobs_to_run:
                    try:
                        # Execute job
                        logger.info(f"▶️ Executing dynamic job: {job['name']}")
                        await executor.execute_job(job, triggered_by="scheduler")
                        
                        # Update job's next run time
                        await registry.update_job_after_execution(job["_id"], {})
                        
                    except Exception as e:
                        logger.error(f"❌ Error executing dynamic job {job['name']}: {e}", exc_info=True)
        
        except Exception as e:
            logger.error(f"❌ Error checking dynamic jobs: {e}", exc_info=True)
    
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
    # ⚠️ MIGRATED: Legacy jobs have been migrated to Dynamic Scheduler
    # These hardcoded registrations are now disabled.
    # The jobs are now managed through the Dynamic Scheduler UI at /dynamic-scheduler
    # 
    # Migrated jobs:
    # - data_cleanup → "Legacy: System Cleanup" (system_cleanup template)
    # - test_scheduler → "Legacy: Test Scheduler" (test_scheduler template)
    # - auto_delete_resolved_tickets → "Legacy: Auto Delete Resolved Tickets" (ticket_cleanup template)
    
    logger.info("ℹ️ Legacy hardcoded jobs are disabled - using Dynamic Scheduler instead")
    
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
