"""
Daily Digest Email Job Template
Sends a consolidated daily digest email to users who have enabled this feature.
Aggregates activity from the past 24 hours (or configured period).
"""

from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
import logging
from .base import JobTemplate, JobResult, JobExecutionContext

logger = logging.getLogger(__name__)


def extract_user_display_data(user: Dict[str, Any]) -> Dict[str, str]:
    """
    Extract display-friendly data from a user document.
    Uses the same logic as saved_search_matches_notifier for consistency.
    """
    result = {
        "education": "",
        "occupation": "",
        "profilePicture": "",
        "location": ""
    }
    
    # === EDUCATION ===
    # 1. Check educationHistory array (primary field)
    edu_history = user.get('educationHistory', [])
    if isinstance(edu_history, list) and len(edu_history) > 0:
        first_edu = edu_history[0]
        if isinstance(first_edu, dict):
            degree = first_edu.get('degree') or first_edu.get('level') or ''
            institution = first_edu.get('institution') or ''
            if degree and institution:
                result["education"] = f"{degree} from {institution}"
            elif degree:
                result["education"] = degree
            elif institution:
                result["education"] = institution
    
    # 2. Fallback to education field (can be string or array)
    if not result["education"] and user.get('education'):
        edu_data = user['education']
        if isinstance(edu_data, str) and edu_data.strip():
            result["education"] = edu_data
        elif isinstance(edu_data, list) and len(edu_data) > 0:
            first_edu = edu_data[0]
            if isinstance(first_edu, dict):
                result["education"] = first_edu.get('degree') or first_edu.get('qualification') or first_edu.get('level', '')
            elif isinstance(first_edu, str):
                result["education"] = first_edu
    
    # 3. Fallback to highestEducation or educationLevel
    if not result["education"]:
        result["education"] = user.get('highestEducation') or user.get('educationLevel') or ''
    
    # === OCCUPATION ===
    # 1. Check occupation field first
    occupation = user.get('occupation')
    if not occupation:
        # 2. Check workExperience array for current job
        work_exp = user.get('workExperience', [])
        if isinstance(work_exp, list) and len(work_exp) > 0:
            # Find current job (isCurrent=True) or use the first entry
            current_job = None
            for job in work_exp:
                if isinstance(job, dict) and job.get('isCurrent'):
                    current_job = job
                    break
            if not current_job and work_exp:
                current_job = work_exp[0] if isinstance(work_exp[0], dict) else None
            
            if current_job:
                job_title = current_job.get('jobTitle') or current_job.get('title') or current_job.get('position')
                company = current_job.get('company') or current_job.get('employer')
                if job_title:
                    occupation = f"{job_title}" + (f" at {company}" if company else "")
    
    result["occupation"] = occupation or ""
    
    # === PROFILE PICTURE ===
    # Priority: imageVisibility.profilePic > images[0] > photos[0] > profilePhoto
    profile_photo_url = ''
    
    # 1. Check imageVisibility.profilePic (new 3-bucket system)
    image_visibility = user.get('imageVisibility', {})
    if image_visibility and image_visibility.get('profilePic'):
        profile_photo_url = image_visibility['profilePic']
    
    # 2. Fallback to images array (main storage)
    if not profile_photo_url:
        images = user.get('images', [])
        if images and isinstance(images, list) and len(images) > 0:
            first_image = images[0]
            if isinstance(first_image, str):
                profile_photo_url = first_image
            elif isinstance(first_image, dict):
                profile_photo_url = first_image.get('url', first_image.get('path', ''))
    
    # 3. Fallback to photos array (legacy)
    if not profile_photo_url:
        photos = user.get('photos', [])
        if photos and isinstance(photos, list) and len(photos) > 0:
            first_photo = photos[0]
            if isinstance(first_photo, dict):
                profile_photo_url = first_photo.get('url', first_photo.get('thumbnail', ''))
            elif isinstance(first_photo, str):
                profile_photo_url = first_photo
    
    # 4. Fallback to profilePhoto/profilePicture field
    if not profile_photo_url:
        profile_photo_url = user.get('profilePhoto') or user.get('profilePicture') or user.get('photoUrl', '')
    
    result["profilePicture"] = profile_photo_url
    
    # === LOCATION ===
    # Build from city/state (not encrypted location field)
    location_parts = []
    if user.get("city"):
        location_parts.append(user.get("city"))
    if user.get("state"):
        location_parts.append(user.get("state"))
    result["location"] = ", ".join(location_parts) if location_parts else ""
    
    return result


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
            "force_send": {
                "type": "boolean",
                "label": "Force Send (Ignore Time)",
                "description": "If true, bypass preferred time check and send to all users now (for testing)",
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
            "force_send": False,
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
        force_send = params.get("force_send", False)
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
            current_hour = now.hour
            
            # Find users with digest enabled
            query = {"digestSettings.enabled": True}
            
            # If test_username is specified, only process that user
            if test_username:
                query["username"] = test_username
                context.log("info", f"🧪 Test mode: only processing user '{test_username}'")
            
            users_with_digest = await db.notification_preferences.find(query).to_list(length=None)
            
            context.log("info", f"📬 Found {len(users_with_digest)} users with digest enabled")
            
            for user_prefs in users_with_digest:
                username = user_prefs.get("username")
                digest_settings = user_prefs.get("digestSettings", {})
                
                # Check if it's the right time to send digest for this user
                preferred_time = digest_settings.get("preferredTime", "08:00")
                user_timezone = digest_settings.get("timezone", "UTC")
                
                # Parse preferred hour (e.g., "08:00" -> 8)
                try:
                    preferred_hour = int(preferred_time.split(":")[0])
                except (ValueError, AttributeError):
                    preferred_hour = 8
                
                # Convert current UTC time to user's timezone and check if it matches
                # For simplicity, we check if current UTC hour matches preferred hour
                # (For production, use pytz for proper timezone conversion)
                if user_timezone == "UTC":
                    user_current_hour = current_hour
                else:
                    # Basic timezone offset handling (simplified)
                    # In production, use: from pytz import timezone
                    user_current_hour = current_hour  # Fallback to UTC
                
                # Only process if current hour matches user's preferred hour (unless force_send is enabled)
                # This allows the job to run hourly and only send to users at their preferred time
                if not force_send and user_current_hour != preferred_hour:
                    context.log("debug", f"⏰ Skipping {username} - not their preferred time ({preferred_hour}:00, current: {user_current_hour}:00)")
                    continue
                
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
                    
                    # Generate and queue digest email
                    if not dry_run:
                        await self._queue_digest_email(
                            db, username, email, user, activity, digest_settings
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
                    display_data = extract_user_display_data(actor)
                    
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
                    display_data = extract_user_display_data(actor)
                    
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
                        display_data = extract_user_display_data(viewer)
                        
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
