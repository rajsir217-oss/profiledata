"""
Ticket Cleanup Job Template
Deletes old resolved/closed tickets and their attachments
"""

from typing import Dict, Any, Tuple, Optional
from datetime import datetime
from .base import JobTemplate, JobExecutionContext, JobResult
import time


class TicketCleanupTemplate(JobTemplate):
    """Template for ticket cleanup (legacy auto_delete_resolved_tickets job)"""
    
    template_type = "ticket_cleanup"
    template_name = "Ticket Cleanup"
    template_description = "Delete resolved/closed tickets past their scheduled deletion time"
    category = "maintenance"
    icon = "🎫"
    estimated_duration = "5-30 minutes"
    resource_usage = "medium"
    risk_level = "medium"
    
    def get_schema(self) -> Dict[str, Any]:
        """Return JSON schema for parameters"""
        return {
            "type": "object",
            "properties": {
                "delete_attachments": {
                    "type": "boolean",
                    "description": "Also delete ticket attachments from filesystem",
                    "default": True
                },
                "batch_size": {
                    "type": "integer",
                    "description": "Number of tickets to process per batch",
                    "minimum": 1,
                    "maximum": 1000,
                    "default": 100
                },
                "dry_run": {
                    "type": "boolean",
                    "description": "Preview what would be deleted without actually deleting",
                    "default": False
                }
            },
            "required": []
        }
    
    def validate_params(self, params: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        """Validate parameters"""
        # All parameters are optional with defaults
        return True, None
    
    async def execute(self, context: JobExecutionContext) -> JobResult:
        """Execute ticket cleanup"""
        from pathlib import Path
        import os
        
        start_time = time.time()
        delete_attachments = context.parameters.get("delete_attachments", True)
        dry_run = context.parameters.get("dry_run", False)
        batch_size = context.parameters.get("batch_size", 100)
        
        context.log("INFO", f"Starting ticket cleanup ({'DRY RUN' if dry_run else 'LIVE MODE'})...")
        
        try:
            # Find tickets scheduled for deletion
            now = datetime.utcnow()
            tickets = await context.db.contact_tickets.find({
                "scheduledDeleteAt": {"$lte": now}
            }).limit(batch_size).to_list(length=batch_size)
            
            if not tickets:
                duration = time.time() - start_time
                context.log("INFO", "No tickets scheduled for deletion")
                return JobResult(
                    status="success",
                    message="No tickets scheduled for deletion",
                    details={
                        "tickets_deleted": 0,
                        "attachments_deleted": 0,
                        "dry_run": dry_run
                    },
                    duration_seconds=duration
                )
            
            context.log("INFO", f"Found {len(tickets)} tickets scheduled for deletion")
            
            attachments_deleted = 0
            tickets_deleted = 0
            errors = []
            
            for ticket in tickets:
                try:
                    # Delete attachments
                    if delete_attachments and ticket.get("attachments"):
                        for attachment in ticket["attachments"]:
                            try:
                                file_path = Path(attachment.get('file_path', ''))
                                if file_path.exists():
                                    if not dry_run:
                                        os.remove(file_path)
                                    attachments_deleted += 1
                                    context.log("INFO", f"{'[DRY RUN] Would delete' if dry_run else 'Deleted'} attachment: {file_path}")
                            except Exception as file_err:
                                error_msg = f"Failed to delete file: {file_err}"
                                context.log("WARNING", error_msg)
                                errors.append(error_msg)
                    
                    # Delete ticket
                    if not dry_run:
                        await context.db.contact_tickets.delete_one({"_id": ticket["_id"]})
                    tickets_deleted += 1
                    context.log("INFO", f"{'[DRY RUN] Would delete' if dry_run else 'Deleted'} ticket: {ticket['_id']}")
                    
                except Exception as ticket_err:
                    error_msg = f"Error deleting ticket {ticket.get('_id')}: {ticket_err}"
                    context.log("ERROR", error_msg)
                    errors.append(error_msg)
            
            duration = time.time() - start_time
            context.log("INFO", f"Ticket cleanup completed in {duration:.2f}s")
            
            return JobResult(
                status="success" if not errors else "partial",
                message=f"{'[DRY RUN] Would delete' if dry_run else 'Deleted'} {tickets_deleted} ticket(s)",
                details={
                    "tickets_deleted": tickets_deleted,
                    "attachments_deleted": attachments_deleted,
                    "dry_run": dry_run,
                    "timestamp": datetime.utcnow().isoformat()
                },
                records_processed=len(tickets),
                records_affected=tickets_deleted,
                errors=errors,
                duration_seconds=duration
            )
            
        except Exception as e:
            duration = time.time() - start_time
            context.log("ERROR", f"Ticket cleanup failed: {str(e)}")
            return JobResult(
                status="failed",
                message=f"Ticket cleanup failed: {str(e)}",
                errors=[str(e)],
                duration_seconds=duration
            )
