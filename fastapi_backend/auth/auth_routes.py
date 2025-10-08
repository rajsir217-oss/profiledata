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

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import get_database
from .security_models import (
    RegisterRequest, LoginRequest, LoginResponse,
    PasswordChangeRequest, PasswordResetRequest, PasswordResetConfirm,
    RefreshTokenRequest
)
from .security_config import security_settings, SECURITY_EVENTS, USER_STATUS
from .password_utils import PasswordManager, AccountLockoutManager, TokenManager
from .jwt_auth import JWTManager, create_token_pair, get_current_user_dependency, AuthenticationService
from .audit_logger import AuditLogger
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/auth", tags=["Authentication"])

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
            
            # Metadata
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        
        # Insert user
        result = await db.users.insert_one(user_doc)
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
        # Get user
        user = await db.users.find_one({"username": request.username})
        
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
            
            raise HTTPException(status_code=401, detail="Invalid username or password")
        
        # Check MFA if enabled
        mfa = user.get("mfa", {})
        if mfa.get("mfa_enabled") and not request.mfa_code:
            raise HTTPException(status_code=403, detail="MFA code required")
        
        if mfa.get("mfa_enabled") and request.mfa_code:
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
            force_password_change=security.get("force_password_change", False) or password_expired
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Login error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

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
        raise HTTPException(status_code=500, detail=str(e))

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
