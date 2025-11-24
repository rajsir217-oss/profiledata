"""
User Invitation Routes
Created: November 23, 2025
Purpose: Allow regular users to invite friends and family
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import Optional, List
from motor.motor_asyncio import AsyncIOMotorDatabase
from datetime import datetime

from auth.jwt_auth import get_current_user_dependency as get_current_user
from database import get_database
from models.invitation_models import (
    InvitationCreate,
    InvitationResponse,
    InvitationChannel,
    InvitationStatus
)
from services.invitation_service import InvitationService


router = APIRouter(prefix="/api/user-invitations", tags=["user-invitations"])


# User invitation limits
MAX_INVITATIONS_PER_USER = 10  # Each user can send up to 10 invitations
INVITATION_VALIDITY_DAYS = 30


@router.get("/my-invitations", response_model=List[InvitationResponse])
async def get_my_invitations(
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Get invitations sent by current user
    Shows only their own invitations with status
    """
    service = InvitationService(db)
    username = current_user["username"]
    
    # Get all invitations sent by this user
    invitations = await service.list_invitations(
        skip=0,
        limit=100,
        include_archived=True,
        status_filter=None
    )
    
    # Filter to only show invitations sent by this user
    user_invitations = [
        inv for inv in invitations 
        if inv.invitedBy == username
    ]
    
    return user_invitations


@router.get("/stats")
async def get_user_invitation_stats(
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Get invitation statistics for current user"""
    username = current_user["username"]
    
    total_sent = await db.invitations.count_documents({
        "invitedBy": username
    })
    
    accepted = await db.invitations.count_documents({
        "invitedBy": username,
        "registeredAt": {"$ne": None}
    })
    
    pending = await db.invitations.count_documents({
        "invitedBy": username,
        "archived": False,
        "$or": [
            {"emailStatus": InvitationStatus.PENDING},
            {"emailStatus": InvitationStatus.SENT}
        ]
    })
    
    remaining = MAX_INVITATIONS_PER_USER - total_sent
    
    return {
        "totalSent": total_sent,
        "accepted": accepted,
        "pending": pending,
        "remaining": remaining if remaining > 0 else 0,
        "maxAllowed": MAX_INVITATIONS_PER_USER
    }


@router.post("", response_model=InvitationResponse, status_code=status.HTTP_201_CREATED)
async def send_invitation(
    invitation: InvitationCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Send invitation to friend or family member
    
    - **name**: Friend's name
    - **email**: Friend's email address
    - **phone**: Optional phone number
    - **channel**: EMAIL, SMS, or BOTH (default: EMAIL)
    - **customMessage**: Personal message (optional)
    - **sendImmediately**: Send now (default: true)
    """
    username = current_user["username"]
    service = InvitationService(db)
    
    # Check invitation limit
    total_sent = await db.invitations.count_documents({
        "invitedBy": username
    })
    
    if total_sent >= MAX_INVITATIONS_PER_USER:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"You have reached the maximum limit of {MAX_INVITATIONS_PER_USER} invitations"
        )
    
    try:
        # Create invitation
        new_invitation = await service.create_invitation(
            invitation_data=invitation,
            invited_by=username
        )
        
        # Send invitation if requested
        if invitation.sendImmediately:
            from routers.invitations import send_invitation_notifications
            await send_invitation_notifications(
                invitation=new_invitation,
                channel=invitation.channel,
                db=db
            )
        
        # Convert to response
        time_lapse = service._calculate_time_lapse(new_invitation.createdAt)
        return InvitationResponse(
            **new_invitation.dict(),
            timeLapse=time_lapse,
            isExpired=False
        )
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to send invitation: {str(e)}"
        )


@router.post("/{invitation_id}/resend")
async def resend_my_invitation(
    invitation_id: str,
    channel: InvitationChannel = Query(InvitationChannel.EMAIL),
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Resend an invitation sent by current user"""
    username = current_user["username"]
    service = InvitationService(db)
    
    # Get invitation
    invitation = await service.get_invitation(invitation_id)
    
    if not invitation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invitation not found"
        )
    
    # Verify ownership
    if invitation.invitedBy != username:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only resend invitations you sent"
        )
    
    # Check if already accepted
    if invitation.emailStatus == InvitationStatus.ACCEPTED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This invitation has already been accepted"
        )
    
    # Resend invitation
    from routers.invitations import send_invitation_notifications
    await send_invitation_notifications(
        invitation=invitation,
        channel=channel,
        db=db
    )
    
    return {"message": "Invitation resent successfully"}


@router.delete("/{invitation_id}")
async def cancel_my_invitation(
    invitation_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Cancel/archive an invitation sent by current user"""
    username = current_user["username"]
    service = InvitationService(db)
    
    # Get invitation
    invitation = await service.get_invitation(invitation_id)
    
    if not invitation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invitation not found"
        )
    
    # Verify ownership
    if invitation.invitedBy != username:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only cancel invitations you sent"
        )
    
    # Archive invitation
    success = await service.archive_invitation(invitation_id)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to cancel invitation"
        )
    
    return {"message": "Invitation cancelled successfully"}
