"""
Weekly/Monthly Digest Email Job Template
Sends activity digest emails to users
"""

from typing import Dict, Any, Tuple, Optional
from .base import JobTemplate, JobExecutionContext, JobResult
import time


class WeeklyDigestNotifierTemplate(JobTemplate):
    """Template for sending weekly/monthly digest emails"""
    
    template_type = "weekly_digest_notifier"
    template_name = "Weekly Digest Emailer"
    template_description = "Send weekly or monthly activity digest emails to users"
    category = "communication"
    icon = "📊"
    estimated_duration = "5-15 minutes"
    resource_usage = "medium"
    risk_level = "low"
    
    def get_schema(self) -> Dict[str, Any]:
        """Return JSON schema for parameters"""
        return {
            "type": "object",
            "properties": {
                "digest_type": {
                    "type": "string",
                    "enum": ["weekly", "monthly"],
                    "description": "Type of digest to send",
                    "default": "weekly"
                },
                "include_stats": {
                    "type": "boolean",
                    "description": "Include user activity statistics",
                    "default": True
                },
                "include_matches": {
                    "type": "boolean",
                    "description": "Include new matches summary",
                    "default": True
                },
                "max_recipients": {
                    "type": "integer",
                    "description": "Maximum number of recipients per run (0 = unlimited)",
                    "minimum": 0,
                    "maximum": 10000,
                    "default": 0
                }
            },
            "required": []
        }
    
    def validate_params(self, params: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        """Validate parameters"""
        # All parameters have defaults
        return True, None
    
    async def execute(self, context: JobExecutionContext) -> JobResult:
        """Execute weekly digest email job"""
        from services.notification_service import NotificationService
        from models.notification_models import NotificationQueueCreate, NotificationTrigger, NotificationChannel
        from datetime import datetime, timedelta
        
        start_time = time.time()
        digest_type = context.parameters.get("digest_type", "weekly")
        include_stats = context.parameters.get("include_stats", True)
        include_matches = context.parameters.get("include_matches", True)
        max_recipients = context.parameters.get("max_recipients", 0)
        
        context.log("INFO", f"📊 Starting {digest_type} digest email job...")
        
        try:
            notification_service = NotificationService(context.db)
            
            # Get date range based on digest type
            end_date = datetime.utcnow()
            if digest_type == "weekly":
                start_date = end_date - timedelta(days=7)
                trigger = NotificationTrigger.WEEKLY_DIGEST
            else:  # monthly
                start_date = end_date - timedelta(days=30)
                trigger = NotificationTrigger.MONTHLY_DIGEST
            
            context.log("INFO", f"   Date range: {start_date.date()} to {end_date.date()}")
            
            # Get all active users with email notifications enabled
            users_cursor = context.db.users.find({
                "isActive": True,
                "contactEmail": {"$exists": True, "$ne": ""}
            })
            users = await users_cursor.to_list(length=None)
            
            context.log("INFO", f"   Found {len(users)} active users")
            
            # Limit recipients if specified
            if max_recipients > 0 and len(users) > max_recipients:
                users = users[:max_recipients]
                context.log("INFO", f"   Limited to {max_recipients} recipients")
            
            sent_count = 0
            skipped_count = 0
            error_count = 0
            
            for user in users:
                username = user.get("username")
                
                # Check if user has digest enabled in preferences
                prefs = await notification_service.get_preferences(username)
                if not prefs or trigger not in prefs.channels:
                    skipped_count += 1
                    continue
                
                try:
                    # Gather user stats for the period
                    stats = {}
                    
                    if include_stats:
                        # Get profile views
                        views_count = await context.db.user_actions.count_documents({
                            "targetUsername": username,
                            "action": "view_profile",
                            "createdAt": {"$gte": start_date, "$lte": end_date}
                        })
                        stats["profileViews"] = views_count
                    
                    if include_matches:
                        # Get new matches
                        matches_count = await context.db.favorites.count_documents({
                            "username": username,
                            "createdAt": {"$gte": start_date, "$lte": end_date}
                        })
                        stats["newMatches"] = matches_count
                    
                    # Enqueue digest notification
                    notification = NotificationQueueCreate(
                        username=username,
                        trigger=trigger,
                        channels=[NotificationChannel.EMAIL],
                        templateData={
                            "user": {
                                "firstName": user.get("firstName", "User"),
                                "username": username
                            },
                            "period": digest_type,
                            "stats": stats,
                            "dateRange": {
                                "start": start_date.strftime("%Y-%m-%d"),
                                "end": end_date.strftime("%Y-%m-%d")
                            }
                        }
                    )
                    
                    await notification_service.enqueue_notification(notification)
                    sent_count += 1
                    
                except Exception as e:
                    context.log("ERROR", f"   Failed to queue digest for {username}: {str(e)}")
                    error_count += 1
            
            duration = time.time() - start_time
            context.log("INFO", f"✅ Digest job completed in {duration:.2f}s")
            context.log("INFO", f"   Sent: {sent_count}, Skipped: {skipped_count}, Errors: {error_count}")
            
            return JobResult(
                status="success" if error_count == 0 else "partial_success",
                message=f"{digest_type.capitalize()} digest emails queued successfully",
                details={
                    "digestType": digest_type,
                    "sentCount": sent_count,
                    "skippedCount": skipped_count,
                    "errorCount": error_count,
                    "dateRange": f"{start_date.date()} to {end_date.date()}"
                },
                duration_seconds=duration
            )
            
        except Exception as e:
            duration = time.time() - start_time
            context.log("ERROR", f"❌ Digest job failed: {str(e)}")
            import traceback
            traceback.print_exc()
            return JobResult(
                status="failed",
                message=f"Digest job failed: {str(e)}",
                errors=[str(e)],
                duration_seconds=duration
            )
