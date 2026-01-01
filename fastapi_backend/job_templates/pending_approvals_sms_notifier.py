"""
Pending Approvals SMS Notifier Job Template
Sends SMS to admins when there are pending user approvals older than X days
"""

from typing import Dict, Any, Tuple, Optional
from datetime import datetime, timedelta
import logging

from .base import JobTemplate, JobExecutionContext, JobResult

logger = logging.getLogger(__name__)


class PendingApprovalsSMSNotifierTemplate(JobTemplate):
    """Job template for notifying admins about pending approvals via SMS"""
    
    # Template metadata
    template_type = "pending_approvals_sms_notifier"
    template_name = "Pending Approvals SMS Alert"
    template_description = "Send SMS alerts to admins when pending user approvals are older than specified days"
    category = "notifications"
    icon = "📱"
    estimated_duration = "1-2 minutes"
    resource_usage = "low"
    risk_level = "low"
    
    def __init__(self):
        """Initialize the template"""
        # Import SMS service
        try:
            from services.simpletexting_service import SimpleTextingService
            self.sms_service = SimpleTextingService()
            self.sms_available = self.sms_service.enabled
        except Exception as e:
            logger.error(f"Failed to initialize SMS service: {e}")
            self.sms_service = None
            self.sms_available = False
    
    def validate_params(self, params: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        """Validate job parameters"""
        # Validate admin phone numbers
        admin_phones = params.get("adminPhoneNumbers", "")
        if not admin_phones or not admin_phones.strip():
            return False, "adminPhoneNumbers is required (comma-separated phone numbers)"
        
        # Validate each phone number format
        phones = [p.strip() for p in admin_phones.split(",") if p.strip()]
        if not phones:
            return False, "At least one valid phone number is required"
        
        for phone in phones:
            # Basic validation - should have at least 10 digits
            digits = ''.join(filter(str.isdigit, phone))
            if len(digits) < 10:
                return False, f"Invalid phone number: {phone} (must have at least 10 digits)"
        
        # Validate days threshold
        days_threshold = params.get("daysThreshold", 2)
        if not isinstance(days_threshold, int) or days_threshold < 1:
            return False, "daysThreshold must be a positive integer"
        
        return True, None
    
    def get_default_params(self) -> Dict[str, Any]:
        """Get default parameters"""
        return {
            "adminPhoneNumbers": "",  # Comma-separated phone numbers
            "daysThreshold": 2,  # Pending for X days or more
            "includeUserDetails": True,  # Include usernames in SMS
            "maxUsersInSMS": 5,  # Max users to list in SMS (to keep message short)
            "testMode": False,  # If true, don't actually send SMS
        }
    
    def get_schema(self) -> Dict[str, Any]:
        """Get parameter schema for UI"""
        return {
            "type": "object",
            "required": ["adminPhoneNumbers"],
            "properties": {
                "adminPhoneNumbers": {
                    "type": "string",
                    "label": "Admin Phone Numbers",
                    "description": "Comma-separated phone numbers to receive SMS alerts (e.g., +1234567890, +0987654321)",
                    "default": "",
                    "placeholder": "+1234567890, +0987654321"
                },
                "daysThreshold": {
                    "type": "integer",
                    "label": "Days Threshold",
                    "description": "Alert when pending approvals are older than this many days",
                    "default": 2,
                    "min": 1,
                    "max": 30
                },
                "includeUserDetails": {
                    "type": "boolean",
                    "label": "Include User Details",
                    "description": "Include usernames in the SMS message",
                    "default": True
                },
                "maxUsersInSMS": {
                    "type": "integer",
                    "label": "Max Users in SMS",
                    "description": "Maximum number of usernames to include in SMS",
                    "default": 5,
                    "min": 1,
                    "max": 10
                },
                "testMode": {
                    "type": "boolean",
                    "label": "Test Mode",
                    "description": "Log SMS content without actually sending",
                    "default": False
                }
            }
        }
    
    async def execute(self, context: JobExecutionContext) -> JobResult:
        """Execute the pending approvals SMS notification job"""
        params = context.parameters  # Fixed: was context.params
        start_time = datetime.utcnow()
        
        # Extract parameters
        admin_phones_str = params.get("adminPhoneNumbers", "")
        days_threshold = params.get("daysThreshold", 2)
        include_user_details = params.get("includeUserDetails", True)
        max_users_in_sms = params.get("maxUsersInSMS", 5)
        test_mode = params.get("testMode", False)
        
        # Parse phone numbers
        admin_phones = [p.strip() for p in admin_phones_str.split(",") if p.strip()]
        
        logger.info(f"📱 Starting Pending Approvals SMS Notifier")
        logger.info(f"   Admin phones: {len(admin_phones)}")
        logger.info(f"   Days threshold: {days_threshold}")
        logger.info(f"   Test mode: {test_mode}")
        
        try:
            # Get database connection - use context.db which is already provided
            db = context.db
            
            # Calculate the cutoff date
            cutoff_date = datetime.utcnow() - timedelta(days=days_threshold)
            
            # Query for pending users older than threshold
            pending_query = {
                "accountStatus": {"$in": ["pending_admin_approval", "pending"]},
                "createdAt": {"$lte": cutoff_date}
            }
            
            # Get pending users
            pending_users = await db.users.find(
                pending_query,
                {"username": 1, "firstName": 1, "lastName": 1, "createdAt": 1}
            ).sort("createdAt", 1).to_list(length=100)
            
            pending_count = len(pending_users)
            
            logger.info(f"📋 Found {pending_count} pending approvals older than {days_threshold} days")
            
            # If no pending users, skip SMS
            if pending_count == 0:
                return JobResult(
                    status="success",
                    message=f"No pending approvals older than {days_threshold} days",
                    details={
                        "pending_count": 0,
                        "sms_sent": 0,
                        "duration_seconds": (datetime.utcnow() - start_time).total_seconds()
                    }
                )
            
            # Build SMS message
            message_lines = [
                f"[L3V3LMATCHES ADMIN ALERT]",
                f"⚠️ {pending_count} pending approval(s) waiting {days_threshold}+ days!"
            ]
            
            if include_user_details and pending_users:
                users_to_show = pending_users[:max_users_in_sms]
                usernames = [u.get("username", "unknown") for u in users_to_show]
                message_lines.append(f"Users: {', '.join(usernames)}")
                
                if pending_count > max_users_in_sms:
                    message_lines.append(f"...and {pending_count - max_users_in_sms} more")
            
            message_lines.append("Please review at your earliest convenience.")
            
            sms_message = "\n".join(message_lines)
            
            logger.info(f"📝 SMS Message:\n{sms_message}")
            
            # Send SMS to each admin
            sms_sent = 0
            sms_failed = 0
            sms_results = []
            
            if test_mode:
                logger.info(f"🧪 TEST MODE - Would send SMS to {len(admin_phones)} numbers")
                sms_sent = len(admin_phones)
                for phone in admin_phones:
                    sms_results.append({
                        "phone": phone,
                        "status": "test_mode",
                        "message": "SMS not sent (test mode)"
                    })
            else:
                if not self.sms_available:
                    return JobResult(
                        status="failed",
                        message="SMS service not available",
                        details={
                            "error": "SimpleTexting service not configured",
                            "pending_count": pending_count
                        }
                    )
                
                for phone in admin_phones:
                    try:
                        result = await self.sms_service.send_notification(
                            phone=phone,
                            message=sms_message
                        )
                        
                        if result.get("success"):
                            sms_sent += 1
                            sms_results.append({
                                "phone": phone[:5] + "***",
                                "status": "sent",
                                "message_id": result.get("message_id")
                            })
                            logger.info(f"✅ SMS sent to {phone[:5]}***")
                        else:
                            sms_failed += 1
                            sms_results.append({
                                "phone": phone[:5] + "***",
                                "status": "failed",
                                "error": result.get("error")
                            })
                            logger.error(f"❌ SMS failed for {phone[:5]}***: {result.get('error')}")
                    
                    except Exception as e:
                        sms_failed += 1
                        sms_results.append({
                            "phone": phone[:5] + "***",
                            "status": "error",
                            "error": str(e)
                        })
                        logger.error(f"❌ SMS error for {phone[:5]}***: {e}")
            
            # Calculate duration
            duration = (datetime.utcnow() - start_time).total_seconds()
            
            # Determine success
            is_success = sms_sent > 0 or test_mode
            
            return JobResult(
                status="success" if is_success else "failed",
                message=f"Sent {sms_sent} SMS alerts for {pending_count} pending approvals" if is_success else f"Failed to send SMS alerts",
                details={
                    "pending_count": pending_count,
                    "days_threshold": days_threshold,
                    "sms_sent": sms_sent,
                    "sms_failed": sms_failed,
                    "sms_results": sms_results,
                    "test_mode": test_mode,
                    "duration_seconds": duration,
                    "oldest_pending": pending_users[0].get("username") if pending_users else None,
                    "oldest_pending_date": pending_users[0].get("createdAt").isoformat() if pending_users and pending_users[0].get("createdAt") else None
                }
            )
        
        except Exception as e:
            logger.error(f"❌ Pending Approvals SMS Notifier failed: {e}", exc_info=True)
            return JobResult(
                status="failed",
                message=f"Job failed: {str(e)}",
                details={
                    "error": str(e),
                    "duration_seconds": (datetime.utcnow() - start_time).total_seconds()
                }
            )
