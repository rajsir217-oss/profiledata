"""
Analytics Notifier Job Template
Sends notifications based on user analytics (visibility spikes, milestones, search appearances)
"""

from typing import Dict, Any, Tuple, Optional
from datetime import datetime, timedelta

from .base import JobTemplate, JobExecutionContext, JobResult
from services.notification_service import NotificationService


class AnalyticsNotifierTemplate(JobTemplate):
    """Job template for analytics-based notifications"""
    
    # Template metadata
    template_type = "analytics_notifier"
    template_name = "Analytics Notifier"
    template_description = "Send notifications for visibility spikes, milestones, and search appearances"
    category = "notifications"
    icon = "📈"
    estimated_duration = "3-10 minutes"
    resource_usage = "medium"
    risk_level = "low"
    
    def validate_params(self, params: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        """Validate job parameters"""
        spike_threshold = params.get("spikeThreshold", 25)
        if not isinstance(spike_threshold, (int, float)) or spike_threshold < 10:
            return False, "spikeThreshold must be at least 10"
        
        return True, None
    
    def get_default_params(self) -> Dict[str, Any]:
        """Get default parameters"""
        return {
            "spikeThreshold": 25,  # 25% increase = spike
            "checkVisibilitySpikes": True,
            "checkMilestones": True,
            "checkSearchAppearances": True,
            "batchSize": 100,
            "searchAppearanceThreshold": 10  # Notify if appeared in 10+ searches
        }
    
    def get_schema(self) -> Dict[str, Any]:
        """Get parameter schema for UI"""
        return {
            "spikeThreshold": {
                "type": "integer",
                "label": "Spike Threshold (%)",
                "description": "Consider it a spike if views increased by this percentage",
                "default": 25,
                "min": 10,
                "max": 100
            },
            "checkVisibilitySpikes": {
                "type": "boolean",
                "label": "Check Visibility Spikes",
                "description": "Send notifications for profile view spikes",
                "default": True
            },
            "checkMilestones": {
                "type": "boolean",
                "label": "Check Milestones",
                "description": "Send notifications for milestones (100 views, 50 matches, etc.)",
                "default": True
            },
            "checkSearchAppearances": {
                "type": "boolean",
                "label": "Check Search Appearances",
                "description": "Send daily digest of search appearances",
                "default": True
            },
            "searchAppearanceThreshold": {
                "type": "integer",
                "label": "Search Appearance Threshold",
                "description": "Notify if profile appeared in at least this many searches",
                "default": 10,
                "min": 1
            },
            "batchSize": {
                "type": "integer",
                "label": "Batch Size",
                "description": "Number of users to process per run",
                "default": 100,
                "min": 1,
                "max": 500
            }
        }
    
    async def execute(self, context: JobExecutionContext) -> JobResult:
        """Execute the analytics notifier job"""
        start_time = datetime.utcnow()
        spike_notifications = 0
        milestone_notifications = 0
        search_notifications = 0
        errors = []
        
        try:
            service = NotificationService(context.db)
            params = context.parameters
            
            spike_threshold = params.get("spikeThreshold", 25)
            check_spikes = params.get("checkVisibilitySpikes", True)
            check_milestones = params.get("checkMilestones", True)
            check_searches = params.get("checkSearchAppearances", True)
            search_threshold = params.get("searchAppearanceThreshold", 10)
            batch_size = params.get("batchSize", 100)
            
            now = datetime.utcnow()
            yesterday = now - timedelta(days=1)
            week_ago = now - timedelta(days=7)
            
            context.log("info", "Starting analytics notifications check")
            
            # Get active users to check
            users = await context.db.users.find({
                "active": True
            }).limit(batch_size).to_list(batch_size)
            
            for user in users:
                try:
                    username = user.get("username")
                    if not username:
                        continue
                    
                    # Check visibility spikes
                    if check_spikes:
                        spike_sent = await self._check_visibility_spike(
                            context, service, username, spike_threshold, yesterday
                        )
                        if spike_sent:
                            spike_notifications += 1
                    
                    # Check milestones
                    if check_milestones:
                        milestone_sent = await self._check_milestones(
                            context, service, username, user
                        )
                        if milestone_sent:
                            milestone_notifications += 1
                    
                    # Check search appearances
                    if check_searches:
                        search_sent = await self._check_search_appearances(
                            context, service, username, search_threshold, yesterday
                        )
                        if search_sent:
                            search_notifications += 1
                    
                except Exception as e:
                    error_msg = f"Failed to process user {user.get('username')}: {str(e)}"
                    errors.append(error_msg)
                    context.log("error", error_msg)
            
            duration = (datetime.utcnow() - start_time).total_seconds()
            total_notifications = spike_notifications + milestone_notifications + search_notifications
            
            return JobResult(
                status="success" if not errors else "partial",
                message=f"Sent {total_notifications} analytics notifications",
                details={
                    "visibility_spikes": spike_notifications,
                    "milestones": milestone_notifications,
                    "search_appearances": search_notifications,
                    "total": total_notifications,
                    "users_checked": len(users)
                },
                records_processed=len(users),
                records_affected=total_notifications,
                errors=errors[:10],
                duration_seconds=duration
            )
            
        except Exception as e:
            duration = (datetime.utcnow() - start_time).total_seconds()
            context.log("error", f"Job failed: {str(e)}")
            return JobResult(
                status="failed",
                message=f"Failed to check analytics: {str(e)}",
                errors=[str(e)],
                duration_seconds=duration
            )
    
    async def _check_visibility_spike(
        self, context, service, username: str, threshold: int, yesterday: datetime
    ) -> bool:
        """Check for profile visibility spikes"""
        try:
            # Count profile views in last 24 hours
            today_views = await context.db.activity_logs.count_documents({
                "targetUsername": username,
                "action": "profile_view",
                "timestamp": {"$gte": yesterday}
            })
            
            # Count views in previous 24 hours
            two_days_ago = yesterday - timedelta(days=1)
            yesterday_views = await context.db.activity_logs.count_documents({
                "targetUsername": username,
                "action": "profile_view",
                "timestamp": {"$gte": two_days_ago, "$lt": yesterday}
            })
            
            if yesterday_views == 0 or today_views < 5:
                return False  # Not enough data or views
            
            # Calculate increase percentage
            increase = ((today_views - yesterday_views) / yesterday_views) * 100
            
            if increase >= threshold:
                # Check if we already notified recently
                last_spike = await context.db.analytics_notifications.find_one({
                    "username": username,
                    "type": "visibility_spike",
                    "sentAt": {"$gte": yesterday}
                })
                
                if not last_spike:
                    # Get user's first name
                    recipient_firstName = user.get("firstName", username)
                    
                    await service.queue_notification(
                        username=username,
                        trigger="profile_visibility_spike",
                        channels=["email"],
                        template_data={
                            "recipient_firstName": recipient_firstName,
                            "stats": {
                                "increase": int(increase),
                                "period": "24 hours",
                                "profileViews": today_views
                            }
                        },
                        priority="medium"
                    )
                    
                    # Track notification
                    await context.db.analytics_notifications.insert_one({
                        "username": username,
                        "type": "visibility_spike",
                        "sentAt": datetime.utcnow(),
                        "increase": increase,
                        "views": today_views
                    })
                    
                    context.log("info", f"Sent visibility spike notification to {username} (+{int(increase)}%)")
                    return True
            
            return False
            
        except Exception as e:
            context.log("error", f"Error checking visibility spike for {username}: {e}")
            return False
    
    async def _check_milestones(self, context, service, username: str, user: Dict) -> bool:
        """Check for user milestones"""
        try:
            # Count total profile views
            total_views = await context.db.activity_logs.count_documents({
                "targetUsername": username,
                "action": "profile_view"
            })
            
            # Count total matches (favorites + mutual favorites)
            total_matches = len(user.get("favorites", [])) + len(user.get("mutualFavorites", []))
            
            # Define milestones
            milestones = [
                {"value": 100, "field": "views", "current": total_views, "description": "100 Profile Views"},
                {"value": 500, "field": "views", "current": total_views, "description": "500 Profile Views"},
                {"value": 1000, "field": "views", "current": total_views, "description": "1000 Profile Views"},
                {"value": 50, "field": "matches", "current": total_matches, "description": "50 Matches"},
                {"value": 100, "field": "matches", "current": total_matches, "description": "100 Matches"},
            ]
            
            for milestone in milestones:
                if milestone["current"] >= milestone["value"]:
                    # Check if we've already notified for this milestone
                    already_notified = await context.db.user_milestones.find_one({
                        "username": username,
                        "milestone": milestone["description"]
                    })
                    
                    if not already_notified:
                        # Get user's first name
                        recipient_firstName = user.get("firstName", username)
                        
                        await service.queue_notification(
                            username=username,
                            trigger="match_milestone",
                            channels=["email", "push"],
                            template_data={
                                "recipient_firstName": recipient_firstName,
                                "milestone": {
                                    "description": milestone["description"],
                                    "value": milestone["value"]
                                }
                            },
                            priority="medium"
                        )
                        
                        # Track milestone
                        await context.db.user_milestones.insert_one({
                            "username": username,
                            "milestone": milestone["description"],
                            "achievedAt": datetime.utcnow(),
                            "value": milestone["current"]
                        })
                        
                        context.log("info", f"Sent milestone notification to {username}: {milestone['description']}")
                        return True
            
            return False
            
        except Exception as e:
            context.log("error", f"Error checking milestones for {username}: {e}")
            return False
    
    async def _check_search_appearances(
        self, context, service, username: str, threshold: int, yesterday: datetime
    ) -> bool:
        """Check for search appearances"""
        try:
            # Count how many times profile appeared in searches yesterday
            search_count = await context.db.search_logs.count_documents({
                "resultsUsernames": username,
                "timestamp": {"$gte": yesterday}
            })
            
            if search_count >= threshold:
                # Check if we already sent today
                today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
                already_sent = await context.db.analytics_notifications.find_one({
                    "username": username,
                    "type": "search_appearance",
                    "sentAt": {"$gte": today_start}
                })
                
                if not already_sent:
                    # Get user's first name
                    user = await context.db.users.find_one({"username": username})
                    recipient_firstName = user.get("firstName", username) if user else username
                    
                    await service.queue_notification(
                        username=username,
                        trigger="search_appearance",
                        channels=["email"],
                        template_data={
                            "recipient_firstName": recipient_firstName,
                            "stats": {
                                "searchCount": search_count
                            }
                        },
                        priority="low"
                    )
                    
                    # Track notification
                    await context.db.analytics_notifications.insert_one({
                        "username": username,
                        "type": "search_appearance",
                        "sentAt": datetime.utcnow(),
                        "searchCount": search_count
                    })
                    
                    context.log("info", f"Sent search appearance notification to {username} ({search_count} appearances)")
                    return True
            
            return False
            
        except Exception as e:
            context.log("error", f"Error checking search appearances for {username}: {e}")
            return False


# Export the template
__all__ = ['AnalyticsNotifierTemplate']
