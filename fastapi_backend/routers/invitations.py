"""
Invitation API Routes
Created: November 2, 2025
Purpose: API endpoints for invitation management (Admin only)
"""

from fastapi import APIRouter, Depends, HTTPException, status
from typing import Optional
from motor.motor_asyncio import AsyncIOMotorDatabase

from auth.jwt_auth import get_current_user_dependency as get_current_user
from database import get_database
from models.invitation_models import (
    InvitationCreate,
    InvitationUpdate,
    InvitationResponse,
    InvitationListResponse,
    InvitationStats,
    InvitationStatus,
    InvitationChannel,
    ResendInvitationRequest
)
from services.invitation_service import InvitationService


router = APIRouter(prefix="/api/invitations", tags=["invitations"])


def check_admin(current_user: dict):
    """Check if user is admin"""
    if current_user.get("username") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can manage invitations"
        )


@router.post("", response_model=InvitationResponse, status_code=status.HTTP_201_CREATED)
async def create_invitation(
    invitation: InvitationCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Create new invitation (Admin only)
    
    - **name**: Invitee name
    - **email**: Invitee email address
    - **phone**: Optional phone number for SMS
    - **channel**: EMAIL, SMS, or BOTH
    - **customMessage**: Optional custom message
    - **sendImmediately**: Send invitation right away
    """
    check_admin(current_user)
    
    service = InvitationService(db)
    
    try:
        # Create invitation
        new_invitation = await service.create_invitation(
            invitation_data=invitation,
            invited_by=current_user["username"]
        )
        
        # Send invitation if requested
        if invitation.sendImmediately:
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
            detail=f"Failed to create invitation: {str(e)}"
        )


@router.get("", response_model=InvitationListResponse)
async def list_invitations(
    skip: int = 0,
    limit: int = 100,
    include_archived: bool = False,
    status: Optional[InvitationStatus] = None,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    List all invitations with pagination and filters (Admin only)
    
    - **skip**: Number of items to skip
    - **limit**: Maximum number of items to return
    - **include_archived**: Include archived invitations
    - **status**: Filter by status (PENDING, SENT, ACCEPTED, etc.)
    """
    check_admin(current_user)
    
    service = InvitationService(db)
    invitations = await service.list_invitations(
        skip=skip,
        limit=limit,
        include_archived=include_archived,
        status_filter=status
    )
    
    # Get counts
    total = await db.invitations.count_documents({})
    archived = await db.invitations.count_documents({"archived": True})
    pending = await db.invitations.count_documents({
        "archived": False,
        "$or": [
            {"emailStatus": InvitationStatus.PENDING},
            {"smsStatus": InvitationStatus.PENDING}
        ]
    })
    accepted = await db.invitations.count_documents({
        "registeredAt": {"$ne": None}
    })
    
    return InvitationListResponse(
        invitations=invitations,
        total=total,
        archived=archived,
        pending=pending,
        accepted=accepted
    )


@router.get("/stats", response_model=InvitationStats)
async def get_invitation_stats(
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Get invitation system statistics (Admin only)"""
    check_admin(current_user)
    
    service = InvitationService(db)
    return await service.get_statistics()


@router.get("/{invitation_id}", response_model=InvitationResponse)
async def get_invitation(
    invitation_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Get specific invitation by ID (Admin only)"""
    check_admin(current_user)
    
    service = InvitationService(db)
    invitation = await service.get_invitation(invitation_id)
    
    if not invitation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invitation not found"
        )
    
    time_lapse = service._calculate_time_lapse(invitation.createdAt)
    is_expired = invitation.tokenExpiresAt and invitation.tokenExpiresAt < datetime.utcnow()
    
    return InvitationResponse(
        **invitation.dict(),
        timeLapse=time_lapse,
        isExpired=is_expired
    )


@router.patch("/{invitation_id}", response_model=InvitationResponse)
async def update_invitation(
    invitation_id: str,
    update_data: InvitationUpdate,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Update invitation (Admin only)"""
    check_admin(current_user)
    
    service = InvitationService(db)
    invitation = await service.get_invitation(invitation_id)
    
    if not invitation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invitation not found"
        )
    
    # Update fields
    update_dict = update_data.dict(exclude_unset=True)
    if update_dict:
        from datetime import datetime
        update_dict["updatedAt"] = datetime.utcnow()
        
        from bson import ObjectId
        result = await db.invitations.update_one(
            {"_id": ObjectId(invitation_id)},
            {"$set": update_dict}
        )
        
        if result.modified_count == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to update invitation"
            )
    
    # Get updated invitation
    updated_invitation = await service.get_invitation(invitation_id)
    time_lapse = service._calculate_time_lapse(updated_invitation.createdAt)
    
    return InvitationResponse(
        **updated_invitation.dict(),
        timeLapse=time_lapse,
        isExpired=False
    )


@router.post("/{invitation_id}/resend")
async def resend_invitation(
    invitation_id: str,
    resend_request: ResendInvitationRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Resend invitation via email/SMS (Admin only)"""
    check_admin(current_user)
    
    service = InvitationService(db)
    invitation = await service.get_invitation(invitation_id)
    
    if not invitation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invitation not found"
        )
    
    # Send invitation
    await send_invitation_notifications(
        invitation=invitation,
        channel=resend_request.channel,
        custom_message=resend_request.customMessage,
        db=db
    )
    
    return {"message": "Invitation resent successfully"}


@router.delete("/{invitation_id}/archive")
async def archive_invitation(
    invitation_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Archive an invitation (Admin only)"""
    check_admin(current_user)
    
    service = InvitationService(db)
    success = await service.archive_invitation(invitation_id)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invitation not found"
        )
    
    return {"message": "Invitation archived successfully"}


@router.delete("/{invitation_id}")
async def delete_invitation(
    invitation_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Permanently delete an invitation (Admin only)"""
    check_admin(current_user)
    
    service = InvitationService(db)
    success = await service.delete_invitation(invitation_id)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invitation not found"
        )
    
    return {"message": "Invitation deleted successfully"}


# Helper function to send invitation notifications
async def send_invitation_notifications(
    invitation,
    channel: InvitationChannel,
    custom_message: Optional[str] = None,
    db=None
):
    """Send invitation directly via SMTP (bypasses notification queue)"""
    from config import Settings
    from services.email_sender import send_invitation_email
    settings = Settings()
    
    invitation_service = InvitationService(db)
    invitation_link = f"{settings.app_url}/register?invitation={invitation.invitationToken}"
    
    # Send email
    if channel in [InvitationChannel.EMAIL, InvitationChannel.BOTH]:
        try:
            # Send email directly via SMTP
            await send_invitation_email(
                to_email=invitation.email,
                to_name=invitation.name,
                invitation_link=invitation_link,
                custom_message=custom_message or invitation.customMessage
            )
            
            # Update status
            await invitation_service.update_invitation_status(
                invitation.id,
                InvitationChannel.EMAIL,
                InvitationStatus.SENT
            )
        except Exception as e:
            await invitation_service.update_invitation_status(
                invitation.id,
                InvitationChannel.EMAIL,
                InvitationStatus.FAILED,
                failed_reason=str(e)
            )
    
    # Send SMS (TODO: Implement direct SMS sender)
    if channel in [InvitationChannel.SMS, InvitationChannel.BOTH]:
        if invitation.phone:
            try:
                # For now, mark as pending - SMS implementation needed
                await invitation_service.update_invitation_status(
                    invitation.id,
                    InvitationChannel.SMS,
                    InvitationStatus.PENDING
                )
                # TODO: Implement direct SMS sending via Twilio
            except Exception as e:
                await invitation_service.update_invitation_status(
                    invitation.id,
                    InvitationChannel.SMS,
                    InvitationStatus.FAILED,
                    failed_reason=str(e)
                )


# Import datetime for update_invitation
from datetime import datetime
