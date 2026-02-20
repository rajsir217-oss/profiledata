"""
Admin Engagement API Routes
Admin-only endpoints for managing user engagement and inactivity tracking
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
from pymongo.database import Database

from models.notification_models import (
    InactivityAnalytics,
    InactivityTestRequest,
    AdminInactivityTracking
)
from services.notification_service import NotificationService
from database import get_database
from auth.jwt_auth import get_current_user_dependency as get_current_user
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin/engagement", tags=["admin-engagement"])


def get_notification_service(db=Depends(get_database)) -> NotificationService:
    """Dependency to get notification service"""
    return NotificationService(db)


def verify_admin_access(current_user: dict = Depends(get_current_user)):
    """Verify admin access"""
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


@router.get("/inactivity-analytics", response_model=InactivityAnalytics)
async def get_inactivity_analytics(
    job_id: Optional[str] = Query(None, description="Filter by specific job execution"),
    date_range: Optional[str] = Query(None, description="Date range filter (e.g., '7d', '30d', '90d')"),
    current_user: dict = Depends(verify_admin_access),
    db: Database = Depends(get_database)
):
    """Get analytics for login reminder job performance"""
    try:
        logger.info(f"📊 Admin {current_user['username']} requesting inactivity analytics")
        
        # Parse date range
        date_filter = {}
        if date_range:
            if date_range.endswith('d'):
                days = int(date_range[:-1])
                cutoff_date = datetime.utcnow() - timedelta(days=days)
                date_filter = {"sentAt": {"$gte": cutoff_date}}
            elif date_range.endswith('h'):
                hours = int(date_range[:-1])
                cutoff_date = datetime.utcnow() - timedelta(hours=hours)
                date_filter = {"sentAt": {"$gte": cutoff_date}}
        
        # Add job filter if specified
        if job_id:
            date_filter["jobExecutionId"] = job_id
        
        # Get total inactive users
        pipeline = [
            {"$match": date_filter},
            {"$group": {"_id": "$username", "lastReminder": {"$max": "$sentAt"}}},
            {"$count": "totalInactive"}
        ]
        result = await db.admin_inactivity_tracking.aggregate(pipeline).to_list(1)
        total_inactive = result[0]["totalInactive"] if result else 0
        
        # Get escalation tier stats
        escalation_pipeline = [
            {"$match": date_filter},
            {"$group": {
                "_id": "$escalationDays",
                "count": {"$sum": 1},
                "sent": {"$sum": 1},
                "reactivated": {
                    "$sum": {
                        "$cond": [
                            {"$ne": ["$userResponse.reactivatedAt", None]},
                            1,
                            0
                        ]
                    }
                }
            }},
            {"$sort": {"_id": 1}}
        ]
        escalation_results = await db.admin_inactivity_tracking.aggregate(escalation_pipeline).to_list(10)
        
        escalation_tiers = {}
        for tier in escalation_results:
            days = str(tier["_id"])
            escalation_tiers[days] = {
                "count": tier["count"],
                "sent": tier["sent"],
                "reactivated": tier["reactivated"]
            }
        
        # Get channel effectiveness
        channel_pipeline = [
            {"$match": date_filter},
            {"$unwind": "$channels"},
            {"$group": {
                "_id": "$channels",
                "sent": {"$sum": 1},
                "delivered": {
                    "$sum": {
                        "$cond": [
                            {"$eq": [f"$deliveryStatus.{'$channels'}.delivered", True]},
                            1,
                            0
                        ]
                    }
                },
                "opened": {
                    "$sum": {
                        "$cond": [
                            {"$eq": [f"$deliveryStatus.{'$channels'}.opened", True]},
                            1,
                            0
                        ]
                    }
                }
            }},
            {"$sort": {"_id": 1}}
        ]
        channel_results = await db.admin_inactivity_tracking.aggregate(channel_pipeline).to_list(10)
        
        channel_effectiveness = {}
        for channel in channel_results:
            channel_name = channel["_id"]
            channel_effectiveness[channel_name] = {
                "sent": channel["sent"],
                "delivered": channel["delivered"],
                "opened": channel["opened"]
            }
        
        # Calculate reactivation rate
        total_reactivated = sum(tier["reactivated"] for tier in escalation_results)
        total_sent = sum(tier["sent"] for tier in escalation_results)
        reactivation_rate = (total_reactivated / total_sent * 100) if total_sent > 0 else 0
        
        # Opt-out rate (users who haven't reactivated after 60 days)
        sixty_day_cutoff = datetime.utcnow() - timedelta(days=60)
        opt_out_pipeline = [
            {
                "$match": {
                    "escalationDays": 60,
                    "sentAt": {"$lte": sixty_day_cutoff},
                    "userResponse.reactivatedAt": None
                }
            },
            {"$count": "optedOut"}
        ]
        opt_out_result = await db.admin_inactivity_tracking.aggregate(opt_out_pipeline).to_list(1)
        opted_out = opt_out_result[0]["optedOut"] if opt_out_result else 0
        opt_out_rate = (opted_out / total_inactive * 100) if total_inactive > 0 else 0
        
        analytics = InactivityAnalytics(
            totalInactive=total_inactive,
            escalationTiers=escalation_tiers,
            channelEffectiveness=channel_effectiveness,
            reactivationRate=round(reactivation_rate, 2),
            optOutRate=round(opt_out_rate, 2)
        )
        
        logger.info(f"✅ Inactivity analytics retrieved: {total_inactive} inactive users")
        return analytics
        
    except Exception as e:
        logger.error(f"❌ Error getting inactivity analytics: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get analytics: {str(e)}")


@router.post("/inactivity-test", response_model=Dict[str, Any])
async def test_inactivity_reminder(
    test_request: InactivityTestRequest,
    current_user: dict = Depends(verify_admin_access),
    db: Database = Depends(get_database),
    notification_service: NotificationService = Depends(get_notification_service)
):
    """Send test reminder to specific user"""
    try:
        logger.info(f"🧪 Admin {current_user['username']} sending test reminder to {test_request.username}")
        
        # Verify user exists
        user = await db.users.find_one({"username": test_request.username})
        if not user:
            raise HTTPException(status_code=404, detail=f"User {test_request.username} not found")
        
        # Get user's contact info
        email = user.get("email") or user.get("contactEmail")
        phone = user.get("phone") or user.get("contactNumber")
        
        # Prepare template data
        template_data = {
            "firstName": user.get("firstName", user["username"]),
            "daysInactive": test_request.escalationDays,
            "lastLoginDate": user.get("lastLogin", datetime.utcnow()).strftime("%Y-%m-%d"),
            "newMatchesCount": 5,  # Mock data for test
            "unreadMessagesCount": 2,
            "profileViewsCount": 8,
            "escalationLevel": "test"
        }
        
        # Send notifications via specified channels
        sent_notifications = []
        failed_notifications = []
        
        for channel in test_request.channels:
            try:
                # Verify user has contact info for this channel
                if channel == "email" and not email:
                    failed_notifications.append(f"email: No email address found")
                    continue
                elif channel == "sms" and not phone:
                    failed_notifications.append(f"sms: No phone number found")
                    continue
                elif channel == "push":
                    # Check if user has push tokens
                    push_tokens = await db.push_tokens.find_one({"username": test_request.username})
                    if not push_tokens or not push_tokens.get("tokens"):
                        failed_notifications.append(f"push: No push tokens found")
                        continue
                
                # Queue notification
                await notification_service.queue_notification(
                    username=test_request.username,
                    trigger="admin_login_reminder",
                    channels=[channel],
                    template_data=template_data,
                    priority="medium"
                )
                
                # Track test notification
                tracking_doc = {
                    "username": test_request.username,
                    "jobExecutionId": f"test_{datetime.utcnow().isoformat()}",
                    "escalationDays": test_request.escalationDays,
                    "channels": [channel],
                    "sentAt": datetime.utcnow(),
                    "templateData": template_data,
                    "deliveryStatus": {
                        channel: {"sent": True, "delivered": False, "opened": False}
                    },
                    "userResponse": {
                        "reactivatedAt": None,
                        "respondedAt": None
                    },
                    "isTest": True,
                    "testSentBy": current_user["username"]
                }
                
                await db.admin_inactivity_tracking.insert_one(tracking_doc)
                sent_notifications.append(channel)
                
            except Exception as e:
                logger.error(f"❌ Failed to send {channel} test notification: {e}")
                failed_notifications.append(f"{channel}: {str(e)}")
        
        result = {
            "success": len(sent_notifications) > 0,
            "username": test_request.username,
            "escalationDays": test_request.escalationDays,
            "channels": test_request.channels,
            "sent": sent_notifications,
            "failed": failed_notifications,
            "sentAt": datetime.utcnow().isoformat(),
            "sentBy": current_user["username"]
        }
        
        logger.info(f"✅ Test reminder sent: {len(sent_notifications)} channels, {len(failed_notifications)} failed")
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error sending test reminder: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to send test reminder: {str(e)}")


@router.get("/inactive-users", response_model=List[Dict[str, Any]])
async def get_inactive_users(
    days: int = Query(..., ge=7, le=365, description="Days of inactivity"),
    limit: int = Query(100, ge=1, le=500, description="Maximum users to return"),
    current_user: dict = Depends(verify_admin_access),
    db: Database = Depends(get_database)
):
    """Get list of inactive users for specified days"""
    try:
        logger.info(f"📋 Admin {current_user['username']} requesting inactive users ({days} days)")
        
        cutoff_date = datetime.utcnow() - timedelta(days=days)
        
        pipeline = [
            {
                "$match": {
                    "status": "active",
                    "lastLogin": {"$lt": cutoff_date}
                }
            },
            {
                "$project": {
                    "username": 1,
                    "firstName": 1,
                    "lastLogin": 1,
                    "loginCount": {"$ifNull": ["$loginCount", 0]},
                    "email": 1,
                    "phone": 1,
                    "contactEmail": 1,
                    "contactNumber": 1,
                    "daysInactive": {
                        "$subtract": [
                            {"$toLong": datetime.utcnow()},
                            {"$toLong": "$lastLogin"}
                        ]
                    }
                }
            },
            {"$sort": {"lastLogin": 1}},
            {"$limit": limit}
        ]
        
        users = await db.users.aggregate(pipeline).to_list(limit)
        
        # Convert days from milliseconds to days
        for user in users:
            if "daysInactive" in user:
                user["daysInactive"] = user["daysInactive"] // (1000 * 60 * 60 * 24)
        
        logger.info(f"✅ Found {len(users)} inactive users for {days} days")
        return users
        
    except Exception as e:
        logger.error(f"❌ Error getting inactive users: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get inactive users: {str(e)}")


@router.get("/job-executions", response_model=List[Dict[str, Any]])
async def get_job_executions(
    limit: int = Query(50, ge=1, le=200, description="Maximum executions to return"),
    current_user: dict = Depends(verify_admin_access),
    db: Database = Depends(get_database)
):
    """Get recent job execution history"""
    try:
        logger.info(f"📜 Admin {current_user['username']} requesting job execution history")
        
        pipeline = [
            {
                "$match": {
                    "template_type": "enhanced_login_reminder"
                }
            },
            {
                "$project": {
                    "jobId": 1,
                    "status": 1,
                    "startedAt": 1,
                    "completedAt": 1,
                    "recordsProcessed": 1,
                    "recordsAffected": 1,
                    "details": 1
                }
            },
            {"$sort": {"startedAt": -1}},
            {"$limit": limit}
        ]
        
        executions = await db.job_execution_logs.aggregate(pipeline).to_list(limit)
        
        logger.info(f"✅ Found {len(executions)} job executions")
        return executions
        
    except Exception as e:
        logger.error(f"❌ Error getting job executions: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get job executions: {str(e)}")


@router.get("/escalation-stats", response_model=Dict[str, Any])
async def get_escalation_stats(
    days: int = Query(30, ge=1, le=365, description="Days to analyze"),
    current_user: dict = Depends(verify_admin_access),
    db: Database = Depends(get_database)
):
    """Get detailed escalation statistics"""
    try:
        logger.info(f"📈 Admin {current_user['username']} requesting escalation stats ({days} days)")
        
        cutoff_date = datetime.utcnow() - timedelta(days=days)
        
        # Get escalation progression
        progression_pipeline = [
            {
                "$match": {
                    "sentAt": {"$gte": cutoff_date}
                }
            },
            {
                "$group": {
                    "_id": "$username",
                    "escalations": {"$push": {"days": "$escalationDays", "sentAt": "$sentAt"}},
                    "maxEscalation": {"$max": "$escalationDays"},
                    "reactivated": {"$max": "$userResponse.reactivatedAt"}
                }
            },
            {
                "$group": {
                    "_id": "$maxEscalation",
                    "count": {"$sum": 1},
                    "reactivated": {
                        "$sum": {
                            "$cond": [
                                {"$ne": ["$reactivated", None]},
                                1,
                                0
                            ]
                        }
                    }
                }
            },
            {"$sort": {"_id": 1}}
        ]
        
        progression = await db.admin_inactivity_tracking.aggregate(progression_pipeline).to_list(10)
        
        # Format results
        escalation_stats = {}
        for stat in progression:
            days = str(stat["_id"])
            escalation_stats[days] = {
                "usersAtThisLevel": stat["count"],
                "reactivatedFromThisLevel": stat["reactivated"],
                "reactivationRate": round((stat["reactivated"] / stat["count"] * 100), 2) if stat["count"] > 0 else 0
            }
        
        logger.info(f"✅ Escalation stats retrieved for {len(progression)} levels")
        return escalation_stats
        
    except Exception as e:
        logger.error(f"❌ Error getting escalation stats: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get escalation stats: {str(e)}")
