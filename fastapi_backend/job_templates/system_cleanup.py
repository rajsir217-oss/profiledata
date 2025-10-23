"""
System Cleanup Job Template
Runs the legacy data cleanup tasks (sessions, expired data, etc.)
"""

from typing import Dict, Any, Tuple, Optional
from .base import JobTemplate, JobExecutionContext, JobResult
import time


class SystemCleanupTemplate(JobTemplate):
    """Template for system cleanup tasks (legacy data_cleanup job)"""
    
    template_type = "system_cleanup"
    template_name = "System Cleanup"
    template_description = "Clean up expired sessions, old data, and system maintenance"
    category = "maintenance"
    icon = "🧹"
    estimated_duration = "1-5 minutes"
    resource_usage = "medium"
    risk_level = "low"
    
    def get_schema(self) -> Dict[str, Any]:
        """Return JSON schema for parameters"""
        return {
            "type": "object",
            "properties": {
                "cleanup_sessions": {
                    "type": "boolean",
                    "description": "Clean up expired user sessions",
                    "default": True
                },
                "cleanup_temp_files": {
                    "type": "boolean",
                    "description": "Remove temporary files",
                    "default": True
                },
                "days_to_keep": {
                    "type": "integer",
                    "description": "Days to keep temporary data",
                    "minimum": 1,
                    "maximum": 365,
                    "default": 30
                }
            },
            "required": []
        }
    
    def validate_params(self, params: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        """Validate parameters"""
        # All parameters are optional with defaults
        return True, None
    
    async def execute(self, context: JobExecutionContext) -> JobResult:
        """Execute system cleanup"""
        from cleanup_scheduler import CleanupScheduler
        
        start_time = time.time()
        context.log("INFO", "Starting system cleanup...")
        
        try:
            cleanup_instance = CleanupScheduler(context.db)
            await cleanup_instance.run_cleanup_cycle()
            
            duration = time.time() - start_time
            context.log("INFO", f"System cleanup completed in {duration:.2f}s")
            
            return JobResult(
                status="success",
                message="System cleanup completed successfully",
                details={
                    "cleaned_sessions": context.parameters.get("cleanup_sessions", True),
                    "cleaned_temp_files": context.parameters.get("cleanup_temp_files", True)
                },
                duration_seconds=duration
            )
        except Exception as e:
            duration = time.time() - start_time
            context.log("ERROR", f"System cleanup failed: {str(e)}")
            return JobResult(
                status="failed",
                message=f"System cleanup failed: {str(e)}",
                errors=[str(e)],
                duration_seconds=duration
            )
