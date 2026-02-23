"""
Queue Cleanup Job Template
Automated cleanup of notification queue with dead letter queue management
"""

from typing import Dict, Any, Optional, Tuple
from datetime import datetime

from .base import JobTemplate, JobExecutionContext, JobResult
from services.queue_manager import QueueManager


class QueueCleanupTemplate(JobTemplate):
    """Job template for automated queue cleanup"""
    
    # Template metadata
    template_type = "queue_cleanup"
    template_name = "Queue Cleanup"
    template_description = "Automated cleanup of notification queue and dead letter management"
    category = "maintenance"
    icon = "🧹"
    estimated_duration = "5-15 minutes"
    resource_usage = "medium"
    risk_level = "low"
    
    def get_schema(self) -> Dict[str, Any]:
        """Get job parameter schema"""
        return {
            "age_days": {
                "type": "integer",
                "label": "Pending/Sent Age (Days)",
                "description": "Clean pending/sent notifications older than this",
                "default": 30,
                "min": 0,
                "max": 365
            },
            "failed_age_days": {
                "type": "integer",
                "label": "Failed Age (Days)",
                "description": "Move failed notifications to dead letter after this many days",
                "default": 7,
                "min": 1,
                "max": 90
            },
            "sent_age_days": {
                "type": "integer",
                "label": "Sent Age (Days)",
                "description": "Delete sent notifications older than this many days",
                "default": 7,
                "min": 0,
                "max": 90
            },
            "batch_size": {
                "type": "integer",
                "label": "Batch Size",
                "description": "Number of items to process per batch",
                "default": 1000,
                "min": 100,
                "max": 10000
            },
            "dry_run": {
                "type": "boolean",
                "label": "Dry Run",
                "description": "Run in dry-run mode without actually deleting",
                "default": False
            },
            "cleanup_dead_letter": {
                "type": "boolean",
                "label": "Clean Dead Letter",
                "description": "Also clean up very old dead letter notifications (90+ days)",
                "default": True
            }
        }
    
    def validate_params(self, params: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        """Validate job parameters"""
        age_days = params.get("age_days", 30)
        failed_age_days = params.get("failed_age_days", 7)
        sent_age_days = params.get("sent_age_days", 7)
        batch_size = params.get("batch_size", 1000)
        
        if not (0 <= age_days <= 365):
            return False, "age_days must be between 0 and 365"
        
        if not (1 <= failed_age_days <= 90):
            return False, "failed_age_days must be between 1 and 90"
        
        if not (0 <= sent_age_days <= 90):
            return False, "sent_age_days must be between 0 and 90"
        
        if not (100 <= batch_size <= 10000):
            return False, "batch_size must be between 100 and 10000"
        
        return True, None
    
    def get_default_params(self) -> Dict[str, Any]:
        """Get default parameters"""
        return {
            "age_days": 30,
            "failed_age_days": 7,
            "sent_age_days": 7,
            "batch_size": 1000,
            "dry_run": False,
            "cleanup_dead_letter": True
        }
    
    async def execute(self, context: JobExecutionContext) -> JobResult:
        """Execute the queue cleanup job"""
        start_time = datetime.utcnow()
        
        db = context.db
        params = context.parameters
        
        age_days = params.get("age_days", 30)
        failed_age_days = params.get("failed_age_days", 7)
        sent_age_days = params.get("sent_age_days", 7)
        batch_size = params.get("batch_size", 1000)
        dry_run = params.get("dry_run", False)
        cleanup_dead_letter = params.get("cleanup_dead_letter", True)
        
        context.log("info", f"🧹 Starting queue cleanup")
        context.log("info", f"   - Pending/Sent age: {age_days} days")
        context.log("info", f"   - Failed age: {failed_age_days} days (move to dead letter)")
        context.log("info", f"   - Sent age: {sent_age_days} days")
        context.log("info", f"   - Batch size: {batch_size}")
        context.log("info", f"   - Dry run: {dry_run}")
        context.log("info", f"   - Clean dead letter: {cleanup_dead_letter}")
        
        try:
            queue_manager = QueueManager(db)
            
            # Get pre-cleanup metrics
            initial_metrics = await queue_manager.get_queue_metrics()
            context.log("info", f"📊 Initial queue state:")
            context.log("info", f"   - Pending: {initial_metrics.total_pending}")
            context.log("info", f"   - Processing: {initial_metrics.total_processing}")
            context.log("info", f"   - Failed: {initial_metrics.total_failed}")
            context.log("info", f"   - Sent: {initial_metrics.total_sent}")
            
            # Perform cleanup
            cleanup_stats = await queue_manager.cleanup_queue(
                age_days=age_days,
                failed_age_days=failed_age_days,
                sent_age_days=sent_age_days,
                batch_size=batch_size,
                dry_run=dry_run
            )
            
            # Get post-cleanup metrics
            final_metrics = await queue_manager.get_queue_metrics()
            
            # Calculate differences
            pending_diff = initial_metrics.total_pending - final_metrics.total_pending
            failed_diff = initial_metrics.total_failed - final_metrics.total_failed
            sent_diff = initial_metrics.total_sent - final_metrics.total_sent
            
            # Log results
            context.log("info", f"✅ Queue cleanup completed")
            context.log("info", f"   - Pending deleted: {pending_diff}")
            context.log("info", f"   - Failed moved to dead letter: {cleanup_stats.get('dead_letter_moved', 0)}")
            context.log("info", f"   - Sent deleted: {sent_diff}")
            context.log("info", f"   - Dead letter cleaned: {cleanup_stats.get('dead_letter_deleted', 0)}")
            context.log("info", f"   - Total processed: {cleanup_stats.get('total_deleted', 0)}")
            
            context.log("info", f"📊 Final queue state:")
            context.log("info", f"   - Pending: {final_metrics.total_pending}")
            context.log("info", f"   - Processing: {final_metrics.total_processing}")
            context.log("info", f"   - Failed: {final_metrics.total_failed}")
            context.log("info", f"   - Sent: {final_metrics.total_sent}")
            
            # Check for any issues
            warnings = []
            if final_metrics.stuck_processing_count > 0:
                warnings.append(f"{final_metrics.stuck_processing_count} notifications still stuck in processing")
            
            if final_metrics.failure_rate > 10:
                warnings.append(f"High failure rate: {final_metrics.failure_rate:.1f}%")
            
            if final_metrics.oldest_pending_age.total_seconds() > 3600:
                warnings.append(f"Old pending notifications: {final_metrics.oldest_pending_age.total_seconds()/60:.1f} minutes")
            
            duration = (datetime.utcnow() - start_time).total_seconds()
            
            return JobResult(
                status="success" if dry_run else "success",
                message=f"Queue cleanup {'simulated' if dry_run else 'completed'} - processed {cleanup_stats.get('total_deleted', 0)} items",
                details={
                    "cleanup_stats": cleanup_stats,
                    "initial_metrics": {
                        "pending": initial_metrics.total_pending,
                        "processing": initial_metrics.total_processing,
                        "failed": initial_metrics.total_failed,
                        "sent": initial_metrics.total_sent
                    },
                    "final_metrics": {
                        "pending": final_metrics.total_pending,
                        "processing": final_metrics.total_processing,
                        "failed": final_metrics.total_failed,
                        "sent": final_metrics.total_sent
                    },
                    "differences": {
                        "pending_deleted": pending_diff,
                        "failed_moved": cleanup_stats.get('dead_letter_moved', 0),
                        "sent_deleted": sent_diff
                    },
                    "dry_run": dry_run,
                    "warnings": warnings
                },
                records_processed=cleanup_stats.get('total_deleted', 0),
                records_affected=cleanup_stats.get('total_deleted', 0),
                errors=[],
                warnings=warnings,
                duration_seconds=duration
            )
            
        except Exception as e:
            context.log("error", f"❌ Queue cleanup failed: {e}")
            import traceback
            context.log("error", traceback.format_exc())
            
            return JobResult(
                status="failed",
                message=f"Queue cleanup failed: {str(e)}",
                details={"error": str(e)},
                records_processed=0,
                records_affected=0,
                errors=[str(e)],
                warnings=[],
                duration_seconds=(datetime.utcnow() - start_time).total_seconds()
            )
