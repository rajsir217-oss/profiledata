"""
Unified OTP Routes
Supports both Email and SMS OTP verification
"""

from fastapi import APIRouter, Depends, HTTPException, status
from database import get_database
from auth.jwt_auth import get_current_user_dependency as get_current_user
from auth.otp_models import (
    OTPSendCodeRequest,
    OTPVerifyCodeRequest,
    OTPResponse,
    VerificationResponse,
    OTPPreferenceRequest,
    OTPPreferenceResponse
)
from services.sms_service import OTPManager
from crypto_utils import get_encryptor
import logging
from datetime import datetime

router = APIRouter(prefix="/api/auth/otp", tags=["otp"])
logger = logging.getLogger(__name__)


def _decrypt_contact_info(value: str) -> str:
    """
    Decrypt contact info (email/phone) if encrypted
    
    Args:
        value: Potentially encrypted contact info
        
    Returns:
        Decrypted contact info
    """
    if not value:
        return value
    
    # Check if value looks encrypted (Fernet tokens start with 'gAAAAA')
    if isinstance(value, str) and value.startswith('gAAAAA'):
        try:
            encryptor = get_encryptor()
            decrypted = encryptor.decrypt(value)
            logger.debug(f"🔓 Decrypted contact info for OTP")
            return decrypted
        except Exception as e:
            logger.error(f"❌ Failed to decrypt contact info: {e}")
            # Return original value if decryption fails
            return value
    
    # Not encrypted, return as-is
    return value


