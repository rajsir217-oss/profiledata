"""
Monthly Platform Stats Aggregation Job Template

Aggregates previous month's daily snapshots into monthly snapshot.
Runs on 1st of each month at 01:00 UTC.
Purges daily snapshots for the aggregated month.
"""

from datetime import datetime, timedelta
from typing import Dict, Any, Tuple, Optional
from database import get_database
from .base import JobTemplate, JobExecutionContext, JobResult


async def execute(job_params: Dict[str, Any]) -> Dict[str, Any]:
    """
    Aggregate previous month's daily docs into monthly snapshot.
    Purge daily docs for that month (now older than 90 days).
    
    Parameters:
        job_params: Dict (unused for this job)
    
    Returns:
        Dict with execution results
    """
    db = await get_database()
    
    # Calculate previous month
    today = datetime.utcnow()
    if today.month == 1:
        # January -> previous year December
        prev_month = today.replace(year=today.year - 1, month=12, day=1)
    else:
        prev_month = today.replace(month=today.month - 1, day=1)
    
    year_str = str(prev_month.year)
    month_str = f"{prev_month.month:02d}"
    month_id = f"{year_str}-{month_str}"
    
    # Calculate date range for the month
    if prev_month.month == 12:
        next_month = prev_month.replace(year=prev_month.year + 1, month=1, day=1)
    else:
        next_month = prev_month.replace(month=prev_month.month + 1, day=1)
    
    month_end = next_month - timedelta(days=1)
    month_end = month_end.replace(hour=23, minute=59, second=59, microsecond=999999)
    
    try:
        # 1. Aggregate all daily docs for this month
        daily_docs = await db.platform_stats_daily.find({
            "date": {"$gte": prev_month.strftime("%Y-%m-%d"), "$lte": month_end.strftime("%Y-%m-%d")}
        }).to_list(length=None)
        
        if not daily_docs:
            return {
                "status": "skipped",
                "month": month_id,
                "message": f"No daily snapshots found for {month_id}"
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
        
        for doc in daily_docs:
            aggregated["searches"] += doc.get("searches", 0)
            aggregated["profileViews"] += doc.get("profileViews", 0)
            aggregated["favorited"] += doc.get("favorited", 0)
            aggregated["shortlisted"] += doc.get("shortlisted", 0)
            aggregated["messagesSent"] += doc.get("messagesSent", 0)
        
        # 3. Compute active members for the month (users who logged in during the month)
        month_start = prev_month.replace(hour=0, minute=0, second=0, microsecond=0)
        aggregated["activeMembers"] = await db.users.count_documents({
            "accountStatus": "active",
            "security.last_login_at": {"$gte": month_start, "$lte": month_end}
        })
        
        # 4. Upsert to platform_stats_monthly
        monthly_doc = {
            "_id": month_id,
            "year": year_str,
            "month": month_str,
            "searches": aggregated["searches"],
            "profileViews": aggregated["profileViews"],
            "favorited": aggregated["favorited"],
            "shortlisted": aggregated["shortlisted"],
            "messagesSent": aggregated["messagesSent"],
            "activeMembers": aggregated["activeMembers"],
            "createdAt": datetime.utcnow(),
            "updatedAt": datetime.utcnow()
        }
        
        await db.platform_stats_monthly.update_one(
            {"_id": month_id},
            {"$set": monthly_doc},
            upsert=True
        )
        
        # 5. Purge daily docs for this month (now older than 90 days)
        delete_result = await db.platform_stats_daily.delete_many({
            "date": {"$gte": prev_month.strftime("%Y-%m-%d"), "$lte": month_end.strftime("%Y-%m-%d")}
        })
        
        return {
            "status": "success",
            "month": month_id,
            "aggregated": aggregated,
            "daily_docs_purged": delete_result.deleted_count,
            "message": f"Monthly snapshot created for {month_id}, purged {delete_result.deleted_count} daily docs"
        }
        
    except Exception as e:
        return {
            "status": "error",
            "month": month_id,
            "error": str(e),
            "message": f"Failed to aggregate monthly stats for {month_id}"
        }


# Job metadata for Dynamic Scheduler
JOB_METADATA = {
    "name": "Monthly Platform Stats Aggregation",
    "description": "Aggregates previous month's daily snapshots into monthly snapshot and purges daily docs",
    "parameters": {},
    "default_schedule": {
        "type": "cron",
        "value": "0 1 1 * *"  # 1st of month at 01:00 UTC
    },
    "timeout": 600  # 10 minutes
}


class MonthlyPlatformStatsAggregationTemplate(JobTemplate):
    """Job template for monthly platform stats aggregation"""
    
    template_type = "monthly_platform_stats_aggregation"
    template_name = "Monthly Platform Stats Aggregation"
    template_description = "Aggregates previous month's daily snapshots into monthly snapshot and purges daily docs"
    category = "maintenance"
    icon = "📅"
    estimated_duration = "5-10 minutes"
    resource_usage = "medium"
    risk_level = "low"
    
    async def execute(self, context: JobExecutionContext) -> JobResult:
        """Execute the monthly aggregation job"""
        try:
            result = await execute(context.parameters)
            if result.get("status") == "success":
                return JobResult(
                    status="success",
                    message=result.get("message", "Monthly aggregation completed successfully"),
                    details=result.get("aggregated", {}),
                    records_affected=result.get("daily_docs_purged", 0)
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
                    message=result.get("message", "Failed to aggregate monthly stats"),
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
