"""
Database Cleanup Job Template
Removes old records from database collections based on conditions
"""

from typing import Dict, Any, Optional, Tuple
from datetime import datetime, timedelta
from .base import JobTemplate, JobResult, JobExecutionContext
import logging

logger = logging.getLogger(__name__)


class DatabaseCleanupTemplate(JobTemplate):
    """Template for cleaning up old database records"""
    
    template_type = "database_cleanup"
    template_name = "Database Cleanup"
    template_description = "Remove old records from a database collection based on conditions"
    category = "maintenance"
    icon = "🧹"
    estimated_duration = "5-30 minutes"
    resource_usage = "low"
    risk_level = "medium"
    
    # Allowed collections (for security)
    ALLOWED_COLLECTIONS = [
        "users",
        "logs",
        "sessions",
        "messages",
        "contact_tickets",
        "notifications",
        "activity_logs",
        "job_executions",
        "favorites",      # User favorites - 45 day retention
        "shortlists",     # User shortlists - 45 day retention
        "exclusions",     # User exclusions - optional cleanup
        "profile_views",  # Profile view history
        "pii_requests",   # PII requests - 7 day retention for pending
        "pii_access"      # PII access grants - cleanup expired
    ]
    
    def get_schema(self) -> Dict[str, Any]:
        """Return JSON schema for parameters"""
        return {
            "type": "object",
            "properties": {
                "cleanup_targets": {
                    "type": "array",
                    "description": "List of collections to clean up with their retention policies",
                    "items": {
                        "type": "object",
                        "properties": {
                            "collection": {
                                "type": "string",
                                "description": "Collection name",
                                "enum": self.ALLOWED_COLLECTIONS
                            },
                            "days_old": {
                                "type": "integer",
                                "description": "Delete records older than this many days",
                                "minimum": 1,
                                "maximum": 3650
                            },
                            "date_field": {
                                "type": "string",
                                "description": "Date field name",
                                "default": "created_at"
                            }
                        },
                        "required": ["collection", "days_old"]
                    }
                },
                "dry_run": {
                    "type": "boolean",
                    "description": "Preview changes without actually deleting",
                    "default": False
                },
                "batch_size": {
                    "type": "integer",
                    "description": "Number of records to delete per batch",
                    "minimum": 1,
                    "maximum": 10000,
                    "default": 1000
                }
            },
            "required": ["cleanup_targets"]
        }
    
    def validate_params(self, params: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        """Validate parameters"""
        # Check cleanup_targets
        cleanup_targets = params.get("cleanup_targets")
        if not cleanup_targets:
            return False, "cleanup_targets is required"
        
        if not isinstance(cleanup_targets, list) or len(cleanup_targets) == 0:
            return False, "cleanup_targets must be a non-empty array"
        
        # Validate each target
        for idx, target in enumerate(cleanup_targets):
            if not isinstance(target, dict):
                return False, f"cleanup_targets[{idx}] must be an object"
            
            collection = target.get("collection")
            if not collection:
                return False, f"cleanup_targets[{idx}].collection is required"
            
            if collection not in self.ALLOWED_COLLECTIONS:
                return False, f"Collection '{collection}' is not allowed"
            
            days_old = target.get("days_old")
            if not days_old:
                return False, f"cleanup_targets[{idx}].days_old is required"
            
            if not isinstance(days_old, int) or days_old < 1:
                return False, f"cleanup_targets[{idx}].days_old must be a positive integer"
        
        return True, None
    
    async def execute(self, context: JobExecutionContext) -> JobResult:
        """Execute database cleanup for multiple collections"""
        params = context.parameters
        
        # Validate required parameters
        if "cleanup_targets" not in params:
            return JobResult(
                status="failed",
                message="Missing required parameter: 'cleanup_targets'",
                errors=["cleanup_targets parameter is required"]
            )
        
        cleanup_targets = params["cleanup_targets"]
        dry_run = params.get("dry_run", False)
        batch_size = params.get("batch_size", 1000)
        
        context.log("INFO", f"🧹 Starting multi-collection database cleanup")
        context.log("INFO", f"📋 Targets: {len(cleanup_targets)} collections")
        context.log("INFO", f"{'🔍 DRY RUN MODE' if dry_run else '🗑️  LIVE DELETION MODE'}")
        context.log("INFO", "="*60)
        
        total_deleted = 0
        total_processed = 0
        results_by_collection = {}
        errors = []
        
        # Process each collection target
        for target in cleanup_targets:
            collection_name = target["collection"]
            days_old = target.get("days_old", 0)
            date_field = target.get("date_field", "created_at")
            status_filter = target.get("status_filter")
            delete_all_matching = target.get("delete_all_matching", False)
            
            context.log("INFO", f"\n📁 Processing: {collection_name}")
            if delete_all_matching and status_filter:
                context.log("INFO", f"   🗑️  Delete ALL with status: {status_filter}")
            else:
                context.log("INFO", f"   ⏰ Retention: {days_old} days")
            context.log("INFO", f"   📅 Date field: {date_field}")
            
            try:
                result = await self._cleanup_collection(
                    context=context,
                    collection_name=collection_name,
                    days_old=days_old,
                    date_field=date_field,
                    dry_run=dry_run,
                    batch_size=batch_size,
                    status_filter=status_filter,
                    delete_all_matching=delete_all_matching
                )
                
                results_by_collection[collection_name] = result
                total_deleted += result["deleted"]
                total_processed += result["found"]
                
                if result["deleted"] > 0 or result["found"] > 0:
                    context.log("INFO", f"   ✅ {collection_name}: {'Would delete' if dry_run else 'Deleted'} {result['deleted']} of {result['found']} old records")
                else:
                    context.log("INFO", f"   ✨ {collection_name}: No old records found")
                    
            except Exception as e:
                error_msg = f"{collection_name}: {str(e)}"
                errors.append(error_msg)
                context.log("ERROR", f"   ❌ {error_msg}")
                results_by_collection[collection_name] = {
                    "found": 0,
                    "deleted": 0,
                    "error": str(e)
                }
        
        context.log("INFO", "="*60)
        context.log("INFO", f"\n📊 SUMMARY:")
        context.log("INFO", f"   Collections processed: {len(cleanup_targets)}")
        context.log("INFO", f"   Total old records found: {total_processed}")
        context.log("INFO", f"   Total {'would be deleted' if dry_run else 'deleted'}: {total_deleted}")
        
        if errors:
            context.log("WARNING", f"   ⚠️  Errors: {len(errors)}")
        
        # Determine overall status
        if len(errors) == len(cleanup_targets):
            status = "failed"
            message = f"All collections failed to clean up"
        elif errors:
            status = "partial"
            message = f"{'Dry run completed' if dry_run else 'Cleanup completed'} with {len(errors)} errors. Deleted {total_deleted} records."
        else:
            status = "success"
            message = f"{'Dry run: Would delete' if dry_run else 'Successfully deleted'} {total_deleted} records across {len(cleanup_targets)} collections"
        
        return JobResult(
            status=status,
            message=message,
            details={
                "dry_run": dry_run,
                "results_by_collection": results_by_collection,
                "total_found": total_processed,
                "total_deleted": total_deleted
            },
            records_processed=total_processed,
            records_affected=total_deleted,
            errors=errors if errors else None
        )
    
    async def _cleanup_collection(
        self,
        context: JobExecutionContext,
        collection_name: str,
        days_old: int,
        date_field: str,
        dry_run: bool,
        batch_size: int,
        status_filter: Any = None,
        delete_all_matching: bool = False
    ) -> Dict[str, Any]:
        """Clean up a single collection
        
        Args:
            status_filter: Optional status or list of statuses to filter by
            delete_all_matching: If True, ignore days_old and delete all matching status records
        """
        condition = {}
        
        # Add date condition unless delete_all_matching is True
        if not delete_all_matching:
            cutoff_date = datetime.utcnow() - timedelta(days=days_old)
            condition[date_field] = {"$lt": cutoff_date}
        
        # Add status filter if provided
        if status_filter:
            if isinstance(status_filter, list):
                condition["status"] = {"$in": status_filter}
            else:
                condition["status"] = status_filter
        
        collection = context.db[collection_name]
        
        # Count matching records
        count = await collection.count_documents(condition)
        
        if count == 0:
            return {"found": 0, "deleted": 0}
        
        if dry_run:
            return {"found": count, "deleted": count}  # Would delete
        
        # Actual deletion (in batches)
        deleted_count = 0
        
        while deleted_count < count:
            result = await collection.delete_many(condition)
            batch_deleted = result.deleted_count
            
            if batch_deleted == 0:
                break
            
            deleted_count += batch_deleted
        
        return {"found": count, "deleted": deleted_count}
