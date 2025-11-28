# fastapi_backend/security_models.py
"""
Enhanced Security Models for Enterprise-Grade Authentication & Authorization
"""

from pydantic import BaseModel, EmailStr, Field, validator
from typing import Optional, List
from datetime import datetime
from bson import ObjectId
import re
from .security_config import security_settings, get_password_requirements

# ===== User Models =====

class UserRole(BaseModel):
    """User role model"""
    id: Optional[str] = None
    name: str = Field(..., min_length=3, max_length=50)
    description: Optional[str] = None
    permissions: List[str] = []
    is_system_role: bool = False
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

class Permission(BaseModel):
    """Permission model"""
    id: Optional[str] = None
    name: str = Field(..., pattern=r'^[a-z_]+\.[a-z_*]+$')  # e.g., "users.create" or "users.*"
    resource: str = Field(..., min_length=2, max_length=50)
    action: str = Field(..., pattern=r'^(create|read|update|delete|\*)$')
    description: Optional[str] = None
    created_at: Optional[datetime] = None

class PasswordHistory(BaseModel):
    """Password history entry"""
    password_hash: str
    changed_at: datetime

class UserSecurity(BaseModel):
    """User security information"""
    password_hash: str
    password_changed_at: datetime
    password_expires_at: datetime
    password_history: List[PasswordHistory] = []
    failed_login_attempts: int = 0
    locked_until: Optional[datetime] = None
    force_password_change: bool = False
    last_login_at: Optional[datetime] = None
    last_login_ip: Optional[str] = None

class UserStatus(BaseModel):
    """User status information"""
    status: str = "pending_verification"  # active, inactive, suspended, banned, pending_verification
    email_verified: bool = False
    phone_verified: bool = False
    email_verification_token: Optional[str] = None
    email_verification_expires: Optional[datetime] = None
    is_online: bool = False
    last_seen: Optional[datetime] = None

class UserMFA(BaseModel):
    """Multi-factor authentication settings"""
    mfa_enabled: bool = False
    mfa_secret: Optional[str] = None
    mfa_backup_codes: List[str] = []
    mfa_enabled_at: Optional[datetime] = None

class EnhancedUser(BaseModel):
    """Enhanced user model with complete security features"""
    id: Optional[str] = None
    username: str = Field(..., min_length=3, max_length=50, pattern=r'^[a-zA-Z0-9_]+$')
    email: EmailStr
    
    # Security
    security: UserSecurity
    
    # Status
    status: UserStatus
    
    # MFA
    mfa: Optional[UserMFA] = None
    
    # Role & Permissions
    role_id: Optional[str] = None
    role_name: str = "free_user"
    custom_permissions: List[str] = []  # Additional permissions beyond role
    
    # Profile Info (existing fields)
    firstName: Optional[str] = None
    lastName: Optional[str] = None
    dateOfBirth: Optional[str] = None
    gender: Optional[str] = None
    location: Optional[str] = None
    
    # Metadata
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    created_by: Optional[str] = None
    updated_by: Optional[str] = None
    
    # GDPR
    data_processing_consent: bool = False
    marketing_consent: bool = False
    consent_date: Optional[datetime] = None

# ===== Session Models =====

class UserSession(BaseModel):
    """User session model"""
    id: Optional[str] = None
    user_id: str
    username: str
    token: str
    refresh_token: str
    session_type: str = "web"  # web, mobile, api
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    device_info: Optional[dict] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    expires_at: datetime
    last_activity: datetime = Field(default_factory=datetime.utcnow)
    revoked: bool = False
    revoked_at: Optional[datetime] = None
    revoked_reason: Optional[str] = None

# ===== Audit Log Models =====

class AuditLog(BaseModel):
    """Audit log entry"""
    id: Optional[str] = None
    user_id: Optional[str] = None
    username: Optional[str] = None
    action: str  # From SECURITY_EVENTS
    resource: Optional[str] = None
    resource_id: Optional[str] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    status: str = "success"  # success, failure
    details: Optional[dict] = None
    error_message: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    severity: str = "info"  # info, warning, error, critical

# ===== Authentication Request/Response Models =====

