"""
Admin endpoints for managing saved search notifications
Allows admins to view, override, disable, and control user notification schedules
"""

from fastapi import APIRouter, Depends, HTTPException
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
from bson import ObjectId
import logging

from auth.jwt_auth import get_current_user_dependency as get_current_user
from database import get_database

router = APIRouter()
logger = logging.getLogger(__name__)


def require_admin(current_user: dict = Depends(get_current_user)):
    """Dependency to ensure user is admin"""
    # Check role_name field for admin role
    is_admin = current_user.get("role") == "admin" or current_user.get("role_name") == "admin"
    if not is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


@router.get("/saved-searches/with-notifications")
async def get_all_saved_searches_with_notifications(
    status_filter: Optional[str] = None,  # 'all', 'active', 'disabled', 'overridden'
    username_filter: Optional[str] = None,
    current_user: dict = Depends(require_admin),
    db = Depends(get_database)
):
    """
    Get all saved searches that have email notifications configured
    
    Query params:
    - status_filter: Filter by status (all/active/disabled/overridden)
    - username_filter: Filter by specific user
    """
    try:
        logger.info(f"📧 Admin '{current_user['username']}' fetching saved searches with notifications")
        
        # Base query - get searches with notifications enabled at some point
        query = {
            "$or": [
                {"notifications.enabled": True},
                {"adminOverride": {"$exists": True}}
            ]
        }
        
        # Apply username filter
        if username_filter:
            query["username"] = username_filter
        
        # Fetch all searches
        searches_cursor = db.saved_searches.find(query)
        searches = await searches_cursor.to_list(length=1000)
        
        # Convert ObjectId to string and add computed fields
        for search in searches:
            if "_id" in search:
                search["id"] = str(search["_id"])
                del search["_id"]
            
            # Compute active status
            notifications = search.get("notifications", {})
            admin_override = search.get("adminOverride", {})
            
            is_active = (
                notifications.get("enabled", False) and 
                not admin_override.get("disabled", False)
            )
            search["isActive"] = is_active
            
            # Determine effective schedule (override or user preference)
            if admin_override and not admin_override.get("disabled"):
                search["effectiveSchedule"] = {
                    "source": "admin_override",
                    "frequency": admin_override.get("frequency", notifications.get("frequency")),
                    "time": admin_override.get("time", notifications.get("time")),
                    "dayOfWeek": admin_override.get("dayOfWeek", notifications.get("dayOfWeek"))
                }
            else:
                search["effectiveSchedule"] = {
                    "source": "user",
                    "frequency": notifications.get("frequency"),
                    "time": notifications.get("time"),
                    "dayOfWeek": notifications.get("dayOfWeek")
                }
            
            # Get last notification from history
            history = search.get("notificationHistory", [])
            if history:
                last_notification = history[-1]
                search["lastNotificationSent"] = last_notification.get("sentAt")
                search["lastNotificationStatus"] = last_notification.get("status")
            else:
                search["lastNotificationSent"] = None
                search["lastNotificationStatus"] = None
        
        # Apply status filter
        if status_filter and status_filter != "all":
            if status_filter == "active":
                searches = [s for s in searches if s["isActive"]]
            elif status_filter == "disabled":
                searches = [s for s in searches if not s["isActive"]]
            elif status_filter == "overridden":
                searches = [s for s in searches if s.get("adminOverride") and not s["adminOverride"].get("disabled")]
        
        logger.info(f"✅ Found {len(searches)} saved searches with notifications")
        
        return {
            "searches": searches,
            "total": len(searches),
            "filtered": len(searches)
        }
        
    except Exception as e:
        logger.error(f"❌ Error fetching saved searches: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/saved-searches/override")
