"""
Daily Digest Email Job Template
Sends a consolidated daily digest email to users who have enabled this feature.
Aggregates activity from the past 24 hours (or configured period).
"""

from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
import logging
from .base import JobTemplate

logger = logging.getLogger(__name__)


class DailyDigestTemplate(JobTemplate):
    """
    Job template for sending daily digest emails.
    Collects all activity for users with digest enabled and sends a single summary email.
    """
    
    name = "daily_digest"
    description = "Send daily digest emails summarizing user activity"
    category = "notifications"
    
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
            }
        }
    
    def validate_params(self, params: Dict[str, Any]) -> bool:
        batch_size = params.get("batch_size", 50)
        hours_lookback = params.get("hours_lookback", 24)
        
        if not isinstance(batch_size, int) or batch_size < 10 or batch_size > 200:
            return False
        if not isinstance(hours_lookback, int) or hours_lookback < 12 or hours_lookback > 168:
            return False
        return True
    
    async def execute(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute the daily digest job.
        
        1. Find all users with digest enabled
        2. For each user, collect their activity from the lookback period
        3. Generate and send digest email
        4. Log results
        """
        db = context.get("db")
        params = context.get("params", {})
        
        batch_size = params.get("batch_size", 50)
        hours_lookback = params.get("hours_lookback", 24)
        dry_run = params.get("dry_run", False)
        
        if not db:
            return {
                "success": False,
                "error": "Database connection not available"
            }
        
        results = {
            "success": True,
            "users_processed": 0,
            "digests_sent": 0,
            "digests_skipped": 0,
            "errors": []
        }
        
        try:
            # Get current time and lookback period
            now = datetime.utcnow()
            lookback_time = now - timedelta(hours=hours_lookback)
            
            # Find users with digest enabled
            users_with_digest = await db.notification_preferences.find({
                "digestSettings.enabled": True
            }).to_list(length=None)
            
            logger.info(f"📬 Found {len(users_with_digest)} users with digest enabled")
            
            for user_prefs in users_with_digest:
                username = user_prefs.get("username")
                digest_settings = user_prefs.get("digestSettings", {})
                
                try:
                    # Collect activity for this user
                    activity = await self._collect_user_activity(
                        db, username, lookback_time, now, digest_settings
                    )
                    
                    results["users_processed"] += 1
                    
                    # Skip if no activity and skipIfNoActivity is enabled
                    if digest_settings.get("skipIfNoActivity", True) and not activity["has_activity"]:
                        results["digests_skipped"] += 1
                        logger.debug(f"⏭️ Skipping digest for {username} - no activity")
                        continue
                    
                    # Get user details for email
                    user = await db.users.find_one({"username": username})
                    if not user:
                        logger.warning(f"⚠️ User {username} not found, skipping")
                        continue
                    
                    email = user.get("email") or user.get("contactEmail")
                    if not email:
                        logger.warning(f"⚠️ No email for {username}, skipping")
                        continue
                    
                    # Generate and queue digest email
                    if not dry_run:
                        await self._queue_digest_email(
                            db, username, email, user, activity, digest_settings
                        )
                        results["digests_sent"] += 1
                        logger.info(f"✅ Queued digest for {username}")
                    else:
                        results["digests_sent"] += 1
                        logger.info(f"🧪 [DRY RUN] Would send digest to {username}")
                    
                except Exception as e:
                    error_msg = f"Error processing {username}: {str(e)}"
                    results["errors"].append(error_msg)
                    logger.error(f"❌ {error_msg}")
            
            logger.info(f"📊 Daily Digest Summary: {results['digests_sent']} sent, {results['digests_skipped']} skipped, {len(results['errors'])} errors")
            
        except Exception as e:
            results["success"] = False
            results["error"] = str(e)
            logger.error(f"❌ Daily digest job failed: {e}")
        
        return results
    
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
                "targetUsername": username,
                "createdAt": {"$gte": start_time, "$lte": end_time}
            }).to_list(length=50)
            
            for fav in favorites:
                actor = await db.users.find_one({"username": fav.get("username")})
                if actor:
                    activity["favorited_by"].append({
                        "username": fav.get("username"),
                        "firstName": actor.get("firstName", ""),
                        "lastName": actor.get("lastName", ""),
                        "education": actor.get("education", ""),
                        "occupation": actor.get("occupation", ""),
                        "location": actor.get("location", ""),
                        "timestamp": fav.get("createdAt")
                    })
            activity["stats"]["total_favorites"] = len(activity["favorited_by"])
        
        # Collect shortlisted by (if batching enabled)
        if digest_settings.get("batchShortlists", True):
            shortlists = await db.shortlist.find({
                "targetUsername": username,
                "createdAt": {"$gte": start_time, "$lte": end_time}
            }).to_list(length=50)
            
            for sl in shortlists:
                actor = await db.users.find_one({"username": sl.get("username")})
                if actor:
                    activity["shortlisted_by"].append({
                        "username": sl.get("username"),
                        "firstName": actor.get("firstName", ""),
                        "lastName": actor.get("lastName", ""),
                        "education": actor.get("education", ""),
                        "occupation": actor.get("occupation", ""),
                        "location": actor.get("location", ""),
                        "timestamp": sl.get("createdAt")
                    })
        
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
                        viewers[viewer_username] = {
                            "username": viewer_username,
                            "firstName": viewer.get("firstName", ""),
                            "lastName": viewer.get("lastName", ""),
                            "education": viewer.get("education", ""),
                            "occupation": viewer.get("occupation", ""),
                            "location": viewer.get("location", ""),
                            "timestamp": view.get("viewedAt")
                        }
            activity["profile_views"] = list(viewers.values())[:20]
            activity["stats"]["total_views"] = len(views)
        
        # Collect PII requests (if batching enabled - not recommended)
        if digest_settings.get("batchPiiRequests", False):
            pii_requests = await db.pii_requests.find({
                "targetUsername": username,
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
                        "requestedTypes": req.get("requestedTypes", []),
                        "timestamp": req.get("createdAt")
                    })
            activity["stats"]["total_pii_requests"] = len(activity["pii_requests"])
        
        # Collect new messages (always include summary)
        unread_messages = await db.messages.find({
            "toUsername": username,
            "read": False,
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
    
    async def _queue_digest_email(
        self,
        db,
        username: str,
        email: str,
        user: Dict[str, Any],
        activity: Dict[str, Any],
        digest_settings: Dict[str, Any]
    ):
        """Queue the digest email for sending."""
        
        first_name = user.get("firstName", username)
        
        # Create notification queue entry
        notification = {
            "username": username,
            "trigger": "daily_digest",
            "priority": "low",
            "channels": ["email"],
            "templateData": {
                "recipient": {
                    "username": username,
                    "firstName": first_name,
                    "email": email
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
