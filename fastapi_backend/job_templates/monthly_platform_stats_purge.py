"""
Monthly Platform Stats Purge Job Template

Purges monthly snapshots for years older than current year.
Runs on 1st of each month at 04:00 UTC.
"""

from datetime import datetime
from typing import Dict, Any, Tuple, Optional
from database import get_database
from .base import JobTemplate, JobExecutionContext, JobResult


async def execute(job_params: Dict[str, Any]) -> Dict[str, Any]:
    """
    Delete monthly snapshots for years older than current year.
    
    Parameters:
        job_params: Dict (unused for this job)
    
    Returns:
        Dict with execution results
    """
    db = await get_database()
    
    # Get current year
    today = datetime.utcnow()
    current_year = str(today.year)
    
    try:
        # Delete monthly docs for years older than current year
        delete_result = await db.platform_stats_monthly.delete_many({
            "year": {"$lt": current_year}
        })
        
        return {
            "status": "success",
            "current_year": current_year,
            "docs_deleted": delete_result.deleted_count,
            "message": f"Purged {delete_result.deleted_count} monthly snapshots for years older than {current_year}"
        }
        
    except Exception as e:
        return {
            "status": "error",
            "current_year": current_year,
            "error": str(e),
            "message": f"Failed to purge monthly snapshots for years older than {current_year}"
        }


# Job metadata for Dynamic Scheduler
JOB_METADATA = {
    "name": "Monthly Platform Stats Purge",
    "description": "Purges monthly snapshots for years older than current year to maintain storage efficiency",
    "parameters": {},
    "default_schedule": {
        "type": "cron",
        "value": "0 4 1 * *"  # 1st of month at 04:00 UTC
    },
    "timeout": 300  # 5 minutes
}


class MonthlyPlatformStatsPurgeTemplate(JobTemplate):
    """Job template for monthly platform stats purge"""
    
    template_type = "monthly_platform_stats_purge"
    template_name = "Monthly Platform Stats Purge"
    template_description = "Purges monthly snapshots for years older than current year to maintain storage efficiency"
    category = "maintenance"
    icon = "🗑️"
    estimated_duration = "1-2 minutes"
    resource_usage = "low"
    risk_level = "medium"  # Purges data
    
    async def execute(self, context: JobExecutionContext) -> JobResult:
        """Execute the monthly purge job"""
        try:
            result = await execute(context.parameters)
            if result.get("status") == "success":
                return JobResult(
                    status="success",
                    message=result.get("message", "Monthly purge completed successfully"),
                    records_affected=result.get("docs_deleted", 0)
                )
            else:
                return JobResult(
                    status="failed",
                    message=result.get("message", "Failed to purge monthly snapshots"),
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
