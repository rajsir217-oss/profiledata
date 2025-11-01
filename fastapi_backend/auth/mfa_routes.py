"""
Dual-Channel MFA (Multi-Factor Authentication) Routes
Supports both Email and SMS MFA
"""
from fastapi import APIRouter, Depends, HTTPException, status
from datetime import datetime
import secrets
import logging

from database import get_database
from .otp_models import (
    MFASendCodeRequest, MFAVerifyCodeRequest, MFAEnableRequest, MFADisableRequest,
    OTPResponse, MFAStatusResponse, BackupCodesResponse
)
from .jwt_auth import get_current_user_dependency
from .password_utils import PasswordManager
from services.sms_service import OTPManager

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/auth/mfa", tags=["Multi-Factor Authentication"])

get_current_user = get_current_user_dependency


def generate_backup_codes(count: int = 10) -> list[str]:
    """Generate backup recovery codes"""
    codes = []
    for _ in range(count):
        # Generate 8-character alphanumeric code
        code = secrets.token_hex(4).upper()
        # Format as XXXX-XXXX
        formatted = f"{code[:4]}-{code[4:]}"
        codes.append(formatted)
    return codes


@router.get("/status", response_model=MFAStatusResponse)
async def get_mfa_status(
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Get current MFA status (Email or SMS)"""
    try:
        username = current_user["username"]
        user = await db.users.find_one({"username": username})
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        mfa_info = user.get("mfa", {})
        phone = user.get("contactNumber")
        email = user.get("email") or user.get("contactEmail")
        mfa_channel = mfa_info.get("mfa_type", "email")  # Default to email
        
        # Mask contact info
        phone_masked = f"{phone[:3]}***{phone[-2:]}" if phone and len(phone) > 5 else None
        email_masked = f"{email[0]}***@{email.split('@')[1]}" if email and '@' in email else None
        
        # Determine which contact to show based on MFA channel
        if mfa_channel == "sms":
            contact_masked = phone_masked
        else:
            contact_masked = email_masked
        
        return MFAStatusResponse(
            mfa_enabled=mfa_info.get("mfa_enabled", False),
            mfa_channel=mfa_channel if mfa_info.get("mfa_enabled") else None,
            phone=phone if mfa_info.get("mfa_enabled") and mfa_channel == "sms" else None,
            email=email if mfa_info.get("mfa_enabled") and mfa_channel == "email" else None,
            contact_masked=contact_masked if mfa_info.get("mfa_enabled") else None,
            phone_masked=phone_masked,  # Legacy
            enabled_at=mfa_info.get("mfa_enabled_at"),
            backup_codes_count=len(mfa_info.get("mfa_backup_codes", []))
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error getting MFA status: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get MFA status"
        )


@router.post("/enable", response_model=BackupCodesResponse)
async def enable_mfa(
    request: MFAEnableRequest,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """
    Enable MFA (Email or SMS)
    
    Steps:
    1. Verify contact ownership with code
    2. Generate backup codes
    3. Enable MFA for user
    """
    try:
        username = current_user["username"]
        otp_manager = OTPManager(db)
        
        # Verify contact ownership first
        verify_result = await otp_manager.verify_otp(
            identifier=username,
            code=request.verification_code,
            purpose="verification",
            mark_as_used=True
        )
        
        if not verify_result["success"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=verify_result["error"]
            )
        
        # Generate backup codes
        backup_codes = generate_backup_codes(10)
        
        # Hash backup codes for storage (same as passwords)
        hashed_codes = [PasswordManager.hash_password(code) for code in backup_codes]
        
        # Prepare update data based on channel
        mfa_update = {
            "mfa.mfa_enabled": True,
            "mfa.mfa_secret": None,  # Not used for Email/SMS MFA
            "mfa.mfa_backup_codes": hashed_codes,
            "mfa.mfa_enabled_at": datetime.utcnow(),
            "mfa.mfa_type": request.channel,
        }
        
        # Update contact info
        if request.channel == "sms":
            mfa_update["contactNumber"] = request.phone
        else:  # email
            if request.email:
                mfa_update["contactEmail"] = request.email
        
        # Enable MFA
        update_result = await db.users.update_one(
            {"username": username},
            {"$set": mfa_update}
        )
        
        if update_result.modified_count == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        logger.info(f"✅ MFA enabled successfully for {username}")
        
        return BackupCodesResponse(
            codes=backup_codes,
            generated_at=datetime.utcnow(),
            message="MFA enabled! Save these backup codes securely. Each can only be used once."
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error enabling MFA: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to enable MFA"
        )


@router.post("/disable")
async def disable_mfa(
    request: MFADisableRequest,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """
    Disable SMS-based MFA
    
    Requires password verification for security
    """
    try:
        username = current_user["username"]
        
        # Get user to verify password
        user = await db.users.find_one({"username": username})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Verify password
        if not PasswordManager.verify_password(request.password, user["password"]):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid password"
            )
        
        # If MFA code provided, verify it
        if request.code:
            otp_manager = OTPManager(db)
            verify_result = await otp_manager.verify_otp(
                identifier=username,
                code=request.code,
                purpose="mfa",
                mark_as_used=True
            )
            
            if not verify_result["success"]:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid MFA code"
                )
        
        # Disable MFA
        update_result = await db.users.update_one(
            {"username": username},
            {
                "$set": {
                    "mfa.mfa_enabled": False,
                    "mfa.mfa_secret": None,
                    "mfa.mfa_backup_codes": [],
                    "mfa.mfa_enabled_at": None,
                    "mfa.mfa_type": None,
                    "mfa.mfa_disabled_at": datetime.utcnow()
                }
            }
        )
        
        if update_result.modified_count == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found or MFA already disabled"
            )
        
        logger.info(f"✅ MFA disabled for {username}")
        
        return {
            "success": True,
            "message": "MFA has been disabled successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error disabling MFA: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to disable MFA"
        )


@router.post("/send-code", response_model=OTPResponse)
async def send_mfa_code(
    request: MFASendCodeRequest,
    db = Depends(get_database)
):
    """
    Send MFA code via Email or SMS (used during login)
    
    Note: This endpoint doesn't require authentication (used during login)
    """
    try:
        # Get user and verify MFA is enabled
        user = await db.users.find_one({"username": request.username})
        
        if not user:
            # Don't reveal if user exists
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid request"
            )
        
        mfa_info = user.get("mfa", {})
        if not mfa_info.get("mfa_enabled"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="MFA not enabled for this account"
            )
        
        # Determine MFA channel (email or sms)
        mfa_channel = request.channel or mfa_info.get("mfa_type", "email")
        phone = user.get("contactNumber")
        email = user.get("email") or user.get("contactEmail")
        
        # Validate contact info exists
        if mfa_channel == "sms" and not phone:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No phone number on file for SMS MFA"
            )
        elif mfa_channel == "email" and not email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No email on file for Email MFA"
            )
        
        # Create and send MFA code
        otp_manager = OTPManager(db)
        result = await otp_manager.create_otp_with_channel(
            identifier=request.username,
            channel=mfa_channel,
            phone=phone,
            email=email,
            username=request.username,
            purpose="mfa",
            expires_in_minutes=5  # Shorter expiry for MFA
        )
        
        if not result["success"]:
            return OTPResponse(
                success=False,
                message=result.get("error", f"Failed to send MFA code via {mfa_channel}"),
                channel=mfa_channel,
                contact_masked=result.get("contact_masked"),
                expires_at=result.get("expires_at"),
                mock_code=result.get("mock_code")
            )
        
        logger.info(f"✅ MFA code sent via {mfa_channel.upper()} to {request.username}")
        
        return OTPResponse(
            success=True,
            message=result.get("message", f"MFA code sent via {mfa_channel}"),
            channel=mfa_channel,
            contact_masked=result["contact_masked"],
            expires_at=result["expires_at"],
            mock_code=result.get("mock_code")
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error sending MFA code: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to send MFA code"
        )


@router.post("/verify-code")
async def verify_mfa_code(
    request: MFAVerifyCodeRequest,
    db = Depends(get_database)
):
    """
    Verify MFA code (used during login)
    
    Note: This endpoint doesn't require authentication (used during login)
    Returns: success status only, actual token creation happens in login endpoint
    """
    try:
        otp_manager = OTPManager(db)
        
        # Check if it's a backup code first
        user = await db.users.find_one({"username": request.username})
        if not user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid request"
            )
        
        mfa_info = user.get("mfa", {})
        backup_codes = mfa_info.get("mfa_backup_codes", [])
        
        # Try backup codes if format matches (XXXX-XXXX)
        if "-" in request.code and len(request.code) == 9:
            for idx, hashed_code in enumerate(backup_codes):
                if PasswordManager.verify_password(request.code, hashed_code):
                    # Remove used backup code
                    backup_codes.pop(idx)
                    await db.users.update_one(
                        {"username": request.username},
                        {"$set": {"mfa.mfa_backup_codes": backup_codes}}
                    )
                    
                    logger.info(f"✅ Backup code used by {request.username}")
                    
                    return {
                        "success": True,
                        "message": "Backup code verified",
                        "backup_code_used": True,
                        "remaining_backup_codes": len(backup_codes)
                    }
            
            # Invalid backup code
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid backup code"
            )
        
        # Verify regular OTP code
        result = await otp_manager.verify_otp(
            identifier=request.username,
            code=request.code,
            purpose="mfa",
            mark_as_used=True
        )
        
        if not result["success"]:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=result["error"]
            )
        
        logger.info(f"✅ MFA code verified for {request.username}")
        
        return {
            "success": True,
            "message": "MFA code verified successfully",
            "backup_code_used": False
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error verifying MFA code: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to verify MFA code"
        )


@router.post("/regenerate-backup-codes", response_model=BackupCodesResponse)
async def regenerate_backup_codes(
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Regenerate backup codes (invalidates old ones)"""
    try:
        username = current_user["username"]
        
        # Check if MFA is enabled
        user = await db.users.find_one({"username": username})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        mfa_info = user.get("mfa", {})
        if not mfa_info.get("mfa_enabled"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="MFA not enabled"
            )
        
        # Generate new backup codes
        backup_codes = generate_backup_codes(10)
        hashed_codes = [PasswordManager.hash_password(code) for code in backup_codes]
        
        # Update user
        await db.users.update_one(
            {"username": username},
            {"$set": {"mfa.mfa_backup_codes": hashed_codes}}
        )
        
        logger.info(f"✅ Backup codes regenerated for {username}")
        
        return BackupCodesResponse(
            codes=backup_codes,
            generated_at=datetime.utcnow(),
            message="New backup codes generated. Old codes are no longer valid."
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error regenerating backup codes: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to regenerate backup codes"
        )
