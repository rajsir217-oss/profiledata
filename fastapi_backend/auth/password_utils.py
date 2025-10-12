# fastapi_backend/password_utils.py
"""
Password utilities for hashing, validation, and policy enforcement
"""

from passlib.context import CryptContext
from datetime import datetime, timedelta
from typing import List, Tuple
import secrets
import string
from .security_config import security_settings

# Password hashing context
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class PasswordManager:
    """Password management utilities"""
    
    @staticmethod
    def hash_password(password: str) -> str:
        """Hash a password using bcrypt"""
        return pwd_context.hash(password)
    
    @staticmethod
    def verify_password(plain_password: str, hashed_password: str) -> bool:
        """Verify a password against its hash"""
        return pwd_context.verify(plain_password, hashed_password)
    
    @staticmethod
    def check_password_in_history(password: str, password_history: List[dict]) -> bool:
        """Check if password was used before"""
        for entry in password_history[-security_settings.PASSWORD_HISTORY_COUNT:]:
            if pwd_context.verify(password, entry.get('password_hash', '')):
                return True
        return False
    
    @staticmethod
    def calculate_password_expiry(changed_at: datetime = None) -> datetime:
        """Calculate password expiry date"""
        if changed_at is None:
            changed_at = datetime.utcnow()
        return changed_at + timedelta(days=security_settings.PASSWORD_EXPIRY_DAYS)
    
    @staticmethod
    def get_days_until_expiry(expires_at: datetime) -> int:
        """Get number of days until password expires"""
        delta = expires_at - datetime.utcnow()
        return max(0, delta.days)
    
    @staticmethod
    def is_password_expired(expires_at: datetime) -> bool:
        """Check if password has expired"""
        return datetime.utcnow() >= expires_at
    
    @staticmethod
    def should_warn_expiry(expires_at: datetime) -> bool:
        """Check if user should be warned about password expiry"""
        days_left = PasswordManager.get_days_until_expiry(expires_at)
        return 0 < days_left <= security_settings.PASSWORD_EXPIRY_WARNING_DAYS
    
    @staticmethod
    def generate_strong_password(length: int = 16) -> str:
        """Generate a strong random password"""
        alphabet = string.ascii_letters + string.digits + security_settings.PASSWORD_SPECIAL_CHARS
        while True:
            password = ''.join(secrets.choice(alphabet) for _ in range(length))
            # Ensure it meets all requirements
            if (any(c.islower() for c in password) and
                any(c.isupper() for c in password) and
                any(c.isdigit() for c in password) and
                any(c in security_settings.PASSWORD_SPECIAL_CHARS for c in password)):
                return password
    
    @staticmethod
    def validate_password_strength(password: str) -> Tuple[bool, List[str]]:
        """
        Validate password strength
        Returns: (is_valid, list_of_errors)
        """
        errors = []
        
        if len(password) < security_settings.PASSWORD_MIN_LENGTH:
            errors.append(f"Password must be at least {security_settings.PASSWORD_MIN_LENGTH} characters")
        
        if len(password) > security_settings.PASSWORD_MAX_LENGTH:
            errors.append(f"Password must not exceed {security_settings.PASSWORD_MAX_LENGTH} characters")
        
        if security_settings.PASSWORD_REQUIRE_UPPERCASE and not any(c.isupper() for c in password):
            errors.append("Password must contain at least one uppercase letter")
        
        if security_settings.PASSWORD_REQUIRE_LOWERCASE and not any(c.islower() for c in password):
            errors.append("Password must contain at least one lowercase letter")
        
        if security_settings.PASSWORD_REQUIRE_NUMBERS and not any(c.isdigit() for c in password):
            errors.append("Password must contain at least one number")
        
        if security_settings.PASSWORD_REQUIRE_SPECIAL:
            if not any(c in security_settings.PASSWORD_SPECIAL_CHARS for c in password):
                errors.append(f"Password must contain at least one special character ({security_settings.PASSWORD_SPECIAL_CHARS})")
        
        return (len(errors) == 0, errors)
    
    @staticmethod
    def create_password_history_entry(password_hash: str) -> dict:
        """Create a password history entry"""
        return {
            "password_hash": password_hash,
            "changed_at": datetime.utcnow()
        }
    
    @staticmethod
    def update_password_history(current_history: List[dict], new_hash: str) -> List[dict]:
        """Update password history with new password"""
        new_entry = PasswordManager.create_password_history_entry(new_hash)
        history = current_history + [new_entry]
        # Keep only the last N passwords
        return history[-security_settings.PASSWORD_HISTORY_COUNT:]

