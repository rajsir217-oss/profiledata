"""
Enhanced Login Reminder Job
===========================
Multi-channel inactive user engagement system with configurable escalation tiers.
Admin-controlled parameters for escalation days and communication channels.
"""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, List

from .base import JobTemplate, JobExecutionContext, JobResult
from services.notification_service import NotificationService
from models.notification_models import NotificationChannel, NotificationPriority

logger = logging.getLogger(__name__)


class EnhancedLoginReminderJob(JobTemplate):
    """Enhanced job for sending multi-channel login reminders to inactive users"""
    
    template_type = "enhanced_login_reminder"
    template_name = "Enhanced Login Reminder"
    template_description = "Multi-channel inactive user engagement with configurable escalation"
    category = "engagement"
    icon = "🔄"
    estimated_duration = "10-30 minutes"
    resource_usage = "medium"
    risk_level = "low"
    
    def __init__(self):
        pass
    
    def validate_params(self, params: Dict[str, Any]) -> tuple[bool, str]:
        """Validate job parameters"""
        escalation_days = params.get("escalation_days", [15, 30, 60])
        if not isinstance(escalation_days, list) or not all(isinstance(d, int) and 7 <= d <= 365 for d in escalation_days):
            return False, "escalation_days must be a list of integers between 7 and 365"
        
        # Validate unique and sorted
        if len(escalation_days) != len(set(escalation_days)):
            return False, "escalation_days must contain unique values"
        
        if sorted(escalation_days) != escalation_days:
            return False, "escalation_days must be in ascending order"
        
        communication_channels = params.get("communication_channels", {})
        if not isinstance(communication_channels, dict):
            return False, "communication_channels must be an object"
        
        valid_channels = ["email", "sms", "push"]
        for days, channels in communication_channels.items():
            if days not in [str(d) for d in escalation_days]:
                return False, f"communication_channels contains invalid escalation day: {days}"
            if not isinstance(channels, list) or not all(c in valid_channels for c in channels):
                return False, f"Invalid channels for {days} days: {channels}"
        
        return True, None
    
    def get_default_params(self) -> Dict[str, Any]:
        """Get default parameters"""
        return {
            "batch_size": 100,
            "dry_run": False,
            "escalation_days": [15, 30, 50, 60],
            "communication_channels": {
                "15": ["email", "push"],
                "30": ["email", "sms"],
                "50": ["email", "sms", "push"],
                "60": ["email", "sms", "push"]
            },
            "min_login_count": 0,
            "exclude_recent": True,
            "rate_limit_days": 7
        }
    
    def get_schema(self) -> Dict[str, Any]:
        """Get parameter schema for UI"""
        return {
            "batch_size": {
                "type": "integer",
                "label": "Batch Size",
                "description": "Number of users to process per batch",
                "default": 100,
                "min": 10,
                "max": 500
            },
            "dry_run": {
                "type": "boolean",
                "label": "Dry Run",
                "description": "Test without sending actual notifications",
                "default": False
            },
            "escalation_days": {
                "type": "array",
                "label": "Escalation Days",
                "description": "Days of inactivity for each escalation tier (must be unique and sorted)",
                "default": [15, 30, 50, 60],
                "items": {
                    "type": "integer",
                    "min": 7,
                    "max": 365
                },
                "validation": "unique_sorted"
            },
            "communication_channels": {
                "type": "object",
                "label": "Communication Channels",
                "description": "Channels for each escalation tier",
                "default": {
                    "15": ["email", "push"],
                    "30": ["email", "sms"],
                    "50": ["email", "sms", "push"],
                    "60": ["email", "sms", "push"]
                },
                "properties": {
                    "15": {
                        "type": "array",
                        "items": {"type": "string", "enum": ["email", "sms", "push"]},
                        "default": ["email", "push"]
                    },
                    "30": {
                        "type": "array",
                        "items": {"type": "string", "enum": ["email", "sms", "push"]},
                        "default": ["email", "sms"]
                    },
                    "50": {
                        "type": "array",
                        "items": {"type": "string", "enum": ["email", "sms", "push"]},
                        "default": ["email", "sms", "push"]
                    },
                    "60": {
                        "type": "array",
                        "items": {"type": "string", "enum": ["email", "sms", "push"]},
                        "default": ["email", "sms", "push"]
                    }
                }
            },
            "min_login_count": {
                "type": "integer",
                "label": "Minimum Login Count",
                "description": "Minimum number of logins user must have",
                "default": 0,
                "min": 0,
                "max": 1000
            },
            "exclude_recent": {
                "type": "boolean",
                "label": "Exclude Recent",
                "description": "Exclude users who received reminder in last rate_limit_days",
                "default": True
            },
            "rate_limit_days": {
                "type": "integer",
                "label": "Rate Limit Days",
                "description": "Minimum days between reminders for same user",
                "default": 7,
                "min": 1,
                "max": 30
            }
        }
    
    async def execute(self, context: JobExecutionContext) -> JobResult:
        """Execute the enhanced login reminder job"""
        params = context.parameters
        db = context.db
        job_id = context.job_id
        
        batch_size = params.get("batch_size", 100)
        dry_run = params.get("dry_run", False)
        escalation_days = params.get("escalation_days", [15, 30, 50, 60])
        communication_channels = params.get("communication_channels", {
            "15": ["email", "push"],
            "30": ["email", "sms"],
            "50": ["email", "sms", "push"],
            "60": ["email", "sms", "push"]
        })
        min_login_count = params.get("min_login_count", 0)
        exclude_recent = params.get("exclude_recent", True)
        rate_limit_days = params.get("rate_limit_days", 7)
        
        logger.info(f"🔄 Starting enhanced login reminder job")
        logger.info(f"   Job ID: {job_id}")
        logger.info(f"   Batch size: {batch_size}")
        logger.info(f"   Dry run: {dry_run}")
        logger.info(f"   Escalation days: {escalation_days}")
        logger.info(f"   Communication channels: {communication_channels}")
        logger.info(f"   Min login count: {min_login_count}")
        logger.info(f"   Exclude recent: {exclude_recent}")
        logger.info(f"   Rate limit days: {rate_limit_days}")
        
        try:
            notification_service = NotificationService(db)
            total_users_processed = 0
            total_notifications_sent = 0
            total_notifications_failed = 0
            escalation_stats = {}
            
            # Process each escalation tier
            for days in escalation_days:
                logger.info(f"📊 Processing {days}-day inactivity tier")
                
                channels = communication_channels.get(str(days), ["email"])
                tier_stats = await self._process_escalation_tier(
                    db, notification_service, days, channels, params, job_id
                )
                
                escalation_stats[str(days)] = tier_stats
                total_users_processed += tier_stats["users_found"]
                total_notifications_sent += tier_stats["notifications_sent"]
                total_notifications_failed += tier_stats["notifications_failed"]
                
                # Small delay between tiers
                await asyncio.sleep(1)
            
            return JobResult(
                status="success",
                message=f"Processed {total_users_processed} inactive users across {len(escalation_days)} escalation tiers",
                records_processed=total_users_processed,
                records_affected=total_notifications_sent,
                details={
                    "escalation_stats": escalation_stats,
                    "notifications_sent": total_notifications_sent,
                    "notifications_failed": total_notifications_failed,
                    "dry_run": dry_run,
                    "escalation_days": escalation_days,
                    "communication_channels": communication_channels
                }
            )
            
        except Exception as e:
            logger.error(f"❌ Enhanced login reminder job failed: {e}", exc_info=True)
            return JobResult(
                status="failed",
                message=f"Job failed: {str(e)}",
                records_processed=0,
                records_affected=0
            )
    
    async def _process_escalation_tier(self, db, notification_service: NotificationService, 
                                     days: int, channels: List[str], params: Dict, job_id: str) -> Dict:
        """Process users inactive for specific days with configured channels"""
        
        batch_size = params.get("batch_size", 100)
        dry_run = params.get("dry_run", False)
        min_login_count = params.get("min_login_count", 0)
        exclude_recent = params.get("exclude_recent", True)
        rate_limit_days = params.get("rate_limit_days", 7)
        
        # Find inactive users for this tier
        inactive_users = await self._find_inactive_users(
            db, days, min_login_count, exclude_recent, rate_limit_days
        )
        
        users_found = len(inactive_users)
        notifications_sent = 0
        notifications_failed = 0
        
        logger.info(f"📊 Found {users_found} users inactive for {days} days")
        
        if users_found == 0:
            return {
                "users_found": 0,
                "notifications_sent": 0,
                "notifications_failed": 0,
                "channels": channels
            }
        
        # Process in batches
        for i in range(0, users_found, batch_size):
            batch = inactive_users[i:i + batch_size]
            
            logger.info(f"📦 Processing batch {i//batch_size + 1}/{(users_found + batch_size - 1)//batch_size}")
            
            for user_data in batch:
                try:
                    # Send via all configured channels for this tier
                    for channel in channels:
                        if not dry_run:
                            await self._send_reminder(
                                notification_service, user_data, channel, days, job_id
                            )
                            notifications_sent += 1
                        else:
                            logger.info(f"   📝 Dry run: Would send {channel} reminder to {user_data['username']} ({days} days)")
                            notifications_sent += 1
                            
                except Exception as e:
                    logger.error(f"❌ Failed to send reminder to {user_data.get('username')}: {e}")
                    notifications_failed += 1
            
            # Small delay between batches
            if i + batch_size < users_found:
                await asyncio.sleep(1)
        
        return {
            "users_found": users_found,
            "notifications_sent": notifications_sent,
            "notifications_failed": notifications_failed,
            "channels": channels
        }
    
    def _parse_dt(self, value) -> "Optional[datetime]":
        """Safely parse datetime from string or datetime object, returns naive UTC datetime."""
        if value is None:
            return None
        if isinstance(value, datetime):
            return value.replace(tzinfo=None) if value.tzinfo else value
        if isinstance(value, str):
            try:
                # Normalize: strip timezone suffix variants before parsing
                s = value.strip()
                # Replace trailing Z or +00:00 to get a clean ISO string
                if s.endswith('Z'):
                    s = s[:-1]
                elif '+' in s[10:]:
                    s = s[:s.rindex('+')]
                dt = datetime.fromisoformat(s)
                return dt.replace(tzinfo=None) if dt.tzinfo else dt
            except Exception:
                return None
        return None

    def _get_last_login(self, user: dict) -> "Optional[datetime]":
        """Determine true last login: security.last_login_at > lastLogin > status.last_seen."""
        candidates = []
        security = user.get("security") or {}
        dt = self._parse_dt(security.get("last_login_at"))
        if dt:
            candidates.append(dt)
        dt = self._parse_dt(user.get("lastLogin"))
        if dt:
            candidates.append(dt)
        status = user.get("status") or {}
        dt = self._parse_dt(status.get("last_seen"))
        if dt:
            candidates.append(dt)
        return max(candidates) if candidates else None

    async def _find_inactive_users(self, db, days: int, min_login_count: int,
                                 exclude_recent: bool, rate_limit_days: int) -> List[Dict]:
        """Find users who haven't logged in for specified days"""

        today = datetime.utcnow()
        cutoff_date = today - timedelta(days=days)
        inactive_users = []

        # Get recent reminder recipients to exclude
        excluded_users = set()
        if exclude_recent:
            recent_cutoff = today - timedelta(days=rate_limit_days)
            recent_reminders = await db.admin_inactivity_tracking.find({
                "escalationDays": days,
                "sentAt": {"$gte": recent_cutoff}
            }).to_list(length=1000)
            for reminder in recent_reminders:
                excluded_users.add(reminder["username"])

        # Fetch active users with all login-related fields — Python-side filtering
        # avoids $dateFromString crashing on malformed string dates in MongoDB
        projection = {
            "username": 1,
            "firstName": 1,
            "loginCount": 1,
            "security.last_login_at": 1,
            "lastLogin": 1,
            "status.last_seen": 1,
            "email": 1,
            "phone": 1,
            "contactEmail": 1,
            "contactNumber": 1,
            "_id": 0
        }
        query = {
            "accountStatus": "active",
            "username": {"$nin": list(excluded_users)}
        }
        raw_users = await db.users.find(query, projection).to_list(length=5000)

        for user in raw_users:
            login_count = user.get("loginCount", 0) or 0
            if login_count < min_login_count:
                continue

            last_login_dt = self._get_last_login(user)

            # Users with no login record are always inactive
            if last_login_dt is not None and last_login_dt >= cutoff_date:
                continue

            # Engagement metrics
            new_matches_count = await self._get_new_matches_count(db, user["username"])
            unread_messages_count = await self._get_unread_messages_count(db, user["username"])
            profile_views_count = await self._get_profile_views_count(db, user["username"])

            email = user.get("email") or user.get("contactEmail")
            phone = user.get("phone") or user.get("contactNumber")

            inactive_users.append({
                "username": user["username"],
                "firstName": user.get("firstName", user["username"]),
                "days_inactive": days,
                "last_login_date": last_login_dt.strftime("%Y-%m-%d") if last_login_dt else "Never",
                "login_count": login_count,
                "new_matches_count": new_matches_count,
                "unread_messages_count": unread_messages_count,
                "profile_views_count": profile_views_count,
                "email": email,
                "phone": phone
            })

        return inactive_users
    
    async def _send_reminder(self, notification_service: NotificationService, 
                           user_data: Dict, channel: str, days_inactive: int, job_id: str):
        """Send reminder via specific channel and track in analytics"""
        
        template_data = {
            "firstName": user_data["firstName"],
            "daysInactive": days_inactive,
            "lastLoginDate": user_data["last_login_date"],
            "newMatchesCount": user_data["new_matches_count"],
            "unreadMessagesCount": user_data["unread_messages_count"],
            "profileViewsCount": user_data["profile_views_count"],
            "escalationLevel": self._get_escalation_level(days_inactive)
        }
        
        # Queue notification
        await notification_service.queue_notification(
            username=user_data["username"],
            trigger="admin_login_reminder",
            channels=[channel],
            template_data=template_data,
            priority="medium"
        )
        
        # Track in analytics collection
        await self._track_reminder_sent(
            notification_service.db, user_data, channel, days_inactive, job_id, template_data
        )
    
    async def _track_reminder_sent(self, db, user_data: Dict, channel: str, 
                                 days_inactive: int, job_id: str, template_data: Dict):
        """Track reminder sent in analytics collection"""
        
        tracking_doc = {
            "username": user_data["username"],
            "jobExecutionId": job_id,
            "escalationDays": days_inactive,
            "channels": [channel],
            "sentAt": datetime.utcnow(),
            "templateData": {
                "newMatchesCount": template_data["newMatchesCount"],
                "unreadMessagesCount": template_data["unreadMessagesCount"],
                "profileViewsCount": template_data["profileViewsCount"]
            },
            "deliveryStatus": {
                channel: {"sent": True, "delivered": False, "opened": False}
            },
            "userResponse": {
                "reactivatedAt": None,
                "respondedAt": None
            }
        }
        
        await db.admin_inactivity_tracking.insert_one(tracking_doc)
    
    def _get_escalation_level(self, days_inactive: int) -> str:
        """Get escalation level based on days inactive"""
        if days_inactive <= 20:
            return "warning"
        elif days_inactive <= 45:
            return "critical"
        else:
            return "dormant"
    
    async def _get_new_matches_count(self, db, username: str) -> int:
        """Get count of new matches since last login"""
        try:
            user = await db.users.find_one(
                {"username": username},
                {"security.last_login_at": 1, "lastLogin": 1, "status.last_seen": 1, "_id": 0}
            )
            if not user:
                return 0
            last_activity = self._get_last_login(user)
            if not last_activity:
                return 0
            count = await db.matches.count_documents({
                "participants": username,
                "createdAt": {"$gte": last_activity}
            })
            return count
        except Exception:
            return 0
    
    async def _get_unread_messages_count(self, db, username: str) -> int:
        """Get count of unread messages"""
        try:
            count = await db.messages.count_documents({
                "recipient": username,
                "read": False
            })
            
            return count
        except Exception:
            return 0
    
    async def _get_profile_views_count(self, db, username: str) -> int:
        """Get count of profile views since last login"""
        try:
            user = await db.users.find_one(
                {"username": username},
                {"security.last_login_at": 1, "lastLogin": 1, "status.last_seen": 1, "_id": 0}
            )
            if not user:
                return 0
            last_activity = self._get_last_login(user)
            if not last_activity:
                return 0
            count = await db.activity_logs.count_documents({
                "action": "profile_view",
                "targetUsername": username,
                "timestamp": {"$gte": last_activity}
            })
            return count
        except Exception:
            return 0


# Job registration for scheduler
def register_enhanced_login_reminder_job():
    """Register this job with the job scheduler"""
    return {
        "name": "enhanced_login_reminder",
        "template": EnhancedLoginReminderJob,
        "schedule": "0 10 * * 1",  # Weekly on Monday at 10:00 AM
        "enabled": True,
        "description": "Send multi-channel login reminders to inactive users"
    }
