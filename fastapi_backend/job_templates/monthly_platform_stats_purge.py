"""
Monthly Platform Stats Purge Job Template

Purges monthly snapshots for years older than current year.
Runs on 1st of each month at 04:00 UTC.
"""

from datetime import datetime
from typing import Dict, Any, Tuple, Optional
from .base import JobTemplate, JobExecutionContext, JobResult


class PlatformStatsMonthlyPurgeTemplate(JobTemplate):
    """Job template for monthly platform stats purge"""
    
    template_type = "platform_stats_monthly_purge"
    template_name = "Platform Stats Monthly Purge"
    template_description = "Purges monthly snapshots for years older than current year to maintain storage efficiency"
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
        """Execute the monthly purge job"""
        db = context.db
        
        # Calculate cutoff year
        today = datetime.utcnow()
        current_year = str(today.year)
        
        try:
            # Delete monthly docs for years older than current year
            delete_result = await db.platform_stats_monthly.delete_many({
                "year": {"$lt": current_year}
            })
            
            return JobResult(
                status="success",
                message=f"Purged {delete_result.deleted_count} monthly snapshots for years older than {current_year}",
                records_affected=delete_result.deleted_count
            )
            
        except Exception as e:
            return JobResult(
                status="failed",
                message=f"Failed to purge monthly snapshots for years older than {current_year}: {str(e)}",
                errors=[str(e)]
            )
