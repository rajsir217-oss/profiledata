"""
Queue Cleanup Job
Clean up old and stale notifications to maintain performance
"""

import asyncio
from datetime import datetime, timedelta
from typing import Dict, Any
from motor.motor_asyncio import AsyncIOMotorDatabase
import logging

from job_templates.base import JobTemplate, JobExecutionContext, JobResult

logger = logging.getLogger(__name__)

class QueueCleanupJob(JobTemplate):
    
    def get_schema(self) -> Dict[str, Any]:
        """Get job parameter schema"""
        return {
            "type": "object",
            "properties": {
                "age_days": {
                    "type": "integer",
                    "minimum": 1,
                    "maximum": 365,
                    "default": 30,
                    "description": "Age threshold for cleanup (days)"
                },
                "failed_age_days": {
                    "type": "integer", 
                    "minimum": 1,
                    "maximum": 90,
                    "default": 7,
                    "description": "Age threshold for failed notifications (days)"
                },
                "batch_size": {
                    "type": "integer",
                    "minimum": 100,
                    "maximum": 10000,
                    "default": 1000,
                    "description": "Batch size for deletion"
                },
                "dry_run": {
                    "type": "boolean",
                    "default": False,
                    "description": "Run in dry-run mode without deleting"
                }
            }
        }
    
    def validate_params(self, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Validate parameters (alias for validate_parameters)"""
        return asyncio.run(self.validate_parameters(parameters))
    
    def __init__(self):
        super().__init__()
        self.job_name = "queue_cleanup"
        self.description = "Clean up old and stale notifications"
    
    async def validate_parameters(self, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Validate and normalize job parameters"""
        validated = {}
        
        # Age threshold for cleanup (days)
        age_days = parameters.get("age_days", 30)
        validated["age_days"] = max(1, min(365, int(age_days)))
        
        # Cleanup failed notifications older than (days)
        failed_age_days = parameters.get("failed_age_days", 7)
        validated["failed_age_days"] = max(1, min(90, int(failed_age_days)))
        
        # Batch size for deletion
        batch_size = parameters.get("batch_size", 1000)
        validated["batch_size"] = max(100, min(10000, int(batch_size)))
        
        # Dry run mode
        validated["dry_run"] = parameters.get("dry_run", False)
        
        return validated
    
    async def execute(self, context: JobExecutionContext) -> JobResult:
        """Execute queue cleanup job"""
        db = context.db
        parameters = context.parameters
        
        age_days = parameters["age_days"]
        failed_age_days = parameters["failed_age_days"]
        batch_size = parameters["batch_size"]
        dry_run = parameters["dry_run"]
        
        context.log("info", f"Starting queue cleanup")
        context.log("info", f"Age threshold: {age_days} days, Failed age: {failed_age_days} days")
        context.log("info", f"Batch size: {batch_size}, Dry run: {dry_run}")
        
        total_deleted = 0
        cleanup_stats = {
            "old_pending": 0,
            "old_failed": 0,
            "old_sent": 0,
            "failed_notifications": 0
        }
        
        try:
            # 1. Clean up old pending notifications (stuck in queue)
            old_pending_cutoff = datetime.utcnow() - timedelta(days=age_days)
            old_pending_query = {
                "status": "pending",
                "createdAt": {"$lt": old_pending_cutoff}
            }
            
            old_pending_count = await db.notification_queue.count_documents(old_pending_query)
            context.log("info", f"Found {old_pending_count} old pending notifications")
            
            if old_pending_count > 0:
                deleted = await self._cleanup_notifications(
                    old_pending_query, "old_pending", batch_size, db, context, dry_run
                )
                cleanup_stats["old_pending"] = deleted
                total_deleted += deleted
            
            # 2. Clean up old failed notifications
            old_failed_cutoff = datetime.utcnow() - timedelta(days=failed_age_days)
            old_failed_query = {
                "status": "failed",
                "createdAt": {"$lt": old_failed_cutoff}
            }
            
            old_failed_count = await db.notification_queue.count_documents(old_failed_query)
            context.log("info", f"Found {old_failed_count} old failed notifications")
            
            if old_failed_count > 0:
                deleted = await self._cleanup_notifications(
                    old_failed_query, "old_failed", batch_size, db, context, dry_run
                )
                cleanup_stats["old_failed"] = deleted
                total_deleted += deleted
            
            # 3. Clean up old sent notifications (keep logs, but queue items can be cleaned)
            old_sent_cutoff = datetime.utcnow() - timedelta(days=age_days)
            old_sent_query = {
                "status": "sent",
                "sentAt": {"$lt": old_sent_cutoff}
            }
            
            old_sent_count = await db.notification_queue.count_documents(old_sent_query)
            context.log("info", f"Found {old_sent_count} old sent notifications")
            
            if old_sent_count > 0:
                deleted = await self._cleanup_notifications(
                    old_sent_query, "old_sent", batch_size, db, context, dry_run
                )
                cleanup_stats["old_sent"] = deleted
                total_deleted += deleted
            
            # 4. Clean up very old notification logs (keep for 90 days)
            log_cutoff = datetime.utcnow() - timedelta(days=90)
            old_log_query = {
                "createdAt": {"$lt": log_cutoff}
            }
            
            old_log_count = await db.notification_log.count_documents(old_log_query)
            context.log("info", f"Found {old_log_count} old notification logs")
            
            if old_log_count > 0:
                deleted = await self._cleanup_logs(
                    old_log_query, batch_size, db, context, dry_run
                )
                total_deleted += deleted
            
            # 5. Clean up rate limit cache entries (if Redis is available)
            try:
                from services.notification_cache import get_notification_cache
                cache_service = await get_notification_cache()
                
                if cache_service and cache_service.redis_client:
                    # Clean up old rate limit entries
                    rate_limit_keys = await cache_service.redis_client.keys("rate_limit:*")
                    if rate_limit_keys:
                        # Delete keys older than 1 hour
                        deleted_keys = 0
                        for key in rate_limit_keys[:1000]:  # Limit to 1000 keys per run
                            try:
                                ttl = await cache_service.redis_client.ttl(key)
                                if ttl == -1:  # No expiry set, clean it up
                                    await cache_service.redis_client.delete(key)
                                    deleted_keys += 1
                            except Exception as e:
                                context.log("warning", f"Error cleaning rate limit key {key}: {e}")
                        
                        context.log("info", f"Cleaned up {deleted_keys} stale rate limit cache entries")
                
            except Exception as e:
                context.log("warning", f"Error cleaning cache entries: {e}")
            
            # Summary
            context.log("info", f"Queue cleanup completed")
            context.log("info", f"Total deleted: {total_deleted}")
            context.log("info", f"Breakdown: {cleanup_stats}")
            
            return JobResult(
                status="success",
                message=f"Cleaned up {total_deleted} old notifications",
                records_processed=total_deleted,
                records_affected=total_deleted,
                details={
                    "cleanup_stats": cleanup_stats,
                    "dry_run": dry_run,
                    "age_days": age_days,
                    "failed_age_days": failed_age_days
                }
            )
            
        except Exception as e:
            context.log("error", f"Queue cleanup failed: {e}")
            return JobResult(
                status="failed",
                message=f"Queue cleanup failed: {e}",
                records_processed=total_deleted,
                records_affected=total_deleted,
                errors=[str(e)]
            )
    
    async def _cleanup_notifications(
        self, 
        query: Dict[str, Any], 
        cleanup_type: str,
        batch_size: int,
        db: AsyncIOMotorDatabase,
        context: JobExecutionContext,
        dry_run: bool
    ) -> int:
        """Clean up notifications matching query"""
        
        total_deleted = 0
        
        while True:
            # Get batch of notifications to delete
            batch = await db.notification_queue.find(query).limit(batch_size).to_list(batch_size)
            
            if not batch:
                break
            
            if dry_run:
                context.log("info", f"[DRY RUN] Would delete {len(batch)} {cleanup_type} notifications")
                total_deleted += len(batch)
                break
            else:
                # Delete the batch
                notification_ids = [n["_id"] for n in batch]
                result = await db.notification_queue.delete_many({"_id": {"$in": notification_ids}})
                
                deleted_count = result.deleted_count
                total_deleted += deleted_count
                
                context.log("debug", f"Deleted {deleted_count} {cleanup_type} notifications")
                
                # Small delay to avoid overwhelming the database
                if deleted_count > 0:
                    await asyncio.sleep(0.1)
        
        return total_deleted
    
    async def _cleanup_logs(
        self, 
        query: Dict[str, Any],
        batch_size: int,
        db: AsyncIOMotorDatabase,
        context: JobExecutionContext,
        dry_run: bool
    ) -> int:
        """Clean up notification logs matching query"""
        
        total_deleted = 0
        
        while True:
            # Get batch of logs to delete
            batch = await db.notification_log.find(query).limit(batch_size).to_list(batch_size)
            
            if not batch:
                break
            
            if dry_run:
                context.log("info", f"[DRY RUN] Would delete {len(batch)} notification logs")
                total_deleted += len(batch)
                break
            else:
                # Delete the batch
                log_ids = [l["_id"] for l in batch]
                result = await db.notification_log.delete_many({"_id": {"$in": log_ids}})
                
                deleted_count = result.deleted_count
                total_deleted += deleted_count
                
                context.log("debug", f"Deleted {deleted_count} notification logs")
                
                # Small delay to avoid overwhelming the database
                if deleted_count > 0:
                    await asyncio.sleep(0.1)
        
        return total_deleted
