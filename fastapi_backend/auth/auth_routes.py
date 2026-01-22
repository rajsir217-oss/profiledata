# fastapi_backend/auth/auth_routes.py
"""
Authentication Endpoints - Login, Register, Password Management
"""

from fastapi import APIRouter, Depends, HTTPException, status, Request
from datetime import datetime, timedelta
from typing import Optional
from bson import ObjectId
import sys
import os
import logging
import re

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import get_database
from crypto_utils import get_encryptor
from .security_models import (
    RegisterRequest, LoginRequest, LoginResponse,
    PasswordChangeRequest, PasswordResetRequest, PasswordResetConfirm,
    RefreshTokenRequest
)
from .security_config import security_settings, SECURITY_EVENTS, USER_STATUS
from .password_utils import PasswordManager, AccountLockoutManager, TokenManager
from .jwt_auth import JWTManager, create_token_pair, get_current_user_dependency, AuthenticationService
from .audit_logger import AuditLogger
from .authorization import PermissionChecker
from services.activity_logger import get_activity_logger
from models.activity_models import ActivityType

logger = logging.getLogger(__name__)

# Helper function for case-insensitive username lookup
def get_username_query(username: str):
    """Create a case-insensitive MongoDB query for username"""
    return {"username": {"$regex": f"^{re.escape(username)}$", "$options": "i"}}

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


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
            logger.debug(f"🔓 Decrypted contact info for login MFA")
            return decrypted
        except Exception as e:
            logger.error(f"❌ Failed to decrypt contact info: {e}")
            # Return original value if decryption fails
            return value
    
    # Not encrypted, return as-is
    return value


# ===== REGISTRATION =====

