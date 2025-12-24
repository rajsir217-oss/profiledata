"""
Push Notifier Job Template
Processes push notification queue and sends via Firebase Cloud Messaging
"""

import logging
from datetime import datetime, timedelta
from typing import Dict, Any, List, Tuple, Optional
from bson import ObjectId

from job_templates.base import JobTemplate, JobExecutionContext, JobResult

logger = logging.getLogger(__name__)


class PushNotifierTemplate(JobTemplate):
    """
    Job template for processing and sending push notifications
    
    - Polls notification_queue for pending push notifications
    - Retrieves user device tokens from push_subscriptions
    - Sends notifications via Firebase Cloud Messaging
    - Updates queue status and logs results
    - Handles failed tokens (invalid/unregistered)
    """
    
    # Template metadata
    template_type = "push_notifier"
    template_name = "Push Notifier"
    template_description = "Process push notification queue and send via Firebase Cloud Messaging (FCM)"
    category = "notifications"
    icon = "🔔"
    
    def get_name(self) -> str:
        return "push_notifier"
    
    def get_description(self) -> str:
        return "Process push notification queue and send via Firebase Cloud Messaging (FCM)"
    
    def get_schema(self) -> Dict[str, Any]:
        return {
            "batch_size": {
                "type": "integer",
                "description": "Number of notifications to process per run",
                "default": 50,
                "min": 1,
                "max": 500
            },
            "retry_failed": {
                "type": "boolean",
                "description": "Retry failed notifications",
                "default": True
            },
            "max_attempts": {
                "type": "integer",
                "description": "Maximum retry attempts for failed notifications",
                "default": 3,
                "min": 1,
                "max": 10
            }
        }
    
    def validate_params(self, params: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        """Validate job parameters"""
        batch_size = params.get("batch_size", 50)
        max_attempts = params.get("max_attempts", 3)
        
        if not (1 <= batch_size <= 500):
            return (False, "batch_size must be between 1 and 500")
        
        if not (1 <= max_attempts <= 10):
            return (False, "max_attempts must be between 1 and 10")
        
        return (True, None)
    
    async def execute(self, context: JobExecutionContext) -> JobResult:
        """
        Execute push notification sending
        
        Returns:
            JobResult with execution statistics
        """
        import time
        start_time = time.time()
        
        db = context.db
        params = context.parameters
        
        batch_size = params.get("batch_size", 50)
        retry_failed = params.get("retry_failed", True)
        max_attempts = params.get("max_attempts", 3)
        
        stats = {
            "processed": 0,
            "sent": 0,
            "failed": 0,
            "skipped": 0,
            "invalid_tokens_removed": 0
        }
        
        try:
            # Import push service
            from services.push_service import PushNotificationService
            push_service = PushNotificationService()
            
            # Build query for pending push notifications
            query = {
                "status": "pending",
                "channels": {"$in": ["push"]}
            }
            
            # Add retry logic if enabled
            if retry_failed:
                query["$or"] = [
                    {"attempts": {"$exists": False}},
                    {"attempts": {"$lt": max_attempts}}
                ]
            
            # Get pending notifications
            notifications = await db.notification_queue.find(query).limit(batch_size).to_list(batch_size)
            
            logger.info(f"📬 Processing {len(notifications)} push notifications")
            
            for notification in notifications:
                try:
                    stats["processed"] += 1
                    
                    username = notification.get("username")
                    if not username:
                        stats["skipped"] += 1
                        continue
                    
                    # Get user's active device tokens
                    subscriptions = await db.push_subscriptions.find({
                        "username": username,
                        "isActive": True
                    }).to_list(100)
                    
                    if not subscriptions:
                        logger.debug(f"No active subscriptions for {username}")
                        stats["skipped"] += 1
                        
                        # Mark as skipped
                        await db.notification_queue.update_one(
                            {"_id": notification["_id"]},
                            {
                                "$set": {
                                    "status": "skipped",
                                    "statusReason": "no_active_subscriptions",
                                    "updatedAt": datetime.utcnow()
                                }
                            }
                        )
                        continue
                    
                    tokens = [sub["token"] for sub in subscriptions]
                    
                    # Prepare notification content with brand prefix
                    PREFIX = "[L3V3LMATCHES] "
                    title = notification.get("title", "L3V3LMATCHES Notification")
                    body = notification.get("message", "")
                    
                    # Add prefix if not already present
                    if not title.startswith("[L3V3LMATCHES]"):
                        title = f"{PREFIX}{title}"
                    if body and not body.startswith("[L3V3LMATCHES]"):
                        body = f"{PREFIX}{body}"
                    
                    data = notification.get("templateData", {})
                    
                    # Convert all data values to strings (FCM requirement)
                    data_str = {k: str(v) for k, v in data.items()}
                    data_str["notificationId"] = str(notification["_id"])
                    data_str["trigger"] = notification.get("trigger", "unknown")
                    
                    # Send push notification
                    if len(tokens) == 1:
                        result = await push_service.send_to_token(
                            token=tokens[0],
                            title=title,
                            body=body,
                            data=data_str
                        )
                        
                        if result["success"]:
                            stats["sent"] += 1
                            status = "sent"
                            status_reason = None
                        else:
                            stats["failed"] += 1
                            status = "failed"
                            status_reason = result.get("error", "unknown")
                            
                            # Remove invalid token
                            if result.get("error") == "invalid_token":
                                await db.push_subscriptions.update_one(
                                    {"token": tokens[0]},
                                    {"$set": {"isActive": False}}
                                )
                                stats["invalid_tokens_removed"] += 1
                    else:
                        result = await push_service.send_to_multiple_tokens(
                            tokens=tokens,
                            title=title,
                            body=body,
                            data=data_str
                        )
                        
                        if result["successCount"] > 0:
                            stats["sent"] += 1
                            status = "sent"
                            status_reason = None
                        else:
                            stats["failed"] += 1
                            status = "failed"
                            status_reason = result.get("error", "all_tokens_failed")
                        
                        # Remove invalid tokens
                        if result.get("failedTokens"):
                            for failed_token in result["failedTokens"]:
                                if "invalid" in failed_token.get("error", "").lower():
                                    await db.push_subscriptions.update_one(
                                        {"token": failed_token["token"]},
                                        {"$set": {"isActive": False}}
                                    )
                                    stats["invalid_tokens_removed"] += 1
                    
                    # Update notification status
                    update_doc = {
                        "$set": {
                            "status": status,
                            "sentAt": datetime.utcnow() if status == "sent" else None,
                            "updatedAt": datetime.utcnow()
                        },
                        "$inc": {"attempts": 1}
                    }
                    
                    if status_reason:
                        update_doc["$set"]["statusReason"] = status_reason
                    
                    await db.notification_queue.update_one(
                        {"_id": notification["_id"]},
                        update_doc
                    )
                    
                    # Log to notification_log
                    log_entry = {
                        "notificationId": str(notification["_id"]),
                        "username": username,
                        "trigger": notification.get("trigger"),
                        "channel": "push",
                        "status": status,
                        "statusReason": status_reason,
                        "deviceCount": len(tokens),
                        "successCount": result.get("successCount", 1 if result.get("success") else 0),
                        "failureCount": result.get("failureCount", 0 if result.get("success") else 1),
                        "sentAt": datetime.utcnow(),
                        "metadata": {
                            "title": title,
                            "body": body[:100]  # Truncate for logging
                        }
                    }
                    
                    await db.notification_log.insert_one(log_entry)
                    
                except Exception as e:
                    logger.error(f"Failed to process notification {notification.get('_id')}: {e}")
                    stats["failed"] += 1
                    
                    # Update as failed
                    await db.notification_queue.update_one(
                        {"_id": notification["_id"]},
                        {
                            "$set": {
                                "status": "failed",
                                "statusReason": str(e),
                                "updatedAt": datetime.utcnow()
                            },
                            "$inc": {"attempts": 1}
                        }
                    )
            
            duration = time.time() - start_time
            
            logger.info(
                f"✅ Push notifier complete - "
                f"Processed: {stats['processed']}, "
                f"Sent: {stats['sent']}, "
                f"Failed: {stats['failed']}, "
                f"Skipped: {stats['skipped']} "
                f"(Duration: {duration:.2f}s)"
            )
            
            return JobResult(
                status="success",
                message=f"Processed {stats['processed']} notifications - Sent: {stats['sent']}, Failed: {stats['failed']}, Skipped: {stats['skipped']}",
                details=stats,
                records_processed=stats['processed'],
                records_affected=stats['sent'],
                errors=[],
                warnings=[],
                duration_seconds=round(duration, 2)
            )
            
        except Exception as e:
            duration = time.time() - start_time
            logger.error(f"Push notifier job failed: {e}")
            return JobResult(
                status="failed",
                message=f"Job failed: {str(e)}",
                details=stats,
                records_processed=stats.get('processed', 0),
                records_affected=stats.get('sent', 0),
                errors=[str(e)],
                warnings=[],
                duration_seconds=round(duration, 2)
            )
