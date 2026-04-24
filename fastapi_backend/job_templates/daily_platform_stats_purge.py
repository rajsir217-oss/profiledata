"""
Daily Platform Stats Purge Job Template

Purges daily snapshots older than 90 days.
Runs daily at 03:00 UTC.
"""

from datetime import datetime, timedelta
from typing import Dict, Any, Tuple, Optional
from database import get_database
from .base import JobTemplate, JobExecutionContext, JobResult


async def execute(job_params: Dict[str, Any]) -> Dict[str, Any]:
    """
    Delete daily snapshots older than 90 days.
    
    Parameters:
        job_params: Dict (unused for this job)
    
    Returns:
        Dict with execution results
    """
    db = await get_database()
    
    # Calculate cutoff date (90 days ago)
    today = datetime.utcnow()
    cutoff_date = today - timedelta(days=90)
    cutoff_date_str = cutoff_date.strftime("%Y-%m-%d")
    
    try:
        # Delete daily docs older than 90 days
        delete_result = await db.platform_stats_daily.delete_many({
            "date": {"$lt": cutoff_date_str}
        })
        
        return {
            "status": "success",
            "cutoff_date": cutoff_date_str,
            "docs_deleted": delete_result.deleted_count,
            "message": f"Purged {delete_result.deleted_count} daily snapshots older than {cutoff_date_str}"
        }
        
    except Exception as e:
        return {
            "status": "error",
            "cutoff_date": cutoff_date_str,
            "error": str(e),
            "message": f"Failed to purge daily snapshots older than {cutoff_date_str}"
        }


# Job metadata for Dynamic Scheduler
JOB_METADATA = {
    "name": "Daily Platform Stats Purge",
    "description": "Purges daily snapshots older than 90 days to maintain storage efficiency",
    "parameters": {},
    "default_schedule": {
        "type": "cron",
        "value": "0 3 * * *"  # Daily at 03:00 UTC
    },
    "timeout": 300  # 5 minutes
}


class DailyPlatformStatsPurgeTemplate(JobTemplate):
    """Job template for daily platform stats purge"""
    
    template_type = "daily_platform_stats_purge"
    template_name = "Daily Platform Stats Purge"
    template_description = "Purges daily snapshots older than 90 days to maintain storage efficiency"
    category = "maintenance"
    icon = "🗑️"
    estimated_duration = "1-2 minutes"
    resource_usage = "low"
    risk_level = "medium"  # Purges data
    
    async def execute(self, context: JobExecutionContext) -> JobResult:
        """Execute the daily purge job"""
        try:
            result = await execute(context.parameters)
            if result.get("status") == "success":
                return JobResult(
                    status="success",
                    message=result.get("message", "Daily purge completed successfully"),
                    records_affected=result.get("docs_deleted", 0)
                )
            else:
                return JobResult(
                    status="failed",
                    message=result.get("message", "Failed to purge daily snapshots"),
                    errors=[result.get("error", "Unknown error")]
                )
        except Exception as e:
            return JobResult(
                status="failed",
                message=f"Job execution failed: {str(e)}",
                errors=[str(e)]
            )
    
    def validate_params(self, params: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        """No parameters required for this job"""
        return True, None
    
    def get_schema(self) -> Dict[str, Any]:
        """Return JSON schema for parameters (no parameters)"""
        return {
            "type": "object",
            "properties": {},
            "required": []
        }
