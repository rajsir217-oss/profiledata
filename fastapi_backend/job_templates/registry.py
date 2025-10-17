"""
Job Template Registry
Manages registration and retrieval of job templates
"""

from typing import Dict, Optional, List
from .base import JobTemplate
import logging

logger = logging.getLogger(__name__)


class TemplateRegistry:
    """Registry for managing job templates"""
    
    def __init__(self):
        self._templates: Dict[str, JobTemplate] = {}
        
    def register(self, template: JobTemplate):
        """
        Register a job template
        
        Args:
            template: JobTemplate instance to register
        """
        template_type = template.template_type
        if template_type in self._templates:
            logger.warning(f"Overwriting existing template: {template_type}")
        
        self._templates[template_type] = template
        logger.info(f"✅ Registered job template: {template_type} ({template.template_name})")
    
    def unregister(self, template_type: str) -> bool:
        """
        Unregister a job template
        
        Args:
            template_type: Type identifier of template to remove
            
        Returns:
            True if template was removed, False if not found
        """
        if template_type in self._templates:
            del self._templates[template_type]
            logger.info(f"❌ Unregistered job template: {template_type}")
            return True
        return False
    
    def get(self, template_type: str) -> Optional[JobTemplate]:
        """
        Get a job template by type
        
        Args:
            template_type: Type identifier of template
            
        Returns:
            JobTemplate instance or None if not found
        """
        return self._templates.get(template_type)
    
    def list_templates(self) -> List[JobTemplate]:
        """
        Get all registered templates
        
        Returns:
            List of JobTemplate instances
        """
        return list(self._templates.values())
    
    def get_metadata(self, template_type: Optional[str] = None) -> Dict:
        """
        Get metadata for templates
        
        Args:
            template_type: Specific template type, or None for all
            
        Returns:
            Dictionary with template metadata
        """
        if template_type:
            template = self.get(template_type)
            if template:
                return template.get_metadata()
            return {}
        
        # Return all templates metadata
        return {
            "templates": [t.get_metadata() for t in self._templates.values()],
            "count": len(self._templates)
        }
    
    def exists(self, template_type: str) -> bool:
        """
        Check if template exists
        
        Args:
            template_type: Type identifier to check
            
        Returns:
            True if template is registered
        """
        return template_type in self._templates
    
    def get_by_category(self, category: str) -> List[JobTemplate]:
        """
        Get templates by category
        
        Args:
            category: Category to filter by
            
        Returns:
            List of matching JobTemplate instances
        """
        return [t for t in self._templates.values() if t.category == category]


# Global template registry instance
_template_registry: Optional[TemplateRegistry] = None


def get_template_registry() -> TemplateRegistry:
    """
    Get the global template registry instance
    
    Returns:
        TemplateRegistry singleton
    """
    global _template_registry
    if _template_registry is None:
        _template_registry = TemplateRegistry()
    return _template_registry


def initialize_templates():
    """
    Initialize and register all job templates
    Should be called at application startup
    """
    from .database_cleanup import DatabaseCleanupTemplate
    from .email_notification import EmailNotificationTemplate
    from .data_export import DataExportTemplate
    from .report_generation import ReportGenerationTemplate
    from .backup_job import BackupJobTemplate
    from .webhook_trigger import WebhookTriggerTemplate
    from .system_cleanup import SystemCleanupTemplate
    from .test_scheduler import TestSchedulerTemplate
    from .ticket_cleanup import TicketCleanupTemplate
    from .message_stats_sync_template import MessageStatsSyncTemplate
    
    registry = get_template_registry()
    
    # Register all templates
    registry.register(DatabaseCleanupTemplate())
    registry.register(EmailNotificationTemplate())
    registry.register(DataExportTemplate())
    registry.register(ReportGenerationTemplate())
    registry.register(BackupJobTemplate())
    registry.register(WebhookTriggerTemplate())
    
    # Register legacy job templates
    registry.register(SystemCleanupTemplate())
    registry.register(TestSchedulerTemplate())
    registry.register(TicketCleanupTemplate())
    
    # Register maintenance job templates
    registry.register(MessageStatsSyncTemplate())
    
    logger.info(f"✅ Initialized {len(registry.list_templates())} job templates")
    return registry
