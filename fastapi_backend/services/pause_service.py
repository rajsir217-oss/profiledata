"""
Pause Service
Business logic for account pausing/unpausing

Created: November 2, 2025
Purpose: Handle user account pause/unpause functionality
"""

from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from motor.motor_asyncio import AsyncIOMotorDatabase
from services.notification_service import NotificationService
from models.notification_models import (
    NotificationTrigger,
    NotificationChannel,
    NotificationQueueCreate
)


class PauseService:
    """Service for managing account pause/unpause functionality"""
    
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.users_collection = db.users
        self.notification_service = NotificationService(db)
    
    async def pause_user(
        self,
        username: str,
        duration_days: Optional[int] = None,
        reason: Optional[str] = None,
        message: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Pause user account
        
        Args:
            username: User to pause
            duration_days: Auto-unpause after X days (None = manual only)
            reason: Pause reason
            message: Custom message to show others
            
        Returns:
            Dictionary with pause details and status
        """
        now = datetime.utcnow()
        paused_until = None
        
        if duration_days:
            paused_until = now + timedelta(days=duration_days)
        
        # Update user document
        result = await self.users_collection.update_one(
            {"username": username},
            {
                "$set": {
                    "accountStatus": "paused",
                    "pausedAt": now,
                    "pausedUntil": paused_until,
                    "pauseReason": reason,
                    "pauseMessage": message
                },
                "$inc": {
                    "pauseCount": 1
                }
            }
        )
        
        if result.modified_count == 0:
            return {
                "success": False,
                "accountStatus": "unknown",
                "pausedAt": None,
                "pausedUntil": None,
                "message": "Failed to pause account. User not found."
            }
        
        # Send pause confirmation notification
        try:
            await self.notification_service.enqueue_notification(
                NotificationQueueCreate(
                    username=username,
                    trigger=NotificationTrigger.ACCOUNT_PAUSED,
                    channels=[NotificationChannel.EMAIL],
                    templateData={
                        "pauseReason": reason or "Not specified",
                        "pauseMessage": message or "",
                        "pausedUntil": paused_until.isoformat() if paused_until else None,
                        "isDurationBased": paused_until is not None
                    }
                )
            )
        except Exception as e:
            # Log error but don't fail the pause operation
            print(f"Failed to send pause notification: {e}")
        
        duration_text = ""
        if paused_until:
            duration_text = f" until {paused_until.strftime('%B %d, %Y')}"
        
        return {
            "success": True,
            "accountStatus": "paused",
            "pausedAt": now,
            "pausedUntil": paused_until,
            "message": f"Account paused successfully{duration_text}. You can unpause anytime!"
        }
    
    async def unpause_user(self, username: str) -> Dict[str, Any]:
        """
        Unpause user account and restore to active status
        
        Args:
            username: User to unpause
            
        Returns:
            Dictionary with unpause details and status
        """
        now = datetime.utcnow()
        
        # Get user before unpausing (to check if they were paused)
        user = await self.users_collection.find_one({"username": username})
        
        if not user:
            return {
                "success": False,
                "accountStatus": "unknown",
                "pausedAt": None,
                "pausedUntil": None,
                "message": "User not found"
            }
        
        was_paused = user.get("accountStatus") == "paused"
        
        # Update user document
        result = await self.users_collection.update_one(
            {"username": username},
            {
                "$set": {
                    "accountStatus": "active",
                    "pausedAt": None,
                    "pausedUntil": None,
                    "pauseReason": None,
                    "pauseMessage": None,
                    "lastUnpausedAt": now
                }
            }
        )
        
        if result.modified_count == 0 and not was_paused:
            return {
                "success": True,
                "accountStatus": "active",
                "pausedAt": None,
                "pausedUntil": None,
                "message": "Account is already active"
            }
        
        # Send unpause notification
        try:
            await self.notification_service.enqueue_notification(
                NotificationQueueCreate(
                    username=username,
                    trigger=NotificationTrigger.ACCOUNT_UNPAUSED,
                    channels=[NotificationChannel.EMAIL],
                    templateData={
                        "wasAutoUnpause": not was_paused,
                        "unpausedAt": now.isoformat()
                    }
                )
            )
        except Exception as e:
            # Log error but don't fail the unpause operation
            print(f"Failed to send unpause notification: {e}")
        
        return {
            "success": True,
            "accountStatus": "active",
            "pausedAt": None,
            "pausedUntil": None,
            "message": "Welcome back! Your account is active again. You're visible in searches and can send messages."
        }
    
    async def get_pause_status(self, username: str) -> Dict[str, Any]:
        """
        Get current pause status for a user
        
        Args:
            username: User to check
            
        Returns:
            Dictionary with pause status details
        """
        user = await self.users_collection.find_one({"username": username})
        
        if not user:
            return {
                "accountStatus": "unknown",
                "isPaused": False,
                "pausedAt": None,
                "pausedUntil": None,
                "pauseReason": None,
                "pauseMessage": None,
                "pauseCount": 0
            }
        
        account_status = user.get("accountStatus", "active")
        
        return {
            "accountStatus": account_status,
            "isPaused": account_status == "paused",
            "pausedAt": user.get("pausedAt"),
            "pausedUntil": user.get("pausedUntil"),
            "pauseReason": user.get("pauseReason"),
            "pauseMessage": user.get("pauseMessage"),
            "pauseCount": user.get("pauseCount", 0),
            "lastUnpausedAt": user.get("lastUnpausedAt")
        }
    
    async def check_auto_unpause(self) -> int:
        """
        Check for users who should be auto-unpaused
        Called by scheduler job every hour
        
        Returns:
            Number of users auto-unpaused
        """
        now = datetime.utcnow()
        
        # Find users with expired pause
        users_to_unpause = await self.users_collection.find({
            "accountStatus": "paused",
            "pausedUntil": {"$lte": now, "$ne": None}
        }).to_list(None)
        
        unpause_count = 0
        
        for user in users_to_unpause:
            result = await self.unpause_user(user["username"])
            if result["success"]:
                unpause_count += 1
                # Unpause notification is already sent by unpause_user()
        
        return unpause_count
    
    async def update_pause_settings(
        self,
        username: str,
        duration_days: Optional[int] = None,
        message: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Update pause duration or message for already paused user
        
        Args:
            username: User to update
            duration_days: New duration (None = manual unpause)
            message: New custom message
            
        Returns:
            Dictionary with updated pause details
        """
        user = await self.users_collection.find_one({"username": username})
        
        if not user or user.get("accountStatus") != "paused":
            return {
                "success": False,
                "message": "User is not currently paused"
            }
        
        now = datetime.utcnow()
        paused_at = user.get("pausedAt", now)
        paused_until = None
        
        if duration_days:
            # Calculate from original pause time
            paused_until = paused_at + timedelta(days=duration_days)
        
        update_fields = {}
        if duration_days is not None:
            update_fields["pausedUntil"] = paused_until
        if message is not None:
            update_fields["pauseMessage"] = message
        
        if update_fields:
            await self.users_collection.update_one(
                {"username": username},
                {"$set": update_fields}
            )
        
        return {
            "success": True,
            "pausedUntil": paused_until,
            "pauseMessage": message,
            "message": "Pause settings updated successfully"
        }
