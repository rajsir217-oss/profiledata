"""
Conversation Cold Reminder Job
===============================
Sends SMS notifications to users about conversations that haven't had activity.
Runs every 6 hours to check for cold conversations.
"""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, List

from .base import JobTemplate, JobExecutionContext, JobResult
from services.notification_service import NotificationService
from models.notification_models import NotificationChannel, NotificationPriority

logger = logging.getLogger(__name__)


class ConversationColdJob(JobTemplate):
    """Job for sending conversation cold reminders"""
    
    template_type = "conversation_cold"
    template_name = "Conversation Cold Reminder"
    template_description = "Send SMS notifications about cold conversations"
    category = "engagement"
    icon = "❄️"
    estimated_duration = "10-20 minutes"
    resource_usage = "medium"
    risk_level = "low"
    
    def __init__(self):
        pass
    
    def validate_params(self, params: Dict[str, Any]) -> tuple[bool, str]:
        """Validate job parameters"""
        cold_hours = params.get("cold_hours", 72)
        if not isinstance(cold_hours, int) or cold_hours < 1 or cold_hours > 168:
            return False, "cold_hours must be an integer between 1 and 168"
        
        return True, None
    
    def get_default_params(self) -> Dict[str, Any]:
        """Get default parameters"""
        return {
            "batch_size": 100,
            "dry_run": False,
            "cold_hours": 72,  # 3 days
            "min_messages": 1,
            "max_age_days": 30
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
            "cold_hours": {
                "type": "integer",
                "label": "Cold Threshold (hours)",
                "description": "Hours without activity to consider conversation cold",
                "default": 72,
                "min": 1,
                "max": 168
            },
            "min_messages": {
                "type": "integer",
                "label": "Minimum Messages",
                "description": "Minimum messages in conversation to consider",
                "default": 1,
                "min": 1,
                "max": 10
            },
            "max_age_days": {
                "type": "integer",
                "label": "Max Conversation Age (days)",
                "description": "Only check conversations within this many days",
                "default": 30,
                "min": 1,
                "max": 90
            }
        }
    
    async def execute(self, context: JobExecutionContext) -> JobResult:
        """Execute the conversation cold job"""
        params = context.params
        db = context.db
        
        batch_size = params.get("batch_size", 100)
        dry_run = params.get("dry_run", False)
        cold_hours = params.get("cold_hours", 72)
        min_messages = params.get("min_messages", 1)
        max_age_days = params.get("max_age_days", 30)
        
        logger.info(f"❄️ Starting conversation cold job")
        logger.info(f"   Batch size: {batch_size}")
        logger.info(f"   Dry run: {dry_run}")
        logger.info(f"   Cold threshold: {cold_hours} hours")
        logger.info(f"   Min messages: {min_messages}")
        logger.info(f"   Max age: {max_age_days} days")
        
        try:
            # Calculate time threshold
            cold_threshold = datetime.utcnow() - timedelta(hours=cold_hours)
            max_created_date = datetime.utcnow() - timedelta(days=max_age_days)
            
            # Find cold conversations
            cold_conversations = await self._find_cold_conversations(
                db, cold_threshold, max_created_date, min_messages
            )
            
            total_conversations = len(cold_conversations)
            logger.info(f"📊 Found {total_conversations} cold conversations")
            
            if total_conversations == 0:
                return JobResult(
                    status="success",
                    message="No cold conversations found",
                    records_processed=0,
                    records_affected=0
                )
            
            # Process in batches
            notification_service = NotificationService(db)
            notifications_sent = 0
            notifications_failed = 0
            
            for i in range(0, total_conversations, batch_size):
                batch = cold_conversations[i:i + batch_size]
                
                logger.info(f"📦 Processing batch {i//batch_size + 1}/{(total_conversations + batch_size - 1)//batch_size}")
                
                for conv_data in batch:
                    try:
                        # Send to both participants
                        for participant in conv_data["participants"]:
                            if not dry_run:
                                await notification_service.queue_notification(
                                    username=participant,
                                    trigger="conversation_cold",
                                    channels=["sms"],
                                    template_data={
                                        "conversation_with": conv_data["other_participant"],
                                        "last_message_days": conv_data["days_since_last_message"],
                                        "message_count": conv_data["message_count"],
                                        "last_message_preview": conv_data["last_message_preview"]
                                    },
                                    priority="medium"
                                )
                                notifications_sent += 1
                            else:
                                logger.info(f"   📝 Dry run: Would send conversation_cold SMS to {participant}")
                                notifications_sent += 1
                                
                    except Exception as e:
                        logger.error(f"❌ Failed to queue notification for conversation {conv_data.get('conversation_id')}: {e}")
                        notifications_failed += 1
                
                # Small delay between batches
                if i + batch_size < total_conversations:
                    await asyncio.sleep(1)
            
            return JobResult(
                status="success",
                message=f"Processed {total_conversations} cold conversations",
                records_processed=total_conversations,
                records_affected=notifications_sent,
                details={
                    "notifications_sent": notifications_sent,
                    "notifications_failed": notifications_failed,
                    "dry_run": dry_run,
                    "cold_hours": cold_hours
                }
            )
            
        except Exception as e:
            logger.error(f"❌ Conversation cold job failed: {e}", exc_info=True)
            return JobResult(
                status="failed",
                message=f"Job failed: {str(e)}",
                records_processed=0,
                records_affected=0
            )
    
    async def _find_cold_conversations(self, db, cold_threshold: datetime, max_created_date: datetime, min_messages: int) -> List[Dict]:
        """Find conversations that haven't had activity"""
        
        # Get conversations from messages collection
        pipeline = [
            {
                "$match": {
                    "createdAt": {"$gte": max_created_date},
                    "lastMessageAt": {"$lt": cold_threshold}
                }
            },
            {
                "$group": {
                    "_id": "$conversationId",
                    "participants": {"$addToSet": "$participants"},
                    "messageCount": {"$sum": 1},
                    "lastMessageAt": {"$max": "$createdAt"},
                    "lastMessagePreview": {"$last": "$content"}
                }
            },
            {
                "$match": {
                    "messageCount": {"$gte": min_messages}
                }
            },
            {
                "$project": {
                    "conversation_id": "$_id",
                    "participants": 1,
                    "message_count": "$messageCount",
                    "last_message_at": "$lastMessageAt",
                    "last_message_preview": "$lastMessagePreview"
                }
            },
            {"$sort": {"last_message_at": 1}}
        ]
        
        conversations = await db.messages.aggregate(pipeline).to_list(length=500)
        
        cold_conversations = []
        
        for conv in conversations:
            # Calculate days since last message
            days_since_last = (datetime.utcnow() - conv["last_message_at"]).days
            
            # Get other participant (not the one who sent last message)
            participants = conv.get("participants", [])
            if len(participants) >= 2:
                # Find the other participant (simplified logic)
                other_participant = participants[0] if participants[0] != "system" else participants[1]
                
                cold_conversations.append({
                    "conversation_id": conv["conversation_id"],
                    "participants": participants,
                    "message_count": conv["message_count"],
                    "days_since_last_message": days_since_last,
                    "last_message_preview": conv.get("last_message_preview", "")[:50],
                    "other_participant": other_participant
                })
        
        return cold_conversations


# Job registration for scheduler
def register_conversation_cold_job():
    """Register this job with the job scheduler"""
    return {
        "name": "conversation_cold",
        "template": ConversationColdJob,
        "schedule": "0 */6 * * *",  # Every 6 hours
        "enabled": True,
        "description": "Send conversation cold reminders to users"
    }
