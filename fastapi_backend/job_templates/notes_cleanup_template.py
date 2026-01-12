"""
Notes Cleanup Job Template
Purges profile notes older than 90 days.
"""

from job_templates.base import JobTemplate, JobExecutionContext, JobResult
from typing import Dict, Any, Optional, Tuple
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)

NOTE_EXPIRY_DAYS = 90


class NotesCleanupTemplate(JobTemplate):
    """Job template for cleaning up expired profile notes"""
    
    template_type = "notes_cleanup"
    template_name = "Notes Cleanup"
    template_description = "Purges profile notes older than 90 days"
    category = "maintenance"
    icon = "📝"
    estimated_duration = "1-5 minutes"
    resource_usage = "low"
    risk_level = "low"
    
    def get_schema(self) -> Dict[str, Any]:
        """Return JSON schema for parameters"""
        return {
            "type": "object",
            "properties": {
                "expiry_days": {
                    "type": "integer",
                    "description": "Number of days after which notes expire",
                    "default": NOTE_EXPIRY_DAYS,
                    "minimum": 1,
                    "maximum": 365
                }
            },
            "required": []
        }
    
    def validate_params(self, params: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        """Validate parameters before execution"""
        expiry_days = params.get("expiry_days", NOTE_EXPIRY_DAYS)
        
        if not isinstance(expiry_days, int):
            return False, "expiry_days must be an integer"
        
        if expiry_days < 1 or expiry_days > 365:
            return False, "expiry_days must be between 1 and 365"
        
        return True, None
    
    async def execute(self, context: JobExecutionContext) -> JobResult:
        """
        Execute the notes cleanup job.
        
        Args:
            context: Job execution context
            
        Returns:
            JobResult with execution details
        """
        try:
            db = context.db
            params = context.parameters
            expiry_days = params.get("expiry_days", NOTE_EXPIRY_DAYS)
            expiry_date = datetime.utcnow() - timedelta(days=expiry_days)
            
            context.log("INFO", f"Looking for notes older than {expiry_days} days")
            
            # Count notes to be deleted
            count_before = await db.profile_notes.count_documents({
                "updatedAt": {"$lt": expiry_date}
            })
            
            if count_before == 0:
                context.log("INFO", "No expired notes to purge")
                return JobResult(
                    status="success",
                    message="No expired notes to purge",
                    records_processed=0,
                    records_affected=0
                )
            
            # Delete expired notes
            result = await db.profile_notes.delete_many({
                "updatedAt": {"$lt": expiry_date}
            })
            
            context.log("INFO", f"Purged {result.deleted_count} expired notes")
            
            return JobResult(
                status="success",
                message=f"Purged {result.deleted_count} expired notes (older than {expiry_days} days)",
                records_processed=count_before,
                records_affected=result.deleted_count,
                details={"expiry_days": expiry_days}
            )
            
        except Exception as e:
            context.log("ERROR", f"Error in notes cleanup: {e}")
            return JobResult(
                status="failed",
                message=f"Notes cleanup failed: {str(e)}",
                errors=[str(e)]
            )
