"""
Email Verification API Routes
Endpoints for user email verification and account activation
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel
from typing import Optional
from database import get_database
from services.email_verification_service import EmailVerificationService
from auth.jwt_auth import get_current_user_dependency as get_current_user

router = APIRouter(prefix="/api/verification", tags=["verification"])

# Pydantic models
class VerifyEmailRequest(BaseModel):
    username: str
    token: str

class ResendVerificationRequest(BaseModel):
    username: str

class VerificationResponse(BaseModel):
    success: bool
    message: str
    nextStep: Optional[str] = None
    alreadyVerified: Optional[bool] = False
    expired: Optional[bool] = False

@router.post("/verify-email", response_model=VerificationResponse)
async def verify_email(
    request: VerifyEmailRequest,
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Verify user email using token from email link
    
    **Flow:**
    1. User clicks link in verification email
    2. Frontend calls this endpoint with username and token
    3. Backend validates token and marks email as verified
    4. Account status changes to "pending_admin_approval"
    5. Admin is notified
    
    **Returns:**
    - success: True if verification successful
    - message: Human-readable message
    - nextStep: Next stage in onboarding flow
    """
    service = EmailVerificationService(db)
    result = await service.verify_token(request.username, request.token)
    
    return VerificationResponse(**result)

@router.post("/resend-verification", response_model=VerificationResponse)
async def resend_verification_email(
    request: ResendVerificationRequest,
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Resend verification email to user
    
    **Use cases:**
    - User didn't receive email
    - Verification link expired
    - Email went to spam
    
    **Rate limits:**
    - Maximum 5 attempts per day per user
    
    **Returns:**
    - success: True if email sent successfully
    - message: Status message
    """
    service = EmailVerificationService(db)
    result = await service.resend_verification_email(request.username)
    
    return VerificationResponse(**result)

@router.get("/status/{username}")
async def get_verification_status(
    username: str,
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Get current verification and approval status for a user
    
    **Returns:**
    - accountStatus: Current status (pending_email_verification, pending_admin_approval, active, etc.)
    - emailVerified: Boolean
    - adminApprovalStatus: pending, approved, or rejected
    - onboardingCompleted: Boolean
    - canAccessFeatures: Boolean indicating if user has full access
    """
    try:
        user = await db.users.find_one(
            {"username": username},
            {
                "accountStatus": 1,
                "emailVerified": 1,
                "emailVerifiedAt": 1,
                "adminApprovalStatus": 1,
                "adminApprovedAt": 1,
                "adminApprovedBy": 1,
                "onboardingCompleted": 1,
                "onboardingCompletedAt": 1,
                "emailVerificationAttempts": 1
            }
        )
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Determine if user can access features
        can_access_features = (
            user.get("emailVerified", False) and
            user.get("adminApprovalStatus") == "approved" and
            user.get("accountStatus") == "active"
        )
        
        return {
            "username": username,
            "accountStatus": user.get("accountStatus", "pending_email_verification"),
            "emailVerified": user.get("emailVerified", False),
            "emailVerifiedAt": user.get("emailVerifiedAt"),
            "adminApprovalStatus": user.get("adminApprovalStatus", "pending"),
            "adminApprovedAt": user.get("adminApprovedAt"),
            "adminApprovedBy": user.get("adminApprovedBy"),
            "onboardingCompleted": user.get("onboardingCompleted", False),
            "onboardingCompletedAt": user.get("onboardingCompletedAt"),
            "canAccessFeatures": can_access_features,
            "emailVerificationAttempts": user.get("emailVerificationAttempts", 0)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching verification status: {str(e)}")

@router.post("/admin/approve/{username}")
async def admin_approve_user(
    username: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    **Admin only:** Approve user and complete onboarding
    
    **Requirements:**
    - User must have verified email
    - Admin role required
    
    **Actions:**
    1. Set adminApprovalStatus to "approved"
    2. Set accountStatus to "active"
    3. Set onboardingCompleted to True
    4. Send welcome email to user
    5. Enable all features
    """
    from datetime import datetime
    
    # Check if current user is admin
    if current_user.get("username") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        # Find user
        user = await db.users.find_one({"username": username})
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Check if email is verified
        if not user.get("emailVerified"):
            raise HTTPException(
                status_code=400,
                detail="User must verify email before admin approval"
            )
        
        # Check if already approved
        if user.get("adminApprovalStatus") == "approved":
            return {
                "success": True,
                "message": "User already approved",
                "alreadyApproved": True
            }
        
        # Update user status
        result = await db.users.update_one(
            {"username": username},
            {
                "$set": {
                    "adminApprovalStatus": "approved",
                    "adminApprovedBy": current_user.get("username"),
                    "adminApprovedAt": datetime.utcnow(),
                    "accountStatus": "active",
                    "onboardingCompleted": True,
                    "onboardingCompletedAt": datetime.utcnow()
                }
            }
        )
        
        if result.modified_count > 0:
            # TODO: Send welcome email to user
            # service = EmailVerificationService(db)
            # await service.send_welcome_email(username, user.get("contactEmail"))
            
            return {
                "success": True,
                "message": f"User {username} approved successfully",
                "accountStatus": "active"
            }
        else:
            raise HTTPException(status_code=500, detail="Failed to approve user")
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error approving user: {str(e)}")

@router.post("/admin/reject/{username}")
async def admin_reject_user(
    username: str,
    reason: str = Query(..., description="Reason for rejection"),
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    **Admin only:** Reject user application
    
    **Requirements:**
    - Admin role required
    
    **Actions:**
    1. Set adminApprovalStatus to "rejected"
    2. Store rejection reason
    3. Send rejection email with reason
    """
    from datetime import datetime
    
    # Check if current user is admin
    if current_user.get("username") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        # Update user status
        result = await db.users.update_one(
            {"username": username},
            {
                "$set": {
                    "adminApprovalStatus": "rejected",
                    "adminRejectionReason": reason,
                    "adminApprovedBy": current_user.get("username"),
                    "adminApprovedAt": datetime.utcnow()
                }
            }
        )
        
        if result.modified_count > 0:
            # TODO: Send rejection email to user
            return {
                "success": True,
                "message": f"User {username} rejected",
                "reason": reason
            }
        else:
            raise HTTPException(status_code=404, detail="User not found")
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error rejecting user: {str(e)}")

@router.get("/admin/pending-approvals")
async def get_pending_approvals(
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    **Admin only:** Get list of users pending admin approval
    
    **Returns:**
    - List of users who have verified email but pending admin approval
    - Includes basic profile info and registration date
    """
    # Check if current user is admin
    if current_user.get("username") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        # Find users pending approval
        pending_users = await db.users.find(
            {
                "emailVerified": True,
                "adminApprovalStatus": "pending"
            },
            {
                "username": 1,
                "firstName": 1,
                "lastName": 1,
                "contactEmail": 1,
                "dateOfBirth": 1,
                "gender": 1,
                "location": 1,
                "emailVerifiedAt": 1,
                "createdAt": 1,
                "profileCompleteness": 1
            }
        ).sort("emailVerifiedAt", -1).to_list(None)
        
        return {
            "success": True,
            "count": len(pending_users),
            "users": pending_users
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching pending approvals: {str(e)}")
