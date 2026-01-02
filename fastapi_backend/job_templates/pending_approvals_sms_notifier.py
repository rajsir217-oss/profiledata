"""
Pending Approvals SMS Notifier Job Template
Sends SMS alerts to admins/moderators when there are pending profile approvals
"""

import logging
from datetime import datetime, timedelta
from typing import Dict, Any, List, Tuple, Optional

from job_templates.base import JobTemplate, JobExecutionContext, JobResult

logger = logging.getLogger(__name__)


class PendingApprovalsSMSNotifierTemplate(JobTemplate):
    """
    Job template for sending SMS alerts about pending profile approvals
    
    - Checks for profiles awaiting approval
    - Sends SMS to admins/moderators when count exceeds threshold
    - Prevents spam by tracking last alert sent
    """
    
    # Template metadata
    template_type = "pending_approvals_sms_notifier"
    template_name = "Pending Approvals SMS Alert"
    template_description = "Send SMS alerts to admins when profiles are pending approval"
    category = "notifications"
    icon = "📱"
    estimated_duration = "1-5 minutes"
    resource_usage = "low"
    risk_level = "low"
    
    def get_name(self) -> str:
        return "pending_approvals_sms_notifier"
    
    def get_description(self) -> str:
        return "Send SMS alerts to admins when profiles are pending approval"
    
    def get_schema(self) -> Dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "min_pending_count": {
                    "type": "integer",
                    "description": "Minimum pending profiles to trigger alert",
                    "default": 5,
                    "minimum": 1,
                    "maximum": 100
                },
                "alert_cooldown_hours": {
                    "type": "integer",
                    "description": "Wait this many hours between alerts",
                    "default": 4,
                    "minimum": 1,
                    "maximum": 24
                },
                "admin_phones": {
                    "type": "array",
                    "description": "List of admin phone numbers to alert",
                    "items": {"type": "string"},
                    "default": []
                },
                "include_details": {
                    "type": "boolean",
                    "description": "Include pending count in SMS",
                    "default": True
                }
            },
            "required": []
        }
    
    def validate_params(self, params: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        """Validate job parameters"""
        min_count = params.get("min_pending_count", 5)
        cooldown = params.get("alert_cooldown_hours", 4)
        
        if not (1 <= min_count <= 100):
            return (False, "min_pending_count must be between 1 and 100")
        
        if not (1 <= cooldown <= 24):
            return (False, "alert_cooldown_hours must be between 1 and 24")
        
        return (True, None)
    
    async def execute(self, context: JobExecutionContext) -> JobResult:
        """
        Execute pending approvals SMS notification job
        
        Returns:
            JobResult with execution statistics
        """
        import time
        start_time = time.time()
        
        db = context.db
        params = context.parameters
        
        min_pending_count = params.get("min_pending_count", 5)
        alert_cooldown_hours = params.get("alert_cooldown_hours", 4)
        admin_phones = params.get("admin_phones", [])
        include_details = params.get("include_details", True)
        
        stats = {
            "pending_count": 0,
            "alerts_sent": 0,
            "skipped_cooldown": False
        }
        
        context.log("INFO", f"📱 Starting pending approvals SMS alert job...")
        context.log("INFO", f"   Min pending count: {min_pending_count}")
        context.log("INFO", f"   Alert cooldown: {alert_cooldown_hours} hours")
        
        try:
            # Count pending approvals
            pending_count = await db.users.count_documents({
                "accountStatus": "pending_approval"
            })
            
            stats["pending_count"] = pending_count
            context.log("INFO", f"   Found {pending_count} profiles pending approval")
            
            # Check if we should send alert
            if pending_count < min_pending_count:
                context.log("INFO", f"   Below threshold ({min_pending_count}), skipping alert")
                duration = time.time() - start_time
                return JobResult(
                    status="success",
                    message=f"No alert needed - only {pending_count} pending (threshold: {min_pending_count})",
                    records_processed=pending_count,
                    records_affected=0,
                    details=stats,
                    duration_seconds=duration
                )
            
            # Check cooldown
            cooldown_cutoff = datetime.utcnow() - timedelta(hours=alert_cooldown_hours)
            last_alert = await db.sms_alert_log.find_one(
                {"type": "pending_approvals", "sentAt": {"$gte": cooldown_cutoff}},
                sort=[("sentAt", -1)]
            )
            
            if last_alert:
                stats["skipped_cooldown"] = True
                context.log("INFO", f"   Alert sent recently, skipping (cooldown: {alert_cooldown_hours}h)")
                duration = time.time() - start_time
                return JobResult(
                    status="success",
                    message=f"Skipped - alert sent within cooldown period",
                    records_processed=pending_count,
                    records_affected=0,
                    details=stats,
                    duration_seconds=duration
                )
            
            # Get admin phone numbers if not provided
            if not admin_phones:
                admins = await db.users.find(
                    {"role_name": {"$in": ["admin", "moderator"]}, "contactNumber": {"$exists": True}},
                    {"contactNumber": 1, "username": 1}
                ).to_list(length=10)
                
                # Decrypt phone numbers
                from crypto_utils import get_encryptor
                encryptor = get_encryptor()
                
                for admin in admins:
                    phone = admin.get("contactNumber", "")
                    if phone:
                        try:
                            if phone.startswith("gAAAAA"):
                                phone = encryptor.decrypt(phone)
                            if phone and len(phone) >= 10:
                                admin_phones.append(phone)
                        except Exception as e:
                            context.log("WARNING", f"   Failed to decrypt phone for {admin.get('username')}: {e}")
            
            if not admin_phones:
                context.log("WARNING", "   No admin phone numbers found, cannot send SMS")
                duration = time.time() - start_time
                return JobResult(
                    status="partial_success",
                    message="No admin phone numbers available",
                    records_processed=pending_count,
                    records_affected=0,
                    details=stats,
                    duration_seconds=duration
                )
            
            # Build SMS message
            if include_details:
                message = f"L3V3L MATCHES: {pending_count} profiles pending approval. Please review at l3v3lmatches.com/admin"
            else:
                message = "L3V3L MATCHES: Profiles pending approval. Please review at l3v3lmatches.com/admin"
            
            # Send SMS via notification service
            from services.notification_service import NotificationService
            from models.notification_models import NotificationQueueCreate, NotificationTrigger, NotificationChannel
            
            notification_service = NotificationService(db)
            
            for phone in admin_phones:
                try:
                    # Queue SMS notification
                    notification = NotificationQueueCreate(
                        username="system",
                        trigger=NotificationTrigger.ADMIN_ALERT,
                        channels=[NotificationChannel.SMS],
                        templateData={
                            "message": message,
                            "phone": phone,
                            "pendingCount": pending_count
                        }
                    )
                    
                    await notification_service.enqueue_notification(notification)
                    stats["alerts_sent"] += 1
                    context.log("INFO", f"   ✅ Queued SMS to {phone[:4]}***")
                    
                except Exception as e:
                    context.log("ERROR", f"   Failed to queue SMS to {phone[:4]}***: {e}")
            
            # Log the alert
            await db.sms_alert_log.insert_one({
                "type": "pending_approvals",
                "pendingCount": pending_count,
                "alertsSent": stats["alerts_sent"],
                "sentAt": datetime.utcnow()
            })
            
            duration = time.time() - start_time
            context.log("INFO", f"✅ Job completed in {duration:.2f}s")
            context.log("INFO", f"   Alerts sent: {stats['alerts_sent']}")
            
            return JobResult(
                status="success",
                message=f"Sent {stats['alerts_sent']} SMS alerts for {pending_count} pending profiles",
                records_processed=pending_count,
                records_affected=stats["alerts_sent"],
                details=stats,
                duration_seconds=duration
            )
            
        except Exception as e:
            duration = time.time() - start_time
            context.log("ERROR", f"❌ Job failed: {str(e)}")
            import traceback
            traceback.print_exc()
            return JobResult(
                status="failed",
                message=f"Job failed: {str(e)}",
                errors=[str(e)],
                details=stats,
                duration_seconds=duration
            )