@router.post("/register", response_model=dict)
async def register(
    request: RegisterRequest,
    http_request: Request,
    db = Depends(get_database)
):
    """Register a new user"""
    try:
        # Check if username exists
        existing_user = await db.users.find_one({"username": request.username})
        if existing_user:
            raise HTTPException(status_code=400, detail="Username already exists")
        
        # Check if email exists
        existing_email = await db.users.find_one({"email": request.email})
        if existing_email:
            raise HTTPException(status_code=400, detail="Email already registered")
        
        # Validate promo code if provided
        promo_validation = None
        validated_promo_code = None
        if request.promoCode:
            from services.promo_code_service import PromoCodeService
            promo_service = PromoCodeService(db)
            promo_validation = await promo_service.validate_promo_code(request.promoCode)
            
            if not promo_validation.get("valid"):
                # Return error with message - user can retry without promo code
                raise HTTPException(
                    status_code=400, 
                    detail={
                        "message": promo_validation.get("reason", "Invalid promo code"),
                        "promoCodeError": True,
                        "defaultToNormal": promo_validation.get("defaultToNormal", True)
                    }
                )
            validated_promo_code = promo_validation.get("code")
        
        # Hash password
        password_hash = PasswordManager.hash_password(request.password)
        
        # Calculate password expiry
        password_changed_at = datetime.utcnow()
        password_expires_at = PasswordManager.calculate_password_expiry(password_changed_at)
        
        # Generate email verification token
        verification_token = TokenManager.generate_verification_token()
        verification_expires = TokenManager.calculate_token_expiry()
        
        # Create user document
        user_doc = {
            "username": request.username,
            "email": request.email,
            "firstName": request.firstName,
            "lastName": request.lastName,
            
            # Security
            "security": {
                "password_hash": password_hash,
                "password_changed_at": password_changed_at,
                "password_expires_at": password_expires_at,
                "password_history": [
                    PasswordManager.create_password_history_entry(password_hash)
                ],
                "failed_login_attempts": 0,
                "locked_until": None,
                "force_password_change": security_settings.FORCE_PASSWORD_CHANGE_ON_FIRST_LOGIN,
                "last_login_at": None,
                "last_login_ip": None
            },
            
            # Status
            "status": {
                "status": USER_STATUS["PENDING_VERIFICATION"] if security_settings.EMAIL_VERIFICATION_REQUIRED else USER_STATUS["ACTIVE"],
                "email_verified": not security_settings.EMAIL_VERIFICATION_REQUIRED,
                "phone_verified": False,
                "email_verification_token": verification_token if security_settings.EMAIL_VERIFICATION_REQUIRED else None,
                "email_verification_expires": verification_expires if security_settings.EMAIL_VERIFICATION_REQUIRED else None,
                "is_online": False,
                "last_seen": None
            },
            
            # MFA
            "mfa": {
                "mfa_enabled": False,
                "mfa_secret": None,
                "mfa_backup_codes": [],
                "mfa_enabled_at": None
            },
            
            # Role & Permissions
            "role_name": security_settings.DEFAULT_USER_ROLE,
            "custom_permissions": [],
            
            # GDPR
            "data_processing_consent": request.data_processing_consent,
            "marketing_consent": request.marketing_consent,
            "consent_date": datetime.utcnow(),
            
            # Promo Code (default to NOPROMOCODE for organic registrations)
            "promoCode": validated_promo_code if validated_promo_code else "NOPROMOCODE",
            "promoCodeAppliedAt": datetime.utcnow() if validated_promo_code else None,
            
            # Metadata
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        
        # Insert user
        result = await db.users.insert_one(user_doc)
        
        # Increment promo code usage if valid code was used
        if validated_promo_code:
            from services.promo_code_service import PromoCodeService
            promo_service = PromoCodeService(db)
            await promo_service.increment_usage(validated_promo_code)
        user_id = str(result.inserted_id)
        
        # Log audit event
        await AuditLogger.log_event(
            db=db,
            username=request.username,
            action="user_registered",
            resource="user",
            resource_id=user_id,
            status="success",
            ip_address=http_request.client.host,
            user_agent=http_request.headers.get("user-agent"),
            details={"email": request.email}
        )
        
        logger.info(f"New user registered: {request.username}")
        
        # TODO: Send verification email
        
        return {
            "message": "Registration successful",
            "username": request.username,
            "email_verification_required": security_settings.EMAIL_VERIFICATION_REQUIRED,
            "verification_token": verification_token if security_settings.EMAIL_VERIFICATION_REQUIRED else None
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Registration error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ===== LOGIN =====

@router.post("/login", response_model=LoginResponse)
async def login(
    request: LoginRequest,
    http_request: Request,
    db = Depends(get_database)
):
    """User login"""
    try:
        # Get user (case-insensitive lookup)
        user = await db.users.find_one(get_username_query(request.username))
        
        if not user:
            # Log failed attempt
            await AuditLogger.log_event(
                db=db,
                username=request.username,
                action=SECURITY_EVENTS["LOGIN_FAILED"],
                resource="auth",
                status="failure",
                ip_address=http_request.client.host,
                user_agent=http_request.headers.get("user-agent"),
                details={"reason": "User not found"}
            )
            raise HTTPException(status_code=401, detail="Invalid username or password")
        
        security = user.get("security", {})
        status_info = user.get("status", {})
        
        # Check if account is locked
        locked_until = security.get("locked_until")
        if AccountLockoutManager.is_account_locked(locked_until):
            raise HTTPException(
                status_code=403,
                detail=f"Account is locked until {locked_until}. Please try again later."
            )
        
        # Check if account is active
        if status_info.get("status") not in [USER_STATUS["ACTIVE"], USER_STATUS["PENDING_VERIFICATION"]]:
            raise HTTPException(status_code=403, detail=f"Account is {status_info.get('status')}")
        
        # Verify password
        password_hash = security.get("password_hash")
        if not PasswordManager.verify_password(request.password, password_hash):
            # Increment failed attempts
            failed_attempts = security.get("failed_login_attempts", 0) + 1
            
            update_data = {
                "security.failed_login_attempts": failed_attempts,
                "security.last_failed_attempt": datetime.utcnow()
            }
            
            # Lock account if too many failed attempts
            if AccountLockoutManager.should_lock_account(failed_attempts):
                locked_until = AccountLockoutManager.calculate_lockout_until()
                update_data["security.locked_until"] = locked_until
                
                await AuditLogger.log_event(
                    db=db,
                    user_id=str(user["_id"]),
                    username=request.username,
                    action=SECURITY_EVENTS["ACCOUNT_LOCKED"],
                    resource="user",
                    resource_id=str(user["_id"]),
                    status="success",
                    ip_address=http_request.client.host,
                    details={"reason": "Too many failed login attempts", "locked_until": str(locked_until)}
                )
            
            await db.users.update_one({"_id": user["_id"]}, {"$set": update_data})
            
            await AuditLogger.log_event(
                db=db,
                user_id=str(user["_id"]),
                username=request.username,
                action=SECURITY_EVENTS["LOGIN_FAILED"],
                resource="auth",
                status="failure",
                ip_address=http_request.client.host,
                user_agent=http_request.headers.get("user-agent"),
                details={"reason": "Invalid password", "failed_attempts": failed_attempts}
            )
            
            # Log activity
            try:
                from services.activity_logger import get_activity_logger
                from models.activity_models import ActivityType
                activity_logger = get_activity_logger()
                await activity_logger.log_activity(
                    username=request.username,
                    action_type=ActivityType.FAILED_LOGIN,
                    ip_address=http_request.client.host,
                    user_agent=http_request.headers.get("user-agent"),
                    metadata={"reason": "invalid_password", "failed_attempts": failed_attempts}
                )
            except Exception as log_err:
                logger.warning(f"⚠️ Failed to log activity: {log_err}")
            
            raise HTTPException(status_code=401, detail="Invalid username or password")
        
        # Check MFA if enabled
        mfa = user.get("mfa", {})
        mfa_warning = None  # To store warning message if MFA requirements not met
        
        if mfa.get("mfa_enabled"):
            mfa_channel = mfa.get("mfa_type", "email")
            
            # Validate MFA requirements based on channel
            mfa_requirements_met = True
            mfa_missing_items = []
            
            if mfa_channel == "sms":
                # Check if user has phone number
                phone = user.get("contactNumber")
                logger.info(f"🔍 Login MFA check - Raw phone: {phone}")
                if phone:
                    phone = _decrypt_contact_info(phone)
                    logger.info(f"🔓 Login MFA check - Decrypted phone: {phone}")
                if not phone or (isinstance(phone, str) and not phone.strip()):
                    mfa_requirements_met = False
                    mfa_missing_items.append("phone number")
                    logger.warning(f"⚠️ Login MFA check: No valid phone number for {request.username}")
                
                # Check if SMS opt-in is enabled
                sms_opt_in = user.get("smsOptIn", True)
                if not sms_opt_in:
                    mfa_requirements_met = False
                    mfa_missing_items.append("SMS notifications enabled")
                    logger.warning(f"⚠️ Login MFA check: SMS opt-in disabled for {request.username}")
            
            elif mfa_channel == "email":
                # Check if user has email
                email = user.get("contactEmail") or user.get("email", "")
                if email:
                    email = _decrypt_contact_info(email)
                if not email or not email.strip():
                    mfa_requirements_met = False
                    mfa_missing_items.append("email address")
            
            # If MFA requirements are not met, skip MFA entirely and add warning
            if not mfa_requirements_met:
                logger.warning(f"⚠️ MFA enabled for {request.username} but requirements not met: {', '.join(mfa_missing_items)}")
                mfa_warning = {
                    "mfa_channel": mfa_channel,
                    "missing_items": mfa_missing_items,
                    "message": f"MFA is enabled but you need to add: {', '.join(mfa_missing_items)}. Please update your profile to enable MFA protection."
                }
                # Skip MFA verification entirely - proceed to login below
            else:
                # MFA requirements ARE met - proceed with normal MFA flow
                if not request.mfa_code:
                    # MFA required and requirements met - return special status with details
                    # Get contact info and DECRYPT if encrypted
                    if mfa_channel == "sms":
                        phone = user.get("contactNumber", "")
                        phone = _decrypt_contact_info(phone)
                        contact_masked = f"{phone[:3]}***{phone[-2:]}" if len(phone) > 5 else "***"
                    else:  # email
                        email = user.get("contactEmail") or user.get("email", "")
                        email = _decrypt_contact_info(email)
                        contact_masked = f"{email[0]}***@{email.split('@')[1]}" if email and '@' in email else "***"
                    
                    # Return 403 with structured error response
                    from fastapi.responses import JSONResponse
                    return JSONResponse(
                        status_code=403,
                        content={
                            "detail": "MFA_REQUIRED",
                            "mfa_channel": mfa_channel,
                            "contact_masked": contact_masked
                        }
                    )
                else:
                    # MFA code provided - verify it
                    # Verify MFA code based on type
                    mfa_type = mfa.get("mfa_type", "totp")
                    
                    if mfa_type in ["sms", "email"]:
                        # SMS/Email-based MFA - verify OTP from database
                        from services.sms_service import OTPManager
                        otp_manager = OTPManager(db)
                        verify_result = await otp_manager.verify_otp(
                            identifier=request.username,
                            code=request.mfa_code,
                            purpose="mfa",
                            mark_as_used=True
                        )
                        
                        if not verify_result["success"]:
                            # Check if it's a backup code
                            backup_codes = mfa.get("mfa_backup_codes", [])
                            backup_code_valid = False
                            
                            if "-" in request.mfa_code and len(request.mfa_code) == 9:
                                for idx, hashed_code in enumerate(backup_codes):
                                    if PasswordManager.verify_password(request.mfa_code, hashed_code):
                                        # Remove used backup code
                                        backup_codes.pop(idx)
                                        await db.users.update_one(
                                            {"username": request.username},
                                            {"$set": {"mfa.mfa_backup_codes": backup_codes}}
                                        )
                                        backup_code_valid = True
                                        logger.info(f"✅ Backup code used for login: {request.username}")
                                        break
                            
                            if not backup_code_valid:
                                raise HTTPException(status_code=401, detail="Invalid MFA code")
                    else:
                        # TOTP-based MFA (legacy)
                        if not TokenManager.verify_mfa_code(mfa.get("mfa_secret"), request.mfa_code):
                            raise HTTPException(status_code=401, detail="Invalid MFA code")
        
        # Check password expiry
        password_expires_at = security.get("password_expires_at")
        password_expired = PasswordManager.is_password_expired(password_expires_at)
        days_until_expiry = PasswordManager.get_days_until_expiry(password_expires_at)
        
        # Create tokens
        tokens = create_token_pair(user, request.remember_me)
        
        # Create session
        session_doc = {
            "user_id": str(user["_id"]),
            "username": request.username,
            "token": tokens["access_token"],
            "refresh_token": tokens["refresh_token"],
            "session_type": "web",
            "ip_address": http_request.client.host,
            "user_agent": http_request.headers.get("user-agent"),
            "created_at": datetime.utcnow(),
            "expires_at": datetime.utcnow() + timedelta(seconds=tokens["expires_in"]),
            "last_activity": datetime.utcnow(),
            "revoked": False
        }
        
        await db.sessions.insert_one(session_doc)
        
        # Update user
        await db.users.update_one(
            {"_id": user["_id"]},
            {
                "$set": {
                    "security.failed_login_attempts": 0,
                    "security.last_login_at": datetime.utcnow(),
                    "security.last_login_ip": http_request.client.host,
                    "status.is_online": True,
                    "status.last_seen": datetime.utcnow()
                }
            }
        )
        
        # Log successful login
        await AuditLogger.log_event(
            db=db,
            user_id=str(user["_id"]),
            username=request.username,
            action=SECURITY_EVENTS["LOGIN_SUCCESS"],
            resource="auth",
            status="success",
            ip_address=http_request.client.host,
            user_agent=http_request.headers.get("user-agent")
        )
        
        # Log activity
        try:
            from services.activity_logger import get_activity_logger
            from models.activity_models import ActivityType
            activity_logger = get_activity_logger()
            await activity_logger.log_activity(
                username=request.username,
                action_type=ActivityType.USER_LOGIN,
                ip_address=http_request.client.host,
                user_agent=http_request.headers.get("user-agent"),
                metadata={"remember_me": request.remember_me}
            )
        except Exception as log_err:
            logger.warning(f"⚠️ Failed to log activity: {log_err}")
        
        logger.info(f"User logged in: {request.username}")
        
        # Prepare user data (remove sensitive info)
        user_data = {
            "username": user["username"],
            "email": user["email"],
            "firstName": user.get("firstName"),
            "lastName": user.get("lastName"),
            "role": user.get("role_name"),
            "email_verified": status_info.get("email_verified")
        }
        
        return LoginResponse(
            access_token=tokens["access_token"],
            refresh_token=tokens["refresh_token"],
            token_type=tokens["token_type"],
            expires_in=tokens["expires_in"],
            user=user_data,
            password_expires_in_days=days_until_expiry if not password_expired else 0,
            force_password_change=security.get("force_password_change", False) or password_expired,
            mfa_warning=mfa_warning
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Login error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ===== TOKEN REFRESH =====

@router.post("/refresh-token", response_model=dict)
async def refresh_token(
    request: RefreshTokenRequest,
    http_request: Request,
    db = Depends(get_database)
):
    """
    Refresh access token using refresh token.
    Extends session for active users up to 8-hour hard limit from initial login.
    """
    try:
        # Verify refresh token and get user
        user = await AuthenticationService.verify_refresh_token(request.refresh_token, db)
        
        # Get session to check initial login time
        session = await db.sessions.find_one({
            "refresh_token": request.refresh_token,
            "revoked": False
        })
        
        if not session:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Session not found or expired"
            )
        
        # Check if session has exceeded 8-hour hard limit from initial login
        created_at = session.get("created_at")
        if created_at:
            time_since_login = datetime.utcnow() - created_at
            # Hard limit: 8 hours (28800 seconds) - full work day
            if time_since_login.total_seconds() > 28800:
                # Revoke session
                await db.sessions.update_one(
                    {"_id": session["_id"]},
                    {"$set": {"revoked": True}}
                )
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Session exceeded maximum duration (8 hours). Please log in again."
                )
        
        # Create new access token (extends session)
        token_data = {
            "sub": user["username"],
            "role": user.get("role_name", "free_user"),
            "permissions": user.get("custom_permissions", [])
        }
        
        # New access token with 15-minute expiry (will be refreshed again if user is active)
        access_token = JWTManager.create_access_token(
            token_data,
            expires_delta=timedelta(minutes=15)
        )
        
        # Update session last_activity
        await db.sessions.update_one(
            {"_id": session["_id"]},
            {
                "$set": {
                    "token": access_token,
                    "last_activity": datetime.utcnow(),
                    "ip_address": http_request.client.host
                }
            }
        )
        
        # Update user last_seen
        await db.users.update_one(
            {"_id": user["_id"]},
            {
                "$set": {
                    "status.last_seen": datetime.utcnow()
                }
            }
        )
        
        logger.info(f"Token refreshed for user: {user['username']}")
        
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "expires_in": 900  # 15 minutes in seconds
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Token refresh error: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not refresh token"
        )

