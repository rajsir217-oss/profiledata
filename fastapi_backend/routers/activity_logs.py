# fastapi_backend/routers/activity_logs.py
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from fastapi.responses import StreamingResponse
from auth.jwt_auth import get_current_user_dependency as get_current_user
from models.activity_models import (
    ActivityLogFilter, ActivityLogCreate, ActivityLogResponse,
    ActivityStats, ActivityType
)
from services.activity_logger import get_activity_logger
from datetime import datetime
from typing import Optional
import io
import csv
import json

router = APIRouter(prefix="/api/activity-logs", tags=["activity-logs"])

def check_admin(current_user: dict):
    """Check if user is admin"""
    is_admin = current_user.get("role") == "admin" or current_user.get("role_name") == "admin"
    if not is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")

@router.get("/", response_model=ActivityLogResponse)
async def get_activity_logs(
    username: Optional[str] = Query(None),
    action_type: Optional[ActivityType] = Query(None),
    action_types: Optional[str] = Query(None, description="Comma-separated list of action types for multi-select"),
    target_username: Optional[str] = Query(None),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    session_id: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    current_user: dict = Depends(get_current_user)
):
    """
    Get activity logs with filters (Admin only)
    
    **Query Parameters:**
    - username: Filter by user who performed action
    - action_type: Filter by single activity type
    - action_types: Comma-separated list of activity types (multi-select)
    - target_username: Filter by target user
    - start_date: Filter from date (ISO format)
    - end_date: Filter to date (ISO format)
    - session_id: Filter by session
    - page: Page number (default: 1)
    - limit: Results per page (default: 50, max: 100)
    """
    check_admin(current_user)
    
    try:
        logger = get_activity_logger()
        
        # Parse multi-select action_types if provided
        action_types_list = None
        if action_types:
            action_types_list = [t.strip() for t in action_types.split(',') if t.strip()]
            print(f"🔍 Filtering by action_types: {action_types_list}", flush=True)
        
        filters = ActivityLogFilter(
            username=username,
            action_type=action_type,
            action_types=action_types_list,
            target_username=target_username,
            start_date=start_date,
            end_date=end_date,
            session_id=session_id,
            page=page,
            limit=limit
        )
        
        logs, total = await logger.get_logs(filters)
        print(f"🔍 Found {total} logs matching filters", flush=True)
        pages = (total + limit - 1) // limit  # Ceiling division
        
        return ActivityLogResponse(
            logs=logs,
            total=total,
            page=page,
            pages=pages,
            limit=limit
        )
    except Exception as e:
        print(f"❌ Error fetching activity logs: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch activity logs: {str(e)}")

@router.get("/stats", response_model=ActivityStats)
async def get_activity_stats(
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    current_user: dict = Depends(get_current_user)
):
    """
    Get activity statistics (Admin only)
    
    **Query Parameters:**
    - start_date: Stats from date (ISO format, default: 30 days ago)
    - end_date: Stats to date (ISO format, default: now)
    """
    check_admin(current_user)
    
    try:
        logger = get_activity_logger()
        stats = await logger.get_stats(start_date, end_date)
        return stats
    except Exception as e:
        print(f"❌ Error fetching activity stats: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch stats: {str(e)}")

@router.get("/export")
async def export_activity_logs(
    format: str = Query("json", regex="^(json|csv)$"),
    username: Optional[str] = Query(None),
    action_type: Optional[ActivityType] = Query(None),
    target_username: Optional[str] = Query(None),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    limit: int = Query(10000, ge=1, le=10000),
    current_user: dict = Depends(get_current_user)
):
    """
    Export activity logs (Admin only)
    
    **Query Parameters:**
    - format: Export format ('json' or 'csv')
    - Other filters same as get_activity_logs
    - limit: Max 10,000 for exports (default: 10000)
    """
    check_admin(current_user)
    
    try:
        logger = get_activity_logger()
        
        # For exports, we want to get all logs without pagination limits
        # So we use limit=100 (max allowed by model) but fetch all pages
        filters = ActivityLogFilter(
            username=username,
            action_type=action_type,
            target_username=target_username,
            start_date=start_date,
            end_date=end_date,
            page=1,
            limit=100  # Use max allowed by model
        )
        
        print(f"📥 Exporting logs with format: {format}")
        print(f"   Filters: {filters}")
        
        logs_data = await logger.export_logs(filters, format)
        
        print(f"✅ Got {len(logs_data)} logs for export")
        
        if format == "csv":
            # Create CSV in memory
            output = io.StringIO()
            if logs_data:
                writer = csv.DictWriter(output, fieldnames=logs_data[0].keys())
                writer.writeheader()
                writer.writerows(logs_data)
            
            csv_content = output.getvalue()
            output.close()
            
            return Response(
                content=csv_content,
                media_type="text/csv",
                headers={
                    "Content-Disposition": f"attachment; filename=activity_logs_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.csv"
                }
            )
        else:
            # JSON format
            json_content = json.dumps(logs_data, indent=2, default=str)
            return Response(
                content=json_content,
                media_type="application/json",
                headers={
                    "Content-Disposition": f"attachment; filename=activity_logs_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.json"
                }
            )
    except Exception as e:
        print(f"❌ Error exporting activity logs: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to export logs: {str(e)}")

