"""
Batch SMS Processing Job
Process SMS notifications in batches for better throughput and cost efficiency
"""

import asyncio
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from motor.motor_asyncio import AsyncIOMotorDatabase
import logging

from job_templates.base import JobTemplate, JobExecutionContext, JobResult
from services.notification_service import NotificationService
from services.notification_cache import NotificationCacheService
from job_templates.sms_notifier_template import SMSNotifierTemplate

logger = logging.getLogger(__name__)

class BatchSMSProcessingJob(JobTemplate):
    """Process SMS notifications in batches for better throughput"""
    
    def get_schema(self) -> Dict[str, Any]:
        """Get job parameter schema"""
        return {
            "type": "object",
            "properties": {
                "batch_size": {
                    "type": "integer",
                    "minimum": 10,
                    "maximum": 100,
                    "default": 50,
                    "description": "Number of notifications per batch"
                },
                "max_batches": {
                    "type": "integer",
                    "minimum": 1,
                    "maximum": 100,
                    "default": 20,
                    "description": "Maximum batches to process"
                },
                "delay_between_batches": {
                    "type": "integer",
                    "minimum": 1,
                    "maximum": 10,
                    "default": 2,
                    "description": "Delay between batches (seconds)"
                },
                "channels": {
                    "type": "array",
                    "items": {"type": "string"},
                    "default": ["sms"],
                    "description": "Channels to process"
                },
                "priority": {
                    "type": "string",
                    "enum": ["low", "medium", "high", "critical"],
                    "description": "Filter by priority (optional)"
                },
                "dry_run": {
                    "type": "boolean",
                    "default": False,
                    "description": "Run in dry-run mode"
                }
            }
        }
    
    def validate_params(self, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Validate parameters (alias for validate_parameters)"""
        return asyncio.run(self.validate_parameters(parameters))
    
    def __init__(self):
        super().__init__()
        self.job_name = "batch_sms_processing"
        self.description = "Process SMS notifications in batches for better throughput"
        
        # Default configuration
        self.default_batch_size = 50
        self.default_max_batches = 20
        self.default_delay_between_batches = 2  # seconds
    
    async def validate_parameters(self, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Validate and normalize job parameters"""
        validated = {}
        
        # Batch size (10-100)
        batch_size = parameters.get("batch_size", self.default_batch_size)
        validated["batch_size"] = max(10, min(100, int(batch_size)))
        
        # Maximum batches to process (1-100)
        max_batches = parameters.get("max_batches", self.default_max_batches)
        validated["max_batches"] = max(1, min(100, int(max_batches)))
        
        # Delay between batches (1-10 seconds)
        delay = parameters.get("delay_between_batches", self.default_delay_between_batches)
        validated["delay_between_batches"] = max(1, min(10, int(delay)))
        
        # Channel filter (optional)
        validated["channels"] = parameters.get("channels", ["sms"])
        
        # Priority filter (optional)
        validated["priority"] = parameters.get("priority", None)
        
        # Dry run mode
        validated["dry_run"] = parameters.get("dry_run", False)
        
        return validated
    
    async def execute(self, context: JobExecutionContext) -> JobResult:
        """Execute batch SMS processing job"""
        db = context.db
        parameters = context.parameters
        
        batch_size = parameters["batch_size"]
        max_batches = parameters["max_batches"]
        delay_between_batches = parameters["delay_between_batches"]
        channels = parameters["channels"]
        priority = parameters["priority"]
        dry_run = parameters["dry_run"]
        
        context.log("info", f"Starting batch SMS processing")
        context.log("info", f"Batch size: {batch_size}, Max batches: {max_batches}")
        context.log("info", f"Delay between batches: {delay_between_batches}s")
        
        # Initialize services
        try:
            cache_service = NotificationCacheService()
            await cache_service.connect()
            
            notification_service = NotificationService(db, cache_service)
            sms_template = SMSNotifierTemplate()
            
            context.log("info", "Services initialized successfully")
        except Exception as e:
            return JobResult(
                status="failed",
                message=f"Failed to initialize services: {e}",
                errors=[str(e)]
            )
        
        total_processed = 0
        total_sent = 0
        total_failed = 0
        batches_processed = 0
        
        try:
            # Query for pending SMS notifications
            query = {
                "status": "pending",
                "channels": {"$in": channels},
                "scheduledFor": {"$lte": datetime.utcnow()}
            }
            
            if priority:
                query["priority"] = priority
            
            # Get total count
            total_pending = await db.notification_queue.count_documents(query)
            context.log("info", f"Found {total_pending} pending SMS notifications")
            
            if total_pending == 0:
                context.log("info", "No pending SMS notifications to process")
                return JobResult(
                    status="success",
                    message="No pending SMS notifications to process",
                    records_processed=0,
                    records_affected=0
                )
            
            # Process in batches
            while batches_processed < max_batches:
                # Get next batch
                batch = await db.notification_queue.find(query).limit(batch_size).to_list(batch_size)
                
                if not batch:
                    context.log("info", "No more notifications to process")
                    break
                
                context.log("info", f"Processing batch {batches_processed + 1} with {len(batch)} notifications")
                
                # Process batch
                batch_result = await self._process_batch(
                    batch, 
                    notification_service, 
                    sms_template, 
                    db, 
                    context,
                    dry_run
                )
                
                total_processed += batch_result["processed"]
                total_sent += batch_result["sent"]
                total_failed += batch_result["failed"]
                
                context.log("info", f"Batch {batches_processed + 1} completed: "
                           f"{batch_result['sent']} sent, {batch_result['failed']} failed")
                
                batches_processed += 1
                
                # Delay between batches to avoid overwhelming SMS provider
                if batches_processed < max_batches:
                    await asyncio.sleep(delay_between_batches)
            
            # Summary
            context.log("info", f"Batch processing completed")
            context.log("info", f"Total processed: {total_processed}")
            context.log("info", f"Total sent: {total_sent}")
            context.log("info", f"Total failed: {total_failed}")
            context.log("info", f"Batches processed: {batches_processed}")
            
            return JobResult(
                status="success",
                message=f"Processed {total_processed} SMS notifications in {batches_processed} batches",
                records_processed=total_processed,
                records_affected=total_sent,
                details={
                    "total_sent": total_sent,
                    "total_failed": total_failed,
                    "batches_processed": batches_processed,
                    "batch_size": batch_size,
                    "dry_run": dry_run
                }
            )
            
        except Exception as e:
            context.log("error", f"Batch processing failed: {e}")
            return JobResult(
                status="failed",
                message=f"Batch processing failed: {e}",
                records_processed=total_processed,
                records_affected=total_sent,
                errors=[str(e)]
            )
        
        finally:
            # Clean up services
            try:
                if cache_service:
                    await cache_service.disconnect()
            except Exception as e:
                context.log("warning", f"Error disconnecting cache service: {e}")
    
    async def _process_batch(
        self, 
        batch: List[Dict[str, Any]], 
        notification_service: NotificationService,
        sms_template: SMSNotifierTemplate,
        db: AsyncIOMotorDatabase,
        context: JobExecutionContext,
        dry_run: bool
    ) -> Dict[str, int]:
        """Process a batch of SMS notifications"""
        
        processed = 0
        sent = 0
        failed = 0
        
        # Group notifications by user for potential batching
        notifications_by_user = {}
        
        for notification in batch:
            username = notification.get("username")
            if username not in notifications_by_user:
                notifications_by_user[username] = []
            notifications_by_user[username].append(notification)
        
        # Process each user's notifications
        for username, user_notifications in notifications_by_user.items():
            try:
                # Check user's SMS preferences and rate limits
                if not dry_run:
                    prefs = await notification_service.get_preferences(username)
                    if not prefs or "sms" not in [c.value for c in prefs.channels]:
                        context.log("debug", f"User {username} has SMS disabled, skipping {len(user_notifications)} notifications")
                        # Mark as failed
                        await self._mark_notifications_failed(user_notifications, "SMS disabled", db)
                        failed += len(user_notifications)
                        processed += len(user_notifications)
                        continue
                    
                    # Check rate limits
                    rate_limit_ok = await notification_service._check_rate_limit(
                        username, ["sms"], prefs
                    )
                    if not rate_limit_ok:
                        context.log("debug", f"User {username} hit rate limit, skipping {len(user_notifications)} notifications")
                        # Mark as failed
                        await self._mark_notifications_failed(user_notifications, "Rate limit exceeded", db)
                        failed += len(user_notifications)
                        processed += len(user_notifications)
                        continue
                
                # Process each notification for this user
                for notification in user_notifications:
                    try:
                        if dry_run:
                            context.log("info", f"[DRY RUN] Would send SMS to {username} for trigger {notification.get('trigger')}")
                            sent += 1
                        else:
                            # Send SMS
                            success = await self._send_sms_notification(
                                notification, sms_template, db, context
                            )
                            
                            if success:
                                # Mark as sent
                                await self._mark_notification_sent(notification, db)
                                sent += 1
                                context.log("debug", f"SMS sent to {username} for trigger {notification.get('trigger')}")
                            else:
                                # Mark as failed
                                await self._mark_notification_failed(notification, "Send failed", db)
                                failed += 1
                                context.log("warning", f"SMS send failed for {username} trigger {notification.get('trigger')}")
                    
                    except Exception as e:
                        context.log("error", f"Error processing notification for {username}: {e}")
                        failed += 1
                    
                    processed += 1
                    
            except Exception as e:
                context.log("error", f"Error processing notifications for user {username}: {e}")
                # Mark all as failed
                await self._mark_notifications_failed(user_notifications, str(e), db)
                failed += len(user_notifications)
                processed += len(user_notifications)
        
        return {
            "processed": processed,
            "sent": sent,
            "failed": failed
        }
    
    async def _send_sms_notification(
        self, 
        notification: Dict[str, Any], 
        sms_template: SMSNotifierTemplate,
        db: AsyncIOMotorDatabase,
        context: JobExecutionContext
    ) -> bool:
        """Send SMS notification"""
        try:
            # Get user's phone number
            username = notification.get("username")
            user = await db.users.find_one({"username": username})
            
            if not user:
                context.log("warning", f"User {username} not found")
                return False
            
            phone = user.get("contactPhone") or user.get("phone")
            if not phone:
                context.log("warning", f"No phone number for user {username}")
                return False
            
            # Render SMS message
            sms_text = await sms_template._render_sms(
                None,  # notification_service not needed for template rendering
                notification,
                db
            )
            
            # Send SMS (this would integrate with your SMS provider)
            # For now, we'll simulate the send
            context.log("debug", f"SMS sent to {phone}: {sms_text}")
            
            # In production, you would call your SMS service here:
            # await sms_service.send(phone, sms_text)
            
            return True
            
        except Exception as e:
            context.log("error", f"Error sending SMS: {e}")
            return False
    
    async def _mark_notification_sent(self, notification: Dict[str, Any], db: AsyncIOMotorDatabase):
        """Mark notification as sent"""
        try:
            await db.notification_queue.update_one(
                {"_id": notification["_id"]},
                {
                    "$set": {
                        "status": "sent",
                        "sentAt": datetime.utcnow(),
                        "updatedAt": datetime.utcnow()
                    }
                }
            )
            
            # Log to notification log
            await db.notification_log.insert_one({
                "username": notification["username"],
                "trigger": notification["trigger"],
                "channel": "sms",
                "status": "sent",
                "sentAt": datetime.utcnow(),
                "createdAt": datetime.utcnow(),
                "notificationId": str(notification["_id"])
            })
            
        except Exception as e:
            logger.error(f"Error marking notification as sent: {e}")
    
    async def _mark_notification_failed(
        self, 
        notification: Dict[str, Any], 
        error_message: str,
        db: AsyncIOMotorDatabase
    ):
        """Mark notification as failed"""
        try:
            await db.notification_queue.update_one(
                {"_id": notification["_id"]},
                {
                    "$set": {
                        "status": "failed",
                        "error": error_message,
                        "updatedAt": datetime.utcnow()
                    }
                }
            )
            
            # Log to notification log
            await db.notification_log.insert_one({
                "username": notification["username"],
                "trigger": notification["trigger"],
                "channel": "sms",
                "status": "failed",
                "error": error_message,
                "createdAt": datetime.utcnow(),
                "notificationId": str(notification["_id"])
            })
            
        except Exception as e:
            logger.error(f"Error marking notification as failed: {e}")
    
    async def _mark_notifications_failed(
        self, 
        notifications: List[Dict[str, Any]], 
        error_message: str,
        db: AsyncIOMotorDatabase
    ):
        """Mark multiple notifications as failed"""
        for notification in notifications:
            await self._mark_notification_failed(notification, error_message, db)
