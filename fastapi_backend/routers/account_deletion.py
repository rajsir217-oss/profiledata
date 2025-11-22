"""
Account Deletion & Unsubscribe System
Implements soft delete with 30-day grace period, data export, and email preferences
"""

from fastapi import APIRouter, Depends, HTTPException, status, Body
from datetime import datetime, timedelta
from typing import Optional, Dict
import logging
import json
from bson import ObjectId

from database import get_database
from auth.jwt_auth import get_current_user_dependency as get_current_user
from crypto_utils import get_encryptor
from services.notification_service import NotificationService
import re

router = APIRouter(prefix="/api/users/account", tags=["account-deletion"])
logger = logging.getLogger(__name__)

# Helper function for case-insensitive username lookup
def get_username_query(username: str):
    """Create a case-insensitive MongoDB query for username"""
    return {"username": {"$regex": f"^{re.escape(username)}$", "$options": "i"}}

@router.post("/request-deletion")
async def request_account_deletion(
    reason: Optional[str] = Body(None),
    downloadData: bool = Body(False),
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """
    Request account deletion with 30-day grace period
    - Immediately hides profile from searches
    - Pauses all services (messaging, matching)
    - Sends confirmation email with reactivation link
    """
    username = current_user.get("username")
    logger.info(f"🗑️ Account deletion requested by: {username}")
    
    try:
        # Find user
        user = await db.users.find_one(get_username_query(username))
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Check if already pending deletion
        if user.get("deletionRequest", {}).get("status") == "pending_deletion":
            scheduled_date = user["deletionRequest"]["scheduledDeletionDate"]
            return {
                "message": "Deletion already scheduled",
                "scheduledDate": scheduled_date,
                "daysRemaining": (datetime.fromisoformat(scheduled_date) - datetime.utcnow()).days
            }
        
        # Calculate deletion date (30 days from now)
        requested_at = datetime.utcnow()
        scheduled_deletion_date = requested_at + timedelta(days=30)
        
        # Generate data export if requested
        data_export_url = None
        if downloadData:
            data_export_url = await generate_data_export(username, db)
        
        # Update user with deletion request
        deletion_request = {
            "status": "pending_deletion",
            "requestedAt": requested_at.isoformat(),
            "scheduledDeletionDate": scheduled_deletion_date.isoformat(),
            "reason": reason or "Not specified",
            "dataExportUrl": data_export_url,
            "emailsSent": {
                "confirmation": False,
                "day7Reminder": False,
                "day23Warning": False,
                "finalDeletion": False
            }
        }
        
        await db.users.update_one(
            {"username": username},
            {
                "$set": {
                    "deletionRequest": deletion_request,
                    "status.status": "pending_deletion",
                    "status.updatedAt": requested_at.isoformat(),
                    "status.reason": "User requested account deletion"
                }
            }
        )
        
        # Send confirmation email
        await send_deletion_confirmation_email(user, scheduled_deletion_date, data_export_url, db)
        
        # Mark confirmation email as sent
        await db.users.update_one(
            {"username": username},
            {"$set": {"deletionRequest.emailsSent.confirmation": True}}
        )
        
        logger.info(f"✅ Deletion scheduled for {username} on {scheduled_deletion_date}")
        
        return {
            "message": f"Deletion scheduled for {scheduled_deletion_date.strftime('%B %d, %Y')}",
            "scheduledDate": scheduled_deletion_date.isoformat(),
            "daysRemaining": 30,
            "dataExportUrl": data_export_url
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error requesting deletion for {username}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/cancel-deletion")
async def cancel_account_deletion(
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """
    Cancel pending account deletion and reactivate account
    - Removes deletion request
    - Restores account to active status
    - Sends reactivation confirmation email
    """
    username = current_user.get("username")
    logger.info(f"🔄 Account reactivation requested by: {username}")
    
    try:
        # Find user
        user = await db.users.find_one(get_username_query(username))
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Check if deletion is pending
        if user.get("deletionRequest", {}).get("status") != "pending_deletion":
            return {"message": "No pending deletion found", "status": "active"}
        
        # Remove deletion request and reactivate account
        await db.users.update_one(
            {"username": username},
            {
                "$unset": {"deletionRequest": ""},
                "$set": {
                    "status.status": "active",
                    "status.updatedAt": datetime.utcnow().isoformat(),
                    "status.reason": "User reactivated account"
                }
            }
        )
        
        # Send reactivation confirmation email
        await send_reactivation_email(user, db)
        
        logger.info(f"✅ Account reactivated: {username}")
        
        return {
            "message": "Account reactivated successfully",
            "status": "active"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error reactivating {username}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/export-data")
async def export_account_data(
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """
    Export all user data in JSON format (GDPR compliance)
    Includes: profile, messages, matches, favorites, activity logs
    """
    username = current_user.get("username")
    logger.info(f"📦 Data export requested by: {username}")
    
    try:
        # Collect all user data
        export_data = {
            "exportDate": datetime.utcnow().isoformat(),
            "username": username,
            "profile": await get_user_profile_data(username, db),
            "messages": await get_user_messages(username, db),
            "favorites": await get_user_favorites(username, db),
            "shortlists": await get_user_shortlists(username, db),
            "matches": await get_user_matches(username, db),
            "activityLogs": await get_user_activity_logs(username, db),
            "profileViews": await get_user_profile_views(username, db)
        }
        
        logger.info(f"✅ Data export generated for {username}")
        
        from fastapi.responses import JSONResponse
        return JSONResponse(
            content=export_data,
            headers={
                "Content-Disposition": f'attachment; filename="account-data-{username}-{datetime.utcnow().strftime("%Y%m%d")}.json"'
            }
        )
        
    except Exception as e:
        logger.error(f"❌ Error exporting data for {username}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/email-preferences")
async def get_email_preferences(
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Get user's email notification preferences"""
    username = current_user.get("username")
    
    try:
        user = await db.users.find_one(get_username_query(username))
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Default preferences if not set
        default_prefs = {
            "marketing": True,
            "matchNotifications": True,
            "messageAlerts": True,
            "activityUpdates": True,
            "systemEmails": True  # Always true, cannot be disabled
        }
        
        preferences = user.get("emailPreferences", default_prefs)
        return {"preferences": preferences}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error getting email preferences: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/email-preferences")
async def update_email_preferences(
    preferences: Dict[str, bool] = Body(...),
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Update user's email notification preferences"""
    username = current_user.get("username")
    logger.info(f"📧 Updating email preferences for: {username}")
    
    try:
        # Ensure systemEmails is always True
        preferences["systemEmails"] = True
        
        await db.users.update_one(
            {"username": username},
            {"$set": {"emailPreferences": preferences}}
        )
        
        logger.info(f"✅ Email preferences updated for {username}")
        
        return {
            "message": "Email preferences updated successfully",
            "preferences": preferences
        }
        
    except Exception as e:
        logger.error(f"❌ Error updating email preferences: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Helper functions

async def generate_data_export(username: str, db) -> str:
    """Generate data export and return download URL"""
    # TODO: Implement actual file storage and URL generation
    # For now, return placeholder
    return f"/api/users/account/export-data"


async def get_user_profile_data(username: str, db) -> dict:
    """Get user profile with decrypted PII"""
    user = await db.users.find_one(get_username_query(username))
    if not user:
        return {}
    
    # Decrypt PII fields
    encryptor = get_encryptor()
    decrypted_user = encryptor.decrypt_user_pii(user)
    
    # Remove sensitive fields
    decrypted_user.pop("password", None)
    decrypted_user.pop("_id", None)
    
    return decrypted_user


async def get_user_messages(username: str, db) -> list:
    """Get all user messages"""
    messages = await db.messages.find({
        "$or": [
            {"fromUsername": username},
            {"toUsername": username}
        ]
    }).to_list(1000)
    
    # Remove _id fields
    for msg in messages:
        msg.pop("_id", None)
    
    return messages


async def get_user_favorites(username: str, db) -> list:
    """Get user's favorites"""
    favorites = await db.favorites.find({
        "$or": [
            {"userUsername": username},
            {"favoriteUsername": username}
        ]
    }).to_list(1000)
    
    for fav in favorites:
        fav.pop("_id", None)
    
    return favorites


async def get_user_shortlists(username: str, db) -> list:
    """Get user's shortlists"""
    shortlists = await db.shortlists.find({
        "$or": [
            {"userUsername": username},
            {"shortlistedUsername": username}
        ]
    }).to_list(1000)
    
    for sl in shortlists:
        sl.pop("_id", None)
    
    return shortlists


async def get_user_matches(username: str, db) -> list:
    """Get user's match history"""
    # TODO: Implement match retrieval if you have a matches collection
    return []


async def get_user_activity_logs(username: str, db) -> list:
    """Get user's activity logs"""
    logs = await db.activity_logs.find({"username": username}).to_list(500)
    
    for log in logs:
        log.pop("_id", None)
    
    return logs


async def get_user_profile_views(username: str, db) -> list:
    """Get profile views (who viewed this user)"""
    views = await db.profile_views.find({
        "$or": [
            {"viewer_username": username},
            {"viewed_username": username}
        ]
    }).to_list(500)
    
    for view in views:
        view.pop("_id", None)
    
    return views


async def send_deletion_confirmation_email(user: dict, scheduled_date: datetime, data_export_url: Optional[str], db):
    """Send deletion confirmation email"""
    notification_service = NotificationService(db)
    
    first_name = user.get("firstName", user.get("username"))
    
    # Build data export section separately to avoid f-string backslash issues
    data_export_section = ""
    if data_export_url:
        data_export_section = f"DOWNLOAD YOUR DATA:\n{data_export_url}\n\n"
    
    message = f"""
    Hi {first_name},
    
    We've received your request to delete your L3V3L account.
    
    ⚠️ IMPORTANT INFORMATION:
    
    • Your account will be permanently deleted on {scheduled_date.strftime('%B %d, %Y')}
    • You have 30 days to reactivate if you change your mind
    • During this period:
      - Your profile is hidden from all users
      - You cannot send or receive messages
      - All matchmaking is paused
    
    REACTIVATE YOUR ACCOUNT:
    Simply log back in at https://l3v3lmatches.com/login
    
    {data_export_section}Need help? Contact us: support@l3v3lmatches.com
    
    Best regards,
    The L3V3L Team
    """
    
    await notification_service.queue_notification(
        username=user.get("username"),
        notification_type="account_deletion_confirmation",
        channel="email",
        title="Account Deletion Requested - You Have 30 Days",
        message=message,
        metadata={"scheduled_date": scheduled_date.isoformat()}
    )


async def send_reactivation_email(user: dict, db):
    """Send reactivation confirmation email"""
    notification_service = NotificationService(db)
    
    first_name = user.get("firstName", user.get("username"))
    
    message = f"""
    Hi {first_name},
    
    Welcome back! Your L3V3L account has been successfully reactivated.
    
    ✅ Your account is now active again:
    • Your profile is visible in searches
    • You can send and receive messages
    • Matchmaking has resumed
    
    We're glad you're staying with us!
    
    Best regards,
    The L3V3L Team
    """
    
    await notification_service.queue_notification(
        username=user.get("username"),
        notification_type="account_reactivation",
        channel="email",
        title="Welcome Back - Account Reactivated",
        message=message
    )
