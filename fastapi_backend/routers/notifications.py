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
    NotificationAnalytics,
    ScheduledNotification,
    ScheduledNotificationCreate,
    ScheduledNotificationUpdate
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
    include_all: bool = Query(False, description="Include all statuses (sent, failed, skipped)"),
    limit: int = Query(50, le=100),
    current_user: dict = Depends(get_current_user),
    service: NotificationService = Depends(get_notification_service)
):
    """Get notification queue (admin sees all, regular users see only theirs)"""
    # Build query based on user role
    query = {}
    
    # Check if user is admin (support both 'role' and 'role_name' fields)
    user_role = current_user.get("role") or current_user.get("role_name", "free_user")
    is_admin = (user_role == "admin" or current_user["username"] == "admin")
    
    # Non-admins only see their own notifications
    if not is_admin:
        query["username"] = current_user["username"]
    # Admins see all notifications (no username filter)
    
    # Filter by status
    if status:
        query["status"] = status
    elif not include_all:
        # Default: only show items that haven't been sent yet
        query["status"] = {"$in": ["pending", "scheduled", "processing"]}
    # If include_all=True, don't filter by status (show all)
    
    cursor = service.queue_collection.find(query).sort("createdAt", -1).limit(limit)
    notifications = []
    
    async for doc in cursor:
        # Convert ObjectId to string for JSON serialization
        if "_id" in doc:
            doc["_id"] = str(doc["_id"])
        
        # Transform MongoDB document to match Pydantic model
        # Old schema: recipient.username, channel (singular)
        # New schema: username, channels (list)
        transformed = {
            "_id": doc.get("_id"),
            "username": doc.get("recipient", {}).get("username") if "recipient" in doc else doc.get("username", "unknown"),
            "trigger": doc.get("trigger"),
            "priority": doc.get("priority", "medium"),
            "channels": [doc.get("channel")] if "channel" in doc else doc.get("channels", ["email"]),
            "templateData": doc.get("data", doc.get("templateData", {})),
            "status": doc.get("status", "pending"),
            "scheduledFor": doc.get("scheduledFor"),
            "attempts": doc.get("attempts", 0),
            "lastAttempt": doc.get("lastAttempt"),
            "error": doc.get("error"),
            "createdAt": doc.get("createdAt"),
            "updatedAt": doc.get("updatedAt")
        }
        
        try:
            notifications.append(NotificationQueueItem(**transformed))
        except Exception as e:
            # If validation still fails, skip this item with a warning
            print(f"⚠️ Skipping invalid notification {doc.get('_id')}: {e}")
            continue
    
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
    # Count items that are pending or scheduled (not yet sent/failed)
    queue_query = {"username": username} if username else {}
    queued = await service.queue_collection.count_documents({
        **queue_query, 
        "status": {"$in": ["pending", "scheduled"]}
    })
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
    # Check if user is admin (support both 'role' and 'role_name' fields)
    user_role = current_user.get("role") or current_user.get("role_name", "free_user")
    username = current_user.get("username", "")
    is_admin = (user_role == "admin" or username == "admin")
    
    # Build query based on role
    query = {} if is_admin else {"username": username}
    
    # Debug logging
    import logging
    logger = logging.getLogger(__name__)
    logger.info(f"📋 Fetching notification logs - user: {username}, role: {user_role}, is_admin: {is_admin}, query: {query}")
    
    logs = await service.db["notification_log"].find(
        query
    ).sort("sentAt", -1).skip(skip).limit(limit).to_list(length=limit)
    
    logger.info(f"📋 Found {len(logs)} notification logs")
    
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


# ============================================
# Template Management Endpoints
# ============================================

