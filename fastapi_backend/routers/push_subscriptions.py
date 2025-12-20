"""
Push Subscriptions Router
Manages device token registration for push notifications
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from pymongo.database import Database

from database import get_database
from auth.jwt_auth import get_current_user_dependency as get_current_user

router = APIRouter(prefix="/api/push-subscriptions", tags=["push-subscriptions"])


class PushSubscriptionCreate(BaseModel):
    """Model for creating push subscription"""
    token: str = Field(..., description="FCM device token")
    deviceInfo: Optional[dict] = Field(None, description="Device information (browser, OS, etc.)")


class PushSubscriptionResponse(BaseModel):
    """Response model for push subscription"""
    username: str
    token: str
    subscribedAt: datetime
    isActive: bool
    deviceInfo: Optional[dict]


@router.post("/subscribe", response_model=dict)
async def subscribe_to_push(
    subscription: PushSubscriptionCreate,
    current_user: dict = Depends(get_current_user),
    db: Database = Depends(get_database)
):
    """
    Register device token for push notifications
    
    - Stores FCM token for current user
    - If token already exists, updates timestamp
    - Supports multiple devices per user
    """
    import logging
    logger = logging.getLogger(__name__)
    
    try:
        username = current_user["username"]
        logger.info(f"[Push Subscribe] User: {username}, Token: {subscription.token[:20]}...")
        
        # Check if token already exists
        existing = await db.push_subscriptions.find_one({
            "username": username,
            "token": subscription.token
        })
        
        if existing:
            # Update existing subscription
            logger.info(f"[Push Subscribe] Updating existing subscription for {username}")
            await db.push_subscriptions.update_one(
                {"_id": existing["_id"]},
                {
                    "$set": {
                        "subscribedAt": datetime.utcnow(),
                        "isActive": True,
                        "deviceInfo": subscription.deviceInfo
                    }
                }
            )
            
            return {
                "success": True,
                "message": "Push subscription updated",
                "action": "updated"
            }
        else:
            # Create new subscription
            logger.info(f"[Push Subscribe] Creating new subscription for {username}")
            subscription_doc = {
                "username": username,
                "token": subscription.token,
                "subscribedAt": datetime.utcnow(),
                "isActive": True,
                "deviceInfo": subscription.deviceInfo or {}
            }
            
            await db.push_subscriptions.insert_one(subscription_doc)
            
            return {
                "success": True,
                "message": "Subscribed to push notifications",
                "action": "created"
            }
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to subscribe: {str(e)}")


@router.delete("/unsubscribe")
async def unsubscribe_from_push(
    token: str = Query(..., description="FCM token to unsubscribe"),
    current_user: dict = Depends(get_current_user),
    db: Database = Depends(get_database)
):
    """
    Unsubscribe device from push notifications
    
    - Marks token as inactive (soft delete)
    - User won't receive notifications on this device
    """
    try:
        username = current_user["username"]
        
        result = await db.push_subscriptions.update_one(
            {
                "username": username,
                "token": token
            },
            {
                "$set": {
                    "isActive": False,
                    "unsubscribedAt": datetime.utcnow()
                }
            }
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail="Subscription not found")
        
        return {
            "success": True,
            "message": "Unsubscribed from push notifications"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to unsubscribe: {str(e)}")


@router.get("/my-subscriptions", response_model=List[PushSubscriptionResponse])
async def get_my_subscriptions(
    current_user: dict = Depends(get_current_user),
    db: Database = Depends(get_database)
):
    """
    Get all active push subscriptions for current user
    
    - Returns list of registered devices
    - Shows which devices are receiving notifications
    """
    try:
        username = current_user["username"]
        
        subscriptions = await db.push_subscriptions.find({
            "username": username,
            "isActive": True
        }).to_list(length=100)
        
        # Convert ObjectId to string for response
        for sub in subscriptions:
            sub["_id"] = str(sub["_id"])
        
        return subscriptions
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch subscriptions: {str(e)}")


@router.delete("/all")
async def unsubscribe_all_devices(
    current_user: dict = Depends(get_current_user),
    db: Database = Depends(get_database)
):
    """
    Unsubscribe all devices for current user
    
    - Deactivates all push subscriptions
    - User won't receive notifications on any device
    """
    try:
        username = current_user["username"]
        
        result = await db.push_subscriptions.update_many(
            {
                "username": username,
                "isActive": True
            },
            {
                "$set": {
                    "isActive": False,
                    "unsubscribedAt": datetime.utcnow()
                }
            }
        )
        
        return {
            "success": True,
            "message": f"Unsubscribed {result.modified_count} device(s)",
            "count": result.modified_count
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to unsubscribe all: {str(e)}")


@router.post("/test")
async def send_test_notification(
    current_user: dict = Depends(get_current_user),
    db: Database = Depends(get_database)
):
    """
    Send a test push notification to current user's devices
    
    - Useful for testing push notification setup
    - Sends to all active devices
    """
    try:
        from services.push_service import PushNotificationService
        import logging
        logger = logging.getLogger(__name__)
        
        username = current_user["username"]
        logger.info(f"[Push Test] Looking for subscriptions for user: {username}")
        
        # Get user's active tokens
        subscriptions = await db.push_subscriptions.find({
            "username": username,
            "isActive": True
        }).to_list(length=100)
        
        logger.info(f"[Push Test] Found {len(subscriptions)} subscriptions")
        
        if not subscriptions:
            return {
                "success": False,
                "message": "No active push subscriptions found"
            }
        
        tokens = [sub["token"] for sub in subscriptions]
        logger.info(f"[Push Test] Tokens to send: {[t[:30] + '...' for t in tokens]}")
        
        # Send test notification using single send for each token
        push_service = PushNotificationService()
        success_count = 0
        failure_count = 0
        errors = []
        
        for token in tokens:
            result = await push_service.send_to_token(
                token=token,
                title="🦋 L3V3L Matches",
                body="Push notifications enabled! You'll receive alerts for new matches, messages & more.",
                data={
                    "type": "test",
                    "timestamp": datetime.utcnow().isoformat()
                }
            )
            if result.get("success"):
                success_count += 1
            else:
                failure_count += 1
                errors.append(result.get("error", "Unknown error"))
        
        return {
            "success": success_count > 0,
            "message": f"Test sent to {success_count} device(s)",
            "details": {
                "successCount": success_count,
                "failureCount": failure_count,
                "errors": errors
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to send test: {str(e)}")


@router.get("/debug-firebase")
async def debug_firebase():
    """Debug endpoint to check Firebase initialization status"""
    import os
    from services.push_service import PushNotificationService, FIREBASE_AVAILABLE
    
    return {
        "firebase_sdk_available": FIREBASE_AVAILABLE,
        "firebase_initialized": PushNotificationService._initialized,
        "env_vars": {
            "FIREBASE_PROJECT_ID": os.getenv("FIREBASE_PROJECT_ID", "NOT SET"),
            "FIREBASE_CLIENT_EMAIL": os.getenv("FIREBASE_CLIENT_EMAIL", "NOT SET")[:30] + "..." if os.getenv("FIREBASE_CLIENT_EMAIL") else "NOT SET",
            "FIREBASE_PRIVATE_KEY_SET": bool(os.getenv("FIREBASE_PRIVATE_KEY")),
            "FIREBASE_PRIVATE_KEY_LENGTH": len(os.getenv("FIREBASE_PRIVATE_KEY", "")),
        }
    }


@router.get("/stats")
async def get_subscription_stats(
    current_user: dict = Depends(get_current_user),
    db: Database = Depends(get_database)
):
    """
    Get push subscription statistics for current user
    
    - Total devices
    - Active vs inactive
    - Recent subscription activity
    """
    try:
        username = current_user["username"]
        
        total = await db.push_subscriptions.count_documents({"username": username})
        active = await db.push_subscriptions.count_documents({
            "username": username,
            "isActive": True
        })
        inactive = total - active
        
        # Get most recent subscription
        recent = await db.push_subscriptions.find({
            "username": username
        }).sort("subscribedAt", -1).limit(1).to_list(1)
        
        last_subscribed = recent[0]["subscribedAt"] if recent else None
        
        return {
            "success": True,
            "stats": {
                "total": total,
                "active": active,
                "inactive": inactive,
                "lastSubscribed": last_subscribed
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get stats: {str(e)}")
