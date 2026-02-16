"""
Subscription Monitor Job
========================
Monitors subscription expirations and sends renewal reminders.
Runs daily to check for expiring subscriptions.
"""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, List

from .base import JobTemplate, JobExecutionContext, JobResult
from services.notification_service import NotificationService
from models.notification_models import NotificationChannel, NotificationPriority

logger = logging.getLogger(__name__)


class SubscriptionMonitorJob(JobTemplate):
    """Job for monitoring subscriptions and sending reminders"""
    
    template_type = "subscription_monitor"
    template_name = "Subscription Monitor"
    template_description = "Monitor subscriptions and send renewal reminders"
    category = "revenue"
    icon = "💳"
    estimated_duration = "5-10 minutes"
    resource_usage = "low"
    risk_level = "low"
    
    def __init__(self):
        pass
    
    def validate_params(self, params: Dict[str, Any]) -> tuple[bool, str]:
        """Validate job parameters"""
        warning_days = params.get("warning_days", [7, 3, 1])
        if not isinstance(warning_days, list) or not all(isinstance(d, int) and 1 <= d <= 30 for d in warning_days):
            return False, "warning_days must be a list of integers between 1 and 30"
        
        return True, None
    
    def get_default_params(self) -> Dict[str, Any]:
        """Get default parameters"""
        return {
            "batch_size": 100,
            "dry_run": False,
            "warning_days": [7, 3, 1],  # 1 week, 3 days, 1 day before
            "check_expired": True,
            "max_check_days": 90
        }
    
    def get_schema(self) -> Dict[str, Any]:
        """Get parameter schema for UI"""
        return {
            "batch_size": {
                "type": "integer",
                "label": "Batch Size",
                "description": "Number of users to process per batch",
                "default": 100,
                "min": 1,
                "max": 500
            },
            "dry_run": {
                "type": "boolean",
                "label": "Dry Run",
                "description": "Test without sending actual notifications",
                "default": False
            },
            "warning_days": {
                "type": "array",
                "label": "Warning Days",
                "description": "Days before expiration to send warnings",
                "default": [7, 3, 1],
                "items": {
                    "type": "integer",
                    "min": 1,
                    "max": 30
                }
            },
            "check_expired": {
                "type": "boolean",
                "label": "Check Expired",
                "description": "Send notifications for already expired subscriptions",
                "default": True
            },
            "max_check_days": {
                "type": "integer",
                "label": "Max Check Days",
                "description": "Maximum days past expiration to check",
                "default": 90,
                "min": 1,
                "max": 365
            }
        }
    
    async def execute(self, context: JobExecutionContext) -> JobResult:
        """Execute the subscription monitor job"""
        params = context.params
        db = context.db
        
        batch_size = params.get("batch_size", 100)
        dry_run = params.get("dry_run", False)
        warning_days = params.get("warning_days", [7, 3, 1])
        check_expired = params.get("check_expired", True)
        max_check_days = params.get("max_check_days", 90)
        
        logger.info(f"💳 Starting subscription monitor job")
        logger.info(f"   Batch size: {batch_size}")
        logger.info(f"   Dry run: {dry_run}")
        logger.info(f"   Warning days: {warning_days}")
        logger.info(f"   Check expired: {check_expired}")
        logger.info(f"   Max check days: {max_check_days}")
        
        try:
            # Find subscriptions needing attention
            subscriptions = await self._find_subscriptions_to_notify(
                db, warning_days, check_expired, max_check_days
            )
            
            total_subscriptions = len(subscriptions)
            logger.info(f"📊 Found {total_subscriptions} subscriptions needing attention")
            
            if total_subscriptions == 0:
                return JobResult(
                    status="success",
                    message="No subscriptions need attention",
                    records_processed=0,
                    records_affected=0
                )
            
            # Process in batches
            notification_service = NotificationService(db)
            notifications_sent = 0
            notifications_failed = 0
            
            for i in range(0, total_subscriptions, batch_size):
                batch = subscriptions[i:i + batch_size]
                
                logger.info(f"📦 Processing batch {i//batch_size + 1}/{(total_subscriptions + batch_size - 1)//batch_size}")
                
                for sub_data in batch:
                    try:
                        if not dry_run:
                            await notification_service.queue_notification(
                                username=sub_data["username"],
                                trigger=sub_data["trigger"],
                                channels=["sms"],
                                template_data={
                                    "subscription_type": sub_data["subscription_type"],
                                    "expiry_date": sub_data["expiry_date"],
                                    "days_until_expiry": sub_data["days_until_expiry"],
                                    "renewal_url": "https://l3v3lmatches.com/account/subscription"
                                },
                                priority="high" if sub_data["trigger"] == "subscription_expired" else "medium"
                            )
                            notifications_sent += 1
                        else:
                            logger.info(f"   📝 Dry run: Would send {sub_data['trigger']} SMS to {sub_data['username']}")
                            notifications_sent += 1
                            
                    except Exception as e:
                        logger.error(f"❌ Failed to queue notification for {sub_data.get('username')}: {e}")
                        notifications_failed += 1
                
                # Small delay between batches
                if i + batch_size < total_subscriptions:
                    await asyncio.sleep(1)
            
            return JobResult(
                status="success",
                message=f"Processed {total_subscriptions} subscriptions",
                records_processed=total_subscriptions,
                records_affected=notifications_sent,
                details={
                    "notifications_sent": notifications_sent,
                    "notifications_failed": notifications_failed,
                    "dry_run": dry_run,
                    "warning_days": warning_days
                }
            )
            
        except Exception as e:
            logger.error(f"❌ Subscription monitor job failed: {e}", exc_info=True)
            return JobResult(
                status="failed",
                message=f"Job failed: {str(e)}",
                records_processed=0,
                records_affected=0
            )
    
    async def _find_subscriptions_to_notify(self, db, warning_days: List[int], check_expired: bool, max_check_days: int) -> List[Dict]:
        """Find subscriptions that need notifications"""
        
        today = datetime.utcnow()
        subscriptions_to_notify = []
        
        # Check for upcoming expirations
        for days in warning_days:
            check_date = today + timedelta(days=days)
            
            # Find subscriptions expiring on this date
            expiring_subs = await db.subscriptions.find({
                "status": "active",
                "expiryDate": {
                    "$gte": check_date.replace(hour=0, minute=0, second=0, microsecond=0),
                    "$lt": check_date.replace(hour=23, minute=59, second=59, microsecond=999999)
                }
            }).to_list(length=100)
            
            for sub in expiring_subs:
                days_until_expiry = (sub["expiryDate"] - today).days
                
                subscriptions_to_notify.append({
                    "username": sub["username"],
                    "subscription_id": sub.get("_id"),
                    "subscription_type": sub.get("planType", "premium"),
                    "expiry_date": sub["expiryDate"].strftime("%Y-%m-%d"),
                    "days_until_expiry": days_until_expiry,
                    "trigger": "subscription_renewal"
                })
        
        # Check for expired subscriptions
        if check_expired:
            expired_since = today - timedelta(days=max_check_days)
            
            expired_subs = await db.subscriptions.find({
                "status": "expired",
                "expiryDate": {"$gte": expired_since}
            }).to_list(length=100)
            
            for sub in expired_subs:
                days_expired = (today - sub["expiryDate"]).days
                
                subscriptions_to_notify.append({
                    "username": sub["username"],
                    "subscription_id": sub.get("_id"),
                    "subscription_type": sub.get("planType", "premium"),
                    "expiry_date": sub["expiryDate"].strftime("%Y-%m-%d"),
                    "days_until_expiry": -days_expired,  # Negative for expired
                    "trigger": "subscription_expired"
                })
        
        return subscriptions_to_notify


# Job registration for scheduler
def register_subscription_monitor_job():
    """Register this job with the job scheduler"""
    return {
        "name": "subscription_monitor",
        "template": SubscriptionMonitorJob,
        "schedule": "0 8 * * *",  # Daily at 8:00 AM
        "enabled": True,
        "description": "Monitor subscriptions and send renewal reminders"
    }
