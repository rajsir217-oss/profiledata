# 🔐 Authentication & Authorization Module

Enterprise-grade security module for the Matrimonial Profile application.

## 📁 Module Structure

```
auth/
├── __init__.py              # Module exports
├── security_config.py       # Security configuration & settings
├── security_models.py       # Pydantic models for security
├── password_utils.py        # Password management utilities
├── jwt_auth.py             # JWT authentication
├── authorization.py         # RBAC authorization
├── auth_routes.py          # Authentication endpoints
├── admin_routes.py         # Admin management endpoints
├── audit_logger.py         # Audit logging system
└── README.md               # This file
```

## 🚀 Quick Start

### Import the module:
```python
from auth import (
    security_settings,
    PasswordManager,
    JWTManager,
    require_admin,
    get_current_user_dependency
)
```

### Use in routes:
```python
from fastapi import APIRouter, Depends
from auth import require_admin, get_current_user_dependency

router = APIRouter()

@router.get("/protected")
async def protected_route(current_user: dict = Depends(get_current_user_dependency)):
    return {"message": f"Hello {current_user['username']}"}

@router.get("/admin-only", dependencies=[Depends(require_admin)])
async def admin_route():
    return {"message": "Admin access granted"}
```

## 📚 Components

### 1. Security Configuration (`security_config.py`)
- Password policies
- Account lockout settings
- Session management
- MFA configuration
- GDPR compliance

### 2. Security Models (`security_models.py`)
- EnhancedUser
- UserRole & Permission
- UserSession
- AuditLog
- Request/Response models

### 3. Password Utilities (`password_utils.py`)
- `PasswordManager` - Hash, verify, validate passwords
- `AccountLockoutManager` - Handle account lockouts
- `TokenManager` - Generate verification/reset tokens
- `SessionManager` - Manage user sessions

### 4. JWT Authentication (`jwt_auth.py`)
- `JWTManager` - Create & validate JWT tokens
- `AuthenticationService` - User authentication
- `create_token_pair()` - Generate access & refresh tokens

### 5. Authorization (`authorization.py`)
- `PermissionChecker` - Check user permissions
- `RoleChecker` - Check user roles
- `require_permission()` - Permission-based dependencies
- `require_role()` - Role-based dependencies
- `require_admin()` - Admin-only access

### 6. Authentication Routes (`auth_routes.py`)
- POST `/api/auth/register` - User registration
- POST `/api/auth/login` - User login
- POST `/api/auth/logout` - User logout
- POST `/api/auth/refresh` - Refresh access token
- GET `/api/auth/me` - Get current user

### 7. Admin Routes (`admin_routes.py`)
- GET `/api/admin/users` - List all users
- GET `/api/admin/users/{username}` - User details
- POST `/api/admin/users/{username}/assign-role` - **Assign role to user**
- POST `/api/admin/users/{username}/grant-permissions` - Grant permissions
- POST `/api/admin/users/{username}/manage` - Manage user account

### 8. Audit Logger (`audit_logger.py`)
- `AuditLogger.log_event()` - Log security events
- `AuditLogger.get_user_audit_logs()` - Get user's audit logs
- `AuditLogger.get_all_audit_logs()` - Get all audit logs

## 🔑 Key Features

### Password Policy
- Minimum 8 characters
- Requires uppercase, lowercase, numbers, special chars
- Password expiry: 90 days
- Password history: Last 5 passwords
- Expiry warnings: 7 days before

### Account Security
- Account lockout: 5 failed attempts
- Lockout duration: 30 minutes
- User status: active, inactive, suspended, banned
- Email verification required
- MFA support (TOTP)

### Authorization
- Role-based access control (RBAC)
- 4 default roles: admin, moderator, premium_user, free_user
- Granular permissions (resource.action format)
- Wildcard permissions (users.* = all user operations)
- Custom permissions per user

### Audit & Compliance
- All security events logged
- GDPR compliant
- Data retention policies
- IP & user agent tracking

## 📖 Usage Examples

### Register a User
```python
from auth import PasswordManager

# Hash password
password_hash = PasswordManager.hash_password("MySecurePass123!")

# Verify password
is_valid = PasswordManager.verify_password("MySecurePass123!", password_hash)
```

### Check Permissions
```python
from auth import PermissionChecker

user = {"role_name": "admin", "custom_permissions": []}
has_perm = PermissionChecker.check_permission(user, "users.create")
# Returns: True (admin has users.*)
```

### Protect Routes
```python
from fastapi import Depends
from auth import require_permission, require_admin

@router.post("/users", dependencies=[Depends(require_permission("users.create"))])
async def create_user():
    return {"message": "User created"}

@router.get("/admin", dependencies=[Depends(require_admin)])
async def admin_panel():
    return {"message": "Admin panel"}
```

### Assign Role (Admin)
```python
# POST /api/admin/users/john_doe/assign-role
{
  "role_name": "premium_user",
  "reason": "Upgraded to premium"
}
```

### Log Audit Event
```python
from auth import AuditLogger

await AuditLogger.log_event(
    db=db,
    username="john_doe",
    action="password_changed",
    resource="user",
    status="success",
    ip_address="192.168.1.1"
)
```

## 🔒 Security Best Practices

1. **Always use HTTPS in production**
2. **Change JWT_SECRET_KEY in production**
3. **Enable MFA for admin accounts**
4. **Configure CORS properly**
5. **Monitor audit logs regularly**
6. **Keep dependencies updated**
7. **Use strong password policies**
8. **Implement rate limiting**

## 📝 Configuration

Edit `.env` file:
```env
JWT_SECRET_KEY=your-super-secret-key-change-in-production
PASSWORD_EXPIRY_DAYS=90
MAX_FAILED_LOGIN_ATTEMPTS=5
ACCOUNT_LOCKOUT_DURATION_MINUTES=30
SESSION_TIMEOUT_MINUTES=60
EMAIL_VERIFICATION_REQUIRED=true
MFA_REQUIRED_FOR_ADMIN=true
```

## 🎯 Roles & Permissions

### Admin
- Full access to everything
- Can assign roles to users
- Can grant/revoke permissions
- Can manage user accounts

### Moderator
- User & content moderation
- Can read/update profiles
- Can delete messages
- Can view audit logs

### Premium User
- Enhanced features
- Can request/grant PII access
- Full favorites & shortlist access
- Unlimited messaging

### Free User
- Basic access
- Limited features
- Can request PII access
- Limited favorites

## 🚀 Next Steps

1. Install dependencies:
```bash
pip install python-jose[cryptography] passlib[bcrypt] pyotp pydantic-settings
```

2. Update main.py to include auth routes:
```python
from auth.auth_routes import router as auth_router
from auth.admin_routes import router as admin_router

app.include_router(auth_router)
app.include_router(admin_router)
```

3. Create database indexes:
```python
await db.users.create_index("username", unique=True)
await db.users.create_index("email", unique=True)
await db.sessions.create_index("token")
await db.audit_logs.create_index([("username", 1), ("timestamp", -1)])
```

## 📊 Version

**Version:** 1.0.0  
**Status:** Production Ready  
**Last Updated:** 2025-10-07
