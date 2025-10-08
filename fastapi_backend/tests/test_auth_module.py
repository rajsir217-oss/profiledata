# fastapi_backend/tests/test_auth_module.py
"""
Comprehensive Test Suite for Auth Module
Tests: Password policy, JWT, RBAC, Admin role assignment, Audit logging
"""

import pytest
from datetime import datetime, timedelta
from fastapi.testclient import TestClient
from unittest.mock import AsyncMock, MagicMock, patch
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from auth.password_utils import PasswordManager, AccountLockoutManager, TokenManager
from auth.jwt_auth import JWTManager, create_token_pair
from auth.authorization import PermissionChecker, RoleChecker
from auth.security_config import security_settings, DEFAULT_PERMISSIONS
from auth.audit_logger import AuditLogger

# ===== PASSWORD UTILITIES TESTS =====

class TestPasswordManager:
    """Test password management utilities"""
    
    def test_hash_password(self):
        """Test password hashing"""
        password = "SecurePass123!"
        hashed = PasswordManager.hash_password(password)
        
        assert hashed != password
        assert len(hashed) > 0
        assert hashed.startswith("$2b$")  # bcrypt prefix
    
    def test_verify_password_correct(self):
        """Test password verification with correct password"""
        password = "SecurePass123!"
        hashed = PasswordManager.hash_password(password)
        
        assert PasswordManager.verify_password(password, hashed) is True
    
    def test_verify_password_incorrect(self):
        """Test password verification with incorrect password"""
        password = "SecurePass123!"
        hashed = PasswordManager.hash_password(password)
        
        assert PasswordManager.verify_password("WrongPass123!", hashed) is False
    
    def test_validate_password_strength_valid(self):
        """Test password strength validation with valid password"""
        password = "SecurePass123!"
        is_valid, errors = PasswordManager.validate_password_strength(password)
        
        assert is_valid is True
        assert len(errors) == 0
    
    def test_validate_password_strength_too_short(self):
        """Test password strength validation with short password"""
        password = "Short1!"
        is_valid, errors = PasswordManager.validate_password_strength(password)
        
        assert is_valid is False
        assert any("at least" in error for error in errors)
    
    def test_validate_password_strength_no_uppercase(self):
        """Test password strength validation without uppercase"""
        password = "securepass123!"
        is_valid, errors = PasswordManager.validate_password_strength(password)
        
        assert is_valid is False
        assert any("uppercase" in error for error in errors)
    
    def test_validate_password_strength_no_lowercase(self):
        """Test password strength validation without lowercase"""
        password = "SECUREPASS123!"
        is_valid, errors = PasswordManager.validate_password_strength(password)
        
        assert is_valid is False
        assert any("lowercase" in error for error in errors)
    
    def test_validate_password_strength_no_numbers(self):
        """Test password strength validation without numbers"""
        password = "SecurePass!"
        is_valid, errors = PasswordManager.validate_password_strength(password)
        
        assert is_valid is False
        assert any("number" in error for error in errors)
    
    def test_validate_password_strength_no_special(self):
        """Test password strength validation without special chars"""
        password = "SecurePass123"
        is_valid, errors = PasswordManager.validate_password_strength(password)
        
        assert is_valid is False
        assert any("special" in error for error in errors)
    
    def test_check_password_in_history(self):
        """Test password history checking"""
        password = "SecurePass123!"
        hashed = PasswordManager.hash_password(password)
        
        history = [{"password_hash": hashed, "changed_at": datetime.utcnow()}]
        
        assert PasswordManager.check_password_in_history(password, history) is True
        assert PasswordManager.check_password_in_history("DifferentPass123!", history) is False
    
    def test_calculate_password_expiry(self):
        """Test password expiry calculation"""
        now = datetime.utcnow()
        expiry = PasswordManager.calculate_password_expiry(now)
        
        expected_expiry = now + timedelta(days=security_settings.PASSWORD_EXPIRY_DAYS)
        assert abs((expiry - expected_expiry).total_seconds()) < 1
    
    def test_is_password_expired(self):
        """Test password expiry checking"""
        past_date = datetime.utcnow() - timedelta(days=1)
        future_date = datetime.utcnow() + timedelta(days=1)
        
        assert PasswordManager.is_password_expired(past_date) is True
        assert PasswordManager.is_password_expired(future_date) is False
    
    def test_generate_strong_password(self):
        """Test strong password generation"""
        password = PasswordManager.generate_strong_password(16)
        
        assert len(password) == 16
        is_valid, errors = PasswordManager.validate_password_strength(password)
        assert is_valid is True

# ===== ACCOUNT LOCKOUT TESTS =====

