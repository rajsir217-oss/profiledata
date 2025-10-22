"""
Notification API Routes
Communication & Notification Module endpoints
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional, List
from datetime import datetime

from models.notification_models import (
    NotificationPreferences,
    NotificationPreferencesUpdate,
    NotificationQueueCreate,
    NotificationQueueItem,
    NotificationResponse,
    NotificationTrigger,
    NotificationChannel,
    NotificationAnalytics
)
from services.notification_service import NotificationService
from database import get_database
from auth.jwt_auth import get_current_user_dependency as get_current_user

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


def get_notification_service(db=Depends(get_database)) -> NotificationService:
    """Dependency to get notification service"""
    return NotificationService(db)


# ============================================
# Notification Preferences Endpoints
# ============================================

@router.get("/preferences", response_model=NotificationPreferences)
async def get_notification_preferences(
    current_user: dict = Depends(get_current_user),
    service: NotificationService = Depends(get_notification_service)
):
    """Get user's notification preferences (creates defaults if not found)"""
    print(f"✅ GET /preferences - User: {current_user.get('username')}")
    prefs = await service.get_preferences(current_user["username"])
    if not prefs:
        # Auto-create default preferences for new users
        prefs = await service.create_default_preferences(current_user["username"])
    return prefs


@router.put("/preferences", response_model=NotificationResponse)
async def update_notification_preferences(
    updates: NotificationPreferencesUpdate,
    current_user: dict = Depends(get_current_user),
    service: NotificationService = Depends(get_notification_service)
):
    """Update user's notification preferences"""
    print(f"✅ PUT /preferences - User: {current_user.get('username')}, Updates: {updates.dict(exclude_unset=True)}")
    try:
        prefs = await service.update_preferences(
            current_user["username"],
            updates.dict(exclude_unset=True)
        )
        return NotificationResponse(
            success=True,
            message="Preferences updated successfully",
            data=prefs.dict()
        )
    except Exception as e:
        print(f"❌ PUT /preferences - Error: {e}")
        return NotificationResponse(
            success=False,
            message="Failed to update preferences",
            error=str(e)
        )


@router.post("/preferences/reset", response_model=NotificationResponse)
async def reset_notification_preferences(
    current_user: dict = Depends(get_current_user),
    service: NotificationService = Depends(get_notification_service)
):
    """Reset preferences to defaults"""
    try:
        # Delete existing preferences
        await service.preferences_collection.delete_one({"username": current_user["username"]})
        
        # Create new defaults
        prefs = await service.create_default_preferences(current_user["username"])
        
        return NotificationResponse(
            success=True,
            message="Preferences reset to defaults",
            data=prefs.dict()
        )
    except Exception as e:
        return NotificationResponse(
            success=False,
            message="Failed to reset preferences",
            error=str(e)
        )


# ============================================
# Notification Queue Endpoints
# ============================================

@router.post("/send", response_model=NotificationResponse)
async def send_notification(
    notification: NotificationQueueCreate,
    current_user: dict = Depends(get_current_user),
    service: NotificationService = Depends(get_notification_service)
):
    """
    Send a notification (queues for delivery)
    Admin or system can send to any user
    """
    try:
        queue_item = await service.enqueue_notification(notification)
        return NotificationResponse(
            success=True,
            message="Notification queued successfully",
            data=queue_item.dict()
        )
    except HTTPException as e:
        return NotificationResponse(
            success=False,
            message=e.detail,
            error=str(e)
        )
    except Exception as e:
        return NotificationResponse(
            success=False,
            message="Failed to queue notification",
            error=str(e)
        )


@router.get("/queue", response_model=List[NotificationQueueItem])
async def get_notification_queue(
    status: Optional[str] = Query(None),
    limit: int = Query(50, le=100),
    current_user: dict = Depends(get_current_user),
    service: NotificationService = Depends(get_notification_service)
):
    """Get notification queue (admin sees all, regular users see only theirs)"""
    # Build query based on user role
    query = {}
    
    # Check if user is admin
    user_role = current_user.get("role", "free_user")
    is_admin = (user_role == "admin" or current_user["username"] == "admin")
    
    # Non-admins only see their own notifications
    if not is_admin:
        query["username"] = current_user["username"]
    # Admins see all notifications (no username filter)
    
    if status:
        query["status"] = status
    
    cursor = service.queue_collection.find(query).limit(limit)
    notifications = []
    
    async for doc in cursor:
        # Convert ObjectId to string for JSON serialization
        if "_id" in doc:
            doc["_id"] = str(doc["_id"])
        notifications.append(NotificationQueueItem(**doc))
    
    return notifications


