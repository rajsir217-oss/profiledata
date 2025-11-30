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
    is_admin = current_user.get("role") == "admin" or current_user.get("role_name") == "admin"
    if not is_admin:
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
    limit: int = 10000,
    include_archived: bool = False,
    status: Optional[InvitationStatus] = None,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    List all invitations with pagination and filters (Admin only)
    
    - **skip**: Number of items to skip
    - **limit**: Maximum number of items to return (default: 10000)
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
@router.put("/{invitation_id}", response_model=InvitationResponse)
async def update_invitation(
    invitation_id: str,
    update_data: InvitationUpdate,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Update invitation (Admin only) - supports both PATCH and PUT"""
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
    
    # CRITICAL: Generate token if missing (for bulk-imported invitations)
    if not invitation.invitationToken:
        import secrets
        import string
        from datetime import timedelta
        from bson import ObjectId
        
        # Generate secure token
        alphabet = string.ascii_letters + string.digits
        token = ''.join(secrets.choice(alphabet) for _ in range(32))
        token_expiry = datetime.utcnow() + timedelta(days=30)
        
        # Update invitation with token
        await db.invitations.update_one(
            {"_id": ObjectId(invitation_id)},
            {
                "$set": {
                    "invitationToken": token,
                    "tokenExpiresAt": token_expiry,
                    "updatedAt": datetime.utcnow()
                }
            }
        )
        
        # Update the in-memory invitation object
        invitation.invitationToken = token
        invitation.tokenExpiresAt = token_expiry
    
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


@router.post("/bulk-send")
async def bulk_send_invitations(
    data: dict,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Send multiple invitations in bulk (Admin only)
    
    Request body:
    {
        "invitationIds": ["id1", "id2", ...],
        "channel": "email",  # or "sms" or "both"
        "emailSubject": "Optional custom subject"
    }
    """
    check_admin(current_user)
    
    invitation_ids = data.get("invitationIds", [])
    channel = data.get("channel", "email")
    email_subject = data.get("emailSubject")
    
    if not invitation_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No invitation IDs provided"
        )
    
    service = InvitationService(db)
    from bson import ObjectId
    
    results = {
        "total": len(invitation_ids),
        "sent": 0,
        "failed": 0,
        "errors": []
    }
    
    # Process each invitation
    for inv_id in invitation_ids:
        try:
            # Get invitation
            invitation = await service.get_invitation(inv_id)
            
            if not invitation:
                results["failed"] += 1
                results["errors"].append(f"Invitation {inv_id} not found")
                continue
            
            # CRITICAL: Generate token if missing (for bulk-imported invitations)
            if not invitation.invitationToken:
                import secrets
                import string
                from datetime import timedelta
                
                # Generate secure token
                alphabet = string.ascii_letters + string.digits
                token = ''.join(secrets.choice(alphabet) for _ in range(32))
                token_expiry = datetime.utcnow() + timedelta(days=30)
                
                # Update invitation with token
                await db.invitations.update_one(
                    {"_id": ObjectId(inv_id)},
                    {
                        "$set": {
                            "invitationToken": token,
                            "tokenExpiresAt": token_expiry,
                            "updatedAt": datetime.utcnow()
                        }
                    }
                )
                
                # Update the in-memory invitation object
                invitation.invitationToken = token
                invitation.tokenExpiresAt = token_expiry
            
            # Update email subject if provided
            if email_subject:
                await db.invitations.update_one(
                    {"_id": ObjectId(inv_id)},
                    {"$set": {"emailSubject": email_subject, "updatedAt": datetime.utcnow()}}
                )
                invitation.emailSubject = email_subject
            
            # Send invitation
            await send_invitation_notifications(
                invitation=invitation,
                channel=InvitationChannel(channel),
                db=db
            )
            
            results["sent"] += 1
            
        except Exception as e:
            results["failed"] += 1
            results["errors"].append(f"Invitation {inv_id}: {str(e)}")
    
    return {
        "message": f"Bulk send completed: {results['sent']} sent, {results['failed']} failed",
        "results": results
    }


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
    from urllib.parse import quote
    settings = Settings()
    
    invitation_service = InvitationService(db)
    # Use register2 page and prefill email
    invitation_link = f"{settings.app_url}/register2?invitation={invitation.invitationToken}&email={quote(invitation.email)}"
    
    # Send email
    if channel in [InvitationChannel.EMAIL, InvitationChannel.BOTH]:
        try:
            # Send email directly via SMTP
            await send_invitation_email(
                to_email=invitation.email,
                to_name=invitation.name,
                invitation_link=invitation_link,
                custom_message=custom_message or invitation.customMessage,
                email_subject=getattr(invitation, 'emailSubject', None)
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
    
    # Send SMS
    if channel in [InvitationChannel.SMS, InvitationChannel.BOTH]:
        import logging
        logger = logging.getLogger(__name__)
        logger.info(f"🔵 SMS channel requested for invitation {invitation.id}, phone: {invitation.phone}")
        
        if invitation.phone:
            try:
                # Import SMS service based on configured provider
                sms_provider = settings.sms_provider or "auto"
                logger.info(f"🔵 SMS provider: {sms_provider}")
                sms_service = None
                
                # Try SimpleTexting first (preferred)
                if sms_provider.lower() in ["simpletexting", "auto"]:
                    try:
                        from services.simpletexting_service import SimpleTextingService
                        simpletexting = SimpleTextingService()
                        logger.info(f"🔵 SimpleTexting enabled: {simpletexting.enabled}")
                        if simpletexting.enabled:
                            sms_service = simpletexting
                    except ImportError as e:
                        logger.error(f"🔴 Failed to import SimpleTexting: {e}")
                        pass
                
                # Fallback to Twilio
                if not sms_service and sms_provider.lower() in ["twilio", "auto"]:
                    try:
                        from services.sms_service import SMSService
                        twilio = SMSService()
                        if twilio.enabled:
                            sms_service = twilio
                    except ImportError:
                        pass
                
                if not sms_service:
                    logger.error("🔴 No SMS service configured or available")
                    raise Exception("No SMS service configured or available")
                
                # Create shortened URL for better SMS delivery
                from services.url_shortener import URLShortener
                
                # Use production URL instead of localhost
                production_link = invitation_link.replace('http://localhost:3000', settings.app_url) if 'localhost' in invitation_link else invitation_link
                
                # Create short URL
                shortener = URLShortener(db)
                short_url = await shortener.create_short_url(production_link)
                
                logger.info(f"🔵 Created short URL: {short_url} for {production_link}")
                
                # Create SMS message with shortened URL
                if custom_message:
                    sms_message = f"{custom_message}\n\nRegister: {short_url}"
                else:
                    sms_message = (
                        f"Hi {invitation.name}! You're invited to join USVedika.\n\n"
                        f"Register here: {short_url}\n\n"
                        f"This invitation expires soon. Join now!"
                    )
                
                logger.info(f"🔵 Sending SMS to {invitation.phone}: {sms_message[:50]}...")
                
                # Send SMS
                result = await sms_service.send_notification(
                    phone=invitation.phone,
                    message=sms_message
                )
                
                logger.info(f"🔵 SMS send result: {result}")
                
                if result["success"]:
                    # Update status to SENT
                    await invitation_service.update_invitation_status(
                        invitation.id,
                        InvitationChannel.SMS,
                        InvitationStatus.SENT
                    )
                else:
                    # Mark as failed
                    await invitation_service.update_invitation_status(
                        invitation.id,
                        InvitationChannel.SMS,
                        InvitationStatus.FAILED,
                        failed_reason=result.get("error", "SMS service unavailable")
                    )
            except Exception as e:
                await invitation_service.update_invitation_status(
                    invitation.id,
                    InvitationChannel.SMS,
                    InvitationStatus.FAILED,
                    failed_reason=str(e)
                )


# Import datetime for update_invitation
from datetime import datetime


# PUBLIC ENDPOINTS (No authentication required)

@router.get("/validate/{token}")
async def validate_invitation(
    token: str,
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Validate invitation token and return invitation data
    PUBLIC endpoint - no authentication required
    Used by registration page to pre-fill user data
    """
    invitation_service = InvitationService(db)
    
    # Find invitation by token
    invitation = await invitation_service.get_invitation_by_token(token)
    
    if not invitation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invitation not found or invalid token"
        )
    
    # Check if token is expired
    if invitation.tokenExpiresAt < datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invitation link has expired"
        )
    
    # Check if already accepted
    if invitation.emailStatus == InvitationStatus.ACCEPTED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invitation already accepted by {invitation.registeredUsername}"
        )
    
    # Return invitation data (excluding sensitive fields)
    return {
        "id": invitation.id,
        "name": invitation.name,
        "email": invitation.email,
        "phone": invitation.phone,
        "invitedBy": invitation.invitedBy,
        "customMessage": invitation.customMessage,
        "createdAt": invitation.createdAt
    }


@router.post("/accept/{token}")
async def accept_invitation(
    token: str,
    data: dict,
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Mark invitation as accepted after successful registration
    PUBLIC endpoint - no authentication required
    Called automatically after user completes registration
    """
    invitation_service = InvitationService(db)
    
    # Find invitation by token
    invitation = await invitation_service.get_invitation_by_token(token)
    
    if not invitation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invitation not found"
        )
    
    # Update invitation status
    registered_username = data.get("registeredUsername")
    
    if not registered_username:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Registered username is required"
        )
    
    # Mark as accepted
    await invitation_service.mark_as_accepted(
        invitation.id,
        registered_username
    )
    
    return {
        "message": "Invitation accepted successfully",
        "invitationId": invitation.id,
        "registeredUsername": registered_username
    }
