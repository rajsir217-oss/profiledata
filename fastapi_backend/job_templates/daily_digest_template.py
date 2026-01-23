"""
Daily Digest Email Job Template
Sends a consolidated daily digest email to users who have enabled this feature.
Aggregates activity from the past 24 hours (or configured period).

Simplified logic:
- Job runs at scheduled time (e.g., 8AM daily via Dynamic Scheduler)
- Processes ALL users with digestSettings.enabled = true
- No user-configurable preferred time - everyone gets digest when job runs
"""

from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
import logging
from .base import JobTemplate, JobResult, JobExecutionContext
from utils.profile_display import extract_profile_display_data

logger = logging.getLogger(__name__)


class DailyDigestTemplate(JobTemplate):
    """
    Job template for sending daily digest emails.
    Collects all activity for users with digest enabled and sends a single summary email.
    """
    
    # Template metadata (required for registry)
    template_type = "daily_digest"
    template_name = "Daily Digest"
    template_description = "Send daily digest emails summarizing user activity"
    category = "notifications"
    icon = "📬"
    estimated_duration = "5-15 minutes"
    resource_usage = "medium"
    risk_level = "low"
    
    def get_schema(self) -> Dict[str, Any]:
        return {
            "batch_size": {
                "type": "integer",
                "label": "Batch Size",
                "description": "Number of users to process per batch",
                "default": 50,
                "min": 10,
                "max": 200
            },
            "hours_lookback": {
                "type": "integer",
                "label": "Hours Lookback",
                "description": "How many hours of activity to include",
                "default": 24,
                "min": 12,
                "max": 168
            },
            "dry_run": {
                "type": "boolean",
                "label": "Dry Run",
                "description": "If true, don't actually send emails (for testing)",
                "default": False
            },
            "test_username": {
                "type": "string",
                "label": "Test Username (Optional)",
                "description": "If set, only send digest to this specific user (for testing). Leave empty for all users.",
                "default": "",
                "required": False
            }
        }
    
    def validate_params(self, params: Dict[str, Any]) -> tuple:
        """Validate job parameters"""
        batch_size = params.get("batch_size", 50)
        hours_lookback = params.get("hours_lookback", 24)
        
        if not isinstance(batch_size, int) or batch_size < 10 or batch_size > 200:
            return False, "batch_size must be an integer between 10 and 200"
        if not isinstance(hours_lookback, int) or hours_lookback < 12 or hours_lookback > 168:
            return False, "hours_lookback must be an integer between 12 and 168"
        return True, None
    
    def get_default_params(self) -> Dict[str, Any]:
        """Get default parameters"""
        return {
            "batch_size": 50,
            "hours_lookback": 24,
            "dry_run": False,
            "test_username": ""
        }
    
    async def execute(self, context: JobExecutionContext) -> JobResult:
        """
        Execute the daily digest job.
        
        1. Find all users with digest enabled
        2. For each user, collect their activity from the lookback period
        3. Generate and send digest email
        4. Log results
        """
        start_time = datetime.utcnow()
        
        # Context is a JobExecutionContext dataclass, access properties directly
        db = context.db
        params = context.parameters or {}
        
        batch_size = params.get("batch_size", 50)
        hours_lookback = params.get("hours_lookback", 24)
        dry_run = params.get("dry_run", False)
        test_username = params.get("test_username", "") or None  # For testing single user (empty string = all users)
        
        if db is None:
            return JobResult(
                status="failed",
                message="Database connection not available",
                duration_seconds=(datetime.utcnow() - start_time).total_seconds()
            )
        
        users_processed = 0
        digests_sent = 0
        digests_skipped = 0
        errors = []
        
        try:
            # Get current time and lookback period
            now = datetime.utcnow()
            lookback_time = now - timedelta(hours=hours_lookback)
            
            # Simple query: find all users with digest enabled
            # Job runs at scheduled time (e.g., 8AM daily) - no user-configurable time
            if test_username:
                # Test mode: only process specific user
                query = {
                    "digestSettings.enabled": True,
                    "username": test_username
                }
                context.log("info", f"🧪 Test mode: only processing user '{test_username}'")
            else:
                # Normal mode: process all users with digest enabled
                query = {"digestSettings.enabled": True}
            
            users_with_digest = await db.notification_preferences.find(query).to_list(length=batch_size)
            
            if not users_with_digest:
                context.log("info", f"📭 No users with digest enabled. Job complete.")
                return JobResult(
                    status="success",
                    message="No users with digest enabled",
                    records_processed=0,
                    records_affected=0,
                    details={"users_found": 0},
                    duration_seconds=(datetime.utcnow() - start_time).total_seconds()
                )
            
            context.log("info", f"📬 Found {len(users_with_digest)} users with digest enabled")
            
            for user_prefs in users_with_digest:
                username = user_prefs.get("username")
                digest_settings = user_prefs.get("digestSettings", {})
                
                try:
                    # Collect activity for this user
                    activity = await self._collect_user_activity(
                        db, username, lookback_time, now, digest_settings
                    )
                    
                    users_processed += 1
                    
                    # Skip if no activity and skipIfNoActivity is enabled
                    if digest_settings.get("skipIfNoActivity", True) and not activity["has_activity"]:
                        digests_skipped += 1
                        context.log("debug", f"⏭️ Skipping digest for {username} - no activity")
                        continue
                    
                    # Get user details for email
                    user = await db.users.find_one({"username": username})
                    if not user:
                        context.log("warning", f"⚠️ User {username} not found, skipping")
                        continue
                    
                    email = user.get("email") or user.get("contactEmail")
                    if not email:
                        context.log("warning", f"⚠️ No email for {username}, skipping")
                        continue
                    
                    # Get user's channel preferences for daily_digest
                    channels_config = user_prefs.get("channels", {})
                    digest_channels = channels_config.get("daily_digest", ["email"])  # Default to email
                    
                    # Skip if no channels enabled for daily digest
                    if not digest_channels:
                        digests_skipped += 1
                        context.log("debug", f"⏭️ Skipping digest for {username} - no channels enabled")
                        continue
                    
                    # Generate and queue digest notification
                    if not dry_run:
                        await self._queue_digest_notification(
                            db, username, email, user, activity, digest_settings, digest_channels
                        )
                        digests_sent += 1
                        context.log("info", f"✅ Queued digest for {username}")
                    else:
                        digests_sent += 1
                        context.log("info", f"🧪 [DRY RUN] Would send digest to {username}")
                    
                except Exception as e:
                    error_msg = f"Error processing {username}: {str(e)}"
                    errors.append(error_msg)
                    context.log("error", f"❌ {error_msg}")
            
            context.log("info", f"📊 Daily Digest Summary: {digests_sent} sent, {digests_skipped} skipped, {len(errors)} errors")
            
            return JobResult(
                status="success" if len(errors) == 0 else "partial",
                message=f"Processed {users_processed} users, sent {digests_sent} digests, skipped {digests_skipped}",
                records_processed=users_processed,
                records_affected=digests_sent,
                details={
                    "digests_sent": digests_sent,
                    "digests_skipped": digests_skipped,
                    "dry_run": dry_run
                },
                errors=errors,
                duration_seconds=(datetime.utcnow() - start_time).total_seconds()
            )
            
        except Exception as e:
            context.log("error", f"❌ Daily digest job failed: {e}")
            return JobResult(
                status="failed",
                message=f"Daily digest job failed: {str(e)}",
                errors=[str(e)],
                duration_seconds=(datetime.utcnow() - start_time).total_seconds()
            )
    
    async def _collect_user_activity(
        self, 
        db, 
        username: str, 
        start_time: datetime, 
        end_time: datetime,
        digest_settings: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Collect all activity for a user within the time period."""
        
        activity = {
            "has_activity": False,
            "favorited_by": [],
            "shortlisted_by": [],
            "profile_views": [],
            "new_matches": [],
            "pii_requests": [],
            "new_messages": [],
            "expiring_access": [],
            "stats": {
                "total_views": 0,
                "total_favorites": 0,
                "total_messages": 0,
                "total_pii_requests": 0
            }
        }
        
        # Collect favorited by (if batching enabled)
        if digest_settings.get("batchFavorites", True):
            favorites = await db.favorites.find({
                "favoriteUsername": username,
                "createdAt": {"$gte": start_time, "$lte": end_time}
            }).to_list(length=50)
            
            for fav in favorites:
                actor = await db.users.find_one({"username": fav.get("userUsername")})
                if actor:
                    # Use helper function to extract display data
                    display_data = extract_profile_display_data(actor)
                    
                    activity["favorited_by"].append({
                        "username": fav.get("userUsername"),
                        "firstName": actor.get("firstName", ""),
                        "lastName": actor.get("lastName", ""),
                        "education": display_data["education"],
                        "occupation": display_data["occupation"],
                        "location": display_data["location"],
                        "profilePicture": display_data["profilePicture"],
                        "timestamp": fav.get("createdAt")
                    })
            activity["stats"]["total_favorites"] = len(activity["favorited_by"])
            activity["favorited_by_count"] = len(activity["favorited_by"])
        
        # Collect shortlisted by (if batching enabled)
        if digest_settings.get("batchShortlists", True):
            shortlists = await db.shortlists.find({
                "shortlistedUsername": username,
                "createdAt": {"$gte": start_time, "$lte": end_time}
            }).to_list(length=50)
            
            for sl in shortlists:
                actor = await db.users.find_one({"username": sl.get("userUsername")})
                if actor:
                    # Use helper function to extract display data
                    display_data = extract_profile_display_data(actor)
                    
                    activity["shortlisted_by"].append({
                        "username": sl.get("userUsername"),
                        "firstName": actor.get("firstName", ""),
                        "lastName": actor.get("lastName", ""),
                        "education": display_data["education"],
                        "occupation": display_data["occupation"],
                        "location": display_data["location"],
                        "profilePicture": display_data["profilePicture"],
                        "timestamp": sl.get("createdAt")
                    })
            activity["shortlisted_by_count"] = len(activity["shortlisted_by"])
        
        # Collect profile views (if batching enabled)
        if digest_settings.get("batchProfileViews", True):
            views = await db.profile_views.find({
                "viewedUsername": username,
                "viewedAt": {"$gte": start_time, "$lte": end_time}
            }).to_list(length=100)
            
            # Group by viewer to avoid duplicates
            viewers = {}
            for view in views:
                viewer_username = view.get("viewerUsername")
                if viewer_username and viewer_username not in viewers:
                    viewer = await db.users.find_one({"username": viewer_username})
                    if viewer:
                        # Use helper function to extract display data
                        display_data = extract_profile_display_data(viewer)
                        
                        viewers[viewer_username] = {
                            "username": viewer_username,
                            "firstName": viewer.get("firstName", ""),
                            "lastName": viewer.get("lastName", ""),
                            "education": display_data["education"],
                            "occupation": display_data["occupation"],
                            "location": display_data["location"],
                            "profilePicture": display_data["profilePicture"],
                            "timestamp": view.get("viewedAt")
                        }
            activity["profile_views"] = list(viewers.values())[:20]
            activity["stats"]["total_views"] = len(views)
            activity["profile_views_count"] = len(activity["profile_views"])
        
        # Collect PII requests (if batching enabled - not recommended)
        if digest_settings.get("batchPiiRequests", False):
            pii_requests = await db.pii_requests.find({
                "profileUsername": username,
                "status": "pending",
                "createdAt": {"$gte": start_time, "$lte": end_time}
            }).to_list(length=20)
            
            for req in pii_requests:
                requester = await db.users.find_one({"username": req.get("requesterUsername")})
                if requester:
                    activity["pii_requests"].append({
                        "username": req.get("requesterUsername"),
                        "firstName": requester.get("firstName", ""),
                        "lastName": requester.get("lastName", ""),
                        "requestedTypes": [req.get("requestType", "contact_info")],
                        "timestamp": req.get("createdAt")
                    })
            activity["stats"]["total_pii_requests"] = len(activity["pii_requests"])
        
        # Collect new messages (always include summary)
        unread_messages = await db.messages.find({
            "toUsername": username,
            "isRead": False,
            "createdAt": {"$gte": start_time, "$lte": end_time}
        }).to_list(length=50)
        
        # Group by sender
        senders = {}
        for msg in unread_messages:
            sender_username = msg.get("fromUsername")
            if sender_username:
                if sender_username not in senders:
                    sender = await db.users.find_one({"username": sender_username})
                    senders[sender_username] = {
                        "username": sender_username,
                        "firstName": sender.get("firstName", "") if sender else "",
                        "lastName": sender.get("lastName", "") if sender else "",
                        "count": 0,
                        "lastMessage": "",
                        "timestamp": msg.get("createdAt")
                    }
                senders[sender_username]["count"] += 1
                senders[sender_username]["lastMessage"] = msg.get("content", "")[:100]
        
        activity["new_messages"] = list(senders.values())
        activity["stats"]["total_messages"] = len(unread_messages)
        activity["new_messages_count"] = len(activity["new_messages"])
        
        # Check for expiring PII access (within 2 days)
        expiring_soon = datetime.utcnow() + timedelta(days=2)
        expiring_access = await db.pii_access.find({
            "grantedTo": username,
            "isActive": True,
            "expiresAt": {"$lte": expiring_soon, "$gte": datetime.utcnow()}
        }).to_list(length=10)
        
        for access in expiring_access:
            grantor = await db.users.find_one({"username": access.get("grantedBy")})
            if grantor:
                activity["expiring_access"].append({
                    "username": access.get("grantedBy"),
                    "firstName": grantor.get("firstName", ""),
                    "lastName": grantor.get("lastName", ""),
                    "accessTypes": access.get("accessTypes", []),
                    "expiresAt": access.get("expiresAt")
                })
        
        # Determine if there's any activity
        activity["has_activity"] = (
            len(activity["favorited_by"]) > 0 or
            len(activity["shortlisted_by"]) > 0 or
            len(activity["profile_views"]) > 0 or
            len(activity["new_matches"]) > 0 or
            len(activity["pii_requests"]) > 0 or
            len(activity["new_messages"]) > 0 or
            len(activity["expiring_access"]) > 0
        )
        
        return activity
    
    async def _queue_digest_notification(
        self,
        db,
        username: str,
        email: str,
        user: Dict[str, Any],
        activity: Dict[str, Any],
        digest_settings: Dict[str, Any],
        channels: List[str]
    ):
        """Queue the digest notification for sending via user's preferred channels."""
        
        first_name = user.get("firstName", username)
        phone = user.get("phone") or user.get("contactNumber")
        
        # Create notification queue entry with user's channel preferences
        notification = {
            "username": username,
            "trigger": "daily_digest",
            "priority": "low",
            "channels": channels,  # Use user's channel preferences
            "templateData": {
                "recipient": {
                    "username": username,
                    "firstName": first_name,
                    "email": email,
                    "phone": phone
                },
                "activity": activity,
                "stats": activity["stats"],
                "digestSettings": digest_settings,
                "generatedAt": datetime.utcnow().isoformat()
            },
            "status": "pending",
            "attempts": 0,
            "createdAt": datetime.utcnow(),
            "updatedAt": datetime.utcnow()
        }
        
        await db.notification_queue.insert_one(notification)
