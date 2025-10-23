# fastapi_backend/routes_image_access.py
from fastapi import APIRouter, HTTPException, Query, Depends
from typing import Optional, List
from database import get_database
from motor.motor_asyncio import AsyncIOMotorDatabase
import logging

router = APIRouter(prefix="/api/image-access", tags=["image-access"])
logger = logging.getLogger(__name__)

@router.get("/profile/{owner_username}/accessible")
async def get_accessible_images(
    owner_username: str,
    viewerUsername: Optional[str] = Query(None),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Get viewer's accessible images for a profile.
    Returns images based on privacy settings and granted access.
    """
    try:
        logger.info(f"🖼️ Fetching accessible images for {owner_username}, viewer: {viewerUsername}")
        
        # Find all image access settings for this owner
        image_access_list = await db.imageaccesses.find({
            "ownerUsername": owner_username
        }).to_list(length=None)
        
        logger.info(f"Found {len(image_access_list)} image settings for {owner_username}")
        
        # Check if viewer has pending requests
        has_pending_request = False
        if viewerUsername:
            pending_count = await db.imageaccessrequests.count_documents({
                "requesterUsername": viewerUsername,
                "ownerUsername": owner_username,
                "status": "pending"
            })
            has_pending_request = pending_count > 0
            logger.info(f"Pending requests for {viewerUsername}: {pending_count}")
        
        accessible_images = []
        
        for image_access in image_access_list:
            # Check if image is public
            initial_visibility = image_access.get("initialVisibility", {})
            is_public = initial_visibility.get("type") == "clear"
            
            # Check if viewer has active access
            has_access = False
            access_details = None
            
            if viewerUsername and image_access.get("activeAccess"):
                for access in image_access.get("activeAccess", []):
                    if access.get("grantedTo") == viewerUsername and access.get("status") == "active":
                        # Check if not expired
                        import datetime
                        expires_at = access.get("expiresAt")
                        if expires_at and isinstance(expires_at, datetime.datetime):
                            if expires_at > datetime.datetime.now(datetime.timezone.utc):
                                has_access = True
                                access_details = access
                                break
            
            if is_public or has_access:
                # User can see full image info
                accessible_images.append({
                    "imageId": image_access.get("imageId"),
                    "imageUrl": image_access.get("imageUrl"),
                    "imageOrder": image_access.get("imageOrder", 0),
                    "isProfilePic": image_access.get("isProfilePic", False),
                    "initialVisibility": initial_visibility,
                    "hasAccess": has_access,
                    "accessDetails": access_details,
                    "hasPendingRequest": has_pending_request
                })
            else:
                # Return limited info for restricted images
                accessible_images.append({
                    "imageId": image_access.get("imageId"),
                    "imageOrder": image_access.get("imageOrder", 0),
                    "isProfilePic": image_access.get("isProfilePic", False),
                    "initialVisibility": initial_visibility,
                    "hasAccess": False,
                    "restricted": True,
                    "hasPendingRequest": has_pending_request
                })
        
        # Sort by image order
        accessible_images.sort(key=lambda x: x.get("imageOrder", 0))
        
        logger.info(f"✅ Returning {len(accessible_images)} images for {owner_username}")
        
        return {
            "success": True,
            "images": accessible_images,
            "hasPendingRequest": has_pending_request
        }
        
    except Exception as error:
        logger.error(f"❌ Error fetching accessible images: {error}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch images: {str(error)}"
        )

@router.get("/{username}/requests/outgoing")
async def get_outgoing_requests(
    username: str,
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Get outgoing image access requests for a user.
    """
    try:
        logger.info(f"📤 Fetching outgoing requests for {username}")
        
        requests = await db.imageaccessrequests.find({
            "requesterUsername": username
        }).to_list(length=None)
        
        logger.info(f"✅ Found {len(requests)} outgoing requests")
        
        return {
            "success": True,
            "requests": requests
        }
        
    except Exception as error:
        logger.error(f"❌ Error fetching outgoing requests: {error}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch requests: {str(error)}"
        )
