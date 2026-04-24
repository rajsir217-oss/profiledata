"""
Daily Platform Stats Purge Job Template

Purges daily snapshots older than 90 days.
Runs daily at 03:00 UTC.
"""

from datetime import datetime, timedelta
from typing import Dict, Any, Tuple, Optional
from .base import JobTemplate, JobExecutionContext, JobResult


class PlatformStatsDailyPurgeTemplate(JobTemplate):
    """Job template for daily platform stats purge"""
    
    template_type = "platform_stats_daily_purge"
    template_name = "Platform Stats Daily Purge"
    template_description = "Purges daily snapshots older than 90 days to maintain storage efficiency"
    category = "maintenance"
    icon = "🗑️"
    estimated_duration = "1-2 minutes"
    resource_usage = "low"
    risk_level = "medium"  # Purges data
    
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
    
    async def execute(self, context: JobExecutionContext) -> JobResult:
        """Execute the daily purge job"""
        db = context.db
        
        # Calculate cutoff date (90 days ago)
        today = datetime.utcnow()
        cutoff_date = today - timedelta(days=90)
        cutoff_date_str = cutoff_date.strftime("%Y-%m-%d")
        
        try:
            # Delete daily docs older than 90 days
            delete_result = await db.platform_stats_daily.delete_many({
                "date": {"$lt": cutoff_date_str}
            })
            
            return JobResult(
                status="success",
                message=f"Purged {delete_result.deleted_count} daily snapshots older than {cutoff_date_str}",
                records_affected=delete_result.deleted_count
            )
            
        except Exception as e:
            return JobResult(
                status="failed",
                message=f"Failed to purge daily snapshots older than {cutoff_date_str}: {str(e)}",
                errors=[str(e)]
            )