@router.get("/templates")
async def get_templates(
    channel: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    include_job_templates: bool = Query(False),  # Default to False - job templates have import issues
    current_user: dict = Depends(get_current_user),
    service: NotificationService = Depends(get_notification_service)
):
    """Get all notification templates (admin only)"""
    # Skip job templates by default to avoid import errors
    if include_job_templates:
        print(f"⚠️ Warning: Job template loading may produce import errors")
    print(f"📧 GET /templates - User: {current_user.get('username')}")
    print(f"   Filters: channel={channel}, category={category}, include_job_templates={include_job_templates}")
    
    try:
        # Build query
        query = {}
        if channel:
            query["channel"] = channel
        if category:
            query["category"] = category
        
        # Fetch notification templates from database
        templates_cursor = service.db.notification_templates.find(query)
        templates = await templates_cursor.to_list(length=None)
        
        # Convert ObjectId to string
        for template in templates:
            if "_id" in template:
                template["_id"] = str(template["_id"])
            template["type"] = "notification"  # Mark as notification template
        
        # Optionally include job templates
        if include_job_templates:
            import os
            import importlib.util
            
            job_templates_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "job_templates")
            
            if os.path.exists(job_templates_dir):
                for filename in os.listdir(job_templates_dir):
                    if filename.endswith(".py") and not filename.startswith("__"):
                        try:
                            filepath = os.path.join(job_templates_dir, filename)
                            spec = importlib.util.spec_from_file_location(filename[:-3], filepath)
                            module = importlib.util.module_from_spec(spec)
                            spec.loader.exec_module(module)
                            
                            if hasattr(module, 'TEMPLATE'):
                                job_template = module.TEMPLATE
                                template_type_value = filename[:-3]  # e.g., "weekly_digest_notifier"
                                templates.append({
                                    "_id": f"job_{template_type_value}",
                                    "template_type": template_type_value,  # For Dynamic Scheduler matching
                                    "trigger": template_type_value.replace("_", " ").title(),
                                    "channel": "job",
                                    "category": job_template.get("metadata", {}).get("category", "system"),
                                    "subject": job_template.get("name", "Unknown Job"),
                                    "body": job_template.get("description", ""),
                                    "active": job_template.get("enabled", True),
                                    "type": "job",  # Mark as job template
                                    "schedule": job_template.get("schedule", ""),
                                    "tags": job_template.get("tags", [])
                                })
                        except Exception as e:
                            # Silently skip job templates with import errors
                            # These use relative imports which fail when loaded dynamically
                            pass
        
        print(f"✅ Found {len(templates)} templates")
        return templates
        
    except Exception as e:
        print(f"❌ Error fetching templates: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to fetch templates: {str(e)}")


@router.get("/templates/{template_id}")
async def get_template(
    template_id: str,
    current_user: dict = Depends(get_current_user),
    service: NotificationService = Depends(get_notification_service)
):
    """Get a specific template by ID or trigger name (admin only)"""
    try:
        from bson import ObjectId
        
        # Try to query by ObjectId first, then by trigger name
        try:
            # If it's a valid ObjectId, query by _id
            template = await service.db.notification_templates.find_one({"_id": ObjectId(template_id)})
        except:
            # If not a valid ObjectId, assume it's a trigger name
            template = await service.db.notification_templates.find_one({"trigger": template_id})
        
        if not template:
            raise HTTPException(status_code=404, detail="Template not found")
        
        # Convert ObjectId to string
        template["_id"] = str(template["_id"])
        
        return template
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error fetching template: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch template: {str(e)}")


@router.post("/templates")
async def create_template(
    template_data: dict,
    current_user: dict = Depends(get_current_user),
    service: NotificationService = Depends(get_notification_service)
):
    """Create a new notification template (admin only)"""
    try:
        # Add timestamps
        template_data["createdAt"] = datetime.utcnow()
        template_data["updatedAt"] = datetime.utcnow()
        
        result = await service.db.notification_templates.insert_one(template_data)
        
        return {
            "success": True,
            "message": "Template created successfully",
            "template_id": str(result.inserted_id)
        }
        
    except Exception as e:
        print(f"❌ Error creating template: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create template: {str(e)}")


