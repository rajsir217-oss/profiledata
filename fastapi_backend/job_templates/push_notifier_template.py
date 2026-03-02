"""
Push Notifier Job Template
Processes push notification queue and sends via Firebase Cloud Messaging
"""

import json
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
            
            # Use NotificationService for consistent query logic and atomic claiming
            from services.notification_service import NotificationService
            from models.notification_models import NotificationChannel
            service = NotificationService(db)
            
            # Reset any stuck processing notifications first
            stuck_count = await service.reset_stuck_processing(timeout_minutes=10)
            if stuck_count > 0:
                logger.warning(f"🔄 Reset {stuck_count} stuck push notifications from previous failed runs")
            
            # Get pending push notifications (atomically claimed)
            claimed_notifications = await service.get_pending_notifications(
                channel=NotificationChannel.PUSH,
                limit=batch_size
            )
            
            logger.info(f"📬 Processing {len(claimed_notifications)} push notifications")
            
            for notification in claimed_notifications:
                # Get notification ID and convert to ObjectId for MongoDB queries
                notification_id = notification.id
                try:
                    notification_oid = ObjectId(notification_id)
                except Exception:
                    notification_oid = notification_id
                
                try:
                    stats["processed"] += 1
                    
                    username = notification.username
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
                        
                        # Delete skipped items — no point keeping them in the queue
                        await db.notification_queue.delete_one({"_id": notification_oid})
                        continue
                    
                    tokens = [sub["token"] for sub in subscriptions]
                    
                    # Prepare notification content with brand prefix
                    PREFIX = "[L3V3LMATCHES] "
                    trigger = notification.trigger or ""
                    
                    # User-friendly fallback messages for each trigger type
                    trigger_messages = {
                        # Contact Info Requests
                        "pending_pii_request": {
                            "title": "{match_firstName} requested your contact info",
                            "body": "Login to respond"
                        },
                        "pii_request": {
                            "title": "{match_firstName} requested your contact info",
                            "body": "Login to respond"
                        },
                        "pii_granted": {
                            "title": "Your contact request was approved!",
                            "body": "Login to L3V3LMATCHES.com to view their details"
                        },
                        "pii_denied": {
                            "title": "Contact request update",
                            "body": "Login to L3V3LMATCHES.com for details"
                        },
                        
                        # Messaging
                        "new_message": {
                            "title": "You have a new message!",
                            "body": "Login to L3V3LMATCHES.com to read it"
                        },
                        "unread_messages": {
                            "title": "You have unread messages",
                            "body": "Login to L3V3LMATCHES.com to catch up"
                        },
                        "conversation_cold": {
                            "title": "Rekindle the conversation! 💬",
                            "body": "Send a message to keep the connection going"
                        },
                        "message_reminder": {
                            "title": "Unread message waiting!",
                            "body": "Login to L3V3LMATCHES.com to respond"
                        },
                        
                        # Profile Interactions
                        "profile_view": {
                            "title": "{match_firstName} viewed your profile! 👀",
                            "body": "Login to L3V3LMATCHES.com to see who"
                        },
                        "profile_view_multiple": {
                            "title": "Multiple profile views!",
                            "body": "People are checking you out! Login to see who"
                        },
                        "profile_complete": {
                            "title": "Complete your profile! 📝",
                            "body": "Get better matches by completing your profile"
                        },
                        "photo_upload_reminder": {
                            "title": "Add photos to get 10x more responses! 📸",
                            "body": "Upload photos to increase your match rate"
                        },
                        
                        # Matching & Favorites
                        "new_match": {
                            "title": "You have a new match! 💕",
                            "body": "Login to L3V3LMATCHES.com to connect"
                        },
                        "mutual_favorite": {
                            "title": "It's a match! 💕",
                            "body": "You both favorited each other! Login to connect"
                        },
                        "shortlist_added": {
                            "title": "{match_firstName} shortlisted you! ⭐",
                            "body": "Login to L3V3LMATCHES.com to see who"
                        },
                        "favorited": {
                            "title": "{match_firstName} favorited your profile! ❤️",
                            "body": "Login to L3V3LMATCHES.com to see who"
                        },
                        "daily_matches": {
                            "title": "New daily matches! 🌅",
                            "body": "Login to L3V3LMATCHES.com to view them"
                        },
                        "smart_matches": {
                            "title": "Smart matches found! 🎯",
                            "body": "AI found compatible matches for you!"
                        },
                        
                        # Subscription & Premium
                        "subscription_expired": {
                            "title": "Subscription expired! ⏰",
                            "body": "Login to L3V3LMATCHES.com to renew"
                        },
                        "subscription_renewal": {
                            "title": "Subscription renewal soon",
                            "body": "Login to manage your subscription settings"
                        },
                        "premium_feature": {
                            "title": "Unlock premium features! 👑",
                            "body": "Login to L3V3LMATCHES.com to upgrade"
                        },
                        "trial_ending": {
                            "title": "Free trial ending soon! ⏰",
                            "body": "Login to L3V3LMATCHES.com to subscribe"
                        },
                        
                        # Activity & Engagement
                        "login_reminder": {
                            "title": "We miss you! 👋",
                            "body": "Login to L3V3LMATCHES.com to see new matches"
                        },
                        "weekly_summary": {
                            "title": "Your weekly activity! 📊",
                            "body": "See what happened this week on your profile"
                        },
                        "success_story": {
                            "title": "Inspiring success story! 💍",
                            "body": "Login to L3V3LMATCHES.com to read it"
                        },
                        "event_invite": {
                            "title": "Upcoming matchmaking event! 🎉",
                            "body": "Login to L3V3LMATCHES.com to RSVP"
                        },
                        
                        # Safety & Verification
                        "verify_email": {
                            "title": "Verify your email! ✉️",
                            "body": "Check your inbox for verification link"
                        },
                        "verify_phone": {
                            "title": "Verify your phone number! 📱",
                            "body": "Login to L3V3LMATCHES.com for better security"
                        },
                        "safety_tip": {
                            "title": "New safety tip! 🛡️",
                            "body": "Login to L3V3LMATCHES.com to read it"
                        },
                        "account_suspended": {
                            "title": "Account action required! ⚠️",
                            "body": "Login to L3V3LMATCHES.com for details"
                        },
                        
                        # Contributions & Donations
                        "contribution_reminder": {
                            "title": "Support our platform! 💝",
                            "body": "Login to L3V3LMATCHES.com to contribute"
                        },
                        "contribution_thank_you": {
                            "title": "Thank you for your contribution! 🙏",
                            "body": "Your support helps us grow"
                        },
                        "popup_shown": {
                            "title": "Premium features available! 👑",
                            "body": "Login to L3V3LMATCHES.com to learn more"
                        },
                        
                        # Admin & Support
                        "admin_message": {
                            "title": "Important admin message! 📢",
                            "body": "Login to L3V3LMATCHES.com to read"
                        },
                        "support_response": {
                            "title": "Support has responded! 💬",
                            "body": "Login to L3V3LMATCHES.com to view response"
                        },
                        "profile_approved": {
                            "title": "Profile approved! ✅",
                            "body": "Login to L3V3LMATCHES.com to connect"
                        },
                        "profile_rejected": {
                            "title": "Profile update needed! ⚠️",
                            "body": "Login to L3V3LMATCHES.com to fix issues"
                        },
                    }
                    
                    # Get title and body from notification or use friendly fallback
                    fallback = trigger_messages.get(trigger, {
                        "title": "New notification",
                        "body": "Login to L3V3LMATCHES.com"
                    })
                    
                    # notification model has no title/message fields; use templateData
                    template_data_raw = notification.templateData or {}
                    raw_title = template_data_raw.get("title")
                    raw_body = template_data_raw.get("message")
                    # Guard: templateData.message can be a dict (e.g. {"preview": ""}), not a string
                    title = raw_title if isinstance(raw_title, str) and raw_title else fallback["title"]
                    body = raw_body if isinstance(raw_body, str) and raw_body else fallback["body"]
                    
                    # Render template variables in title and body
                    template_data = template_data_raw
                    if template_data:
                        for key, value in template_data.items():
                            if isinstance(value, dict):
                                for nested_key, nested_value in value.items():
                                    safe_val = str(nested_value) if not isinstance(nested_value, dict) else ""
                                    title = title.replace(f"{{{key}_{nested_key}}}", safe_val or "")
                                    body = body.replace(f"{{{key}_{nested_key}}}", safe_val or "")
                            else:
                                title = title.replace(f"{{{key}}}", str(value or ""))
                                body = body.replace(f"{{{key}}}", str(value or ""))
                    
                    # Add prefix if not already present
                    if not title.startswith("[L3V3LMATCHES]"):
                        title = f"{PREFIX}{title}"
                    
                    # Convert all data values to strings (FCM requirement)
                    data_str = {k: (json.dumps(v) if isinstance(v, dict) else str(v)) for k, v in template_data.items()}
                    data_str["notificationId"] = str(notification_id)
                    data_str["trigger"] = trigger or "unknown"
                    
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
                    if status == "sent":
                        # Sent items logged to notification_log — remove from queue
                        await db.notification_queue.delete_one({"_id": notification_oid})
                    else:
                        # Failed items stay for retry
                        update_doc = {"$set": {"status": status, "updatedAt": datetime.utcnow()}, "$inc": {"attempts": 1}}
                        if status_reason:
                            update_doc["$set"]["statusReason"] = status_reason
                        await db.notification_queue.update_one({"_id": notification_oid}, update_doc)
                    
                    # Log to notification_log
                    log_entry = {
                        "notificationId": str(notification_id),
                        "username": username,
                        "trigger": trigger,
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
                    logger.error(f"Failed to process notification {notification_id}: {e}")
                    stats["failed"] += 1
                    
                    # Update as failed
                    await db.notification_queue.update_one(
                        {"_id": notification_oid},
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
