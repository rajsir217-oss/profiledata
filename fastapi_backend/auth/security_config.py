# fastapi_backend/security_config.py
"""
Enterprise-Grade Security Configuration
Compliant with OWASP, NIST, and industry best practices
"""

from pydantic_settings import BaseSettings
from pydantic import ConfigDict
from typing import Optional
from datetime import timedelta

class SecuritySettings(BaseSettings):
    """Security configuration settings"""
    
    # ===== JWT Configuration =====
    JWT_SECRET_KEY: str = "your-secret-key-change-in-production"  # Change in production!
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 15  # 15 minutes (refreshed automatically)
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 7  # 7 days (reduced from 30 for security - Jan 13, 2026)
    
    # ===== Password Policy =====
    PASSWORD_MIN_LENGTH: int = 8
    PASSWORD_MAX_LENGTH: int = 128
    PASSWORD_REQUIRE_UPPERCASE: bool = True
    PASSWORD_REQUIRE_LOWERCASE: bool = True
    PASSWORD_REQUIRE_NUMBERS: bool = True
    PASSWORD_REQUIRE_SPECIAL: bool = True
    PASSWORD_SPECIAL_CHARS: str = "!@#$%^&*()_+-=[]{}|;:,.<>?"
    
    # ===== Password Expiry & Rotation =====
    PASSWORD_EXPIRY_DAYS: int = 90  # Force password change every 90 days
    PASSWORD_EXPIRY_WARNING_DAYS: int = 7  # Warn user 7 days before expiry
    PASSWORD_HISTORY_COUNT: int = 5  # Prevent reusing last 5 passwords
    FORCE_PASSWORD_CHANGE_ON_FIRST_LOGIN: bool = True
    
    # ===== Account Lockout Policy =====
    MAX_FAILED_LOGIN_ATTEMPTS: int = 5
    ACCOUNT_LOCKOUT_DURATION_MINUTES: int = 30
    RESET_FAILED_ATTEMPTS_AFTER_MINUTES: int = 60
    
    # ===== Session Management =====
    # ALIGNED with frontend sessionManager.js (Jan 13, 2026)
    SESSION_TIMEOUT_MINUTES: int = 30  # Inactivity timeout (matches frontend INACTIVITY_LOGOUT)
    MAX_CONCURRENT_SESSIONS_PER_USER: int = 3
    SESSION_ABSOLUTE_TIMEOUT_HOURS: int = 8  # Hard limit (matches frontend HARD_LIMIT)
    
    # ===== Multi-Factor Authentication =====
    MFA_ENABLED: bool = False  # Enable for production
    MFA_REQUIRED_FOR_ADMIN: bool = True
    MFA_ISSUER_NAME: str = "Matrimonial Profile App"
    
    # ===== Rate Limiting =====
    RATE_LIMIT_LOGIN_ATTEMPTS: int = 10  # Per 15 minutes
    RATE_LIMIT_PASSWORD_RESET: int = 3  # Per hour
    RATE_LIMIT_API_CALLS: int = 100  # Per minute
    
    # ===== Email Verification =====
    EMAIL_VERIFICATION_REQUIRED: bool = True
    EMAIL_VERIFICATION_TOKEN_EXPIRE_HOURS: int = 24
    
    # ===== Security Headers =====
    CORS_ALLOWED_ORIGINS: list = [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000"
    ]
    CORS_ALLOW_CREDENTIALS: bool = True
    
    # ===== Audit Logging =====
    AUDIT_LOG_ENABLED: bool = True
    AUDIT_LOG_RETENTION_DAYS: int = 365  # Keep logs for 1 year
    LOG_SENSITIVE_DATA: bool = False  # Don't log passwords, tokens
    
    # ===== GDPR Compliance =====
    GDPR_ENABLED: bool = True
    DATA_RETENTION_DAYS: int = 730  # 2 years
    ALLOW_DATA_EXPORT: bool = True
    ALLOW_DATA_DELETION: bool = True
    
    # ===== IP Tracking =====
    TRACK_IP_ADDRESSES: bool = True
    BLOCK_SUSPICIOUS_IPS: bool = True
    MAX_FAILED_ATTEMPTS_PER_IP: int = 20
    
    # ===== Default Roles =====
    DEFAULT_USER_ROLE: str = "free_user"
    SYSTEM_ROLES: list = ["admin", "moderator", "premium_user", "free_user"]
    
    model_config = ConfigDict(
        env_file=".env",
        case_sensitive=True,
        extra="ignore"  # Ignore extra fields in .env
    )

# Global security settings instance
security_settings = SecuritySettings()

