"""
Job Template: Activity Log Cleanup
Automatically cleans up old contribution activity records
"""

from datetime import datetime, timedelta
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Dict, Any, Optional, Tuple
import logging

from .base import JobTemplate, JobResult, JobExecutionContext

logger = logging.getLogger(__name__)


class ContributionPopupActivityCleanupJob(JobTemplate):
    """
    Job template for cleaning up old contribution activity records
    """
    
    # Template metadata (required for registry)
    template_type = "contribution_popup_activity_cleanup"
    template_name = "Contribution Popup Activity Cleanup"
    template_description = "Clean up old contribution popup activity records to manage storage"
    category = "maintenance"
    icon = "🗑️"
    estimated_duration = "5-10 minutes"
    resource_usage = "low"
    risk_level = "low"
    
    def get_schema(self) -> Dict[str, Any]:
        """Get the parameter schema for this job"""
        return {
            "type": "object",
            "properties": {
                "retention_days": {
                    "type": "integer",
                    "title": "Retention Period (Days)",
                    "description": "Keep records for this many days",
                    "default": 90,
                    "minimum": 1,
                    "maximum": 365
                },
                "batch_size": {
                    "type": "integer",
                    "title": "Batch Size",
                    "description": "Process records in batches to avoid memory issues",
                    "default": 1000,
                    "minimum": 100,
                    "maximum": 10000
                },
                "dry_run": {
                    "type": "boolean",
                    "title": "Dry Run",
                    "description": "If enabled, only report what would be deleted",
                    "default": False
                },
                "archive": {
                    "type": "boolean",
                    "title": "Archive Before Delete",
                    "description": "Save records to archive collection before deletion",
                    "default": True
                }
            },
            "required": []
        }
    
    def validate_params(self, params: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        """
        Validate job parameters
        
        Args:
            params: Parameters to validate
            
        Returns:
            Tuple of (is_valid, error_message)
        """
        # Check retention_days
        retention_days = params.get("retention_days", 90)
        if not isinstance(retention_days, int) or retention_days < 1 or retention_days > 365:
            return False, "retention_days must be an integer between 1 and 365"
        
        # Check batch_size
        batch_size = params.get("batch_size", 1000)
        if not isinstance(batch_size, int) or batch_size < 100 or batch_size > 10000:
            return False, "batch_size must be an integer between 100 and 10000"
        
        # Check dry_run
        dry_run = params.get("dry_run", False)
        if not isinstance(dry_run, bool):
            return False, "dry_run must be a boolean"
        
        # Check archive
        archive = params.get("archive", True)
        if not isinstance(archive, bool):
            return False, "archive must be a boolean"
        
        return True, None
    
    async def execute(self, context: JobExecutionContext) -> JobResult:
        """
        Execute the activity cleanup job
        
        Args:
            context: Job execution context
            
        Returns:
            JobResult with execution details
        """
        # Get parameters
        params = context.parameters
        retention_days = params.get("retention_days", 90)
        batch_size = params.get("batch_size", 1000)
        dry_run = params.get("dry_run", False)
        archive = params.get("archive", True)
        
        try:
            context.log("info", f"Starting activity log cleanup (retention: {retention_days} days)")
            
            # Calculate cutoff date (use naive datetime to match DB)
            cutoff_date = datetime.utcnow().replace(tzinfo=None) - timedelta(days=retention_days)
            context.log("info", f"Retention period: {retention_days} days")
            context.log("info", f"Cutoff date: {cutoff_date} (naive UTC)")
            
            # Count records to be deleted
            total_to_delete = await context.db.contribution_activity.count_documents({
                "timestamp": {"$lt": cutoff_date}
            })
            
            context.log("info", f"Total records in collection: {await context.db.contribution_activity.count_documents({})}")
            context.log("info", f"Records older than {retention_days} days: {total_to_delete}")
            
            if total_to_delete == 0:
                context.log("info", "No old records to clean up")
                return JobResult(
                    status="success",
                    message="No records to clean up",
                    details={"deleted_count": 0}
                )
            
            context.log("info", f"Found {total_to_delete:,} records older than {cutoff_date}")
            
            if dry_run:
                context.log("info", "DRY RUN: No records will be deleted")
                return JobResult(
                    status="success",
                    message=f"Would delete {total_to_delete:,} records",
                    details={
                        "deleted_count": 0,
                        "would_delete": total_to_delete
                    }
                )
            
            # Process in batches
            deleted_count = 0
            archived_count = 0
            max_iterations = 100  # Safety check to prevent infinite loops
            iteration = 0
            
            while iteration < max_iterations:
                iteration += 1
                
                # Get a batch of records
                batch = await context.db.contribution_activity.find(
                    {"timestamp": {"$lt": cutoff_date}}
                ).limit(batch_size).to_list(length=batch_size)
                
                if not batch:
                    context.log("info", f"No more records found after {iteration} iterations")
                    break
                
                # Archive if requested
                if archive:
                    archive_docs = []
                    # Keep original IDs for deletion
                    original_ids = []
                    for doc in batch:
                        original_ids.append(doc["_id"])  # Keep ObjectId
                        doc_copy = dict(doc)  # Create a copy
                        doc_copy["_id"] = str(doc["_id"])  # Convert copy to string
                        doc_copy["archived_at"] = datetime.utcnow().replace(tzinfo=None)
                        archive_docs.append(doc_copy)
                    
                    if archive_docs:
                        try:
                            # Try to insert all documents
                            result = await context.db.contribution_activity_archive.insert_many(archive_docs)
                            archived_count += len(result.inserted_ids)
                        except Exception as archive_error:
                            # If duplicate key error, insert one by one
                            if "duplicate key" in str(archive_error):
                                context.log("warning", "Some documents already archived, inserting individually...")
                                for doc in archive_docs:
                                    try:
                                        await context.db.contribution_activity_archive.insert_one(doc)
                                        archived_count += 1
                                    except:
                                        # Skip if already exists
                                        pass
                            else:
                                # Re-raise if it's a different error
                                raise archive_error
                
                # Delete the batch using original ObjectIds
                result = await context.db.contribution_activity.delete_many({
                    "_id": {"$in": original_ids if archive else [doc["_id"] for doc in batch]}
                })
                
                deleted_count += result.deleted_count
                
                # Debug logging
                context.log("info", f"Batch size: {len(batch)}, Deleted: {result.deleted_count}, Total deleted: {deleted_count}")
                
                # If nothing was deleted, we might have an issue
                if result.deleted_count == 0:
                    context.log("warning", f"No documents deleted! Sample ID: {batch[0]['_id']} (type: {type(batch[0]['_id'])})")
                    # Force break to prevent infinite loop
                    if deleted_count == 0 and archived_count > 0:
                        context.log("warning", "Breaking loop to prevent infinite loop - documents were archived but not deleted")
                        break
                
                # Log progress
                progress = (deleted_count / total_to_delete) * 100
                context.log(
                    "info", 
                    f"Progress: {deleted_count:,}/{total_to_delete:,} ({progress:.1f}%)"
                )
                
                # Stop if we've deleted all
                if deleted_count >= total_to_delete:
                    break
            
            # Check if we hit max iterations
            if iteration >= max_iterations:
                context.log("warning", f"Reached maximum iterations ({max_iterations}) - stopping to prevent infinite loop")
                context.log("warning", f"Deleted: {deleted_count}, Archived: {archived_count}")
            
            # Get final count
            remaining_count = await context.db.contribution_activity.count_documents({})
            
            result_msg = f"Cleaned up {deleted_count:,} old records"
            if archive:
                result_msg += f" (archived {archived_count:,})"
            
            context.log("info", result_msg)
            context.log("info", f"Remaining records: {remaining_count:,}")
            
            return JobResult(
                status="success",
                message=result_msg,
                details={
                    "deleted_count": deleted_count,
                    "archived_count": archived_count if archive else None,
                    "remaining_count": remaining_count
                },
                records_processed=deleted_count,
                records_affected=deleted_count
            )
            
        except Exception as e:
            error_msg = f"Activity log cleanup failed: {str(e)}"
            context.log("error", error_msg)
            logger.error(error_msg, exc_info=True)
            
            return JobResult(
                status="failed",
                message=error_msg,
                details={"error": str(e)}
            )
