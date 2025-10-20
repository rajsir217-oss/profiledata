"""
SMS Notifier Job Template
Processes SMS notification queue and sends text messages
Cost-optimized for dating app notifications
"""

import asyncio
from datetime import datetime
from typing import Dict, Any
from pymongo.database import Database
import os
import aiohttp

from services.notification_service import NotificationService
from models.notification_models import (
    NotificationChannel,
    NotificationStatus,
    NotificationPriority
)


class SMSNotifierJob:
    """Job to process and send SMS notifications"""
    
    # Job metadata
    job_name = "sms_notifier"
    description = "Process SMS notification queue (cost-optimized)"
    default_schedule = "every 10 minutes"
    timeout = 600  # 10 minutes
    
    # Default parameters
    default_parameters = {
        "batchSize": 50,  # Smaller batches for cost control
        "costLimit": 100.00,  # Max $100/day
        "priorityOnly": True,  # Only send high-priority SMS
        "verifiedUsersOnly": True,
        "testMode": False,
        "testPhone": None
    }
    
    # SMS costs (example - adjust based on provider)
    SMS_COST_PER_MESSAGE = 0.0075  # $0.0075 per SMS
    
    def __init__(self, db: Database, parameters: Dict[str, Any]):
        self.db = db
        self.params = {**self.default_parameters, **parameters}
        self.service = NotificationService(db)
        
        # SMS provider configuration (Twilio example)
        self.sms_provider = os.getenv("SMS_PROVIDER", "twilio")
        self.account_sid = os.getenv("TWILIO_ACCOUNT_SID")
        self.auth_token = os.getenv("TWILIO_AUTH_TOKEN")
        self.from_phone = os.getenv("TWILIO_FROM_PHONE")
        
    async def execute(self) -> Dict[str, Any]:
        """Execute the SMS notifier job"""
        start_time = datetime.utcnow()
        sent_count = 0
        failed_count = 0
        total_cost = 0.0
        errors = []
        
        try:
            # Check today's cost limit
            daily_cost = await self._get_daily_cost()
            if daily_cost >= self.params["costLimit"]:
                return {
                    "success": False,
                    "message": f"Daily cost limit reached (${daily_cost:.2f})",
                    "sentCount": 0,
                    "failedCount": 0,
                    "totalCost": 0.0
                }
            
            # Get pending SMS notifications
            notifications = await self.service.get_pending_notifications(
                channel=NotificationChannel.SMS,
                limit=self.params["batchSize"]
            )
            
            if not notifications:
                return {
                    "success": True,
                    "message": "No pending SMS notifications",
                    "sentCount": 0,
                    "failedCount": 0,
                    "totalCost": 0.0
                }
            
            # Filter notifications based on parameters
            filtered_notifications = []
            for notification in notifications:
                # Priority filter
                if self.params["priorityOnly"]:
                    if notification.priority not in [NotificationPriority.CRITICAL, NotificationPriority.HIGH]:
                        continue
                
                # Verified users filter
                if self.params["verifiedUsersOnly"]:
                    user = await self.db.users.find_one({"username": notification.username})
                    if not user or not user.get("verified", False):
                        continue
                
                # Match score filter (if applicable)
                user_prefs = await self.service.get_preferences(notification.username)
                if user_prefs.smsOptimization.minimumMatchScore > 0:
                    match_score = notification.templateData.get("match", {}).get("matchScore", 0)
                    if match_score < user_prefs.smsOptimization.minimumMatchScore:
                        continue
                
                filtered_notifications.append(notification)
            
            # Send SMS
            for notification in filtered_notifications:
                # Check if we'll exceed cost limit
                if daily_cost + total_cost + self.SMS_COST_PER_MESSAGE > self.params["costLimit"]:
                    break
                
                try:
                    # Get user phone
                    if self.params["testMode"] and self.params.get("testPhone"):
                        phone = self.params["testPhone"]
                    else:
                        user = await self.db.users.find_one({"username": notification.username})
                        if not user or not user.get("phone"):
                            raise Exception("User phone not found")
                        phone = user["phone"]
                    
                    # Render SMS content
                    message = await self._render_sms(notification)
                    
                    # Send SMS
                    await self._send_sms(
                        to_phone=phone,
                        message=message,
                        notification=notification
                    )
                    
                    # Mark as sent
                    await self.service.mark_as_sent(
                        notification._id,
                        NotificationChannel.SMS,
                        success=True
                    )
                    
                    # Log notification with cost
                    await self.service.log_notification(
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
                    # Mark as failed
                    await self.service.mark_as_sent(
                        notification._id,
                        NotificationChannel.SMS,
                        success=False,
                        error=str(e)
                    )
                    
                    failed_count += 1
                    errors.append(f"{notification.username}: {str(e)}")
            
            duration = (datetime.utcnow() - start_time).total_seconds()
            
            return {
                "success": True,
                "message": f"Processed {len(filtered_notifications)} SMS notifications",
                "sentCount": sent_count,
                "failedCount": failed_count,
                "totalCost": total_cost,
                "dailyCost": daily_cost + total_cost,
                "duration": duration,
                "errors": errors[:10]
            }
            
        except Exception as e:
            return {
                "success": False,
                "message": "SMS notifier job failed",
                "error": str(e),
                "sentCount": sent_count,
                "failedCount": failed_count,
                "totalCost": total_cost
            }
    
    async def _render_sms(self, notification) -> str:
        """Render SMS content from template (max 160 chars)"""
        # Get template from database
        template = await self.db.notification_templates.find_one({
            "trigger": notification.trigger,
            "channel": NotificationChannel.SMS,
            "active": True
        })
        
        if not template:
            # Use default template
            message = f"New {notification.trigger}: Check your L3V3L Dating app!"
        else:
            # Render template with variables
            message = self.service.render_template(
                template.get("bodyTemplate", ""),
                notification.templateData
            )
            
            # Enforce max length
            max_length = template.get("maxLength", 160)
            if len(message) > max_length:
                message = message[:max_length-3] + "..."
        
        # Shorten URLs in message
        message = await self._shorten_urls(message)
        
        return message
    
    async def _shorten_urls(self, message: str) -> str:
        """Shorten URLs in message for SMS"""
        # Simple URL shortening (in production, use bit.ly or similar)
        import re
        url_pattern = r'http[s]?://(?:[a-zA-Z]|[0-9]|[$-_@.&+]|[!*\\(\\),]|(?:%[0-9a-fA-F][0-9a-fA-F]))+'
        urls = re.findall(url_pattern, message)
        
        for url in urls:
            # In production, call URL shortening API
            short_url = url  # Placeholder
            message = message.replace(url, short_url)
        
        return message
    
    async def _send_sms(
        self,
        to_phone: str,
        message: str,
        notification
    ) -> None:
        """Send SMS via Twilio"""
        if not self.account_sid or not self.auth_token:
            raise Exception("SMS provider credentials not configured")
        
        if self.sms_provider == "twilio":
            await self._send_via_twilio(to_phone, message)
        else:
            raise Exception(f"Unsupported SMS provider: {self.sms_provider}")
    
    async def _send_via_twilio(self, to_phone: str, message: str) -> None:
        """Send SMS via Twilio API"""
        url = f"https://api.twilio.com/2010-04-01/Accounts/{self.account_sid}/Messages.json"
        
        data = {
            "From": self.from_phone,
            "To": to_phone,
            "Body": message
        }
        
        auth = aiohttp.BasicAuth(self.account_sid, self.auth_token)
        
        async with aiohttp.ClientSession() as session:
            async with session.post(url, data=data, auth=auth) as response:
                if response.status != 201:
                    error_data = await response.text()
                    raise Exception(f"Twilio API error: {error_data}")
    
    async def _get_daily_cost(self) -> float:
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
        
        result = await self.service.log_collection.aggregate(pipeline).to_list(1)
        
        if not result:
            return 0.0
        
        return result[0]["totalCost"]


# Required function for job template system
async def execute_job(db: Database, parameters: Dict[str, Any]) -> Dict[str, Any]:
    """Entry point for job execution"""
    job = SMSNotifierJob(db, parameters)
    return await job.execute()


# Job template registration info
JOB_INFO = {
    "name": SMSNotifierJob.job_name,
    "description": SMSNotifierJob.description,
    "default_schedule": SMSNotifierJob.default_schedule,
    "timeout": SMSNotifierJob.timeout,
    "parameters": SMSNotifierJob.default_parameters,
    "category": "notifications",
    "costTracking": True
}
