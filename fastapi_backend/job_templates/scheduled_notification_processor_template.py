"""
Scheduled Notification Processor Job Template
Processes and sends scheduled notifications
"""

from typing import Dict, Any, Tuple, Optional
from .base import JobTemplate, JobExecutionContext, JobResult
import time
from datetime import datetime, timedelta
from croniter import croniter


class ScheduledNotificationProcessorTemplate(JobTemplate):
    """Template for processing scheduled notifications"""
    
    template_type = "scheduled_notification_processor"
    template_name = "Scheduled Notification Processor"
    template_description = "Process and send scheduled notifications at their specified times"
    category = "notifications"
    icon = "⏰"
    estimated_duration = "1-5 minutes"
    resource_usage = "medium"
    risk_level = "low"
    
    def get_schema(self) -> Dict[str, Any]:
        """Return JSON schema for parameters"""
        return {
            "type": "object",
            "properties": {
                "max_per_run": {
                    "type": "integer",
                    "description": "Maximum number of scheduled notifications to process per run",
                    "minimum": 1,
                    "maximum": 1000,
                    "default": 100
                }
            },
            "required": []
        }
    
    def validate_params(self, params: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        """Validate parameters"""
        return True, None
    
    async def execute(self, context: JobExecutionContext) -> JobResult:
        """Execute scheduled notification processing"""
        from services.notification_service import NotificationService
        from models.notification_models import NotificationQueueCreate
        
        start_time = time.time()
        max_per_run = context.parameters.get("max_per_run", 100)
        
        context.log("INFO", "⏰ Starting scheduled notification processor...")
        
        try:
            notification_service = NotificationService(context.db)
            now = datetime.utcnow()
            
            # Find all scheduled notifications that are due
            query = {
                "enabled": True,
                "nextRun": {"$lte": now}
            }
            
            cursor = context.db.scheduled_notifications.find(query).limit(max_per_run)
            scheduled_items = await cursor.to_list(length=max_per_run)
            
            context.log("INFO", f"   Found {len(scheduled_items)} scheduled notifications due")
            
            processed_count = 0
            sent_count = 0
            error_count = 0
            
            for scheduled in scheduled_items:
                try:
                    schedule_id = str(scheduled["_id"])
                    template_id = scheduled["templateId"]
                    recipient_type = scheduled["recipientType"]
                    max_recipients = scheduled.get("maxRecipients", 0)
                    
                    context.log("INFO", f"   Processing schedule {schedule_id}")
                    
                    # Get recipients based on type
                    recipients = await self._get_recipients(
                        context.db,
                        recipient_type,
                        scheduled.get("recipientSegment"),
                        max_recipients
                    )
                    
                    context.log("INFO", f"   Found {len(recipients)} recipients")
                    
                    # Queue notifications for each recipient
                    for recipient in recipients:
                        try:
                            notification = NotificationQueueCreate(
                                username=recipient.get("username"),
                                trigger=scheduled["trigger"],
                                channels=[scheduled["channel"]],
                                templateData=scheduled.get("templateData", {})
                            )
                            
                            await notification_service.enqueue_notification(notification)
                            sent_count += 1
                            
                        except Exception as e:
                            context.log("ERROR", f"   Failed to queue for {recipient.get('username')}: {str(e)}")
                            error_count += 1
                    
                    # Update schedule
                    await self._update_schedule_next_run(context.db, scheduled)
                    processed_count += 1
                    
                except Exception as e:
                    context.log("ERROR", f"   Failed to process schedule: {str(e)}")
                    error_count += 1
            
            duration = time.time() - start_time
            context.log("INFO", f"✅ Processor completed in {duration:.2f}s")
            context.log("INFO", f"   Processed: {processed_count}, Sent: {sent_count}, Errors: {error_count}")
            
            return JobResult(
                status="success" if error_count == 0 else "partial_success",
                message=f"Processed {processed_count} scheduled notifications",
                details={
                    "processedCount": processed_count,
                    "sentCount": sent_count,
                    "errorCount": error_count
                },
                duration_seconds=duration
            )
            
        except Exception as e:
            duration = time.time() - start_time
            context.log("ERROR", f"❌ Processor failed: {str(e)}")
            import traceback
            traceback.print_exc()
            return JobResult(
                status="failed",
                message=f"Processor failed: {str(e)}",
                errors=[str(e)],
                duration_seconds=duration
            )
    
    async def _get_recipients(self, db, recipient_type: str, segment: Optional[Dict], max_recipients: int):
        """Get list of recipients based on type"""
        query = {}
        
        if recipient_type == "active_users":
            query["isActive"] = True
        elif recipient_type == "test":
            query["role"] = "admin"
        # all_users has no filter
        
        if segment:
            query.update(segment)
        
        cursor = db.users.find(query)
        if max_recipients > 0:
            cursor = cursor.limit(max_recipients)
        
        return await cursor.to_list(length=max_recipients if max_recipients > 0 else None)
    
    async def _update_schedule_next_run(self, db, scheduled: Dict):
        """Update the nextRun time for a schedule"""
        from bson import ObjectId
        
        schedule_id = scheduled["_id"]
        schedule_type = scheduled["scheduleType"]
        
        if schedule_type == "one_time":
            # Disable one-time schedules after execution
            await db.scheduled_notifications.update_one(
                {"_id": schedule_id},
                {
                    "$set": {
                        "enabled": False,
                        "lastRun": datetime.utcnow()
                    },
                    "$inc": {"runCount": 1}
                }
            )
        else:
            # Calculate next run for recurring schedules
            pattern = scheduled.get("recurrencePattern")
            
            if pattern == "custom":
                cron_expr = scheduled.get("cronExpression")
            else:
                # Use default cron expressions
                if pattern == "daily":
                    cron_expr = "0 9 * * *"
                elif pattern == "weekly":
                    cron_expr = "0 9 * * 1"
                elif pattern == "monthly":
                    cron_expr = "0 9 1 * *"
                else:
                    cron_expr = scheduled.get("cronExpression", "0 9 * * *")
            
            iter = croniter(cron_expr, datetime.utcnow())
            next_run = iter.get_next(datetime)
            
            await db.scheduled_notifications.update_one(
                {"_id": schedule_id},
                {
                    "$set": {
                        "lastRun": datetime.utcnow(),
                        "nextRun": next_run
                    },
                    "$inc": {"runCount": 1}
                }
            )
