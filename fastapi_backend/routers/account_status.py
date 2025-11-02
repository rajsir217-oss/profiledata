"""
Account Status Management Router
Handles pause/unpause functionality

Created: November 2, 2025
Purpose: API endpoints for account pause/unpause
"""

from fastapi import APIRouter, Depends, HTTPException, status
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field

from auth.jwt_auth import get_current_user_dependency as get_current_user
from database import get_database
from services.pause_service import PauseService


router = APIRouter(prefix="/api/account", tags=["account"])


# Request/Response Models

class PauseRequest(BaseModel):
    """Request to pause account"""
    duration: Optional[int] = Field(
        None,
        description="Duration in days (null = manual unpause only)",
        ge=1,
        le=365
    )
    reason: Optional[str] = Field(
        None,
        description="Reason for pausing",
        max_length=100
    )
    message: Optional[str] = Field(
        None,
        description="Custom message to show others",
        max_length=200
    )


class PauseResponse(BaseModel):
    """Response from pause/unpause operation"""
    success: bool
    accountStatus: str
    pausedAt: Optional[datetime]
    pausedUntil: Optional[datetime]
    message: str


class PauseStatusResponse(BaseModel):
    """Current pause status"""
    accountStatus: str
    isPaused: bool
    pausedAt: Optional[datetime]
    pausedUntil: Optional[datetime]
    pauseReason: Optional[str]
    pauseMessage: Optional[str]
    pauseCount: int
    lastUnpausedAt: Optional[datetime] = None


class UpdatePauseSettingsRequest(BaseModel):
    """Update pause settings"""
    duration: Optional[int] = Field(
        None,
        description="New duration in days",
        ge=1,
        le=365
    )
    message: Optional[str] = Field(
        None,
        description="New custom message",
        max_length=200
    )


# API Endpoints

@router.post("/pause", response_model=PauseResponse, status_code=status.HTTP_200_OK)
async def pause_account(
    request: PauseRequest,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """
    Pause user account
    
    When paused:
    - Hidden from all searches
    - No new matches generated
    - Cannot send/receive messages
    - Profile shows "on break" status
    - Subscription continues
    - Can edit profile
    - Can unpause anytime
    """
    pause_service = PauseService(db)
    
    # Check if already paused
    status_check = await pause_service.get_pause_status(current_user["username"])
    if status_check["isPaused"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Account is already paused. Use PATCH /api/account/pause-settings to update settings."
        )
    
    result = await pause_service.pause_user(
        username=current_user["username"],
        duration_days=request.duration,
        reason=request.reason,
        message=request.message
    )
    
    if not result["success"]:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=result["message"]
        )
    
    return PauseResponse(**result)


@router.post("/unpause", response_model=PauseResponse, status_code=status.HTTP_200_OK)
async def unpause_account(
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """
    Unpause user account and restore to active status
    
    When unpaused:
    - Visible in searches again
    - Can send/receive messages
    - Matches will be generated
    - Conversation partners will be notified (Phase 2)
    """
    pause_service = PauseService(db)
    
    # Check if actually paused
    status_check = await pause_service.get_pause_status(current_user["username"])
    if not status_check["isPaused"]:
        return PauseResponse(
            success=True,
            accountStatus="active",
            pausedAt=None,
            pausedUntil=None,
            message="Account is already active"
        )
    
    result = await pause_service.unpause_user(current_user["username"])
    
    if not result["success"]:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=result["message"]
        )
    
    return PauseResponse(**result)


@router.get("/pause-status", response_model=PauseStatusResponse, status_code=status.HTTP_200_OK)
async def get_pause_status(
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """
    Get current pause status for the logged-in user
    
    Returns:
    - accountStatus: "active", "paused", or "deactivated"
    - isPaused: Boolean flag
    - pausedAt: When account was paused
    - pausedUntil: When auto-unpause will occur (null = manual)
    - pauseReason: Why user paused
    - pauseMessage: Custom message for others
    - pauseCount: Total number of times paused
    - lastUnpausedAt: When user last unpaused
    """
    pause_service = PauseService(db)
    
    result = await pause_service.get_pause_status(current_user["username"])
    
    return PauseStatusResponse(**result)


@router.patch("/pause-settings", status_code=status.HTTP_200_OK)
async def update_pause_settings(
    request: UpdatePauseSettingsRequest,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """
    Update pause settings while already paused
    
    Can update:
    - Duration (change auto-unpause date)
    - Custom message shown to others
    
    Must be currently paused to use this endpoint.
    """
    pause_service = PauseService(db)
    
    # Check if paused
    status_check = await pause_service.get_pause_status(current_user["username"])
    if not status_check["isPaused"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Account is not currently paused"
        )
    
    result = await pause_service.update_pause_settings(
        username=current_user["username"],
        duration_days=request.duration,
        message=request.message
    )
    
    if not result["success"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result["message"]
        )
    
    return {
        "success": True,
        "pausedUntil": result.get("pausedUntil"),
        "pauseMessage": result.get("pauseMessage"),
        "message": result["message"]
    }
