# fastapi_backend/cleanup_routes.py
"""
Cleanup and Moderation API Routes
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

from database import get_database
from auth.jwt_auth import get_current_user_dependency
from profanity_filter import check_message_content, get_community_guidelines
from unified_scheduler import get_unified_scheduler
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["Cleanup & Moderation"])


# ===== PYDANTIC MODELS =====

class CleanupSettingsUpdate(BaseModel):
    cleanup_days: int


class MessageCheck(BaseModel):
    message: str


# ===== CLEANUP SETTINGS ENDPOINTS =====

@router.get("/users/cleanup-settings")
async def get_cleanup_settings(
    current_user: dict = Depends(get_current_user_dependency),
    db = Depends(get_database)
):
    """Get user's cleanup settings"""
    try:
        username = current_user.get("username")
        user = await db.users.find_one({"username": username})
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        cleanup_settings = user.get("cleanup_settings", {
            "cleanup_days": 90,  # Default
            "updated_at": None
        })
        
        return {
            "cleanup_days": cleanup_settings.get("cleanup_days", 90),
            "updated_at": cleanup_settings.get("updated_at"),
            "min_days": 30,
            "max_days": 365,
            "available_options": [30, 60, 90, 120, 180, 365]
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting cleanup settings: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/users/cleanup-settings")
async def update_cleanup_settings(
    settings: CleanupSettingsUpdate,
    current_user: dict = Depends(get_current_user_dependency),
    db = Depends(get_database)
):
    """Update user's cleanup settings"""
    try:
        username = current_user.get("username")
        
        # Validate
        if settings.cleanup_days < 30 or settings.cleanup_days > 365:
            raise HTTPException(
                status_code=400,
                detail="Cleanup days must be between 30 and 365"
            )
        
        # Update user's cleanup settings in database
        result = await db.users.update_one(
            {"username": username},
            {
                "$set": {
                    "cleanup_settings": {
                        "cleanup_days": settings.cleanup_days,
                        "updated_at": datetime.utcnow().isoformat()
                    }
                }
            }
        )
        
        if result.modified_count > 0:
            logger.info(f"✅ User {username} updated cleanup settings to {settings.cleanup_days} days")
            return {
                "success": True,
                "cleanup_days": settings.cleanup_days,
                "message": f"Cleanup period set to {settings.cleanup_days} days"
            }
        else:
            raise HTTPException(status_code=400, detail="Failed to update settings")
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating cleanup settings: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/users/cleanup-stats")
async def get_cleanup_stats(
    current_user: dict = Depends(get_current_user_dependency),
    db = Depends(get_database)
):
    """Get statistics about data that will be cleaned up"""
    try:
        username = current_user.get("username")
        
        # Get user's cleanup days
        user = await db.users.find_one({"username": username})
        cleanup_days = user.get("cleanup_settings", {}).get("cleanup_days", 90)
        
        # Calculate cutoff date
        cutoff_date = datetime.utcnow()
        from datetime import timedelta
        cutoff_date = cutoff_date - timedelta(days=cleanup_days)
        
        # Count items
        favorites_count = await db.favorites.count_documents({
            "username": username,
            "created_at": {"$lte": cutoff_date}
        })
        
        shortlist_count = await db.shortlist.count_documents({
            "username": username,
            "created_at": {"$lte": cutoff_date}
        })
        
        messages_count = await db.messages.count_documents({
            "$or": [
                {"sender": username},
                {"recipient": username}
            ],
            "timestamp": {"$lte": cutoff_date}
        })
        
        return {
            "cleanup_days": cleanup_days,
            "cutoff_date": cutoff_date.isoformat(),
            "stats": {
                "favorites": favorites_count,
                "shortlist": shortlist_count,
                "messages": messages_count,
                "total": favorites_count + shortlist_count + messages_count
            }
        }
    
    except Exception as e:
        logger.error(f"Error getting cleanup stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ===== NOTIFICATIONS ENDPOINTS =====

@router.get("/users/notifications")
async def get_notifications(
    current_user: dict = Depends(get_current_user_dependency),
    limit: int = Query(20, ge=1, le=100),
    skip: int = Query(0, ge=0),
    unread_only: bool = Query(False),
    db = Depends(get_database)
):
    """Get user's notifications"""
    try:
        username = current_user.get("username")
        
        # Build query
        query = {"username": username}
        if unread_only:
            query["read"] = False
        
        # Get notifications
        notifications_cursor = db.notifications.find(query)\
            .sort("created_at", -1)\
            .skip(skip)\
            .limit(limit)
        
        notifications = await notifications_cursor.to_list(length=limit)
        
        # Convert ObjectId to string
        for notif in notifications:
            notif["_id"] = str(notif["_id"])
        
        # Get total count
        total = await db.notifications.count_documents(query)
        unread_count = await db.notifications.count_documents({
            "username": username,
            "read": False
        })
        
        return {
            "notifications": notifications,
            "total": total,
            "unread_count": unread_count,
            "limit": limit,
            "skip": skip
        }
    
    except Exception as e:
        logger.error(f"Error getting notifications: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/users/notifications/{notification_id}/read")
async def mark_notification_read(
    notification_id: str,
    current_user: dict = Depends(get_current_user_dependency),
    db = Depends(get_database)
):
    """Mark a notification as read"""
    try:
        from bson import ObjectId
        
        username = current_user.get("username")
        
        result = await db.notifications.update_one(
            {
                "_id": ObjectId(notification_id),
                "username": username
            },
            {
                "$set": {"read": True, "read_at": datetime.utcnow()}
            }
        )
        
        if result.modified_count > 0:
            return {"success": True, "message": "Notification marked as read"}
        else:
            raise HTTPException(status_code=404, detail="Notification not found")
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error marking notification as read: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/users/notifications/mark-all-read")
async def mark_all_notifications_read(
    current_user: dict = Depends(get_current_user_dependency),
    db = Depends(get_database)
):
    """Mark all notifications as read"""
    try:
        username = current_user.get("username")
        
        result = await db.notifications.update_many(
            {"username": username, "read": False},
            {"$set": {"read": True, "read_at": datetime.utcnow()}}
        )
        
        return {
            "success": True,
            "marked_count": result.modified_count,
            "message": f"Marked {result.modified_count} notifications as read"
        }
    
    except Exception as e:
        logger.error(f"Error marking all notifications as read: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ===== PROFANITY FILTER & MODERATION ENDPOINTS =====

@router.post("/messages/check-content")
async def check_message_profanity(
    message_data: MessageCheck,
    current_user: dict = Depends(get_current_user_dependency)
):
    """Check if message contains inappropriate content"""
    try:
        result = check_message_content(message_data.message)
        
        # Log violations
        if not result["is_clean"]:
            username = current_user.get("username")
            logger.warning(
                f"⚠️ Profanity detected from {username}: "
                f"violations={result['violations']}, severity={result['severity']}"
            )
        
        return result
    
    except Exception as e:
        logger.error(f"Error checking message content: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/community-guidelines")
async def get_guidelines():
    """Get community guidelines"""
    return get_community_guidelines()


# ===== CLEANUP LOGS ENDPOINTS (Admin) =====

@router.get("/admin/cleanup-logs")
async def get_cleanup_logs(
    current_user: dict = Depends(get_current_user_dependency),
    limit: int = Query(50, ge=1, le=500),
    skip: int = Query(0, ge=0),
    db = Depends(get_database)
):
    """Get cleanup logs (Admin only)"""
    try:
        # Check if admin
        if current_user.get("role_name") != "admin":
            raise HTTPException(status_code=403, detail="Admin access required")
        
        # Get logs
        logs_cursor = db.cleanup_logs.find({})\
            .sort("cleanup_date", -1)\
            .skip(skip)\
            .limit(limit)
        
        logs = await logs_cursor.to_list(length=limit)
        
        # Convert ObjectId
        for log in logs:
            log["_id"] = str(log["_id"])
        
        total = await db.cleanup_logs.count_documents({})
        
        return {
            "logs": logs,
            "total": total,
            "limit": limit,
            "skip": skip
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting cleanup logs: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ===== ADMIN CLEANUP SETTINGS ENDPOINTS =====

@router.get("/users/{username}/cleanup-settings")
async def get_user_cleanup_settings_admin(
    username: str,
    current_user: dict = Depends(get_current_user_dependency),
    db = Depends(get_database)
):
    """Get cleanup settings for a specific user (Admin or self)"""
    try:
        requester = current_user.get("username")
        
        # Allow if admin or viewing own settings
        requester_user = await db.users.find_one({"username": requester})
        is_admin = requester_user and (requester_user.get('role_name') == 'admin' or requester == 'admin')
        
        if not is_admin and requester != username:
            raise HTTPException(status_code=403, detail="Access denied")
        
        user = await db.users.find_one({"username": username})
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        cleanup_settings = user.get("cleanup_settings", {
            "cleanup_days": 90,  # Default
            "updated_at": None
        })
        
        return {
            "cleanup_days": cleanup_settings.get("cleanup_days", 90),
            "updated_at": cleanup_settings.get("updated_at"),
            "min_days": 30,
            "max_days": 365,
            "available_options": [30, 60, 90, 120, 180, 365]
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting cleanup settings for {username}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/admin/users/{username}/cleanup-settings")
async def update_user_cleanup_settings_admin(
    username: str,
    settings: CleanupSettingsUpdate,
    current_user: dict = Depends(get_current_user_dependency),
    db = Depends(get_database)
):
    """Update cleanup settings for a specific user (Admin only)"""
    try:
        # Check if requester is admin
        requester = current_user.get("username")
        requester_user = await db.users.find_one({"username": requester})
        is_admin = requester_user and (requester_user.get('role_name') == 'admin' or requester == 'admin')
        
        if not is_admin:
            raise HTTPException(status_code=403, detail="Admin access required")
        
        # Validate
        if settings.cleanup_days < 30 or settings.cleanup_days > 365:
            raise HTTPException(
                status_code=400,
                detail="Cleanup days must be between 30 and 365"
            )
        
        # Check if user exists
        user = await db.users.find_one({"username": username})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Update settings
        result = await db.users.update_one(
            {"username": username},
            {
                "$set": {
                    "cleanup_settings": {
                        "cleanup_days": settings.cleanup_days,
                        "updated_at": datetime.utcnow().isoformat(),
                        "updated_by": requester
                    }
                }
            }
        )
        
        if result.modified_count > 0:
            logger.info(f"✅ Admin {requester} updated cleanup settings for {username}: {settings.cleanup_days} days")
            return {
                "success": True,
                "cleanup_days": settings.cleanup_days,
                "message": f"Cleanup period set to {settings.cleanup_days} days for {username}"
            }
        else:
            raise HTTPException(status_code=400, detail="Failed to update settings")
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating cleanup settings for {username}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ===== SCHEDULER STATUS ENDPOINT =====

@router.get("/admin/scheduler-status")
async def get_scheduler_status(
    current_user: dict = Depends(get_current_user_dependency),
    db = Depends(get_database)
):
    """Get status of all scheduled jobs (Admin only)"""
    try:
        # Check if requester is admin
        requester = current_user.get("username")
        requester_user = await db.users.find_one({"username": requester})
        is_admin = requester_user and (requester_user.get('role_name') == 'admin' or requester == 'admin')
        
        if not is_admin:
            raise HTTPException(status_code=403, detail="Admin access required")
        
        # Get scheduler instance
        scheduler = get_unified_scheduler()
        
        if not scheduler:
            return {
                "status": "not_initialized",
                "jobs": [],
                "message": "Unified scheduler not initialized"
            }
        
        # Get job status
        jobs_status = scheduler.get_job_status()
        
        return {
            "status": "running" if scheduler.is_running else "stopped",
            "total_jobs": len(jobs_status),
            "jobs": jobs_status
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting scheduler status: {e}")
        raise HTTPException(status_code=500, detail=str(e))
