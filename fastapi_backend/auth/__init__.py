# fastapi_backend/auth/__init__.py
"""
Authentication & Authorization Module

This module provides enterprise-grade security features including:
- User authentication (JWT)
- Role-based access control (RBAC)
- Password management & policies
- Admin user management
- Audit logging
"""

from .security_config import security_settings, SecuritySettings
from .security_models import (
    EnhancedUser,
    UserRole,
    Permission,
    UserSession,
    AuditLog,
    RegisterRequest,
    LoginRequest,
    LoginResponse,
    PasswordChangeRequest,
    PasswordResetRequest,
    UserManagementRequest,
    RoleAssignmentRequest,
    PermissionGrantRequest
)
from .password_utils import (
    PasswordManager,
    AccountLockoutManager,
    TokenManager,
    SessionManager
)
from .jwt_auth import (
    JWTManager,
    AuthenticationService,
    create_token_pair,
    get_current_user_dependency
)
from .authorization import (
    PermissionChecker,
    RoleChecker,
    LimitChecker,
    OwnershipChecker,
    require_permission,
    require_role,
    require_admin,
    require_moderator_or_admin,
    require_premium_user
)

__all__ = [
    # Config
    'security_settings',
    'SecuritySettings',
    
    # Models
    'EnhancedUser',
    'UserRole',
    'Permission',
    'UserSession',
    'AuditLog',
    'RegisterRequest',
    'LoginRequest',
    'LoginResponse',
    'PasswordChangeRequest',
    'PasswordResetRequest',
    'UserManagementRequest',
    'RoleAssignmentRequest',
    'PermissionGrantRequest',
    
    # Password Utils
    'PasswordManager',
    'AccountLockoutManager',
    'TokenManager',
    'SessionManager',
    
    # JWT Auth
    'JWTManager',
    'AuthenticationService',
    'create_token_pair',
    'get_current_user_dependency',
    
    # Authorization
    'PermissionChecker',
    'RoleChecker',
    'LimitChecker',
    'OwnershipChecker',
    'require_permission',
    'require_role',
    'require_admin',
    'require_moderator_or_admin',
    'require_premium_user',
]

__version__ = '1.0.0'
