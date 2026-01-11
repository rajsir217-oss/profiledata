"""
PII Expiry Notifier Job Template
Checks for expiring PII access and sends reminder notifications
"""

from typing import Dict, Any, Tuple, Optional
from datetime import datetime, timedelta

from .base import JobTemplate, JobExecutionContext, JobResult
from services.notification_service import NotificationService


class PIIExpiryNotifierTemplate(JobTemplate):
    """Job template for notifying users about expiring PII access"""
    
    # Template metadata
    template_type = "pii_expiry_notifier"
    template_name = "PII Expiry Notifier"
    template_description = "Send notifications for expiring PII access (3-day warning)"
    category = "notifications"
    icon = "⏰"
    estimated_duration = "1-2 minutes"
    resource_usage = "low"
    risk_level = "low"
    
    def validate_params(self, params: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        """Validate job parameters"""
        days_before = params.get("daysBeforeExpiry", 3)
        if not isinstance(days_before, int) or days_before < 1 or days_before > 30:
            return False, "daysBeforeExpiry must be an integer between 1 and 30"
        
        return True, None
    
    def get_default_params(self) -> Dict[str, Any]:
        """Get default parameters"""
        return {
            "daysBeforeExpiry": 3,  # Warn 3 days before expiry (access expires after 5 days)
            "batchSize": 100
        }
    
    def get_schema(self) -> Dict[str, Any]:
        """Get parameter schema for UI"""
        return {
            "daysBeforeExpiry": {
                "type": "integer",
                "label": "Days Before Expiry",
                "description": "Send notification this many days before PII access expires",
                "default": 3,
                "min": 1,
                "max": 30
            },
            "batchSize": {
                "type": "integer",
                "label": "Batch Size",
                "description": "Number of records to process per run",
                "default": 100,
                "min": 1,
                "max": 500
            }
        }
    
    async def execute(self, context: JobExecutionContext) -> JobResult:
        """Execute the PII expiry notifier job"""
        start_time = datetime.utcnow()
        notified_count = 0
        errors = []
        
        try:
            service = NotificationService(context.db)
            params = context.parameters
            
            days_before = params.get("daysBeforeExpiry", 7)
            batch_size = params.get("batchSize", 100)
            
            # Calculate the warning window
            # We want PII access that expires between 7-8 days from now
            # (so we notify once, not daily)
            now = datetime.utcnow()
            warning_start = now + timedelta(days=days_before)
            warning_end = now + timedelta(days=days_before + 1)
            
            context.log("info", f"Checking for PII access expiring between {warning_start.date()} and {warning_end.date()}")
            
            # Find PII access records expiring in the warning window
            # that haven't been notified yet
            expiring_access = await context.db.pii_access.find({
                "expiresAt": {
                    "$gte": warning_start,
                    "$lt": warning_end
                },
                "status": "active",
                "expiryNotificationSent": {"$ne": True}
            }).limit(batch_size).to_list(batch_size)
            
            context.log("info", f"Found {len(expiring_access)} PII access records expiring soon")
            
            if not expiring_access:
                return JobResult(
                    status="success",
                    message="No expiring PII access found",
                    duration_seconds=(datetime.utcnow() - start_time).total_seconds()
                )
            
            # Send notification for each expiring access
            for access in expiring_access:
                try:
                    requester = access.get("requester")
                    target = access.get("target")
                    expires_at = access.get("expiresAt")
                    
                    if not requester or not expires_at:
                        context.log("warning", f"Skipping PII access {access.get('_id')}: missing requester or expiresAt")
                        continue
                    
                    # Get target user's name
                    target_user = await context.db.users.find_one({"username": target})
                    target_name = target_user.get("firstName", target) if target_user else target
                    
                    # Calculate days remaining
                    days_remaining = (expires_at - now).days
                    expiry_date = expires_at.strftime("%B %d, %Y")
                    
                    # Get requester's first name for template
                    requester_user = await context.db.users.find_one({"username": requester})
                    requester_firstName = requester_user.get("firstName", requester) if requester_user else requester
                    
                    # Queue notification
                    await service.queue_notification(
                        username=requester,
                        trigger="pii_expiring",
                        channels=["email"],
                        template_data={
                            "recipient": {"firstName": requester_firstName, "username": requester},
                            "recipient_firstName": requester_firstName,
                            "match": {
                                "firstName": target_name,
                                "profileId": target_user.get("profileId", "") if target_user else ""
                            },
                            "match_firstName": target_name,
                            "match_profileId": target_user.get("profileId", "") if target_user else "",
                            "pii": {
                                "daysRemaining": days_remaining,
                                "expiryDate": expiry_date
                            }
                        },
                        priority="medium"
                    )
                    
                    # Mark as notified
                    await context.db.pii_access.update_one(
                        {"_id": access["_id"]},
                        {"$set": {"expiryNotificationSent": True}}
                    )
                    
                    notified_count += 1
                    context.log("info", f"Notified {requester} about expiring access to {target_name}")
                    
                except Exception as e:
                    error_msg = f"Failed to process PII access {access.get('_id')}: {str(e)}"
                    errors.append(error_msg)
                    context.log("error", error_msg)
            
            duration = (datetime.utcnow() - start_time).total_seconds()
            
            return JobResult(
                status="success" if not errors else "partial",
                message=f"Sent {notified_count} PII expiry notifications",
                details={
                    "notified": notified_count,
                    "total_checked": len(expiring_access),
                    "days_before_expiry": days_before
                },
                records_processed=len(expiring_access),
                records_affected=notified_count,
                errors=errors[:10],
                duration_seconds=duration
            )
            
        except Exception as e:
            duration = (datetime.utcnow() - start_time).total_seconds()
            context.log("error", f"Job failed: {str(e)}")
            return JobResult(
                status="failed",
                message=f"Failed to check expiring PII access: {str(e)}",
                errors=[str(e)],
                duration_seconds=duration
            )


# Export the template
__all__ = ['PIIExpiryNotifierTemplate']