@router.put("/templates/{template_id}")
async def update_template(
    template_id: str,
    template_data: dict,
    current_user: dict = Depends(get_current_user),
    service: NotificationService = Depends(get_notification_service)
):
    """Update an existing template (admin only)"""
    try:
        from bson import ObjectId
        
        # Add updated timestamp
        template_data["updatedAt"] = datetime.utcnow()
        
        # Remove _id if present (can't update _id)
        template_data.pop("_id", None)
        
        result = await service.db.notification_templates.update_one(
            {"_id": ObjectId(template_id)},
            {"$set": template_data}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Template not found")
        
        return {
            "success": True,
            "message": "Template updated successfully"
        }
        
    except Exception as e:
        print(f"❌ Error updating template: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update template: {str(e)}")


@router.delete("/templates/{template_id}")
async def delete_template(
    template_id: str,
    current_user: dict = Depends(get_current_user),
    service: NotificationService = Depends(get_notification_service)
):
    """Delete a template (admin only)"""
    try:
        from bson import ObjectId
        
        result = await service.db.notification_templates.delete_one({"_id": ObjectId(template_id)})
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Template not found")
        
        return {
            "success": True,
            "message": "Template deleted successfully"
        }
        
    except Exception as e:
        print(f"❌ Error deleting template: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete template: {str(e)}")


# ========================================
# Scheduled Notifications Endpoints
# ========================================

@router.get("/scheduled")
async def get_scheduled_notifications(
    enabled: Optional[bool] = Query(None, description="Filter by enabled status"),
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Get all scheduled notifications (admin only)"""
    # Check if user is admin
    user_role = current_user.get("role", "free_user")
    is_admin = (user_role == "admin" or current_user["username"] == "admin")
    
    if not is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        query = {}
        if enabled is not None:
            query["enabled"] = enabled
        
        cursor = db.scheduled_notifications.find(query).sort("createdAt", -1)
        scheduled = []
        
        async for doc in cursor:
            doc["_id"] = str(doc["_id"])
            # Set defaults for optional fields to prevent validation errors
            doc.setdefault("templateData", {})
            doc.setdefault("enabled", True)
            doc.setdefault("runCount", 0)
            doc.setdefault("timezone", "UTC")
            doc.setdefault("maxRecipients", 0)
            scheduled.append(doc)
        
        return {"success": True, "scheduled": scheduled}
        
    except Exception as e:
        print(f"❌ Error fetching scheduled notifications: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch scheduled notifications: {str(e)}")


@router.post("/scheduled", response_model=NotificationResponse)
async def create_scheduled_notification(
    schedule_data: ScheduledNotificationCreate,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Create a new scheduled notification (admin only)"""
    # Check if user is admin
    user_role = current_user.get("role", "free_user")
    is_admin = (user_role == "admin" or current_user["username"] == "admin")
    
    if not is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        from croniter import croniter
        
        # Build schedule document
        schedule_doc = schedule_data.dict()
        schedule_doc["createdBy"] = current_user["username"]
        schedule_doc["createdAt"] = datetime.utcnow()
        schedule_doc["updatedAt"] = datetime.utcnow()
        schedule_doc["runCount"] = 0
        
        # Calculate nextRun
        if schedule_data.scheduleType == "one_time":
            schedule_doc["nextRun"] = schedule_data.scheduledFor
        else:  # recurring
            # Calculate next run based on pattern
            if schedule_data.recurrencePattern == "daily":
                cron_expr = f"0 9 * * *"  # 9 AM daily
            elif schedule_data.recurrencePattern == "weekly":
                cron_expr = f"0 9 * * 1"  # Monday 9 AM
            elif schedule_data.recurrencePattern == "monthly":
                cron_expr = f"0 9 1 * *"  # 1st of month 9 AM
            else:  # custom
                cron_expr = schedule_data.cronExpression
            
            # Calculate next run
            iter = croniter(cron_expr, datetime.utcnow())
            schedule_doc["nextRun"] = iter.get_next(datetime)
        
        result = await db.scheduled_notifications.insert_one(schedule_doc)
        
        return NotificationResponse(
            success=True,
            message="Scheduled notification created successfully",
            data={"id": str(result.inserted_id)}
        )
        
    except Exception as e:
        print(f"❌ Error creating scheduled notification: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to create scheduled notification: {str(e)}")


@router.put("/scheduled/{schedule_id}", response_model=NotificationResponse)
async def update_scheduled_notification(
    schedule_id: str,
    update_data: ScheduledNotificationUpdate,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Update a scheduled notification (admin only)"""
    # Check if user is admin
    user_role = current_user.get("role", "free_user")
    is_admin = (user_role == "admin" or current_user["username"] == "admin")
    
    if not is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        from bson import ObjectId
        
        update_doc = {k: v for k, v in update_data.dict(exclude_unset=True).items() if v is not None}
        update_doc["updatedAt"] = datetime.utcnow()
        
        result = await db.scheduled_notifications.update_one(
            {"_id": ObjectId(schedule_id)},
            {"$set": update_doc}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Scheduled notification not found")
        
        return NotificationResponse(
            success=True,
            message="Scheduled notification updated successfully"
        )
        
    except Exception as e:
        print(f"❌ Error updating scheduled notification: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update scheduled notification: {str(e)}")


@router.delete("/scheduled/{schedule_id}", response_model=NotificationResponse)
async def delete_scheduled_notification(
    schedule_id: str,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Delete a scheduled notification (admin only)"""
    # Check if user is admin
    user_role = current_user.get("role", "free_user")
    is_admin = (user_role == "admin" or current_user["username"] == "admin")
    
    if not is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        from bson import ObjectId
        
        result = await db.scheduled_notifications.delete_one({"_id": ObjectId(schedule_id)})
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Scheduled notification not found")
        
        return NotificationResponse(
            success=True,
            message="Scheduled notification deleted successfully"
        )
        
    except Exception as e:
        print(f"❌ Error deleting scheduled notification: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete scheduled notification: {str(e)}")
