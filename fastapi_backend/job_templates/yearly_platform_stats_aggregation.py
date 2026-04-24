"""
Yearly Platform Stats Aggregation Job Template

Aggregates previous year's monthly snapshots into yearly snapshot.
Runs on January 1st at 02:00 UTC.
Purges monthly snapshots for the aggregated year.
"""

from datetime import datetime
from typing import Dict, Any, Tuple, Optional
from database import get_database
from .base import JobTemplate, JobExecutionContext, JobResult


async def execute(job_params: Dict[str, Any]) -> Dict[str, Any]:
    """
    Aggregate previous year's monthly docs into yearly snapshot.
    Purge monthly docs for that year.
    
    Parameters:
        job_params: Dict (unused for this job)
    
    Returns:
        Dict with execution results
    """
    db = await get_database()
    
    # Calculate previous year
    today = datetime.utcnow()
    prev_year = today.year - 1
    year_id = str(prev_year)
    
    try:
        # 1. Aggregate all monthly docs for this year
        monthly_docs = await db.platform_stats_monthly.find({
            "year": year_id
        }).to_list(length=None)
        
        if not monthly_docs:
            return {
                "status": "skipped",
                "year": year_id,
                "message": f"No monthly snapshots found for {year_id}"
            }
        
        # 2. Sum all stats
        aggregated = {
            "searches": 0,
            "profileViews": 0,
            "favorited": 0,
            "shortlisted": 0,
            "messagesSent": 0,
            "activeMembers": 0  # Will be computed separately
        }
        
        for doc in monthly_docs:
            aggregated["searches"] += doc.get("searches", 0)
            aggregated["profileViews"] += doc.get("profileViews", 0)
            aggregated["favorited"] += doc.get("favorited", 0)
            aggregated["shortlisted"] += doc.get("shortlisted", 0)
            aggregated["messagesSent"] += doc.get("messagesSent", 0)
        
        # 3. Compute active members for the year (users who logged in during the year)
        year_start = datetime(prev_year, 1, 1, 0, 0, 0)
        year_end = datetime(prev_year, 12, 31, 23, 59, 59, 999999)
        aggregated["activeMembers"] = await db.users.count_documents({
            "accountStatus": "active",
            "security.last_login_at": {"$gte": year_start, "$lte": year_end}
        })
        
        # 4. Upsert to platform_stats_yearly
        yearly_doc = {
            "_id": year_id,
            "year": year_id,
            "searches": aggregated["searches"],
            "profileViews": aggregated["profileViews"],
            "favorited": aggregated["favorited"],
            "shortlisted": aggregated["shortlisted"],
            "messagesSent": aggregated["messagesSent"],
            "activeMembers": aggregated["activeMembers"],
            "createdAt": datetime.utcnow(),
            "updatedAt": datetime.utcnow()
        }
        
        await db.platform_stats_yearly.update_one(
            {"_id": year_id},
            {"$set": yearly_doc},
            upsert=True
        )
        
        # 5. Purge monthly docs for this year
        delete_result = await db.platform_stats_monthly.delete_many({
            "year": year_id
        })
        
        return {
            "status": "success",
            "year": year_id,
            "aggregated": aggregated,
            "monthly_docs_purged": delete_result.deleted_count,
            "message": f"Yearly snapshot created for {year_id}, purged {delete_result.deleted_count} monthly docs"
        }
        
    except Exception as e:
        return {
            "status": "error",
            "year": year_id,
            "error": str(e),
            "message": f"Failed to aggregate yearly stats for {year_id}"
        }


# Job metadata for Dynamic Scheduler
JOB_METADATA = {
    "name": "Yearly Platform Stats Aggregation",
    "description": "Aggregates previous year's monthly snapshots into yearly snapshot and purges monthly docs",
    "parameters": {},
    "default_schedule": {
        "type": "cron",
        "value": "0 2 1 1 *"  # January 1st at 02:00 UTC
    },
    "timeout": 600  # 10 minutes
}


class YearlyPlatformStatsAggregationTemplate(JobTemplate):
    """Job template for yearly platform stats aggregation"""
    
    template_type = "yearly_platform_stats_aggregation"
    template_name = "Yearly Platform Stats Aggregation"
    template_description = "Aggregates previous year's monthly snapshots into yearly snapshot and purges monthly docs"
    category = "maintenance"
    icon = "🗓️"
    estimated_duration = "5-10 minutes"
    resource_usage = "medium"
    risk_level = "low"
    
    async def execute(self, context: JobExecutionContext) -> JobResult:
        """Execute the yearly aggregation job"""
        try:
            result = await execute(context.parameters)
            if result.get("status") == "success":
                return JobResult(
                    status="success",
                    message=result.get("message", "Yearly aggregation completed successfully"),
                    details=result.get("aggregated", {}),
                    records_affected=result.get("monthly_docs_purged", 0)
                )
            elif result.get("status") == "skipped":
                return JobResult(
                    status="success",
                    message=result.get("message", "No data to aggregate"),
                    records_affected=0
                )
            else:
                return JobResult(
                    status="failed",
                    message=result.get("message", "Failed to aggregate yearly stats"),
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
