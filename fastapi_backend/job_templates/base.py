"""
Base Job Template Class
Defines the interface for all job templates
"""

from abc import ABC, abstractmethod
from typing import Dict, Any, Optional, Tuple, List
from datetime import datetime
from dataclasses import dataclass, field
from motor.motor_asyncio import AsyncIOMotorDatabase
import logging

logger = logging.getLogger(__name__)


@dataclass
class JobExecutionContext:
    """Context passed to job execution"""
    job_id: str
    job_name: str
    parameters: Dict[str, Any]
    db: AsyncIOMotorDatabase
    triggered_by: str = "scheduler"
    execution_id: Optional[str] = None
    logs: List[Dict[str, Any]] = field(default_factory=list)
    
    def log(self, level: str, message: str, **kwargs):
        """Add a log entry to the execution context"""
        log_entry = {
            "timestamp": datetime.utcnow(),
            "level": level,
            "message": message,
            **kwargs
        }
        self.logs.append(log_entry)
        
        # Also log to standard logger
        log_method = getattr(logger, level.lower(), logger.info)
        log_method(f"[Job: {self.job_name}] {message}")


@dataclass
class JobResult:
    """Result of job execution"""
    status: str  # success, failed, timeout, partial
    message: str
    details: Dict[str, Any] = field(default_factory=dict)
    records_processed: int = 0
    records_affected: int = 0
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    duration_seconds: float = 0.0
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for storage"""
        return {
            "status": self.status,
            "message": self.message,
            "details": self.details,
            "records_processed": self.records_processed,
            "records_affected": self.records_affected,
            "errors": self.errors,
            "warnings": self.warnings,
            "duration_seconds": self.duration_seconds
        }


class JobTemplate(ABC):
    """
    Abstract base class for all job templates
    
    Job templates define reusable job types that can be instantiated
    with different parameters through the admin UI.
    """
    
    # Template metadata (to be overridden by subclasses)
    template_type: str = "base_template"
    template_name: str = "Base Template"
    template_description: str = "Base template class"
    category: str = "general"
    icon: str = "⚙️"
    estimated_duration: str = "Unknown"
    resource_usage: str = "medium"  # low, medium, high
    risk_level: str = "low"  # low, medium, high, critical
    
    @abstractmethod
    async def execute(self, context: JobExecutionContext) -> JobResult:
        """
        Execute the job with given parameters
        
        Args:
            context: Job execution context containing parameters, DB, and logging
            
        Returns:
            JobResult with execution details
        """
        pass
    
    @abstractmethod
    def validate_params(self, params: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        """
        Validate parameters before execution
        
        Args:
            params: Parameters to validate
            
        Returns:
            Tuple of (is_valid, error_message)
        """
        pass
    
    @abstractmethod
    def get_schema(self) -> Dict[str, Any]:
        """
        Return JSON schema for parameters
        
        Returns:
            JSON Schema dictionary defining parameter structure
        """
        pass
    
    def get_metadata(self) -> Dict[str, Any]:
        """
        Get template metadata
        
        Returns:
            Dictionary with template information
        """
        return {
            "_id": self.template_type,
            "type": self.template_type,
            "name": self.template_name,
            "description": self.template_description,
            "category": self.category,
            "icon": self.icon,
            "estimated_duration": self.estimated_duration,
            "resource_usage": self.resource_usage,
            "risk_level": self.risk_level,
            "parameters_schema": self.get_schema()
        }
    
    async def pre_execute(self, context: JobExecutionContext) -> bool:
        """
        Hook called before execution (optional override)
        
        Returns:
            True to continue execution, False to abort
        """
        context.log("INFO", f"Starting job execution: {context.job_name}")
        return True
    
    async def post_execute(self, context: JobExecutionContext, result: JobResult):
        """
        Hook called after execution (optional override)
        """
        context.log("INFO", f"Job execution completed: {result.status}")
    
    async def on_error(self, context: JobExecutionContext, error: Exception) -> JobResult:
        """
        Hook called on execution error (optional override)
        
        Returns:
            JobResult for the error
        """
        context.log("ERROR", f"Job execution failed: {str(error)}")
        return JobResult(
            status="failed",
            message=f"Job execution failed: {str(error)}",
            errors=[str(error)]
        )