# ===== LOGOUT =====

@router.post("/logout")
async def logout(
    http_request: Request,
    current_user: dict = Depends(get_current_user_dependency),
    db = Depends(get_database)
):
    """User logout"""
    try:
        # Get token from header
        auth_header = http_request.headers.get("authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
            
            # Revoke session
            await db.sessions.update_one(
                {"token": token},
                {
                    "$set": {
                        "revoked": True,
                        "revoked_at": datetime.utcnow(),
                        "revoked_reason": "User logout"
                    }
                }
            )
        
        # Update user status
        await db.users.update_one(
            {"username": current_user["username"]},
            {
                "$set": {
                    "status.is_online": False,
                    "status.last_seen": datetime.utcnow()
                }
            }
        )
        
        # Log audit event
        await AuditLogger.log_event(
            db=db,
            user_id=str(current_user.get("_id")),
            username=current_user["username"],
            action=SECURITY_EVENTS["LOGOUT"],
            resource="auth",
            status="success",
            ip_address=http_request.client.host
        )
        
        return {"message": "Logged out successfully"}
    
    except Exception as e:
        logger.error(f"Logout error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ===== REFRESH TOKEN =====

@router.post("/refresh")
async def refresh_token(
    request: RefreshTokenRequest,
    db = Depends(get_database)
):
    """Refresh access token using refresh token"""
    try:
        # Verify refresh token
        user = await AuthenticationService.verify_refresh_token(request.refresh_token, db)
        
        # Create new token pair
        tokens = create_token_pair(user, remember_me=True)
        
        # Update session
        await db.sessions.update_one(
            {"refresh_token": request.refresh_token},
            {
                "$set": {
                    "token": tokens["access_token"],
                    "refresh_token": tokens["refresh_token"],
                    "last_activity": datetime.utcnow(),
                    "expires_at": datetime.utcnow() + timedelta(seconds=tokens["expires_in"])
                }
            }
        )
        
        return {
            "access_token": tokens["access_token"],
            "refresh_token": tokens["refresh_token"],
            "token_type": tokens["token_type"],
            "expires_in": tokens["expires_in"]
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Token refresh error: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not refresh token"
        )

# ===== GET CURRENT USER =====

@router.get("/me")
async def get_current_user(
    current_user: dict = Depends(get_current_user_dependency)
):
    """Get current authenticated user"""
    # Remove sensitive data
    user_data = {
        "username": current_user.get("username"),
        "email": current_user.get("email"),
        "firstName": current_user.get("firstName"),
        "lastName": current_user.get("lastName"),
        "role": current_user.get("role_name"),
        "permissions": PermissionChecker.get_user_permissions(current_user),
        "email_verified": current_user.get("status", {}).get("email_verified"),
        "mfa_enabled": current_user.get("mfa", {}).get("mfa_enabled")
    }
    
    return user_data

# ===== CHANGE PASSWORD =====

@router.post("/change-password")
async def change_password(
    request: PasswordChangeRequest,
    current_user: dict = Depends(get_current_user_dependency),
    http_request: Request = None,
    db = Depends(get_database)
):
    """Change user password"""
    try:
        username = current_user.get("username")
        logger.info(f"🔐 Password change request from {username}")
        
        # Get user from database
        user = await db.users.find_one({"username": username})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        security = user.get("security", {})
        
        # Verify current password
        current_password_hash = security.get("password_hash")
        if not PasswordManager.verify_password(request.current_password, current_password_hash):
            logger.warning(f"⚠️ Password change failed for {username}: Invalid current password")
            await AuditLogger.log_event(
                db=db,
                user_id=str(user.get("_id")),
                username=username,
                action=SECURITY_EVENTS["PASSWORD_CHANGE_FAILED"],
                ip_address=http_request.client.host if http_request else None,
                user_agent=http_request.headers.get("user-agent") if http_request else None,
                status="failure",
                details={"reason": "Invalid current password"}
            )
            raise HTTPException(status_code=400, detail="Current password is incorrect")
        
        # Validate new password strength
        is_valid, errors = PasswordManager.validate_password_strength(request.new_password)
        if not is_valid:
            raise HTTPException(status_code=400, detail="; ".join(errors))
        
        # Check if new password matches current password
        if PasswordManager.verify_password(request.new_password, current_password_hash):
            raise HTTPException(
                status_code=400, 
                detail="New password cannot be the same as current password"
            )
        
        # Check password history
        password_history = security.get("password_history", [])
        if PasswordManager.check_password_in_history(request.new_password, password_history):
            raise HTTPException(
                status_code=400,
                detail=f"Password was used recently. Please choose a different password (last {security_settings.PASSWORD_HISTORY_COUNT} passwords cannot be reused)"
            )
        
        # Hash new password
        new_password_hash = PasswordManager.hash_password(request.new_password)
        
        # Update password and security settings
        password_changed_at = datetime.utcnow()
        password_expires_at = PasswordManager.calculate_password_expiry(password_changed_at)
        updated_history = PasswordManager.update_password_history(password_history, new_password_hash)
        
        await db.users.update_one(
            {"username": username},
            {
                "$set": {
                    "security.password_hash": new_password_hash,
                    "security.password_changed_at": password_changed_at,
                    "security.password_expires_at": password_expires_at,
                    "security.password_history": updated_history,
                    "security.force_password_change": False,
                    "updated_at": datetime.utcnow()
                }
            }
        )
        
        # Log successful password change
        await AuditLogger.log_event(
            db=db,
            user_id=str(user.get("_id")),
            username=username,
            action=SECURITY_EVENTS["PASSWORD_CHANGED"],
            ip_address=http_request.client.host if http_request else None,
            user_agent=http_request.headers.get("user-agent") if http_request else None,
            status="success",
            details={"password_expiry": password_expires_at.isoformat()}
        )
        
        # Log to activity logger
        try:
            activity_logger = get_activity_logger()
            await activity_logger.log_activity(
                username=username,
                action_type=ActivityType.PASSWORD_CHANGED,
                ip_address=http_request.client.host if http_request else None,
                user_agent=http_request.headers.get("user-agent") if http_request else None,
                metadata={"password_expiry": password_expires_at.isoformat()}
            )
        except Exception as log_err:
            logger.warning(f"Failed to log password change activity: {log_err}")
        
        logger.info(f"✅ Password changed successfully for {username}")
        
        return {
            "message": "Password changed successfully",
            "password_expires_in_days": PasswordManager.get_days_until_expiry(password_expires_at)
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Password change error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to change password")