class TestAccountLockoutManager:
    """Test account lockout management"""
    
    def test_should_lock_account(self):
        """Test account lockout threshold"""
        assert AccountLockoutManager.should_lock_account(4) is False
        assert AccountLockoutManager.should_lock_account(5) is True
        assert AccountLockoutManager.should_lock_account(6) is True
    
    def test_calculate_lockout_until(self):
        """Test lockout duration calculation"""
        now = datetime.utcnow()
        lockout_until = AccountLockoutManager.calculate_lockout_until()
        
        expected = now + timedelta(minutes=security_settings.ACCOUNT_LOCKOUT_DURATION_MINUTES)
        assert abs((lockout_until - expected).total_seconds()) < 1
    
    def test_is_account_locked(self):
        """Test account lock status checking"""
        past_date = datetime.utcnow() - timedelta(minutes=1)
        future_date = datetime.utcnow() + timedelta(minutes=30)
        
        assert AccountLockoutManager.is_account_locked(None) is False
        assert AccountLockoutManager.is_account_locked(past_date) is False
        assert AccountLockoutManager.is_account_locked(future_date) is True

# ===== TOKEN MANAGER TESTS =====

class TestTokenManager:
    """Test token generation and validation"""
    
    def test_generate_verification_token(self):
        """Test verification token generation"""
        token = TokenManager.generate_verification_token()
        
        assert len(token) > 0
        assert isinstance(token, str)
    
    def test_generate_reset_token(self):
        """Test reset token generation"""
        token = TokenManager.generate_reset_token()
        
        assert len(token) > 0
        assert isinstance(token, str)
    
    def test_calculate_token_expiry(self):
        """Test token expiry calculation"""
        now = datetime.utcnow()
        expiry = TokenManager.calculate_token_expiry(24)
        
        expected = now + timedelta(hours=24)
        assert abs((expiry - expected).total_seconds()) < 1
    
    def test_is_token_expired(self):
        """Test token expiry checking"""
        past_date = datetime.utcnow() - timedelta(hours=1)
        future_date = datetime.utcnow() + timedelta(hours=24)
        
        assert TokenManager.is_token_expired(past_date) is True
        assert TokenManager.is_token_expired(future_date) is False

# ===== JWT TESTS =====

class TestJWTManager:
    """Test JWT token management"""
    
    def test_create_access_token(self):
        """Test access token creation"""
        data = {"sub": "testuser", "role": "free_user"}
        token = JWTManager.create_access_token(data)
        
        assert isinstance(token, str)
        assert len(token) > 0
    
    def test_create_refresh_token(self):
        """Test refresh token creation"""
        data = {"sub": "testuser", "role": "free_user"}
        token = JWTManager.create_refresh_token(data)
        
        assert isinstance(token, str)
        assert len(token) > 0
    
    def test_decode_token_valid(self):
        """Test token decoding with valid token"""
        data = {"sub": "testuser", "role": "free_user"}
        token = JWTManager.create_access_token(data)
        
        payload = JWTManager.decode_token(token)
        
        assert payload["sub"] == "testuser"
        assert payload["role"] == "free_user"
        assert payload["type"] == "access"
    
    def test_verify_token_type(self):
        """Test token type verification"""
        data = {"sub": "testuser"}
        access_token = JWTManager.create_access_token(data)
        refresh_token = JWTManager.create_refresh_token(data)
        
        access_payload = JWTManager.decode_token(access_token)
        refresh_payload = JWTManager.decode_token(refresh_token)
        
        # Should not raise exception
        JWTManager.verify_token_type(access_payload, "access")
        JWTManager.verify_token_type(refresh_payload, "refresh")
    
    def test_create_token_pair(self):
        """Test token pair creation"""
        user = {
            "username": "testuser",
            "role_name": "free_user",
            "custom_permissions": []
        }
        
        tokens = create_token_pair(user, remember_me=False)
        
        assert "access_token" in tokens
        assert "refresh_token" in tokens
        assert "token_type" in tokens
        assert "expires_in" in tokens
        assert tokens["token_type"] == "bearer"

# ===== PERMISSION CHECKER TESTS =====

class TestPermissionChecker:
    """Test permission checking"""
    
    def test_has_permission_exact_match(self):
        """Test exact permission match"""
        permissions = ["users.create", "users.read"]
        
        assert PermissionChecker.has_permission(permissions, "users.create") is True
        assert PermissionChecker.has_permission(permissions, "users.delete") is False
    
    def test_has_permission_wildcard(self):
        """Test wildcard permission match"""
        permissions = ["users.*"]
        
        assert PermissionChecker.has_permission(permissions, "users.create") is True
        assert PermissionChecker.has_permission(permissions, "users.read") is True
        assert PermissionChecker.has_permission(permissions, "users.delete") is True
        assert PermissionChecker.has_permission(permissions, "profiles.read") is False
    
    def test_has_permission_full_wildcard(self):
        """Test full wildcard permission"""
        permissions = ["*"]
        
        assert PermissionChecker.has_permission(permissions, "users.create") is True
        assert PermissionChecker.has_permission(permissions, "profiles.delete") is True
    
    def test_get_user_permissions(self):
        """Test getting user permissions from role"""
        user = {
            "role_name": "admin",
            "custom_permissions": ["extra.permission"]
        }
        
        permissions = PermissionChecker.get_user_permissions(user)
        
        assert "users.*" in permissions
        assert "extra.permission" in permissions
    
    def test_check_permission(self):
        """Test permission checking for user"""
        user = {
            "role_name": "moderator",
            "custom_permissions": []
        }
        
        assert PermissionChecker.check_permission(user, "users.read") is True
        assert PermissionChecker.check_permission(user, "users.delete") is False

