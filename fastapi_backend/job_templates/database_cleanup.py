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
        "job_executions"
    ]
    
    def get_schema(self) -> Dict[str, Any]:
        """Return JSON schema for parameters"""
        return {
            "type": "object",
            "properties": {
                "collection": {
                    "type": "string",
                    "description": "Collection name to clean up",
                    "enum": self.ALLOWED_COLLECTIONS
                },
                "condition_type": {
                    "type": "string",
                    "description": "Type of condition to apply",
                    "enum": ["older_than_days", "custom_query"],
                    "default": "older_than_days"
                },
                "days_old": {
                    "type": "integer",
                    "description": "Delete records older than this many days",
                    "minimum": 1,
                    "maximum": 3650
                },
                "date_field": {
                    "type": "string",
                    "description": "Field name containing the date (e.g., 'created_at', 'updated_at')",
                    "default": "created_at"
                },
                "custom_condition": {
                    "type": "object",
                    "description": "Custom MongoDB query condition (advanced users only)"
                },
                "dry_run": {
                    "type": "boolean",
                    "description": "Preview changes without actually deleting",
                    "default": True
                },
                "batch_size": {
                    "type": "integer",
                    "description": "Number of records to delete per batch",
                    "minimum": 1,
                    "maximum": 10000,
                    "default": 1000
                }
            },
            "required": ["collection"],
            "oneOf": [
                {"required": ["condition_type", "days_old", "date_field"]},
                {"required": ["condition_type", "custom_condition"]}
            ]
        }
    
    def validate_params(self, params: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        """Validate parameters"""
        # Check collection
        collection = params.get("collection")
        if not collection:
            return False, "Collection name is required"
        
        if collection not in self.ALLOWED_COLLECTIONS:
            return False, f"Collection '{collection}' is not allowed. Allowed: {', '.join(self.ALLOWED_COLLECTIONS)}"
        
        # Check condition type
        condition_type = params.get("condition_type", "older_than_days")
        
        if condition_type == "older_than_days":
            if "days_old" not in params:
                return False, "days_old is required when using older_than_days condition"
            
            days_old = params.get("days_old")
            if not isinstance(days_old, int) or days_old < 1:
                return False, "days_old must be a positive integer"
            
            if "date_field" not in params:
                return False, "date_field is required when using older_than_days condition"
        
        elif condition_type == "custom_query":
            if "custom_condition" not in params:
                return False, "custom_condition is required when using custom_query type"
            
            if not isinstance(params["custom_condition"], dict):
                return False, "custom_condition must be a valid MongoDB query object"
        
        else:
            return False, f"Invalid condition_type: {condition_type}"
        
        return True, None
    
    async def execute(self, context: JobExecutionContext) -> JobResult:
        """Execute database cleanup"""
        params = context.parameters
        
        # Validate required parameters
        if "collection" not in params:
            return JobResult(
                status="failed",
                message="Missing required parameter: 'collection'. Please edit the job and specify which collection to clean up.",
                errors=["collection parameter is required"]
            )
        
        collection_name = params["collection"]
        dry_run = params.get("dry_run", True)
        batch_size = params.get("batch_size", 1000)
        
        context.log("INFO", f"Starting database cleanup for collection: {collection_name}")
        context.log("INFO", f"Dry run mode: {dry_run}")
        
        # Build query condition
        condition = await self._build_condition(params, context)
        
        try:
            collection = context.db[collection_name]
            
            # Count matching records
            count = await collection.count_documents(condition)
            context.log("INFO", f"Found {count} records matching condition")
            
            if count == 0:
                return JobResult(
                    status="success",
                    message="No records found matching the cleanup condition",
                    records_processed=0,
                    records_affected=0
                )
            
            if dry_run:
                # Get sample of records that would be deleted
                sample_records = await collection.find(condition).limit(5).to_list(length=5)
                sample_ids = [str(r.get("_id")) for r in sample_records]
                
                context.log("INFO", f"DRY RUN: Would delete {count} records")
                context.log("INFO", f"Sample IDs: {sample_ids[:3]}")
                
                return JobResult(
                    status="success",
                    message=f"Dry run: Would delete {count} records",
                    details={
                        "count": count,
                        "sample_ids": sample_ids,
                        "condition": str(condition)
                    },
                    records_processed=count,
                    records_affected=0
                )
            
            # Actual deletion (in batches)
            deleted_count = 0
            processed_count = 0
            
            while True:
                # Delete in batches
                result = await collection.delete_many(condition, limit=batch_size if batch_size < count else None)
                batch_deleted = result.deleted_count
                
                if batch_deleted == 0:
                    break
                
                deleted_count += batch_deleted
                processed_count += batch_deleted
                
                context.log("INFO", f"Deleted batch: {batch_deleted} records (total: {deleted_count}/{count})")
                
                if deleted_count >= count:
                    break
            
            context.log("INFO", f"Cleanup completed: {deleted_count} records deleted")
            
            return JobResult(
                status="success",
                message=f"Successfully deleted {deleted_count} records from {collection_name}",
                details={
                    "collection": collection_name,
                    "condition": str(condition),
                    "deleted_count": deleted_count
                },
                records_processed=processed_count,
                records_affected=deleted_count
            )
            
        except Exception as e:
            context.log("ERROR", f"Cleanup failed: {str(e)}")
            return JobResult(
                status="failed",
                message=f"Database cleanup failed: {str(e)}",
                errors=[str(e)]
            )
    
    async def _build_condition(self, params: Dict[str, Any], context: JobExecutionContext) -> Dict[str, Any]:
        """Build MongoDB query condition from parameters"""
        condition_type = params.get("condition_type", "older_than_days")
        
        if condition_type == "older_than_days":
            days_old = params["days_old"]
            date_field = params.get("date_field", "created_at")
            
            # Calculate cutoff date
            cutoff_date = datetime.utcnow() - timedelta(days=days_old)
            
            condition = {
                date_field: {"$lt": cutoff_date}
            }
            
            context.log("INFO", f"Condition: {date_field} < {cutoff_date.isoformat()}")
            
        elif condition_type == "custom_query":
            condition = params["custom_condition"]
            context.log("INFO", f"Using custom condition: {condition}")
        
        else:
            raise ValueError(f"Invalid condition_type: {condition_type}")
        
        return condition