@router.delete("/queue/{notification_id}", response_model=NotificationResponse)
async def cancel_notification(
    notification_id: str,
    hard_delete: bool = Query(False, description="If true, permanently delete from database"),
    current_user: dict = Depends(get_current_user),
    service: NotificationService = Depends(get_notification_service)
):
    """Cancel or permanently delete a notification"""
    try:
        from bson import ObjectId
        
        # Convert string ID to ObjectId
        try:
            obj_id = ObjectId(notification_id)
        except:
            raise HTTPException(status_code=400, detail="Invalid notification ID")
        
        # Build query - admin can delete any notification, users can only delete their own
        is_admin = current_user.get("username") == "admin"
        base_query = {"_id": obj_id}
        if not is_admin:
            base_query["username"] = current_user["username"]
        
        if hard_delete:
            # Hard delete: Remove from database entirely
            result = await service.queue_collection.delete_one(base_query)
            
            if result.deleted_count == 0:
                raise HTTPException(status_code=404, detail="Notification not found")
            
            return NotificationResponse(
                success=True,
                message="Notification permanently deleted"
            )
        else:
            # Soft delete: Mark as cancelled
            query = {**base_query, "status": {"$in": ["pending", "scheduled"]}}
            result = await service.queue_collection.update_one(
                query,
                {"$set": {"status": "cancelled", "updatedAt": datetime.utcnow()}}
            )
            
            if result.matched_count == 0:
                raise HTTPException(status_code=404, detail="Notification not found or already sent")
            
            return NotificationResponse(
                success=True,
                message="Notification cancelled successfully"
            )
    except Exception as e:
        return NotificationResponse(
            success=False,
            message="Failed to cancel notification",
            error=str(e)
        )


# ============================================
# Analytics Endpoints
# ============================================

@router.get("/analytics", response_model=NotificationAnalytics)
async def get_notification_analytics(
    trigger: Optional[NotificationTrigger] = Query(None),
    channel: Optional[NotificationChannel] = Query(None),
    days: int = Query(30, ge=1, le=365),
    current_user: dict = Depends(get_current_user),
    service: NotificationService = Depends(get_notification_service)
):
    """Get notification analytics (admin sees global, users see their own)"""
    # Check if user is admin
    user_role = current_user.get("role", "free_user")
    is_admin = (user_role == "admin" or current_user["username"] == "admin")
    
    end_date = datetime.utcnow()
    start_date = end_date - timedelta(days=days)
    
    # Admins get global stats, regular users get their own
    username = None if is_admin else current_user["username"]
    
    stats = await service.get_analytics(
        username=username,
        trigger=trigger,
        channel=channel,
        start_date=start_date,
        end_date=end_date
    )
    
    # Add queue counts for Event Queue Manager
    queue_query = {"username": username} if username else {}
    queued = await service.queue_collection.count_documents({**queue_query, "status": {"$in": ["pending", "scheduled"]}})
    processing = await service.queue_collection.count_documents({**queue_query, "status": "processing"})
    
    # Count recent logs for 24h stats
    yesterday = datetime.utcnow() - timedelta(days=1)
    log_query = {"username": username, "createdAt": {"$gte": yesterday}} if username else {"createdAt": {"$gte": yesterday}}
    success_24h = await service.log_collection.count_documents({**log_query, "status": {"$in": ["sent", "delivered"]}})
    failed_24h = await service.log_collection.count_documents({**log_query, "status": "failed"})
    
    return NotificationAnalytics(
        username=username,
        trigger=trigger,
        channel=channel,
        startDate=start_date,
        endDate=end_date,
        queued=queued,
        processing=processing,
        success_24h=success_24h,
        failed_24h=failed_24h,
        **stats
    )


