"""
Phone Verification Routes
"""
from fastapi import APIRouter, Depends, HTTPException, status
from datetime import datetime
import logging

from database import get_database
from .otp_models import (
    PhoneSendCodeRequest, PhoneVerifyCodeRequest, 
    OTPResponse, PhoneVerificationResponse
)
from .jwt_auth import get_current_user_dependency
from services.sms_service import OTPManager

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/auth/phone", tags=["Phone Verification"])

get_current_user = get_current_user_dependency


@router.post("/send-code", response_model=OTPResponse)
async def send_verification_code(
    request: PhoneSendCodeRequest,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """
    Send phone verification code to user
    
    - Generates 6-digit OTP
    - Sends via SMS
    - Expires in 10 minutes
    """
    try:
        username = current_user["username"]
        otp_manager = OTPManager(db)
        
        # Create and send OTP
        result = await otp_manager.create_otp(
            identifier=username,
            phone=request.phone,
            purpose="verification",
            expires_in_minutes=10
        )
        
        if not result["success"]:
            # SMS failed but OTP created
            return OTPResponse(
                success=False,
                message=result.get("error", "Failed to send verification code"),
                phone_masked=result.get("phone_masked"),
                expires_at=result.get("expires_at"),
                mock_code=result.get("mock_code")  # Only in dev
            )
        
        logger.info(f"✅ Verification code sent to {username}")
        
        return OTPResponse(
            success=True,
            message="Verification code sent successfully",
            phone_masked=result["phone_masked"],
            expires_at=result["expires_at"]
        )
        
    except Exception as e:
        logger.error(f"❌ Error sending verification code: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to send verification code"
        )


@router.post("/verify", response_model=PhoneVerificationResponse)
async def verify_phone_code(
    request: PhoneVerifyCodeRequest,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """
    Verify phone number with OTP code
    
    - Validates code
    - Updates user's phone_verified status
    - Stores verified phone number
    """
    try:
        username = current_user["username"]
        otp_manager = OTPManager(db)
        
        # Verify OTP
        result = await otp_manager.verify_otp(
            identifier=username,
            code=request.code,
            purpose="verification",
            mark_as_used=True
        )
        
        if not result["success"]:
            return PhoneVerificationResponse(
                success=False,
                message=result["error"],
                phone_verified=False
            )
        
        # Update user's phone verification status
        update_result = await db.users.update_one(
            {"username": username},
            {
                "$set": {
                    "contactNumber": request.phone,
                    "status.phone_verified": True,
                    "status.phone_verified_at": datetime.utcnow()
                }
            }
        )
        
        if update_result.modified_count == 0:
            logger.warning(f"⚠️ User {username} not found or already verified")
        
        logger.info(f"✅ Phone verified successfully for {username}")
        
        return PhoneVerificationResponse(
            success=True,
            message="Phone number verified successfully!",
            phone_verified=True
        )
        
    except Exception as e:
        logger.error(f"❌ Error verifying phone: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to verify phone number"
        )


@router.post("/resend-code", response_model=OTPResponse)
async def resend_verification_code(
    request: PhoneSendCodeRequest,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """
    Resend phone verification code
    
    - Rate limited to 1 request per minute
    """
    try:
        username = current_user["username"]
        otp_manager = OTPManager(db)
        
        # Resend OTP (with rate limiting)
        result = await otp_manager.resend_otp(
            identifier=username,
            phone=request.phone,
            purpose="verification"
        )
        
        if not result["success"]:
            return OTPResponse(
                success=False,
                message=result.get("error", "Failed to resend code")
            )
        
        logger.info(f"✅ Verification code resent to {username}")
        
        return OTPResponse(
            success=True,
            message="Verification code resent successfully",
            phone_masked=result["phone_masked"],
            expires_at=result["expires_at"],
            mock_code=result.get("mock_code")
        )
        
    except Exception as e:
        logger.error(f"❌ Error resending code: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to resend verification code"
        )


@router.get("/status")
async def get_phone_verification_status(
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Get current phone verification status"""
    try:
        username = current_user["username"]
        user = await db.users.find_one({"username": username})
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        status_info = user.get("status", {})
        phone = user.get("contactNumber")
        
        return {
            "phone_verified": status_info.get("phone_verified", False),
            "phone": phone,
            "phone_masked": f"{phone[:3]}***{phone[-2:]}" if phone and len(phone) > 5 else None,
            "verified_at": status_info.get("phone_verified_at")
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error getting phone status: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get phone verification status"
        )