@router.post("/send", response_model=OTPResponse)
async def send_otp_code(
    request: OTPSendCodeRequest,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """
    Send OTP verification code via Email or SMS
    
    - **channel**: "email" or "sms"
    - **email**: Required if channel is "email"
    - **phone**: Required if channel is "sms"
    """
    try:
        username = current_user["username"]
        
        # Get full user data from database (JWT doesn't have all fields)
        user = await db.users.find_one({"username": username})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Prioritize contactEmail over legacy email field
        user_email = user.get("contactEmail") or user.get("email")
        user_phone = user.get("contactNumber")
        
        # DECRYPT contact info if encrypted (production PII encryption)
        if user_email:
            user_email = _decrypt_contact_info(user_email)
        if user_phone:
            user_phone = _decrypt_contact_info(user_phone)
        
        # Determine contact info
        email = request.email or user_email
        phone = request.phone or user_phone
        
        # Also decrypt provided email/phone if any
        if email:
            email = _decrypt_contact_info(email)
        if phone:
            phone = _decrypt_contact_info(phone)
        
        if request.channel == "email" and not email:
            raise HTTPException(
                status_code=400,
                detail="Email address not found. Please provide an email or update your profile."
            )
        
        if request.channel == "sms" and not phone:
            raise HTTPException(
                status_code=400,
                detail="Phone number not found. Please provide a phone or update your profile."
            )
        
        # Check SMS opt-in status before sending
        if request.channel == "sms":
            sms_opt_in = user.get("smsOptIn", True)  # Default True for backward compatibility
            if not sms_opt_in:
                logger.warning(f"⚠️  SMS OTP blocked for {username} - user has opted out")
                raise HTTPException(
                    status_code=400,
                    detail="SMS notifications are disabled for this account. Please use email verification or update your SMS preferences."
                )
        
        # Create and send OTP
        otp_manager = OTPManager(db)
        result = await otp_manager.create_otp_with_channel(
            identifier=username,
            channel=request.channel,
            phone=phone,
            email=email,
            username=username,
            purpose="verification",
            expires_in_minutes=10
        )
        
        if result["success"]:
            logger.info(f"✅ OTP sent via {request.channel.upper()} to {username}")
            return OTPResponse(
                success=True,
                message=result.get("message", f"Verification code sent via {request.channel}"),
                channel=request.channel,
                contact_masked=result.get("contact_masked"),
                expires_at=result.get("expires_at")
            )
        else:
            # Check if mock code is available (development mode)
            if "mock_code" in result:
                logger.warning(f"⚠️  {request.channel.upper()} failed, returning mock code for dev")
                return OTPResponse(
                    success=False,
                    message=f"{request.channel.upper()} service not configured - use mock code for testing",
                    channel=request.channel,
                    mock_code=result.get("mock_code"),
                    expires_at=result.get("expires_at")
                )
            
            raise HTTPException(
                status_code=500,
                detail=result.get("error", f"Failed to send OTP via {request.channel}")
            )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error sending OTP: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to send verification code: {str(e)}")


@router.post("/verify", response_model=VerificationResponse)
async def verify_otp_code(
    request: OTPVerifyCodeRequest,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """
    Verify OTP code (works for both Email and SMS)
    
    - **code**: 6-digit verification code
    """
    try:
        username = current_user["username"]
        
        # Verify OTP
        otp_manager = OTPManager(db)
        result = await otp_manager.verify_otp(
            identifier=username,
            code=request.code,
            purpose="verification",
            mark_as_used=True
        )
        
        if not result["success"]:
            raise HTTPException(
                status_code=400,
                detail=result.get("error", "Invalid or expired verification code")
            )
        
        # Update user verification status
        update_data = {
            "status.email_verified": True,
            "status.phone_verified": True,
            "status.verified_at": datetime.utcnow()
        }
        
        await db.users.update_one(
            {"username": username},
            {"$set": update_data}
        )
        
        logger.info(f"✅ OTP verified for {username}")
        
        return VerificationResponse(
            success=True,
            message="Verification successful!",
            verified=True,
            channel=result.get("channel")
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error verifying OTP: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Verification failed: {str(e)}")


@router.post("/resend", response_model=OTPResponse)
async def resend_otp_code(
    request: OTPSendCodeRequest,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """
    Resend OTP verification code
    
    Same as /send but with rate limiting check
    """
    # Rate limiting: Check last OTP creation time
    username = current_user["username"]
    
    last_otp = await db.otp_codes.find_one(
        {"identifier": username, "purpose": "verification"},
        sort=[("created_at", -1)]
    )
    
    if last_otp:
        from datetime import timedelta
        time_since_last = datetime.utcnow() - last_otp["created_at"]
        if time_since_last < timedelta(seconds=60):
            remaining = 60 - int(time_since_last.total_seconds())
            raise HTTPException(
                status_code=429,
                detail=f"Please wait {remaining} seconds before requesting a new code"
            )
    
    # Use the send endpoint logic
    return await send_otp_code(request, current_user, db)


@router.get("/status")
async def get_verification_status(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """
    Get current verification status
    """
    # Get full user data from database (JWT doesn't have all fields)
    user = await db.users.find_one({"username": current_user["username"]})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    status_data = user.get("status", {})
    
    # Get and decrypt contact info
    email = user.get("contactEmail") or user.get("email")
    phone = user.get("contactNumber")
    
    if email:
        email = _decrypt_contact_info(email)
    if phone:
        phone = _decrypt_contact_info(phone)
    
    return {
        "email_verified": status_data.get("email_verified", False),
        "phone_verified": status_data.get("phone_verified", False),
        "verified_at": status_data.get("verified_at"),
        "email": email,
        "phone": phone
    }


@router.post("/preferences", response_model=OTPPreferenceResponse)
async def update_otp_preference(
    request: OTPPreferenceRequest,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """
    Update preferred OTP channel
    
    - **channel**: "email" or "sms"
    """
    try:
        username = current_user["username"]
        
        # Get full user data from database (JWT doesn't have all fields)
        user = await db.users.find_one({"username": username})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Validate user has the required contact info
        if request.channel == "email":
            email = user.get("contactEmail") or user.get("email")
            # Decrypt to check if actually exists
            email = _decrypt_contact_info(email) if email else None
            if not email:
                raise HTTPException(
                    status_code=400,
                    detail="Cannot set email as preferred channel - no email address on file"
                )
        elif request.channel == "sms":
            phone = user.get("contactNumber")
            # Decrypt to check if actually exists
            phone = _decrypt_contact_info(phone) if phone else None
            if not phone:
                raise HTTPException(
                    status_code=400,
                    detail="Cannot set SMS as preferred channel - no phone number on file"
                )
        
        # Update user preferences
        await db.users.update_one(
            {"username": username},
            {
                "$set": {
                    "notification_preferences.otp_channel": request.channel,
                    "notification_preferences.updated_at": datetime.utcnow()
                }
            }
        )
        
        logger.info(f"✅ OTP channel preference updated to {request.channel.upper()} for {username}")
        
        return OTPPreferenceResponse(
            success=True,
            message=f"OTP channel preference updated to {request.channel.upper()}",
            channel=request.channel
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error updating OTP preference: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to update preference: {str(e)}")


@router.get("/preferences")
async def get_otp_preference(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """
    Get current OTP channel preference
    """
    # Get full user data from database (JWT doesn't have all fields)
    user = await db.users.find_one({"username": current_user["username"]})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    prefs = user.get("notification_preferences", {})
    channel = prefs.get("otp_channel", "email")  # Default to email
    
    # Get and decrypt contact info
    email = user.get("contactEmail") or user.get("email")
    phone = user.get("contactNumber")
    
    if email:
        email = _decrypt_contact_info(email)
    if phone:
        phone = _decrypt_contact_info(phone)
    
    # Determine available channels
    available_channels = []
    if email:
        available_channels.append("email")
    if phone:
        available_channels.append("sms")
    
    return {
        "preferred_channel": channel,
        "available_channels": available_channels,
        "email": email,
        "phone": phone
    }
