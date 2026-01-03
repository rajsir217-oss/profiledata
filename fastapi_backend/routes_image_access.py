# fastapi_backend/routes_image_access.py
from fastapi import APIRouter, HTTPException, Query, Depends, Body
from typing import Optional, List, Dict
from database import get_database
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId
from datetime import datetime, timedelta, timezone
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

@router.get("/{username}/requests/incoming")
async def get_incoming_requests(
    username: str,
    status: Optional[str] = Query(None),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Get incoming image access requests for a user (requests made to them).
    """
    try:
        logger.info(f"📥 Fetching incoming image access requests for {username}")
        
        # Build query filter
        query = {"ownerUsername": username}
        if status:
            query["status"] = status
        else:
            # Default to pending only
            query["status"] = "pending"
        
        # Find all incoming requests
        requests = await db.imageaccessrequests.find(query).to_list(length=None)
        
        # Enrich with requester profile data
        enriched_requests = []
        for request in requests:
            requester_username = request.get("requesterUsername")
            
            # Fetch requester profile - Only show if requester is still active
            requester_profile = await db.users.find_one(
                {"username": requester_username, "accountStatus": "active"},
                {"_id": 0, "username": 1, "firstName": 1, "lastName": 1, "images": 1}
            )
            
            if not requester_profile:
                continue
                
            enriched_requests.append({
                "id": str(request.get("_id")),
                "requesterUsername": requester_username,
                "ownerUsername": request.get("ownerUsername"),
                "status": request.get("status"),
                "message": request.get("message"),
                "requestedAt": request.get("requestedAt"),
                "requested_at": request.get("requestedAt"),  # Alias for compatibility
                "requestType": "images",  # Always images for this endpoint
                "requesterProfile": requester_profile if requester_profile else {
                    "username": requester_username,
                    "firstName": requester_username,
                    "images": []
                }
            })
        
        logger.info(f"✅ Found {len(enriched_requests)} incoming image access requests")
        
        return {
            "success": True,
            "requests": enriched_requests
        }
        
    except Exception as error:
        logger.error(f"❌ Error fetching incoming requests: {error}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch incoming requests: {str(error)}"
        )

@router.post("/requests/{request_id}/approve")
async def approve_image_access_request(
    request_id: str,
    body: Dict = Body(...),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Approve an image access request and grant access to all images.
    """
    try:
        owner_username = body.get("ownerUsername")
        if not owner_username:
            raise HTTPException(status_code=400, detail="ownerUsername is required")
        
        logger.info(f"✅ Approving image access request {request_id} for owner {owner_username}")
        
        # Find the request
        request = await db.imageaccessrequests.find_one({"_id": ObjectId(request_id)})
        if not request:
            raise HTTPException(status_code=404, detail="Request not found")
        
        requester_username = request.get("requesterUsername")
        
        # Update request status to approved
        await db.imageaccessrequests.update_one(
            {"_id": ObjectId(request_id)},
            {
                "$set": {
                    "status": "approved",
                    "approvedAt": datetime.now(timezone.utc)
                }
            }
        )
        
        # Grant access to all owner's images
        expires_at = datetime.now(timezone.utc) + timedelta(days=365)  # 1 year access
        
        # Find all images for the owner
        owner_images = await db.imageaccesses.find({
            "ownerUsername": owner_username
        }).to_list(length=None)
        
        # Grant access to each image
        for image in owner_images:
            # Check if access already exists
            active_access = image.get("activeAccess", [])
            existing_access = None
            for access in active_access:
                if access.get("grantedTo") == requester_username:
                    existing_access = access
                    break
            
            if existing_access:
                # Update existing access
                await db.imageaccesses.update_one(
                    {
                        "_id": image["_id"],
                        "activeAccess.grantedTo": requester_username
                    },
                    {
                        "$set": {
                            "activeAccess.$.status": "active",
                            "activeAccess.$.expiresAt": expires_at,
                            "activeAccess.$.grantedAt": datetime.now(timezone.utc)
                        }
                    }
                )
            else:
                # Add new access
                new_access = {
                    "grantedTo": requester_username,
                    "status": "active",
                    "grantedAt": datetime.now(timezone.utc),
                    "expiresAt": expires_at
                }
                await db.imageaccesses.update_one(
                    {"_id": image["_id"]},
                    {"$push": {"activeAccess": new_access}}
                )
        
        logger.info(f"✅ Granted access to {len(owner_images)} images for {requester_username}")
        
        return {
            "success": True,
            "message": "Image access request approved",
            "imagesGranted": len(owner_images)
        }
        
    except HTTPException:
        raise
    except Exception as error:
        logger.error(f"❌ Error approving request: {error}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to approve request: {str(error)}"
        )

@router.post("/requests/{request_id}/deny")
async def deny_image_access_request(
    request_id: str,
    body: Dict = Body(...),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Deny/reject an image access request.
    """
    try:
        owner_username = body.get("ownerUsername")
        if not owner_username:
            raise HTTPException(status_code=400, detail="ownerUsername is required")
        
        logger.info(f"❌ Denying image access request {request_id} for owner {owner_username}")
        
        # Find the request
        request = await db.imageaccessrequests.find_one({"_id": ObjectId(request_id)})
        if not request:
            raise HTTPException(status_code=404, detail="Request not found")
        
        # Update request status to denied
        await db.imageaccessrequests.update_one(
            {"_id": ObjectId(request_id)},
            {
                "$set": {
                    "status": "denied",
                    "deniedAt": datetime.now(timezone.utc)
                }
            }
        )
        
        logger.info(f"✅ Successfully denied image access request {request_id}")
        
        return {
            "success": True,
            "message": "Image access request denied"
        }
        
    except HTTPException:
        raise
    except Exception as error:
        logger.error(f"❌ Error denying request: {error}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to deny request: {str(error)}"
        )
