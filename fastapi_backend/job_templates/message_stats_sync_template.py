"""
Message Statistics Sync Template
JobTemplate wrapper for the message stats sync job
"""

from typing import Dict, Any, Tuple, Optional
from .base import JobTemplate, JobExecutionContext, JobResult
from . import message_stats_sync
import time


class MessageStatsSyncTemplate(JobTemplate):
    """Template for syncing user message statistics"""
    
    template_type = "message_stats_sync"
    template_name = "Message Statistics Sync"
    template_description = "Automatically sync user message counts with actual database records"
    category = "maintenance"
    icon = "📊"
    estimated_duration = "5-10 minutes"
    resource_usage = "medium"
    risk_level = "low"
    
    def get_schema(self) -> Dict[str, Any]:
        """
        Get JSON schema for job parameters
        
        Returns:
            dict: JSON schema (no parameters needed for this job)
        """
        return {
            "type": "object",
            "properties": {},
            "required": [],
            "additionalProperties": False
        }
    
    def validate_params(self, params: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        """
        Validate job parameters
        
        Args:
            params: Parameters to validate
        
        Returns:
            tuple: (is_valid, error_message)
        """
        # No parameters required, always valid
        return True, None
    
    async def execute(self, context: JobExecutionContext) -> JobResult:
        """
        Execute the message stats sync job
        
        Args:
            context: Job execution context
        
        Returns:
            JobResult with execution details
        """
        start_time = time.time()
        
        try:
            context.log("INFO", "Starting message statistics sync")
            
            # Execute the sync job
            result = await message_stats_sync.execute(context.db, context.parameters)
            
            duration = time.time() - start_time
            
            # Convert result to JobResult
            return JobResult(
                status="success" if result.get("status") == "completed" else "failed",
                message=result.get("message", "Message stats synced successfully"),
                details=result,
                records_processed=result.get("total_users", 0),
                records_affected=result.get("users_synced", 0),
                errors=[f"{result.get('errors', 0)} users had errors"] if result.get('errors', 0) > 0 else [],
                duration_seconds=duration
            )
            
        except Exception as e:
            duration = time.time() - start_time
            context.log("ERROR", f"Message stats sync failed: {str(e)}")
            
            return JobResult(
                status="failed",
                message=f"Failed to sync message statistics: {str(e)}",
                errors=[str(e)],
                duration_seconds=duration
            )
