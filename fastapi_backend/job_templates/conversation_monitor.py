"""
Conversation Monitor Job Template
Detects and notifies about cold/inactive conversations
"""

from typing import Dict, Any, Tuple, Optional
from datetime import datetime, timedelta

from .base import JobTemplate, JobExecutionContext, JobResult
from services.notification_service import NotificationService


class ConversationMonitorTemplate(JobTemplate):
    """Job template for monitoring and reviving cold conversations"""
    
    # Template metadata
    template_type = "conversation_monitor"
    template_name = "Conversation Monitor"
    template_description = "Detect inactive conversations and send revival nudges"
    category = "notifications"
    icon = "💬"
    estimated_duration = "2-5 minutes"
    resource_usage = "medium"
    risk_level = "low"
    
    def validate_params(self, params: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        """Validate job parameters"""
        cold_threshold_days = params.get("coldThresholdDays", 7)
        if not isinstance(cold_threshold_days, int) or cold_threshold_days < 1:
            return False, "coldThresholdDays must be a positive integer"
        
        return True, None
    
    def get_default_params(self) -> Dict[str, Any]:
        """Get default parameters"""
        return {
            "coldThresholdDays": 7,  # No activity for 7 days = cold
            "minMessages": 3,  # Only for conversations with some history
            "batchSize": 100,
            "reminderIntervalDays": 7  # Don't spam daily
        }
    
    def get_schema(self) -> Dict[str, Any]:
        """Get parameter schema for UI"""
        return {
            "coldThresholdDays": {
                "type": "integer",
                "label": "Cold Threshold (Days)",
                "description": "Consider conversation cold after this many days of inactivity",
                "default": 7,
                "min": 1,
                "max": 30
            },
            "minMessages": {
                "type": "integer",
                "label": "Minimum Messages",
                "description": "Only notify for conversations with at least this many messages",
                "default": 3,
                "min": 1
            },
            "batchSize": {
                "type": "integer",
                "label": "Batch Size",
                "description": "Number of conversations to process per run",
                "default": 100,
                "min": 1,
                "max": 500
            },
            "reminderIntervalDays": {
                "type": "integer",
                "label": "Reminder Interval (Days)",
                "description": "Wait this many days between cold conversation reminders",
                "default": 7,
                "min": 1
            }
        }
    
    async def execute(self, context: JobExecutionContext) -> JobResult:
        """Execute the conversation monitor job"""
        start_time = datetime.utcnow()
        notified_count = 0
        errors = []
        
        try:
            service = NotificationService(context.db)
            params = context.parameters
            
            cold_threshold_days = params.get("coldThresholdDays", 7)
            min_messages = params.get("minMessages", 3)
            batch_size = params.get("batchSize", 100)
            reminder_interval_days = params.get("reminderIntervalDays", 7)
            
            # Calculate cutoff times
            now = datetime.utcnow()
            cold_cutoff = now - timedelta(days=cold_threshold_days)
            reminder_cutoff = now - timedelta(days=reminder_interval_days)
            
            context.log("info", f"Checking for conversations inactive since {cold_cutoff.date()}")
            
            # Aggregate pipeline to find cold conversations
            pipeline = [
                # Group messages by conversation (pair of users)
                {
                    "$group": {
                        "_id": {
                            "$cond": [
                                {"$lt": ["$fromUsername", "$toUsername"]},
                                {"user1": "$fromUsername", "user2": "$toUsername"},
                                {"user1": "$toUsername", "user2": "$fromUsername"}
                            ]
                        },
                        "lastMessage": {"$max": "$createdAt"},
                        "messageCount": {"$sum": 1},
                        "participants": {
                            "$addToSet": {
                                "$cond": [
                                    {"$lt": ["$fromUsername", "$toUsername"]},
                                    ["$fromUsername", "$toUsername"],
                                    ["$toUsername", "$fromUsername"]
                                ]
                            }
                        }
                    }
                },
                # Filter for cold conversations
                {
                    "$match": {
                        "lastMessage": {"$lte": cold_cutoff},
                        "messageCount": {"$gte": min_messages}
                    }
                },
                # Limit results
                {"$limit": batch_size}
            ]
            
            cold_conversations = await context.db.messages.aggregate(pipeline).to_list(batch_size)
            
            context.log("info", f"Found {len(cold_conversations)} cold conversations")
            
            for conversation in cold_conversations:
                try:
                    user1 = conversation["_id"]["user1"]
                    user2 = conversation["_id"]["user2"]
                    last_message_date = conversation["lastMessage"]
                    days_inactive = (now - last_message_date).days
                    
                    # Get user details
                    user1_doc = await context.db.users.find_one({"username": user1})
                    user2_doc = await context.db.users.find_one({"username": user2})
                    
                    if not user1_doc or not user2_doc:
                        continue
                    
                    user1_name = user1_doc.get("firstName", user1)
                    user2_name = user2_doc.get("firstName", user2)
                    
                    # Check if we've recently sent a reminder for this conversation
                    # Use a hash of usernames to track conversations
                    conversation_id = f"{user1}_{user2}"
                    
                    last_reminder = await context.db.cold_conversation_reminders.find_one({
                        "conversationId": conversation_id
                    })
                    
                    if last_reminder:
                        last_sent = last_reminder.get("lastSent", datetime.min)
                        if last_sent > reminder_cutoff:
                            # Already reminded recently
                            continue
                    
                    # Send notification to both users
                    for username, other_name in [(user1, user2_name), (user2, user1_name)]:
                        await service.queue_notification(
                            username=username,
                            trigger="conversation_cold",
                            channels=["email"],
                            template_data={
                                "match": {
                                    "firstName": other_name
                                },
                                "conversation": {
                                    "lastMessageDate": last_message_date.strftime("%B %d"),
                                    "daysInactive": days_inactive
                                }
                            },
                            priority="low"
                        )
                    
                    # Track that we sent this reminder
                    await context.db.cold_conversation_reminders.update_one(
                        {"conversationId": conversation_id},
                        {
                            "$set": {
                                "conversationId": conversation_id,
                                "user1": user1,
                                "user2": user2,
                                "lastSent": now,
                                "lastMessageDate": last_message_date
                            }
                        },
                        upsert=True
                    )
                    
                    notified_count += 2  # Both users
                    context.log("info", f"Sent cold conversation reminder for {user1} <-> {user2}")
                    
                except Exception as e:
                    error_msg = f"Failed to process conversation: {str(e)}"
                    errors.append(error_msg)
                    context.log("error", error_msg)
            
            duration = (datetime.utcnow() - start_time).total_seconds()
            
            return JobResult(
                status="success" if not errors else "partial",
                message=f"Sent {notified_count} cold conversation reminders",
                details={
                    "notified": notified_count,
                    "conversations_checked": len(cold_conversations),
                    "cold_threshold_days": cold_threshold_days
                },
                records_processed=len(cold_conversations),
                records_affected=notified_count,
                errors=errors[:10],
                duration_seconds=duration
            )
            
        except Exception as e:
            duration = (datetime.utcnow() - start_time).total_seconds()
            context.log("error", f"Job failed: {str(e)}")
            return JobResult(
                status="failed",
                message=f"Failed to monitor conversations: {str(e)}",
                errors=[str(e)],
                duration_seconds=duration
            )


# Export the template
__all__ = ['ConversationMonitorTemplate']
