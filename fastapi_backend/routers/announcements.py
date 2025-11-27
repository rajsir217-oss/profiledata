"""
Announcement/Marquee Routes
API endpoints for managing announcement banners
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime
from typing import List, Optional
from bson import ObjectId
import logging

from models.announcement_models import (
    AnnouncementCreate,
    AnnouncementUpdate,
    AnnouncementResponse,
    AnnouncementDismissal,
    AnnouncementStats,
    AnnouncementTargetAudience
)
from auth.jwt_auth import get_current_user_dependency as get_current_user
from database import get_database

router = APIRouter(prefix="/announcements", tags=["announcements"])
logger = logging.getLogger(__name__)


def is_admin(current_user: dict) -> bool:
    """Check if user is admin"""
    return current_user.get("role") == "admin" or current_user.get("role_name") == "admin"


@router.get("/active", response_model=List[AnnouncementResponse])
async def get_active_announcements(
    current_user: Optional[dict] = Depends(get_current_user),
    db: AsyncIOMotorClient = Depends(get_database)
):
    """
    Get active announcements for current user
    
    Returns announcements that:
    - Are marked as active
    - Have not expired (endDate in future or null)
    - Have started (startDate in past or null)
    - Match user's target audience
    - User has not dismissed (if dismissible)
    """
    try:
        now = datetime.utcnow()
        
        # Build query
        query = {
            "active": True,
            "$or": [
                {"startDate": {"$lte": now}},
                {"startDate": None}
            ],
            "$or": [
                {"endDate": {"$gte": now}},
                {"endDate": None}
            ]
        }
        
        # Filter by target audience
        if current_user:
            username = current_user.get("username")
            user_role = current_user.get("role") or current_user.get("role_name") or "free_user"
            
            # Determine user's audience group
            if user_role == "admin":
                audience_groups = [AnnouncementTargetAudience.ALL, AnnouncementTargetAudience.AUTHENTICATED, AnnouncementTargetAudience.ADMINS]
            elif user_role == "premium_user":
                audience_groups = [AnnouncementTargetAudience.ALL, AnnouncementTargetAudience.AUTHENTICATED, AnnouncementTargetAudience.PREMIUM]
            else:
                audience_groups = [AnnouncementTargetAudience.ALL, AnnouncementTargetAudience.AUTHENTICATED, AnnouncementTargetAudience.FREE]
            
            query["targetAudience"] = {"$in": audience_groups}
            
            # Get dismissed announcement IDs for this user
            dismissed_ids = await db.announcement_dismissals.find(
                {"username": username}
            ).distinct("announcementId")
            
            # Exclude dismissed announcements
            if dismissed_ids:
                query["_id"] = {"$nin": [ObjectId(aid) for aid in dismissed_ids if ObjectId.is_valid(aid)]}
        else:
            # Anonymous users only see "all" audience
            query["targetAudience"] = AnnouncementTargetAudience.ALL
        
        # Fetch announcements
        announcements = await db.announcements.find(query).sort("priority", -1).to_list(length=100)
        
        # Increment view count for each announcement
        for announcement in announcements:
            await db.announcements.update_one(
                {"_id": announcement["_id"]},
                {"$inc": {"viewCount": 1}}
            )
        
        # Convert to response model
        result = []
        for announcement in announcements:
            announcement["id"] = str(announcement.pop("_id"))
            result.append(AnnouncementResponse(**announcement))
        
        return result
        
    except Exception as e:
        logger.error(f"Error fetching active announcements: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/dismiss/{announcement_id}")
async def dismiss_announcement(
    announcement_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorClient = Depends(get_database)
):
    """
    Dismiss an announcement for current user
    """
    try:
        username = current_user.get("username")
        
        # Check if announcement exists
        announcement = await db.announcements.find_one({"_id": ObjectId(announcement_id)})
        if not announcement:
            raise HTTPException(status_code=404, detail="Announcement not found")
        
        if not announcement.get("dismissible", True):
            raise HTTPException(status_code=400, detail="This announcement cannot be dismissed")
        
        # Check if already dismissed
        existing = await db.announcement_dismissals.find_one({
            "announcementId": announcement_id,
            "username": username
        })
        
        if existing:
            return {"message": "Already dismissed"}
        
        # Record dismissal
        dismissal = {
            "announcementId": announcement_id,
            "username": username,
            "dismissedAt": datetime.utcnow()
        }
        await db.announcement_dismissals.insert_one(dismissal)
        
        # Increment dismiss count
        await db.announcements.update_one(
            {"_id": ObjectId(announcement_id)},
            {"$inc": {"dismissCount": 1}}
        )
        
        logger.info(f"User {username} dismissed announcement {announcement_id}")
        return {"message": "Announcement dismissed"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error dismissing announcement: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# === ADMIN ROUTES ===

@router.get("/admin/all", response_model=List[AnnouncementResponse])
async def get_all_announcements(
    active: Optional[bool] = Query(None, description="Filter by active status"),
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorClient = Depends(get_database)
):
    """
    Get all announcements (admin only)
    """
    if not is_admin(current_user):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        query = {}
        if active is not None:
            query["active"] = active
        
        announcements = await db.announcements.find(query).sort("createdAt", -1).to_list(length=1000)
        
        result = []
        for announcement in announcements:
            announcement["id"] = str(announcement.pop("_id"))
            result.append(AnnouncementResponse(**announcement))
        
        return result
        
    except Exception as e:
        logger.error(f"Error fetching all announcements: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/admin/create", response_model=AnnouncementResponse, status_code=status.HTTP_201_CREATED)
async def create_announcement(
    announcement: AnnouncementCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorClient = Depends(get_database)
):
    """
    Create a new announcement (admin only)
    """
    if not is_admin(current_user):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        now = datetime.utcnow()
        username = current_user.get("username")
        
        announcement_doc = {
            **announcement.dict(),
            "active": True,
            "createdBy": username,
            "createdAt": now,
            "updatedAt": now,
            "viewCount": 0,
            "dismissCount": 0
        }
        
        result = await db.announcements.insert_one(announcement_doc)
        announcement_doc["id"] = str(result.inserted_id)
        announcement_doc.pop("_id", None)
        
        logger.info(f"Admin {username} created announcement: {announcement_doc['id']}")
        return AnnouncementResponse(**announcement_doc)
        
    except Exception as e:
        logger.error(f"Error creating announcement: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/admin/{announcement_id}", response_model=AnnouncementResponse)
async def update_announcement(
    announcement_id: str,
    update: AnnouncementUpdate,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorClient = Depends(get_database)
):
    """
    Update an announcement (admin only)
    """
    if not is_admin(current_user):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        # Check if exists
        existing = await db.announcements.find_one({"_id": ObjectId(announcement_id)})
        if not existing:
            raise HTTPException(status_code=404, detail="Announcement not found")
        
        # Build update document
        update_data = {k: v for k, v in update.dict(exclude_unset=True).items() if v is not None}
        if not update_data:
            raise HTTPException(status_code=400, detail="No fields to update")
        
        update_data["updatedAt"] = datetime.utcnow()
        
        # Update
        await db.announcements.update_one(
            {"_id": ObjectId(announcement_id)},
            {"$set": update_data}
        )
        
        # Fetch updated announcement
        updated = await db.announcements.find_one({"_id": ObjectId(announcement_id)})
        updated["id"] = str(updated.pop("_id"))
        
        logger.info(f"Admin {current_user.get('username')} updated announcement: {announcement_id}")
        return AnnouncementResponse(**updated)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating announcement: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/admin/{announcement_id}")
async def delete_announcement(
    announcement_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorClient = Depends(get_database)
):
    """
    Delete an announcement (admin only)
    """
    if not is_admin(current_user):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        result = await db.announcements.delete_one({"_id": ObjectId(announcement_id)})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Announcement not found")
        
        # Also delete all dismissals for this announcement
        await db.announcement_dismissals.delete_many({"announcementId": announcement_id})
        
        logger.info(f"Admin {current_user.get('username')} deleted announcement: {announcement_id}")
        return {"message": "Announcement deleted"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting announcement: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/admin/stats", response_model=AnnouncementStats)
async def get_announcement_stats(
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorClient = Depends(get_database)
):
    """
    Get announcement statistics (admin only)
    """
    if not is_admin(current_user):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        now = datetime.utcnow()
        
        total = await db.announcements.count_documents({})
        active = await db.announcements.count_documents({"active": True})
        scheduled = await db.announcements.count_documents({"startDate": {"$gt": now}})
        expired = await db.announcements.count_documents({"endDate": {"$lt": now}})
        
        # Aggregate total views and dismissals
        pipeline = [
            {
                "$group": {
                    "_id": None,
                    "totalViews": {"$sum": "$viewCount"},
                    "totalDismissals": {"$sum": "$dismissCount"}
                }
            }
        ]
        
        result = await db.announcements.aggregate(pipeline).to_list(length=1)
        stats_data = result[0] if result else {"totalViews": 0, "totalDismissals": 0}
        
        return AnnouncementStats(
            totalAnnouncements=total,
            activeAnnouncements=active,
            scheduledAnnouncements=scheduled,
            expiredAnnouncements=expired,
            totalViews=stats_data["totalViews"],
            totalDismissals=stats_data["totalDismissals"]
        )
        
    except Exception as e:
        logger.error(f"Error fetching announcement stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))
