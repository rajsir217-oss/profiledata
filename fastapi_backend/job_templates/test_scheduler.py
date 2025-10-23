"""
Test Scheduler Job Template
Checks and runs scheduled tests
"""

from typing import Dict, Any, Tuple, Optional
from .base import JobTemplate, JobExecutionContext, JobResult
import time
import asyncio


class TestSchedulerTemplate(JobTemplate):
    """Template for test scheduling (legacy test_scheduler job)"""
    
    template_type = "test_scheduler"
    template_name = "Test Scheduler"
    template_description = "Check and run scheduled tests automatically"
    category = "testing"
    icon = "🧪"
    estimated_duration = "1-10 minutes"
    resource_usage = "medium"
    risk_level = "low"
    
    def get_schema(self) -> Dict[str, Any]:
        """Return JSON schema for parameters"""
        return {
            "type": "object",
            "properties": {
                "check_interval": {
                    "type": "integer",
                    "description": "How often to check for scheduled tests (seconds)",
                    "minimum": 10,
                    "maximum": 3600,
                    "default": 60
                },
                "auto_run": {
                    "type": "boolean",
                    "description": "Automatically run tests when scheduled",
                    "default": True
                }
            },
            "required": []
        }
    
    def validate_params(self, params: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        """Validate parameters"""
        # All parameters are optional with defaults
        return True, None
    
    async def execute(self, context: JobExecutionContext) -> JobResult:
        """Execute test scheduler check"""
        from test_management import check_and_run_scheduled_tests
        
        start_time = time.time()
        context.log("INFO", "Checking for scheduled tests...")
        
        try:
            # Run the test scheduler (it's a sync function)
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(None, check_and_run_scheduled_tests, context.db)
            
            duration = time.time() - start_time
            context.log("INFO", f"Test scheduler check completed in {duration:.2f}s")
            
            return JobResult(
                status="success",
                message="Test scheduler check completed",
                details={
                    "auto_run": context.parameters.get("auto_run", True)
                },
                duration_seconds=duration
            )
        except Exception as e:
            duration = time.time() - start_time
            context.log("ERROR", f"Test scheduler failed: {str(e)}")
            return JobResult(
                status="failed",
                message=f"Test scheduler failed: {str(e)}",
                errors=[str(e)],
                duration_seconds=duration
            )