# ===== Password Validation Rules =====
def get_password_requirements() -> dict:
    """Get human-readable password requirements"""
    requirements = []
    
    if security_settings.PASSWORD_MIN_LENGTH:
        requirements.append(f"At least {security_settings.PASSWORD_MIN_LENGTH} characters")
    
    if security_settings.PASSWORD_REQUIRE_UPPERCASE:
        requirements.append("At least one uppercase letter (A-Z)")
    
    if security_settings.PASSWORD_REQUIRE_LOWERCASE:
        requirements.append("At least one lowercase letter (a-z)")
    
    if security_settings.PASSWORD_REQUIRE_NUMBERS:
        requirements.append("At least one number (0-9)")
    
    if security_settings.PASSWORD_REQUIRE_SPECIAL:
        requirements.append(f"At least one special character ({security_settings.PASSWORD_SPECIAL_CHARS})")
    
    return {
        "requirements": requirements,
        "min_length": security_settings.PASSWORD_MIN_LENGTH,
        "max_length": security_settings.PASSWORD_MAX_LENGTH
    }

# ===== Role Hierarchy (Inheritance) =====
ROLE_HIERARCHY = {
    "admin": ["moderator", "premium_user", "free_user"],  # Admin inherits all
    "moderator": ["premium_user", "free_user"],  # Moderator inherits premium + free
    "premium_user": ["free_user"],  # Premium inherits free
    "free_user": []  # Free user is base (no inheritance)
}

# ===== Default Permissions =====
DEFAULT_PERMISSIONS = {
    "admin": [
        "users.*",  # All user operations
        "roles.*",  # All role operations
        "permissions.*",  # All permission operations
        "profiles.*",  # All profile operations
        "messages.*",  # All message operations
        "pii.*",  # All PII operations
        "audit.*",  # View audit logs
        "security.*"  # Security settings
    ],
    "moderator": [
        "users.read",
        "users.update",
        "profiles.read",
        "profiles.update",
        "profiles.delete",
        "messages.read",
        "messages.delete",
        "pii.read",
        "audit.read",
        "announcements.*",
        "polls.*",
        "invitations.*"
    ],
    "premium_user": [
        "profiles.read",
        "profiles.create",
        "profiles.update",
        "messages.read",
        "messages.create",
        "pii.request",
        "pii.grant",
        "favorites.*",
        "shortlist.*"
    ],
    "free_user": [
        "profiles.read",
        "profiles.create",
        "profiles.update",
        "messages.read",
        "messages.create",
        "pii.request",
        "favorites.read",
        "favorites.create"
    ]
}

# ===== Feature Limits by Role =====
ROLE_LIMITS = {
    "admin": {
        "favorites_max": None,  # Unlimited
        "shortlist_max": None,
        "messages_per_day": None,
        "profile_views_per_day": None,
        "pii_requests_per_month": None,
        "search_results_max": None
    },
    "moderator": {
        "favorites_max": None,
        "shortlist_max": None,
        "messages_per_day": None,
        "profile_views_per_day": None,
        "pii_requests_per_month": None,
        "search_results_max": None
    },
    "premium_user": {
        "favorites_max": None,  # Unlimited
        "shortlist_max": None,
        "messages_per_day": None,
        "profile_views_per_day": None,
        "pii_requests_per_month": 10,
        "search_results_max": 100
    },
    "free_user": {
        "favorites_max": 10,
        "shortlist_max": 5,
        "messages_per_day": 5,
        "profile_views_per_day": 20,
        "pii_requests_per_month": 3,
        "search_results_max": 20
    }
}

# ===== Security Event Types =====
SECURITY_EVENTS = {
    "LOGIN_SUCCESS": "login_success",
    "LOGIN_FAILED": "login_failed",
    "LOGOUT": "logout",
    "PASSWORD_CHANGED": "password_changed",
    "PASSWORD_CHANGE_FAILED": "password_change_failed",
    "PASSWORD_RESET_REQUESTED": "password_reset_requested",
    "PASSWORD_RESET_COMPLETED": "password_reset_completed",
    "ACCOUNT_LOCKED": "account_locked",
    "ACCOUNT_UNLOCKED": "account_unlocked",
    "EMAIL_VERIFIED": "email_verified",
    "MFA_ENABLED": "mfa_enabled",
    "MFA_DISABLED": "mfa_disabled",
    "ROLE_CHANGED": "role_changed",
    "PERMISSION_GRANTED": "permission_granted",
    "PERMISSION_REVOKED": "permission_revoked",
    "SUSPICIOUS_ACTIVITY": "suspicious_activity",
    "DATA_EXPORTED": "data_exported",
    "DATA_DELETED": "data_deleted"
}

# ===== User Status Types =====
USER_STATUS = {
    "ACTIVE": "active",
    "INACTIVE": "inactive",
    "SUSPENDED": "suspended",
    "BANNED": "banned",
    "PENDING_VERIFICATION": "pending_verification",
    "PASSWORD_EXPIRED": "password_expired",
    "LOCKED": "locked"
}

# ===== Session Types =====
SESSION_TYPES = {
    "WEB": "web",
    "MOBILE": "mobile",
    "API": "api"
}