@router.get("/analytics/global", response_model=NotificationAnalytics)
async def get_global_analytics(
    trigger: Optional[NotificationTrigger] = Query(None),
    channel: Optional[NotificationChannel] = Query(None),
    days: int = Query(30, ge=1, le=365),
    current_user: dict = Depends(get_current_user),
    service: NotificationService = Depends(get_notification_service)
):
    """Get global notification analytics (admin only)"""
    # TODO: Add admin check
    if current_user["username"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    end_date = datetime.utcnow()
    start_date = end_date - timedelta(days=days)
    
    stats = await service.get_analytics(
        trigger=trigger,
        channel=channel,
        start_date=start_date,
        end_date=end_date
    )
    
    return NotificationAnalytics(
        trigger=trigger,
        channel=channel,
        startDate=start_date,
        endDate=end_date,
        **stats
    )


# ============================================
# Notification Logs Endpoint
# ============================================

@router.get("/logs")
async def get_notification_logs(
    current_user: dict = Depends(get_current_user),
    limit: int = Query(100, ge=1, le=500),
    skip: int = Query(0, ge=0),
    service: NotificationService = Depends(get_notification_service)
):
    """Get notification logs (sent notifications history)"""
    # Check if user is admin
    user_role = current_user.get("role", "free_user")
    is_admin = (user_role == "admin" or current_user["username"] == "admin")
    
    # Build query based on role
    query = {} if is_admin else {"username": current_user["username"]}
    
    logs = await service.db["notification_log"].find(
        query
    ).sort("sent_at", -1).skip(skip).limit(limit).to_list(length=limit)
    
    # Serialize ObjectId
    for log in logs:
        log["_id"] = str(log["_id"])
    
    return logs


@router.delete("/logs/{log_id}")
async def delete_notification_log(
    log_id: str,
    current_user: dict = Depends(get_current_user),
    service: NotificationService = Depends(get_notification_service)
):
    """Delete a notification log entry"""
    try:
        from bson import ObjectId
        
        # Convert string ID to ObjectId
        try:
            obj_id = ObjectId(log_id)
        except:
            raise HTTPException(status_code=400, detail="Invalid log ID")
        
        # Admin can delete any log, users can only delete their own
        is_admin = current_user.get("username") == "admin"
        query = {"_id": obj_id}
        if not is_admin:
            query["username"] = current_user["username"]
        
        result = await service.db["notification_log"].delete_one(query)
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Log entry not found")
        
        return {"success": True, "message": "Log entry deleted"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# Tracking Endpoints (for email/SMS links)
# ============================================

@router.get("/track/open/{log_id}")
async def track_notification_open(
    log_id: str,
    service: NotificationService = Depends(get_notification_service)
):
    """Track notification opened (embedded tracking pixel)"""
    try:
        await service.track_open(log_id)
        # Return 1x1 transparent GIF
        return Response(
            content=b'\x47\x49\x46\x38\x39\x61\x01\x00\x01\x00\x00\x00\x00\x21\xf9\x04\x01\x00\x00\x00\x00\x2c\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x00\x3b',
            media_type="image/gif"
        )
    except:
        return Response(status_code=204)


@router.get("/track/click/{log_id}")
async def track_notification_click(
    log_id: str,
    redirect_url: str = Query(...),
    service: NotificationService = Depends(get_notification_service)
):
    """Track link clicked in notification and redirect"""
    try:
        await service.track_click(log_id)
    except:
        pass  # Don't break redirect on tracking failure
    
    return RedirectResponse(url=redirect_url)


# ============================================
# Subscription Management
# ============================================

@router.post("/unsubscribe", response_model=NotificationResponse)
async def unsubscribe_all(
    current_user: dict = Depends(get_current_user),
    service: NotificationService = Depends(get_notification_service)
):
    """Unsubscribe from all notifications"""
    try:
        await service.update_preferences(
            current_user["username"],
            {
                "channels": {},  # Clear all channel preferences
                "updatedAt": datetime.utcnow()
            }
        )
        
        return NotificationResponse(
            success=True,
            message="Successfully unsubscribed from all notifications"
        )
    except Exception as e:
        return NotificationResponse(
            success=False,
            message="Failed to unsubscribe",
            error=str(e)
        )


@router.post("/unsubscribe/{trigger}", response_model=NotificationResponse)
async def unsubscribe_trigger(
    trigger: NotificationTrigger,
    current_user: dict = Depends(get_current_user),
    service: NotificationService = Depends(get_notification_service)
):
    """Unsubscribe from specific notification type"""
    try:
        prefs = await service.get_preferences(current_user["username"])
        
        # Remove trigger from channels
        if trigger in prefs.channels:
            del prefs.channels[trigger]
        
        await service.update_preferences(
            current_user["username"],
            {"channels": prefs.channels, "updatedAt": datetime.utcnow()}
        )
        
        return NotificationResponse(
            success=True,
            message=f"Unsubscribed from {trigger} notifications"
        )
    except Exception as e:
        return NotificationResponse(
            success=False,
            message="Failed to unsubscribe",
            error=str(e)
        )


# Add missing imports
from fastapi.responses import Response, RedirectResponse
from datetime import timedelta
