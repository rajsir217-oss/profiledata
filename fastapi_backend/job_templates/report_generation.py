"""
Report Generation Job Template
Generates various reports from database data
"""

from typing import Dict, Any, Optional, Tuple
from datetime import datetime, timedelta
from .base import JobTemplate, JobResult, JobExecutionContext
import logging

logger = logging.getLogger(__name__)


class ReportGenerationTemplate(JobTemplate):
    """Template for generating reports"""
    
    template_type = "report_generation"
    template_name = "Report Generation"
    template_description = "Generate statistical reports from database data"
    category = "reports"
    icon = "📈"
    estimated_duration = "10-30 minutes"
    resource_usage = "medium"
    risk_level = "low"
    
    def get_schema(self) -> Dict[str, Any]:
        """Return JSON schema for parameters"""
        return {
            "type": "object",
            "properties": {
                "report_type": {
                    "type": "string",
                    "description": "Type of report to generate",
                    "enum": ["user_activity", "system_stats", "engagement_metrics", "custom"]
                },
                "date_range": {
                    "type": "string",
                    "description": "Date range for report",
                    "enum": ["last_24h", "last_7d", "last_30d", "last_90d", "custom"],
                    "default": "last_7d"
                },
                "start_date": {
                    "type": "string",
                    "description": "Start date (ISO format) for custom date range",
                    "format": "date-time"
                },
                "end_date": {
                    "type": "string",
                    "description": "End date (ISO format) for custom date range",
                    "format": "date-time"
                },
                "format": {
                    "type": "string",
                    "description": "Output format",
                    "enum": ["json", "pdf", "html"],
                    "default": "json"
                },
                "include_charts": {
                    "type": "boolean",
                    "description": "Include charts in report",
                    "default": False
                },
                "email_recipients": {
                    "type": "array",
                    "description": "Email addresses to send report to",
                    "items": {"type": "string", "format": "email"}
                }
            },
            "required": ["report_type"]
        }
    
    def validate_params(self, params: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        """Validate parameters"""
        report_type = params.get("report_type")
        if not report_type:
            return False, "Report type is required"
        
        date_range = params.get("date_range", "last_7d")
        if date_range == "custom":
            if not params.get("start_date") or not params.get("end_date"):
                return False, "start_date and end_date are required for custom date range"
        
        return True, None
    
    async def execute(self, context: JobExecutionContext) -> JobResult:
        """Execute report generation"""
        params = context.parameters
        report_type = params["report_type"]
        date_range = params.get("date_range", "last_7d")
        
        context.log("INFO", f"Generating report: {report_type}")
        context.log("INFO", f"Date range: {date_range}")
        
        try:
            # Calculate date range
            start_date, end_date = self._calculate_date_range(params)
            
            # Generate report based on type
            report_data = await self._generate_report_data(
                report_type, start_date, end_date, context
            )
            
            context.log("INFO", f"Report generation completed successfully")
            
            return JobResult(
                status="success",
                message=f"Successfully generated {report_type} report",
                details={
                    "report_type": report_type,
                    "date_range": date_range,
                    "start_date": start_date.isoformat(),
                    "end_date": end_date.isoformat(),
                    "report_data": report_data
                },
                records_processed=len(report_data.get("data", []))
            )
            
        except Exception as e:
            context.log("ERROR", f"Report generation failed: {str(e)}")
            return JobResult(
                status="failed",
                message=f"Report generation failed: {str(e)}",
                errors=[str(e)]
            )
    
    def _calculate_date_range(self, params: Dict[str, Any]) -> Tuple[datetime, datetime]:
        """Calculate start and end dates"""
        date_range = params.get("date_range", "last_7d")
        
        if date_range == "custom":
            start_date = datetime.fromisoformat(params["start_date"].replace('Z', '+00:00'))
            end_date = datetime.fromisoformat(params["end_date"].replace('Z', '+00:00'))
        else:
            end_date = datetime.utcnow()
            if date_range == "last_24h":
                start_date = end_date - timedelta(days=1)
            elif date_range == "last_7d":
                start_date = end_date - timedelta(days=7)
            elif date_range == "last_30d":
                start_date = end_date - timedelta(days=30)
            elif date_range == "last_90d":
                start_date = end_date - timedelta(days=90)
            else:
                start_date = end_date - timedelta(days=7)
        
        return start_date, end_date
    
    async def _generate_report_data(
        self, report_type: str, start_date: datetime, end_date: datetime, context: JobExecutionContext
    ) -> Dict[str, Any]:
        """Generate actual report data"""
        # Placeholder implementation - customize based on your needs
        
        if report_type == "user_activity":
            return await self._generate_user_activity_report(start_date, end_date, context)
        elif report_type == "system_stats":
            return await self._generate_system_stats_report(start_date, end_date, context)
        elif report_type == "engagement_metrics":
            return await self._generate_engagement_metrics_report(start_date, end_date, context)
        else:
            return {"data": [], "summary": {}}
    
    async def _generate_user_activity_report(
        self, start_date: datetime, end_date: datetime, context: JobExecutionContext
    ) -> Dict[str, Any]:
        """Generate user activity report"""
        # Query database for user activity
        users_collection = context.db.users
        
        total_users = await users_collection.count_documents({})
        active_users = await users_collection.count_documents({
            "lastActive": {"$gte": start_date, "$lte": end_date}
        })
        
        return {
            "data": [
                {"metric": "total_users", "value": total_users},
                {"metric": "active_users", "value": active_users}
            ],
            "summary": {
                "total_users": total_users,
                "active_users": active_users,
                "activity_rate": f"{(active_users/total_users*100):.2f}%" if total_users > 0 else "0%"
            }
        }
    
    async def _generate_system_stats_report(
        self, start_date: datetime, end_date: datetime, context: JobExecutionContext
    ) -> Dict[str, Any]:
        """Generate system statistics report"""
        return {
            "data": [],
            "summary": {"generated_at": datetime.utcnow().isoformat()}
        }
    
    async def _generate_engagement_metrics_report(
        self, start_date: datetime, end_date: datetime, context: JobExecutionContext
    ) -> Dict[str, Any]:
        """Generate engagement metrics report"""
        return {
            "data": [],
            "summary": {"generated_at": datetime.utcnow().isoformat()}
        }