@router.post("/log")
async def create_activity_log(
    log_data: ActivityLogCreate,
    current_user: dict = Depends(get_current_user)
):
    """
    Manually create an activity log entry
    
    **Note:** Most logs are created automatically. This endpoint is for special cases.
    """
    try:
        logger = get_activity_logger()
        username = current_user.get("username")
        
        await logger.log_activity(
            username=username,
            action_type=log_data.action_type,
            target_username=log_data.target_username,
            metadata=log_data.metadata,
            page_url=log_data.page_url,
            referrer_url=log_data.referrer_url,
            duration_ms=log_data.duration_ms,
            pii_logged=log_data.pii_logged
        )
        
        return {"success": True, "message": "Activity logged successfully"}
    except Exception as e:
        print(f"❌ Error creating activity log: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to log activity: {str(e)}")


@router.post("/batch")
async def create_batch_activity_logs(
    data: dict,
    current_user: dict = Depends(get_current_user)
):
    """
    Create multiple activity log entries in batch (from frontend)
    
    **Request Body:**
    - activities: List of activity objects with action_type, metadata, target_username, etc.
    
    **Note:** This endpoint is used by the frontend useActivityLogger hook for batched logging.
    """
    try:
        logger = get_activity_logger()
        username = current_user.get("username")
        activities = data.get("activities", [])
        
        if not activities:
            return {"success": True, "message": "No activities to log", "logged_count": 0}
        
        logged_count = 0
        for activity in activities:
            try:
                action_type_str = activity.get("action_type")
                if not action_type_str:
                    continue
                
                # Convert string to ActivityType enum
                try:
                    action_type = ActivityType(action_type_str)
                except ValueError:
                    print(f"⚠️ Unknown activity type: {action_type_str}")
                    continue
                
                await logger.log_activity(
                    username=username,
                    action_type=action_type,
                    target_username=activity.get("target_username"),
                    metadata=activity.get("metadata", {}),
                    page_url=activity.get("page_url"),
                    referrer_url=activity.get("referrer_url"),
                    duration_ms=activity.get("duration_ms")
                )
                logged_count += 1
            except Exception as activity_err:
                print(f"⚠️ Failed to log activity: {activity_err}")
                continue
        
        return {"success": True, "message": f"Logged {logged_count} activities", "logged_count": logged_count}
    except Exception as e:
        print(f"❌ Error creating batch activity logs: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to log activities: {str(e)}")

@router.delete("/cleanup")
async def cleanup_old_logs(
    days: int = Query(30, ge=1, le=365),
    current_user: dict = Depends(get_current_user)
):
    """
    Delete old activity logs (Admin only)
    
    **Query Parameters:**
    - days: Delete logs older than this many days (default: 30, max: 365)
    
    **Note:** Audit logs (PII requests, admin actions) are never deleted
    """
    check_admin(current_user)
    
    try:
        logger = get_activity_logger()
        deleted_count = await logger.delete_old_logs(days)
        
        return {
            "success": True,
            "message": f"Deleted {deleted_count} old activity logs",
            "deleted_count": deleted_count,
            "days": days
        }
    except Exception as e:
        print(f"❌ Error cleaning up logs: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to cleanup logs: {str(e)}")

@router.get("/action-types")
async def get_action_types(
    current_user: dict = Depends(get_current_user)
):
    """
    Get list of all available activity types (Admin only)
    """
    check_admin(current_user)
    
    return {
        "success": True,
        "action_types": [
            {
                "value": activity_type.value,
                "label": activity_type.value.replace("_", " ").title()
            }
            for activity_type in ActivityType
        ]
    }

@router.delete("/{log_id}")
async def delete_activity_log(
    log_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Delete a single activity log by ID (Admin only)
    """
    check_admin(current_user)
    
    try:
        from bson import ObjectId
        logger = get_activity_logger()
        
        result = await logger.db.activity_logs.delete_one({"_id": ObjectId(log_id)})
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Log not found")
        
        return {
            "success": True,
            "message": "Activity log deleted"
        }
    except Exception as e:
        print(f"❌ Error deleting log: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete log: {str(e)}")

@router.post("/delete-bulk")
async def delete_bulk_logs(
    log_ids: list[str],
    current_user: dict = Depends(get_current_user)
):
    """
    Delete multiple activity logs by IDs (Admin only)
    """
    check_admin(current_user)
    
    try:
        from bson import ObjectId
        logger = get_activity_logger()
        
        object_ids = [ObjectId(log_id) for log_id in log_ids]
        result = await logger.db.activity_logs.delete_many({"_id": {"$in": object_ids}})
        
        return {
            "success": True,
            "message": f"Deleted {result.deleted_count} activity logs",
            "deleted_count": result.deleted_count
        }
    except Exception as e:
        print(f"❌ Error deleting logs: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete logs: {str(e)}")
