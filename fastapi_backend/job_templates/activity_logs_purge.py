"""
Activity Logs Purge Job Template

Purges activity_logs entries older than specified retention period.
This is safe because the data is preserved in platform stats snapshot collections.
Runs daily at 05:00 UTC.
"""

from datetime import datetime, timedelta
from typing import Dict, Any, Tuple, Optional
from .base import JobTemplate, JobExecutionContext, JobResult


class ActivityLogsPurgeTemplate(JobTemplate):
    """Job template for activity logs purge"""
    
    template_type = "activity_logs_purge"
    template_name = "Activity Logs Purge"
    template_description = "Purges activity_logs entries older than retention period (data preserved in snapshots)"
    category = "maintenance"
    icon = "🗑️"
    estimated_duration = "5-15 minutes"
    resource_usage = "medium"
    risk_level = "high"  # Purges data
    
    def validate_params(self, params: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        """Validate retention period parameter"""
        retention_days = params.get("retention_days", 90)
        
        if not isinstance(retention_days, int) or retention_days < 30:
            return False, "retention_days must be an integer >= 30"
        
        if retention_days > 365:
            return False, "retention_days must not exceed 365 days"
        
        return True, None
    
    def get_schema(self) -> Dict[str, Any]:
        """Return JSON schema for parameters"""
        return {
            "type": "object",
            "properties": {
                "retention_days": {
                    "type": "integer",
                    "description": "Number of days to retain activity logs (default: 90, min: 30, max: 365)",
                    "default": 90,
                    "minimum": 30,
                    "maximum": 365
                },
                "dry_run": {
                    "type": "boolean",
                    "description": "If true, only report what would be deleted without actually deleting (default: false)",
                    "default": False
                }
            },
            "required": []
        }
    
    async def execute(self, context: JobExecutionContext) -> JobResult:
        """Execute the activity logs purge job"""
        db = context.db
        params = context.parameters
        
        retention_days = params.get("retention_days", 90)
        dry_run = params.get("dry_run", False)
        
        # Calculate cutoff date
        today = datetime.utcnow()
        cutoff_date = today - timedelta(days=retention_days)
        cutoff_date_str = cutoff_date.strftime("%Y-%m-%d %H:%M:%S")
        
        try:
            # Count documents that would be deleted
            count_query = {"timestamp": {"$lt": cutoff_date}}
            docs_to_delete = await db.activity_logs.count_documents(count_query)
            
            if docs_to_delete == 0:
                return JobResult(
                    status="success",
                    message=f"No activity logs older than {retention_days} days found",
                    records_affected=0
                )
            
            if dry_run:
                return JobResult(
                    status="success",
                    message=f"[DRY RUN] Would purge {docs_to_delete} activity logs older than {cutoff_date_str}",
                    details={
                        "retention_days": retention_days,
                        "cutoff_date": cutoff_date_str,
                        "docs_to_delete": docs_to_delete,
                        "dry_run": True
                    },
                    records_affected=0
                )
            
            # Actually delete the documents
            delete_result = await db.activity_logs.delete_many(count_query)
            
            return JobResult(
                status="success",
                message=f"Purged {delete_result.deleted_count} activity logs older than {cutoff_date_str}",
                details={
                    "retention_days": retention_days,
                    "cutoff_date": cutoff_date_str,
                    "docs_deleted": delete_result.deleted_count,
                    "dry_run": False
                },
                records_affected=delete_result.deleted_count
            )
            
        except Exception as e:
            return JobResult(
                status="failed",
                message=f"Failed to purge activity logs older than {cutoff_date_str}: {str(e)}",
                errors=[str(e)]
            )
