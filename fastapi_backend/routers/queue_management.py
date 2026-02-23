"""
Queue Management API Routes
Admin endpoints for advanced queue control, cleanup, and monitoring
"""

from fastapi import APIRouter, Depends, HTTPException, Query, Body
from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field

from database import get_database
from auth.jwt_auth import get_current_user_dependency as get_current_user
from services.queue_manager import QueueManager, QueueStatus
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/admin/queue", tags=["Queue Management"])


# ============================================
# Pydantic Models
# ============================================

class QueuePauseRequest(BaseModel):
    """Request to pause the queue"""
    reason: str = Field(..., description="Reason for pausing the queue")
    duration_minutes: Optional[int] = Field(None, ge=1, le=1440, description="Auto-resume after X minutes (None = indefinite)")
    emergency: bool = Field(False, description="Emergency stop (immediate halt)")

class QueueCleanupRequest(BaseModel):
    """Request for queue cleanup"""
    age_days: int = Field(30, ge=0, le=365, description="Clean pending notifications older than this many days")
    failed_age_days: int = Field(7, ge=1, le=90, description="Clean failed notifications older than this many days")
    sent_age_days: int = Field(7, ge=0, le=90, description="Clean sent notifications older than this many days")
    batch_size: int = Field(1000, ge=100, le=10000, description="Batch size for deletion")
    dry_run: bool = Field(False, description="Dry run mode (don't actually delete)")

class DeadLetterRetryRequest(BaseModel):
    """Request to retry dead letter notification"""
    reset_attempts: bool = Field(True, description="Reset attempt counter")


# ============================================
# Dependencies
# ============================================

def require_admin(current_user: dict = Depends(get_current_user)):
    """Require admin access"""
    user_role = current_user.get("role") or current_user.get("role_name", "free_user")
    is_admin = (user_role == "admin" or current_user["username"] == "admin")
    
    if not is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    return current_user


def get_queue_manager(db=Depends(get_database)) -> QueueManager:
    """Get queue manager instance"""
    return QueueManager(db)


# ============================================
# Queue Control Endpoints
# ============================================

@router.post("/pause")
async def pause_queue(
    request: QueuePauseRequest,
    current_user: dict = Depends(require_admin),
    queue_manager: QueueManager = Depends(get_queue_manager)
):
    """Pause the notification queue"""
    try:
        result = await queue_manager.pause_queue(
            reason=request.reason,
            duration_minutes=request.duration_minutes,
            emergency=request.emergency
        )
        
        logger.info(f"🛑 Queue paused by {current_user['username']}: {request.reason}")
        
        return {
            "success": True,
            "message": f"Queue paused: {request.reason}",
            "data": result
        }
        
    except Exception as e:
        logger.error(f"❌ Failed to pause queue: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/resume")
async def resume_queue(
    reason: str = Query("Manual resume", description="Reason for resuming"),
    current_user: dict = Depends(require_admin),
    queue_manager: QueueManager = Depends(get_queue_manager)
):
    """Resume the paused notification queue"""
    try:
        result = await queue_manager.resume_queue(reason)
        
        logger.info(f"▶️ Queue resumed by {current_user['username']}: {reason}")
        
        return {
            "success": True,
            "message": f"Queue resumed: {reason}",
            "data": result
        }
        
    except Exception as e:
        logger.error(f"❌ Failed to resume queue: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/status")
