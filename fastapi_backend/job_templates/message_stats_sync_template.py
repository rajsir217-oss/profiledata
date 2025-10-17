"""
Message Statistics Sync Template
JobTemplate wrapper for the message stats sync job
"""

from .base import JobTemplate
from . import message_stats_sync


class MessageStatsSyncTemplate(JobTemplate):
    """Template for syncing user message statistics"""
    
    def __init__(self):
        super().__init__(
            template_type="message_stats_sync",
            template_name="Message Statistics Sync",
            description="Automatically sync user message counts with actual database records",
            category="maintenance",
            default_timeout=600,  # 10 minutes
            default_parameters={}
        )
    
    async def execute(self, db, parameters: dict = None):
        """
        Execute the message stats sync job
        
        Args:
            db: MongoDB database instance
            parameters: Job parameters (optional)
        
        Returns:
            dict: Execution results
        """
        return await message_stats_sync.execute(db, parameters)
    
    def get_parameter_schema(self) -> dict:
        """
        Get JSON schema for job parameters
        
        Returns:
            dict: JSON schema (no parameters needed for this job)
        """
        return {
            "type": "object",
            "properties": {},
            "additionalProperties": False
        }
    
    def validate_parameters(self, parameters: dict) -> tuple[bool, str]:
        """
        Validate job parameters
        
        Args:
            parameters: Parameters to validate
        
        Returns:
            tuple: (is_valid, error_message)
        """
        # No parameters required, always valid
        return True, ""