class RegisterRequest(BaseModel):
    """User registration request"""
    username: str = Field(..., min_length=3, max_length=50, pattern=r'^[a-zA-Z0-9_]+$')
    email: EmailStr
    password: str = Field(..., min_length=security_settings.PASSWORD_MIN_LENGTH)
    confirm_password: str
    firstName: str = Field(..., min_length=1, max_length=50)
    lastName: str = Field(..., min_length=1, max_length=50)
    data_processing_consent: bool = True
    marketing_consent: bool = False
    
    @validator('confirm_password')
    def passwords_match(cls, v, values):
        if 'password' in values and v != values['password']:
            raise ValueError('Passwords do not match')
        return v
    
    @validator('password')
    def password_strength(cls, v):
        """Validate password strength according to security policy"""
        errors = []
        
        if len(v) < security_settings.PASSWORD_MIN_LENGTH:
            errors.append(f"Password must be at least {security_settings.PASSWORD_MIN_LENGTH} characters")
        
        if len(v) > security_settings.PASSWORD_MAX_LENGTH:
            errors.append(f"Password must not exceed {security_settings.PASSWORD_MAX_LENGTH} characters")
        
        if security_settings.PASSWORD_REQUIRE_UPPERCASE and not re.search(r'[A-Z]', v):
            errors.append("Password must contain at least one uppercase letter")
        
        if security_settings.PASSWORD_REQUIRE_LOWERCASE and not re.search(r'[a-z]', v):
            errors.append("Password must contain at least one lowercase letter")
        
        if security_settings.PASSWORD_REQUIRE_NUMBERS and not re.search(r'\d', v):
            errors.append("Password must contain at least one number")
        
        if security_settings.PASSWORD_REQUIRE_SPECIAL:
            special_chars = re.escape(security_settings.PASSWORD_SPECIAL_CHARS)
            if not re.search(f'[{special_chars}]', v):
                errors.append(f"Password must contain at least one special character ({security_settings.PASSWORD_SPECIAL_CHARS})")
        
        if errors:
            raise ValueError('; '.join(errors))
        
        return v

class LoginRequest(BaseModel):
    """User login request"""
    username: str
    password: str
    remember_me: bool = False
    mfa_code: Optional[str] = None

class LoginResponse(BaseModel):
    """User login response"""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    user: dict
    password_expires_in_days: Optional[int] = None
    force_password_change: bool = False
    mfa_warning: Optional[dict] = None  # Warning if MFA requirements not met

class PasswordChangeRequest(BaseModel):
    """Password change request"""
    current_password: str
    new_password: str = Field(..., min_length=security_settings.PASSWORD_MIN_LENGTH)
    confirm_password: str
    
    @validator('confirm_password')
    def passwords_match(cls, v, values):
        if 'new_password' in values and v != values['new_password']:
            raise ValueError('Passwords do not match')
        return v
    
    @validator('new_password')
    def password_strength(cls, v):
        """Validate password strength"""
        # Reuse validation from RegisterRequest
        return RegisterRequest.password_strength(v)

class PasswordResetRequest(BaseModel):
    """Password reset request"""
    email: EmailStr

class PasswordResetConfirm(BaseModel):
    """Password reset confirmation"""
    token: str
    new_password: str = Field(..., min_length=security_settings.PASSWORD_MIN_LENGTH)
    confirm_password: str
    
    @validator('confirm_password')
    def passwords_match(cls, v, values):
        if 'new_password' in values and v != values['new_password']:
            raise ValueError('Passwords do not match')
        return v

class RefreshTokenRequest(BaseModel):
    """Refresh token request"""
    refresh_token: str

# ===== Admin Models =====

class UserManagementRequest(BaseModel):
    """Admin user management request"""
    action: str = Field(..., pattern=r'^(activate|deactivate|suspend|ban|unlock|verify_email)$')
    reason: Optional[str] = None

class RoleAssignmentRequest(BaseModel):
    """Role assignment request"""
    role_name: str
    reason: Optional[str] = None

class PermissionGrantRequest(BaseModel):
    """Permission grant request"""
    permissions: List[str]
    reason: Optional[str] = None

# ===== Security Info Models =====

class PasswordRequirements(BaseModel):
    """Password requirements response"""
    requirements: List[str]
    min_length: int
    max_length: int

class SecurityInfo(BaseModel):
    """Security information response"""
    password_requirements: PasswordRequirements
    password_expiry_days: int
    max_failed_attempts: int
    lockout_duration_minutes: int
    session_timeout_minutes: int
    mfa_available: bool
    mfa_required_for_admin: bool

class UserSecurityStatus(BaseModel):
    """User security status"""
    username: str
    status: str
    email_verified: bool
    mfa_enabled: bool
    password_expires_in_days: int
    password_expired: bool
    account_locked: bool
    locked_until: Optional[datetime] = None
    failed_attempts: int
    last_login: Optional[datetime] = None
    active_sessions: int
