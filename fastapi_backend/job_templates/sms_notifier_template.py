"""
SMS Notifier Job Template
Processes SMS notification queue and sends text messages (cost-optimized)
"""

from typing import Dict, Any, Tuple, Optional
from datetime import datetime
import os
import aiohttp

from .base import JobTemplate, JobExecutionContext, JobResult
from services.notification_service import NotificationService
from models.notification_models import (
    NotificationChannel,
    NotificationPriority
)


class SMSNotifierTemplate(JobTemplate):
    """Job template for sending SMS notifications"""
    
    # Template metadata
    template_type = "sms_notifier"
    template_name = "SMS Notifier"
    template_description = "Process SMS notification queue with cost optimization"
    category = "notifications"
    icon = "📱"
    estimated_duration = "2-10 minutes"
    resource_usage = "medium"
    risk_level = "medium"  # Medium risk due to SMS costs
    
    SMS_COST_PER_MESSAGE = 0.0075  # $0.0075 per SMS
    
    def __init__(self):
        # SMS provider configuration (use centralized service)
        from config import settings
        self.sms_provider = settings.sms_provider
        
        # Import SMS service for sending
        from services.simpletexting_service import SimpleTextingService
        try:
            self.sms_service = SimpleTextingService()
            self.sms_available = self.sms_service.enabled
        except Exception as e:
            self.sms_service = None
            self.sms_available = False
    
    def validate_params(self, params: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        """Validate job parameters"""
        batch_size = params.get("batchSize", 50)
        if not isinstance(batch_size, int) or batch_size < 1 or batch_size > 100:
            return False, "batchSize must be an integer between 1 and 100"
        
        cost_limit = params.get("costLimit", 100.0)
        if not isinstance(cost_limit, (int, float)) or cost_limit < 0:
            return False, "costLimit must be a positive number"
        
        if params.get("testMode") and not params.get("testPhone"):
            return False, "testPhone is required when testMode is enabled"
        
        return True, None
    
    def get_default_params(self) -> Dict[str, Any]:
        """Get default parameters"""
        return {
            "batchSize": 50,
            "costLimit": 100.00,
            "priorityOnly": True,
            "verifiedUsersOnly": True,
            "testMode": False,
            "testPhone": None
        }
    
    def get_schema(self) -> Dict[str, Any]:
        """Get parameter schema for UI"""
        return {
            "batchSize": {
                "type": "integer",
                "label": "Batch Size",
                "description": "Number of SMS to process per run",
                "default": 50,
                "min": 1,
                "max": 100
            },
            "costLimit": {
                "type": "number",
                "label": "Daily Cost Limit ($)",
                "description": "Maximum SMS cost per day",
                "default": 100.00,
                "min": 0
            },
            "priorityOnly": {
                "type": "boolean",
                "label": "Priority Only",
                "description": "Only send high/critical priority SMS",
                "default": True
            },
            "verifiedUsersOnly": {
                "type": "boolean",
                "label": "Verified Users Only",
                "description": "Only send SMS to verified users",
                "default": True
            },
            "testMode": {
                "type": "boolean",
                "label": "Test Mode",
                "description": "Send all SMS to test phone",
                "default": False
            },
            "testPhone": {
                "type": "string",
                "label": "Test Phone",
                "description": "Phone number for test mode (format: +1234567890)",
                "required_if": {"testMode": True}
            }
        }
    
    async def execute(self, context: JobExecutionContext) -> JobResult:
        """Execute the SMS notifier job"""
        start_time = datetime.utcnow()
        sent_count = 0
        failed_count = 0
        total_cost = 0.0
        errors = []
        
        try:
            service = NotificationService(context.db)
            params = context.parameters
            
            # Check daily cost limit
            daily_cost = await self._get_daily_cost(service)
            if daily_cost >= params.get("costLimit", 100.0):
                return JobResult(
                    status="success",
                    message=f"Daily cost limit reached (${daily_cost:.2f})",
                    details={"dailyCost": daily_cost, "limit": params.get("costLimit")},
                    duration_seconds=(datetime.utcnow() - start_time).total_seconds()
                )
            
            context.log("info", f"Daily SMS cost: ${daily_cost:.2f} / ${params.get('costLimit')})")
            
            # Get pending SMS notifications
            context.log("info", f"Fetching pending SMS notifications (limit: {params.get('batchSize', 50)})")
            notifications = await service.get_pending_notifications(
                channel=NotificationChannel.SMS,
                limit=params.get("batchSize", 50)
            )
            
            if not notifications:
                return JobResult(
                    status="success",
                    message="No pending SMS notifications",
                    duration_seconds=(datetime.utcnow() - start_time).total_seconds()
                )
            
            # Filter notifications
            filtered = await self._filter_notifications(notifications, params, context)
            context.log("info", f"Processing {len(filtered)} SMS notifications (filtered from {len(notifications)})")
            
            # Send SMS
            for notification in filtered:
                if daily_cost + total_cost + self.SMS_COST_PER_MESSAGE > params.get("costLimit", 100.0):
                    context.log("warning", "Cost limit reached, stopping")
                    break
                
                try:
                    # Get recipient phone
                    if params.get("testMode") and params.get("testPhone"):
                        phone = params["testPhone"]
                        context.log("info", f"🧪 Test mode - using phone: {phone}")
                    else:
                        context.log("info", f"Looking up phone for user: {notification.username}")
                        user = await context.db.users.find_one({"username": notification.username})
                        context.log("info", f"Found user: {user is not None}")
                        
                        if not user:
                            raise Exception(f"User '{notification.username}' not found in database")
                        
                        # Check both 'phone' and 'contactNumber' fields
                        phone_field = user.get("phone")
                        contactNumber_field = user.get("contactNumber")
                        context.log("info", f"DB Fields - phone: {phone_field or 'NOT SET'}, contactNumber: {contactNumber_field or 'NOT SET'}")
                        
                        phone = phone_field or contactNumber_field
                        
                        if not phone:
                            raise Exception(f"User '{notification.username}' has no phone number (checked 'phone' and 'contactNumber' fields)")
                        
                        # 🔓 Decrypt phone if encrypted
                        from crypto_utils import get_encryptor
                        if phone and phone.startswith('gAAAAA'):
                            try:
                                encryptor = get_encryptor()
                                decrypted_phone = encryptor.decrypt(phone)
                                context.log("info", f"🔓 Decrypted phone: {decrypted_phone[:3]}***{decrypted_phone[-2:]}")
                                phone = decrypted_phone
                            except Exception as decrypt_err:
                                raise Exception(f"Failed to decrypt phone number: {decrypt_err}")
                        
                        context.log("info", f"✅ Using phone: {phone[:3]}***{phone[-2:] if len(phone) > 5 else '***'}")
                    
                    # Render SMS
                    message = await self._render_sms(service, notification, context.db)
                    
                    # Send SMS
                    await self._send_sms(phone, message)
                    
                    # Mark as sent
                    await service.mark_as_sent(
                        notification.id,  # Use .id field directly
                        NotificationChannel.SMS,
                        success=True
                    )
                    
                    # Log notification
                    await service.log_notification(
                        username=notification.username,
                        trigger=notification.trigger,
                        channel=NotificationChannel.SMS,
                        priority=notification.priority,
                        preview=message[:100],
                        cost=self.SMS_COST_PER_MESSAGE
                    )
                    
                    sent_count += 1
                    total_cost += self.SMS_COST_PER_MESSAGE
                    
                except Exception as e:
                    await service.mark_as_sent(
                        notification.id,  # Use .id field directly
                        NotificationChannel.SMS,
                        success=False,
                        error=str(e)
                    )
                    failed_count += 1
                    errors.append(f"{notification.username}: {str(e)}")
                    context.log("error", f"Failed to send SMS to {notification.username}: {str(e)}")
            
            duration = (datetime.utcnow() - start_time).total_seconds()
            
            return JobResult(
                status="success" if failed_count == 0 else "partial",
                message=f"Processed {len(filtered)} SMS notifications",
                details={
                    "sent": sent_count,
                    "failed": failed_count,
                    "totalCost": round(total_cost, 4),
                    "dailyCost": round(daily_cost + total_cost, 4),
                    "filtered": len(notifications) - len(filtered)
                },
                records_processed=len(filtered),
                records_affected=sent_count,
                errors=errors[:10],
                duration_seconds=duration
            )
            
        except Exception as e:
            context.log("error", f"SMS notifier job failed: {str(e)}")
            return JobResult(
                status="failed",
                message=f"SMS notifier job failed: {str(e)}",
                errors=[str(e)],
                duration_seconds=(datetime.utcnow() - start_time).total_seconds()
            )
    
    async def _filter_notifications(self, notifications, params, context):
        """Filter notifications based on parameters"""
        filtered = []
        
        for notification in notifications:
            # Priority filter
            if params.get("priorityOnly"):
                if notification.priority not in [NotificationPriority.CRITICAL, NotificationPriority.HIGH]:
                    continue
            
            # Verified users filter
            if params.get("verifiedUsersOnly"):
                user = await context.db.users.find_one({"username": notification.username})
                if not user or not user.get("verified", False):
                    continue
            
            filtered.append(notification)
        
        return filtered
    
    async def _render_sms(self, service, notification, db) -> str:
        """Render SMS content from template (max 160 chars)"""
        template = await db.notification_templates.find_one({
            "trigger": notification.trigger,
            "channel": NotificationChannel.SMS,
            "active": True
        })
        
        if not template:
            message = f"New {notification.trigger}: Check your L3V3L Dating app!"
        else:
            message = service.render_template(
                template.get("bodyTemplate", ""),
                notification.templateData
            )
            
            max_length = template.get("maxLength", 160)
            if len(message) > max_length:
                message = message[:max_length-3] + "..."
        
        return message
    
    async def _send_sms(self, to_phone: str, message: str) -> None:
        """Send SMS via configured provider (SimpleTexting or Twilio)"""
        if not self.sms_available or not self.sms_service:
            raise Exception("SMS provider credentials not configured")
        
        # Phone should already be decrypted by caller
        # Send via SimpleTexting service
        result = await self.sms_service.send_notification(to_phone, message)
        
        if not result.get("success"):
            raise Exception(result.get("error", "Failed to send SMS"))
    
    async def _get_daily_cost(self, service) -> float:
        """Get today's SMS cost"""
        today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        
        pipeline = [
            {
                "$match": {
                    "channel": NotificationChannel.SMS,
                    "createdAt": {"$gte": today_start}
                }
            },
            {
                "$group": {
                    "_id": None,
                    "totalCost": {"$sum": "$cost"}
                }
            }
        ]
        
        cursor = service.log_collection.aggregate(pipeline)
        result = await cursor.to_list(1)
        
        if not result:
            return 0.0
        
        return result[0]["totalCost"]