class AccountLockoutManager:
    """Account lockout management"""
    
    @staticmethod
    def should_lock_account(failed_attempts: int) -> bool:
        """Check if account should be locked"""
        return failed_attempts >= security_settings.MAX_FAILED_LOGIN_ATTEMPTS
    
    @staticmethod
    def calculate_lockout_until() -> datetime:
        """Calculate when account lockout should end"""
        return datetime.utcnow() + timedelta(minutes=security_settings.ACCOUNT_LOCKOUT_DURATION_MINUTES)
    
    @staticmethod
    def is_account_locked(locked_until: datetime = None) -> bool:
        """Check if account is currently locked"""
        if locked_until is None:
            return False
        return datetime.utcnow() < locked_until
    
    @staticmethod
    def should_reset_failed_attempts(last_failed_attempt: datetime) -> bool:
        """Check if failed attempts counter should be reset"""
        if last_failed_attempt is None:
            return True
        time_since_last_attempt = datetime.utcnow() - last_failed_attempt
        return time_since_last_attempt.total_seconds() > (security_settings.RESET_FAILED_ATTEMPTS_AFTER_MINUTES * 60)

class TokenManager:
    """Token generation and validation"""
    
    @staticmethod
    def generate_verification_token(length: int = 32) -> str:
        """Generate a secure random token for email verification"""
        return secrets.token_urlsafe(length)
    
    @staticmethod
    def generate_reset_token(length: int = 32) -> str:
        """Generate a secure random token for password reset"""
        return secrets.token_urlsafe(length)
    
    @staticmethod
    def calculate_token_expiry(hours: int = None) -> datetime:
        """Calculate token expiry time"""
        if hours is None:
            hours = security_settings.EMAIL_VERIFICATION_TOKEN_EXPIRE_HOURS
        return datetime.utcnow() + timedelta(hours=hours)
    
    @staticmethod
    def is_token_expired(expires_at: datetime) -> bool:
        """Check if token has expired"""
        return datetime.utcnow() >= expires_at
    
    @staticmethod
    def generate_mfa_secret() -> str:
        """Generate MFA secret key"""
        import pyotp
        return pyotp.random_base32()
    
    @staticmethod
    def verify_mfa_code(secret: str, code: str) -> bool:
        """Verify MFA code"""
        import pyotp
        totp = pyotp.TOTP(secret)
        return totp.verify(code, valid_window=1)
    
    @staticmethod
    def generate_backup_codes(count: int = 10) -> List[str]:
        """Generate MFA backup codes"""
        return [secrets.token_hex(4).upper() for _ in range(count)]

class SessionManager:
    """Session management utilities"""
    
    @staticmethod
    def calculate_session_expiry(remember_me: bool = False) -> datetime:
        """Calculate session expiry time"""
        if remember_me:
            # Extended session for "remember me"
            return datetime.utcnow() + timedelta(days=security_settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS)
        else:
            return datetime.utcnow() + timedelta(minutes=security_settings.SESSION_TIMEOUT_MINUTES)
    
    @staticmethod
    def is_session_expired(expires_at: datetime) -> bool:
        """Check if session has expired"""
        return datetime.utcnow() >= expires_at
    
    @staticmethod
    def should_refresh_session(last_activity: datetime) -> bool:
        """Check if session should be refreshed"""
        time_since_activity = datetime.utcnow() - last_activity
        # Refresh if more than half the timeout has passed
        return time_since_activity.total_seconds() > (security_settings.SESSION_TIMEOUT_MINUTES * 30)
    
    @staticmethod
    def calculate_absolute_timeout() -> datetime:
        """Calculate absolute session timeout"""
        return datetime.utcnow() + timedelta(hours=security_settings.SESSION_ABSOLUTE_TIMEOUT_HOURS)