# ===== ROLE CHECKER TESTS =====

class TestRoleChecker:
    """Test role checking"""
    
    def test_has_role(self):
        """Test role checking"""
        user = {"role_name": "admin"}
        
        assert RoleChecker.has_role(user, "admin") is True
        assert RoleChecker.has_role(user, "moderator") is False
    
    def test_has_any_role(self):
        """Test any role checking"""
        user = {"role_name": "moderator"}
        
        assert RoleChecker.has_any_role(user, ["admin", "moderator"]) is True
        assert RoleChecker.has_any_role(user, ["admin", "premium_user"]) is False
    
    def test_is_admin(self):
        """Test admin role checking"""
        admin_user = {"role_name": "admin"}
        regular_user = {"role_name": "free_user"}
        
        assert RoleChecker.is_admin(admin_user) is True
        assert RoleChecker.is_admin(regular_user) is False
    
    def test_is_moderator_or_admin(self):
        """Test moderator or admin checking"""
        admin_user = {"role_name": "admin"}
        mod_user = {"role_name": "moderator"}
        regular_user = {"role_name": "free_user"}
        
        assert RoleChecker.is_moderator_or_admin(admin_user) is True
        assert RoleChecker.is_moderator_or_admin(mod_user) is True
        assert RoleChecker.is_moderator_or_admin(regular_user) is False

# ===== AUDIT LOGGER TESTS =====

class TestAuditLogger:
    """Test audit logging"""
    
    @pytest.mark.asyncio
    async def test_log_event(self):
        """Test audit event logging"""
        mock_db = MagicMock()
        mock_db.audit_logs.insert_one = AsyncMock()
        
        await AuditLogger.log_event(
            db=mock_db,
            username="testuser",
            action="login_success",
            resource="auth",
            status="success",
            ip_address="192.168.1.1"
        )
        
        mock_db.audit_logs.insert_one.assert_called_once()
        call_args = mock_db.audit_logs.insert_one.call_args[0][0]
        
        assert call_args["username"] == "testuser"
        assert call_args["action"] == "login_success"
        assert call_args["status"] == "success"

# ===== INTEGRATION TESTS =====

class TestPasswordPolicyIntegration:
    """Test password policy integration"""
    
    def test_password_expiry_workflow(self):
        """Test complete password expiry workflow"""
        # Create password
        password = "SecurePass123!"
        hashed = PasswordManager.hash_password(password)
        
        # Set expiry
        changed_at = datetime.utcnow()
        expires_at = PasswordManager.calculate_password_expiry(changed_at)
        
        # Check not expired
        assert PasswordManager.is_password_expired(expires_at) is False
        
        # Check days until expiry
        days_left = PasswordManager.get_days_until_expiry(expires_at)
        assert days_left == security_settings.PASSWORD_EXPIRY_DAYS
        
        # Check warning
        warning_date = expires_at - timedelta(days=5)
        assert PasswordManager.should_warn_expiry(warning_date) is True
    
    def test_password_history_workflow(self):
        """Test password history workflow"""
        passwords = ["Pass1!", "Pass2!", "Pass3!", "Pass4!", "Pass5!", "Pass6!"]
        history = []
        
        # Add passwords to history
        for pwd in passwords[:5]:
            hashed = PasswordManager.hash_password(pwd)
            history = PasswordManager.update_password_history(history, hashed)
        
        # History should only keep last 5
        assert len(history) == security_settings.PASSWORD_HISTORY_COUNT
        
        # Check if old password is in history
        assert PasswordManager.check_password_in_history(passwords[0], history) is True
        
        # Add 6th password
        hashed6 = PasswordManager.hash_password(passwords[5])
        history = PasswordManager.update_password_history(history, hashed6)
        
        # First password should be removed
        assert len(history) == security_settings.PASSWORD_HISTORY_COUNT
        assert PasswordManager.check_password_in_history(passwords[0], history) is False

class TestAccountLockoutIntegration:
    """Test account lockout integration"""
    
    def test_failed_login_workflow(self):
        """Test failed login workflow"""
        failed_attempts = 0
        
        # Simulate failed logins
        for i in range(6):
            failed_attempts += 1
            
            if AccountLockoutManager.should_lock_account(failed_attempts):
                locked_until = AccountLockoutManager.calculate_lockout_until()
                assert AccountLockoutManager.is_account_locked(locked_until) is True
                break
        
        assert failed_attempts == 5  # Should lock at 5 attempts

# ===== SUMMARY =====

def test_module_imports():
    """Test that all auth module components can be imported"""
    from auth import (
        security_settings,
        PasswordManager,
        JWTManager,
        PermissionChecker,
        RoleChecker,
        require_admin,
        get_current_user_dependency
    )
    
    assert security_settings is not None
    assert PasswordManager is not None
    assert JWTManager is not None
    assert PermissionChecker is not None
    assert RoleChecker is not None

if __name__ == "__main__":
    pytest.main([__file__, "-v"])