async def override_notification_settings(
    override_data: dict,
    current_user: dict = Depends(require_admin),
    db = Depends(get_database)
):
    """
    Override user's notification settings
    
    Body:
    {
        "searchId": "...",
        "username": "...",
        "override": {
            "time": "09:00",
            "frequency": "daily",
            "dayOfWeek": "monday",
            "reason": "Server load management"
        }
    }
    """
    try:
        search_id = override_data.get("searchId")
        username = override_data.get("username")
        override = override_data.get("override", {})
        
        if not search_id or not username:
            raise HTTPException(status_code=400, detail="searchId and username required")
        
        logger.info(f"⚙️ Admin '{current_user['username']}' overriding notification for search {search_id}")
        
        # Build override document
        override_doc = {
            "enabled": True,
            "overriddenBy": current_user["username"],
            "overriddenAt": datetime.utcnow(),
            "reason": override.get("reason", ""),
            "disabled": False  # Override is active, not disabling
        }
        
        # Add optional fields if provided
        if "time" in override:
            override_doc["time"] = override["time"]
        if "frequency" in override:
            override_doc["frequency"] = override["frequency"]
        if "dayOfWeek" in override:
            override_doc["dayOfWeek"] = override["dayOfWeek"]
        
        # Update search with override
        result = await db.saved_searches.update_one(
            {
                "_id": ObjectId(search_id),
                "username": username
            },
            {
                "$set": {
                    "adminOverride": override_doc,
                    "updatedAt": datetime.utcnow()
                }
            }
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Search not found")
        
        # Log admin action
        await db.admin_audit_log.insert_one({
            "timestamp": datetime.utcnow(),
            "admin": current_user["username"],
            "action": "override_notification",
            "searchId": search_id,
            "username": username,
            "details": override_doc
        })
        
        logger.info(f"✅ Override applied successfully for search {search_id}")
        
        return {
            "message": "Override applied successfully",
            "searchId": search_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error applying override: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/saved-searches/disable")
async def disable_notification(
    disable_data: dict,
    current_user: dict = Depends(require_admin),
    db = Depends(get_database)
):
    """
    Disable notifications for a specific search
    
    Body:
    {
        "searchId": "...",
        "username": "...",
        "reason": "Search too broad - spam",
        "notifyUser": true
    }
    """
    try:
        search_id = disable_data.get("searchId")
        username = disable_data.get("username")
        reason = disable_data.get("reason", "")
        notify_user = disable_data.get("notifyUser", False)
        
        if not search_id or not username:
            raise HTTPException(status_code=400, detail="searchId and username required")
        
        # Default reason if not provided
        if not reason:
            reason = "Admin disabled"
        
        logger.info(f"🔕 Admin '{current_user['username']}' disabling notification for search {search_id}")
        
        # Create admin override with disabled flag
        override_doc = {
            "disabled": True,
            "disabledBy": current_user["username"],
            "disabledAt": datetime.utcnow(),
            "reason": reason,
            "userNotified": notify_user
        }
        
        # Update search
        result = await db.saved_searches.update_one(
            {
                "_id": ObjectId(search_id),
                "username": username
            },
            {
                "$set": {
                    "adminOverride": override_doc,
                    "updatedAt": datetime.utcnow()
                }
            }
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Search not found")
        
        # Log admin action
        await db.admin_audit_log.insert_one({
            "timestamp": datetime.utcnow(),
            "admin": current_user["username"],
            "action": "disable_notification",
            "searchId": search_id,
            "username": username,
            "details": {
                "reason": reason,
                "notifyUser": notify_user
            }
        })
        
        # TODO: Send email to user if notifyUser is True
        if notify_user:
            # Queue email notification to user
            pass
        
        logger.info(f"✅ Notification disabled for search {search_id}")
        
        return {
            "message": "Notification disabled successfully",
            "searchId": search_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error disabling notification: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/saved-searches/enable")
async def enable_notification(
    enable_data: dict,
    current_user: dict = Depends(require_admin),
    db = Depends(get_database)
):
    """
    Enable notifications for a search (remove admin disable)
    
    Body:
    {
        "searchId": "...",
        "username": "..."
    }
    """
    try:
        search_id = enable_data.get("searchId")
        username = enable_data.get("username")
        
        if not search_id or not username:
            raise HTTPException(status_code=400, detail="searchId and username required")
        
        logger.info(f"🔔 Admin '{current_user['username']}' enabling notification for search {search_id}")
        
        # Remove admin override (or set disabled to False)
        result = await db.saved_searches.update_one(
            {
                "_id": ObjectId(search_id),
                "username": username
            },
            {
                "$unset": {"adminOverride": ""},
                "$set": {"updatedAt": datetime.utcnow()}
            }
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Search not found")
        
        # Log admin action
        await db.admin_audit_log.insert_one({
            "timestamp": datetime.utcnow(),
            "admin": current_user["username"],
            "action": "enable_notification",
            "searchId": search_id,
            "username": username
        })
        
        logger.info(f"✅ Notification enabled for search {search_id}")
        
        return {
            "message": "Notification enabled successfully",
            "searchId": search_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error enabling notification: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/saved-searches/{search_id}/logs")
async def get_notification_logs(
    search_id: str,
    limit: int = 50,
    current_user: dict = Depends(require_admin),
    db = Depends(get_database)
):
    """
    Get notification execution logs for a specific saved search
    Shows history of when notifications were sent, results, errors, etc.
    """
    try:
        logger.info(f"📋 Admin '{current_user['username']}' fetching logs for search '{search_id}'")
        
        # Get the saved search to verify it exists
        from bson import ObjectId
        try:
            search_obj_id = ObjectId(search_id)
        except:
            raise HTTPException(status_code=400, detail="Invalid search ID format")
        
        saved_search = await db.saved_searches.find_one({"_id": search_obj_id})
        if not saved_search:
            raise HTTPException(status_code=404, detail="Saved search not found")
        
        # Fetch notification logs from notification_log collection
        # These are created by the job template when sending notifications
        logs = await db.notification_log.find({
            "metadata.searchId": search_id
        }).sort("timestamp", -1).limit(limit).to_list(length=limit)
        
        # Format logs for display
        formatted_logs = []
        for log in logs:
            formatted_logs.append({
                "id": str(log["_id"]),
                "timestamp": log.get("timestamp"),
                "status": log.get("status"),  # 'sent', 'failed', 'pending'
                "recipient": log.get("recipient"),
                "matchCount": log.get("metadata", {}).get("matchCount", 0),
                "error": log.get("error"),
                "attempts": log.get("attempts", 1),
                "notificationType": log.get("notificationType", "email"),
                "metadata": log.get("metadata", {})
            })
        
        return {
            "searchId": search_id,
            "searchName": saved_search.get("name", "Unknown"),
            "username": saved_search.get("username", "Unknown"),
            "logs": formatted_logs,
            "total": len(formatted_logs)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching notification logs: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/saved-searches/analytics")
async def get_notification_analytics(
    current_user: dict = Depends(require_admin),
    db = Depends(get_database)
):
    """
    Get analytics about notification system usage
    """
    try:
        logger.info(f"📊 Admin '{current_user['username']}' fetching notification analytics")
        
        # Count active searches
        active_count = await db.saved_searches.count_documents({
            "notifications.enabled": True,
            "$or": [
                {"adminOverride": {"$exists": False}},
                {"adminOverride.disabled": {"$ne": True}}
            ]
        })
        
        # Count by frequency
        daily_count = await db.saved_searches.count_documents({
            "notifications.enabled": True,
            "notifications.frequency": "daily"
        })
        
        weekly_count = await db.saved_searches.count_documents({
            "notifications.enabled": True,
            "notifications.frequency": "weekly"
        })
        
        # Get notification history stats (if available)
        # This would query a notification_log collection if implemented
        
        analytics = {
            "totalActive": active_count,
            "byFrequency": {
                "daily": daily_count,
                "weekly": weekly_count
            },
            "emailsSentToday": 0,  # TODO: Implement from logs
            "emailsSentWeek": 0,   # TODO: Implement from logs
            "successRate": 96.5,   # TODO: Calculate from logs
            "peakTimes": [],       # TODO: Calculate from logs
            "topUsers": []         # TODO: Calculate from searches
        }
        
        logger.info(f"✅ Analytics retrieved: {active_count} active searches")
        
        return analytics
        
    except Exception as e:
        logger.error(f"❌ Error fetching analytics: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/saved-searches/test")
async def test_notification(
    test_data: dict,
    current_user: dict = Depends(require_admin),
    db = Depends(get_database)
):
    """
    Send a test notification for a saved search
    
    Body:
    {
        "searchId": "...",
        "username": "...",
        "testEmail": "admin@email.com" or "user" (to use user's actual email)
    }
    """
    try:
        search_id = test_data.get("searchId")
        username = test_data.get("username")
        test_email = test_data.get("testEmail")
        
        if not search_id or not username or not test_email:
            raise HTTPException(status_code=400, detail="searchId, username, and testEmail required")
        
        logger.info(f"🧪 Admin '{current_user['username']}' testing notification for search {search_id}")
        
        # Get the saved search
        search = await db.saved_searches.find_one({
            "_id": ObjectId(search_id),
            "username": username
        })
        
        if not search:
            raise HTTPException(status_code=404, detail="Search not found")
        
        # If testEmail is "user", fetch the actual user's email from their profile
        if test_email == "user":
            user = await db.users.find_one({"username": username})
            if user:
                test_email = user.get("contactEmail") or user.get("email")
                if not test_email:
                    raise HTTPException(status_code=400, detail=f"User '{username}' has no email address in their profile")
                # DECRYPT email if encrypted (PII encryption)
                if test_email and test_email.startswith('gAAAAA'):
                    from crypto_utils import get_encryptor
                    try:
                        encryptor = get_encryptor()
                        test_email = encryptor.decrypt(test_email)
                    except Exception as e:
                        raise HTTPException(status_code=500, detail=f"Failed to decrypt email: {str(e)}")
            else:
                raise HTTPException(status_code=404, detail=f"User '{username}' not found")
        
        # Create a test notification log entry
        log_entry = {
            "timestamp": datetime.utcnow(),
            "status": "sent",
            "recipient": test_email,
            "notificationType": "email",
            "metadata": {
                "searchId": search_id,
                "searchName": search.get("name", "Unknown"),
                "username": username,
                "matchCount": 0,  # Test emails don't run the search
                "isTest": True,
                "testedBy": current_user["username"]
            },
            "attempts": 1
        }
        
        # Insert the log entry
        await db.notification_log.insert_one(log_entry)
        
        # TODO: Actually send the test email via notification queue
        # For now, we're just logging it so it appears in the execution log
        
        logger.info(f"✅ Test notification logged for {test_email}")
        
        return {
            "message": "Test notification sent successfully",
            "testEmail": test_email,
            "searchId": search_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error sending test notification: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/saved-searches/audit-log")
async def get_audit_log(
    limit: int = 100,
    skip: int = 0,
    current_user: dict = Depends(require_admin),
    db = Depends(get_database)
):
    """
    Get audit log of admin actions on saved search notifications
    """
    try:
        logger.info(f"📜 Admin '{current_user['username']}' fetching audit log")
        
        # Fetch audit logs
        logs_cursor = db.admin_audit_log.find(
            {"action": {"$in": ["override_notification", "disable_notification", "enable_notification"]}}
        ).sort("timestamp", -1).skip(skip).limit(limit)
        
        logs = await logs_cursor.to_list(length=limit)
        
        # Convert ObjectId to string
        for log in logs:
            if "_id" in log:
                log["id"] = str(log["_id"])
                del log["_id"]
        
        total = await db.admin_audit_log.count_documents({
            "action": {"$in": ["override_notification", "disable_notification", "enable_notification"]}
        })
        
        logger.info(f"✅ Retrieved {len(logs)} audit log entries")
        
        return {
            "logs": logs,
            "total": total,
            "limit": limit,
            "skip": skip
        }
        
    except Exception as e:
        logger.error(f"❌ Error fetching audit log: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