async def get_queue_status(
    current_user: dict = Depends(require_admin),
    queue_manager: QueueManager = Depends(get_queue_manager)
):
    """Get current queue status and control information"""
    try:
        status = await queue_manager.get_queue_status()
        metrics = await queue_manager.get_queue_metrics()
        
        return {
            "success": True,
            "data": {
                "control_status": status,
                "metrics": {
                    "total_pending": metrics.total_pending,
                    "total_processing": metrics.total_processing,
                    "total_failed": metrics.total_failed,
                    "total_sent": metrics.total_sent,
                    "processing_rate": round(metrics.processing_rate, 2),
                    "failure_rate": round(metrics.failure_rate, 2),
                    "oldest_pending_age_minutes": metrics.oldest_pending_age.total_seconds() / 60,
                    "stuck_processing_count": metrics.stuck_processing_count
                }
            }
        }
        
    except Exception as e:
        logger.error(f"❌ Failed to get queue status: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# Queue Cleanup Endpoints
# ============================================

@router.post("/cleanup")
async def cleanup_queue(
    request: QueueCleanupRequest,
    current_user: dict = Depends(require_admin),
    queue_manager: QueueManager = Depends(get_queue_manager)
):
    """Perform comprehensive queue cleanup"""
    try:
        result = await queue_manager.cleanup_queue(
            age_days=request.age_days,
            failed_age_days=request.failed_age_days,
            sent_age_days=request.sent_age_days,
            batch_size=request.batch_size,
            dry_run=request.dry_run
        )
        
        action = "Dry run cleanup" if request.dry_run else "Queue cleanup"
        logger.info(f"🧹 {action} performed by {current_user['username']}: {result}")
        
        return {
            "success": True,
            "message": f"{action} completed",
            "data": result
        }
        
    except Exception as e:
        logger.error(f"❌ Queue cleanup failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/reset-stuck")
async def reset_stuck_notifications(
    timeout_minutes: int = Query(10, ge=1, le=60, description="Consider notifications stuck longer than this many minutes"),
    current_user: dict = Depends(require_admin),
    queue_manager: QueueManager = Depends(get_queue_manager)
):
    """Reset notifications stuck in processing state"""
    try:
        from datetime import timedelta
        
        cutoff_time = datetime.utcnow() - timedelta(minutes=timeout_minutes)
        
        # Reset stuck notifications
        from services.notification_service import NotificationService
        notification_service = NotificationService(queue_manager.db)
        
        reset_count = await queue_manager.queue_collection.update_many(
            {
                "status": "processing",
                "processingStartedAt": {"$lt": cutoff_time}
            },
            {
                "$set": {
                    "status": "pending",
                    "statusReason": f"Reset from stuck processing state after {timeout_minutes} minutes"
                },
                "$inc": {"attempts": 0}
            }
        )
        
        logger.info(f"🔄 Reset {reset_count.modified_count} stuck notifications by {current_user['username']}")
        
        return {
            "success": True,
            "message": f"Reset {reset_count.modified_count} stuck notifications",
            "data": {
                "reset_count": reset_count.modified_count,
                "timeout_minutes": timeout_minutes
            }
        }
        
    except Exception as e:
        logger.error(f"❌ Failed to reset stuck notifications: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# Dead Letter Queue Endpoints
# ============================================

@router.get("/dead-letter")
async def get_dead_letter_queue(
    limit: int = Query(100, ge=1, le=500, description="Maximum number of items to return"),
    status_filter: Optional[str] = Query(None, description="Filter by status"),
    current_user: dict = Depends(require_admin),
    queue_manager: QueueManager = Depends(get_queue_manager)
):
    """Get dead letter queue items"""
    try:
        dead_letters = await queue_manager.get_dead_letter_queue(
            limit=limit,
            status_filter=status_filter
        )
        
        return {
            "success": True,
            "data": {
                "dead_letters": dead_letters,
                "count": len(dead_letters)
            }
        }
        
    except Exception as e:
        logger.error(f"❌ Failed to get dead letter queue: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/dead-letter/{dead_letter_id}/retry")
async def retry_dead_letter_notification(
    dead_letter_id: str,
    request: DeadLetterRetryRequest = Body(...),
    current_user: dict = Depends(require_admin),
    queue_manager: QueueManager = Depends(get_queue_manager)
):
    """Retry a dead letter notification"""
    try:
        success = await queue_manager.retry_dead_letter_notification(
            dead_letter_id=dead_letter_id,
            reset_attempts=request.reset_attempts
        )
        
        if success:
            logger.info(f"🔄 Dead letter notification {dead_letter_id} retried by {current_user['username']}")
            return {
                "success": True,
                "message": "Dead letter notification retried successfully"
            }
        else:
            return {
                "success": False,
                "message": "Failed to retry dead letter notification"
            }
        
    except Exception as e:
        logger.error(f"❌ Failed to retry dead letter notification: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/dead-letter/{dead_letter_id}")
async def delete_dead_letter_notification(
    dead_letter_id: str,
    current_user: dict = Depends(require_admin),
    queue_manager: QueueManager = Depends(get_queue_manager)
):
    """Delete a dead letter notification permanently"""
    try:
        from bson import ObjectId
        
        result = await queue_manager.dead_letter_collection.delete_one({
            "_id": ObjectId(dead_letter_id)
        })
        
        if result.deleted_count > 0:
            logger.info(f"🗑️ Dead letter notification {dead_letter_id} deleted by {current_user['username']}")
            return {
                "success": True,
                "message": "Dead letter notification deleted"
            }
        else:
            raise HTTPException(status_code=404, detail="Dead letter notification not found")
        
    except Exception as e:
        logger.error(f"❌ Failed to delete dead letter notification: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# Rate Limiting Endpoints
# ============================================

@router.get("/rate-limits")
async def get_rate_limit_stats(
    current_user: dict = Depends(require_admin),
    queue_manager: QueueManager = Depends(get_queue_manager)
):
    """Get rate limiting statistics"""
    try:
        stats = await queue_manager.get_rate_limit_stats()
        
        return {
            "success": True,
            "data": stats
        }
        
    except Exception as e:
        logger.error(f"❌ Failed to get rate limit stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/rate-limits/check")
async def check_rate_limit(
    username: str = Query(..., description="Username to check"),
    channel: str = Query(..., description="Channel to check"),
    window_minutes: int = Query(60, ge=1, le=1440, description="Time window in minutes"),
    max_notifications: int = Query(10, ge=1, le=100, description="Max notifications allowed"),
    current_user: dict = Depends(require_admin),
    queue_manager: QueueManager = Depends(get_queue_manager)
):
    """Check if a user/channel is rate limited"""
    try:
        allowed, rate_limit_info = await queue_manager.check_rate_limit(
            username=username,
            channel=channel,
            window_minutes=window_minutes,
            max_notifications=max_notifications
        )
        
        return {
            "success": True,
            "data": {
                "allowed": allowed,
                "rate_limit_info": rate_limit_info
            }
        }
        
    except Exception as e:
        logger.error(f"❌ Failed to check rate limit: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# Advanced Analytics Endpoints
# ============================================

@router.get("/analytics")
async def get_queue_analytics(
    hours: int = Query(24, ge=1, le=168, description="Hours of data to analyze"),
    current_user: dict = Depends(require_admin),
    queue_manager: QueueManager = Depends(get_queue_manager)
):
    """Get comprehensive queue analytics"""
    try:
        from datetime import timedelta
        
        now = datetime.utcnow()
        start_time = now - timedelta(hours=hours)
        
        # Get time-series data
        pipeline = [
            {
                "$match": {
                    "createdAt": {"$gte": start_time}
                }
            },
            {
                "$group": {
                    "_id": {
                        "hour": {"$hour": "$createdAt"},
                        "status": "$status"
                    },
                    "count": {"$sum": 1}
                }
            },
            {"$sort": {"_id.hour": 1}}
        ]
        
        time_series = await queue_manager.queue_collection.aggregate(pipeline).to_list(100)
        
        # Get trigger breakdown
        trigger_pipeline = [
            {
                "$match": {
                    "createdAt": {"$gte": start_time}
                }
            },
            {
                "$group": {
                    "_id": "$trigger",
                    "count": {"$sum": 1},
                    "success": {
                        "$sum": {"$cond": [{"$eq": ["$status", "sent"]}, 1, 0]}
                    },
                    "failed": {
                        "$sum": {"$cond": [{"$eq": ["$status", "failed"]}, 1, 0]}
                    }
                }
            },
            {"$sort": {"count": -1}}
        ]
        
        trigger_breakdown = await queue_manager.queue_collection.aggregate(trigger_pipeline).to_list(50)
        
        # Get channel breakdown
        channel_pipeline = [
            {
                "$match": {
                    "createdAt": {"$gte": start_time}
                }
            },
            {"$unwind": "$channels"},
            {
                "$group": {
                    "_id": "$channels",
                    "count": {"$sum": 1},
                    "success": {
                        "$sum": {"$cond": [{"$eq": ["$status", "sent"]}, 1, 0]}
                    },
                    "failed": {
                        "$sum": {"$cond": [{"$eq": ["$status", "failed"]}, 1, 0]}
                    }
                }
            },
            {"$sort": {"count": -1}}
        ]
        
        channel_breakdown = await queue_manager.queue_collection.aggregate(channel_pipeline).to_list(10)
        
        return {
            "success": True,
            "data": {
                "time_series": time_series,
                "trigger_breakdown": trigger_breakdown,
                "channel_breakdown": channel_breakdown,
                "analysis_period_hours": hours
            }
        }
        
    except Exception as e:
        logger.error(f"❌ Failed to get queue analytics: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# Health Check Endpoint
# ============================================

@router.get("/health")
async def queue_health_check(
    current_user: dict = Depends(require_admin),
    queue_manager: QueueManager = Depends(get_queue_manager)
):
    """Comprehensive queue health check"""
    try:
        metrics = await queue_manager.get_queue_metrics()
        status = await queue_manager.get_queue_status()
        
        # Determine health status
        health_issues = []
        
        if metrics.stuck_processing_count > 0:
            health_issues.append(f"{metrics.stuck_processing_count} notifications stuck in processing")
        
        if metrics.failure_rate > 10:
            health_issues.append(f"High failure rate: {metrics.failure_rate:.1f}%")
        
        if metrics.oldest_pending_age.total_seconds() > 3600:  # 1 hour
            health_issues.append(f"Old pending notifications: {metrics.oldest_pending_age.total_seconds()/60:.1f} minutes")
        
        if status.get("status") != QueueStatus.NORMAL.value:
            health_issues.append(f"Queue status: {status.get('status')}")
        
        health_status = "healthy" if not health_issues else "warning"
        if metrics.stuck_processing_count > 50 or metrics.failure_rate > 25:
            health_status = "critical"
        
        return {
            "success": True,
            "data": {
                "health_status": health_status,
                "issues": health_issues,
                "metrics": {
                    "total_pending": metrics.total_pending,
                    "total_processing": metrics.total_processing,
                    "total_failed": metrics.total_failed,
                    "processing_rate": round(metrics.processing_rate, 2),
                    "failure_rate": round(metrics.failure_rate, 2),
                    "oldest_pending_age_minutes": metrics.oldest_pending_age.total_seconds() / 60,
                    "stuck_processing_count": metrics.stuck_processing_count
                },
                "queue_control": status,
                "checked_at": datetime.utcnow().isoformat()
            }
        }
        
    except Exception as e:
        logger.error(f"❌ Queue health check failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
