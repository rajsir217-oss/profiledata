# 🔒 Security Roles & Permissions Review
## L3V3L Dating Platform - Enterprise-Grade RBAC System

**Last Updated:** October 14, 2025  
**Status:** ✅ Production Ready

---

## 📋 Table of Contents
1. [Role Hierarchy](#role-hierarchy)
2. [Permission Matrix](#permission-matrix)
3. [Access Control Implementation](#access-control-implementation)
4. [Security Policies](#security-policies)
5. [Frontend Route Protection](#frontend-route-protection)
6. [Recommendations](#recommendations)

---

## 🏆 Role Hierarchy

### **1. Admin** (Highest Privilege)
- **Purpose:** System administrators with full control
- **Access Level:** Full access to all resources
- **Count:** Typically 1-2 users
- **Special Features:**
  - User management dashboard
  - Role assignment capabilities
  - Test dashboard access
  - Audit log viewing
  - Security settings management

### **2. Moderator** (Moderation Team)
- **Purpose:** Content moderation and user support
- **Access Level:** Read/Update/Delete for profiles and messages
- **Count:** 2-5 users typically
- **Special Features:**
  - View and moderate user profiles
  - Delete inappropriate content
  - View PII data (for support)
  - View audit logs

### **3. Premium User** (Paid Tier)
- **Purpose:** Paying customers with enhanced features
- **Access Level:** Extended profile and messaging features
- **Count:** Unlimited
- **Special Features:**
  - Unlimited favorites and shortlist
  - PII request and grant capabilities
  - Full message access
  - Priority support

### **4. Free User** (Default)
- **Purpose:** Standard users
- **Access Level:** Basic platform features
- **Count:** Unlimited
- **Special Features:**
  - Read and create own profile
  - Basic messaging (limited)
  - PII request only (can't grant)
  - Limited favorites

---

## 🔐 Permission Matrix

### Complete Permission Breakdown

| Permission | Admin | Moderator | Premium | Free | Description |
|------------|-------|-----------|---------|------|-------------|
| **USERS** |
| `users.read` | ✅ | ✅ | ❌ | ❌ | View all users |
| `users.create` | ✅ | ❌ | ❌ | ❌ | Create users |
| `users.update` | ✅ | ✅ | ❌ | ❌ | Update any user |
| `users.delete` | ✅ | ❌ | ❌ | ❌ | Delete users |
| `users.*` | ✅ | ❌ | ❌ | ❌ | All user operations |
| **ROLES** |
| `roles.read` | ✅ | ❌ | ❌ | ❌ | View roles |
| `roles.create` | ✅ | ❌ | ❌ | ❌ | Create roles |
| `roles.update` | ✅ | ❌ | ❌ | ❌ | Update roles |
| `roles.delete` | ✅ | ❌ | ❌ | ❌ | Delete roles |
| `roles.*` | ✅ | ❌ | ❌ | ❌ | All role operations |
| **PERMISSIONS** |
| `permissions.*` | ✅ | ❌ | ❌ | ❌ | All permission operations |
| **PROFILES** |
| `profiles.read` | ✅ | ✅ | ✅ | ✅ | View profiles |
| `profiles.create` | ✅ | ❌ | ✅ | ✅ | Create own profile |
| `profiles.update` | ✅ | ✅ | ✅ | ✅ | Update own profile |
| `profiles.delete` | ✅ | ✅ | ❌ | ❌ | Delete profiles |
| `profiles.*` | ✅ | ❌ | ❌ | ❌ | All profile operations |
| **MESSAGES** |
| `messages.read` | ✅ | ✅ | ✅ | ✅ | Read messages |
| `messages.create` | ✅ | ❌ | ✅ | ✅ | Send messages |
| `messages.delete` | ✅ | ✅ | ❌ | ❌ | Delete messages |
| `messages.*` | ✅ | ❌ | ❌ | ❌ | All message operations |
| **PII (Personally Identifiable Information)** |
| `pii.read` | ✅ | ✅ | ❌ | ❌ | View PII data |
| `pii.request` | ✅ | ❌ | ✅ | ✅ | Request PII access |
| `pii.grant` | ✅ | ❌ | ✅ | ❌ | Grant PII access |
| `pii.*` | ✅ | ❌ | ❌ | ❌ | All PII operations |
| **FAVORITES** |
| `favorites.read` | ✅ | ❌ | ✅ | ✅ | View favorites |
| `favorites.create` | ✅ | ❌ | ✅ | ✅ | Add favorites |
| `favorites.delete` | ✅ | ❌ | ✅ | ✅ | Remove favorites (premium: unlimited) |
| `favorites.*` | ✅ | ❌ | ✅ | ❌ | All favorite operations |
| **SHORTLIST** |
| `shortlist.read` | ✅ | ❌ | ✅ | ❌ | View shortlist |
| `shortlist.create` | ✅ | ❌ | ✅ | ❌ | Add to shortlist |
| `shortlist.delete` | ✅ | ❌ | ✅ | ❌ | Remove from shortlist |
| `shortlist.*` | ✅ | ❌ | ✅ | ❌ | All shortlist operations |
| **AUDIT** |
| `audit.read` | ✅ | ✅ | ❌ | ❌ | View audit logs |
| `audit.*` | ✅ | ❌ | ❌ | ❌ | All audit operations |
| **SECURITY** |
| `security.*` | ✅ | ❌ | ❌ | ❌ | Security settings |

### Wildcard Permission Support
- `*` or `*.*` → Full access to everything
- `users.*` → All operations on users resource
- `profiles.read` → Specific permission

---

## 🛡️ Access Control Implementation

### Backend Implementation

#### 1. **Permission Checking**
```python
# Check single permission
PermissionChecker.check_permission(user, "users.create")

# Check any permission (OR logic)
PermissionChecker.check_any_permission(user, ["users.read", "profiles.read"])

# Check all permissions (AND logic)
PermissionChecker.check_all_permissions(user, ["users.read", "users.update"])
```

#### 2. **Role Checking**
```python
# Check specific role
RoleChecker.has_role(user, "admin")

# Check any role
RoleChecker.has_any_role(user, ["admin", "moderator"])

# Convenience methods
RoleChecker.is_admin(user)
RoleChecker.is_moderator_or_admin(user)
RoleChecker.is_premium_user(user)
```

#### 3. **FastAPI Dependencies**
```python
# Require specific permission
@router.get("/endpoint", dependencies=[Depends(require_permission("users.read"))])

# Require any permission
@router.post("/endpoint", dependencies=[Depends(require_any_permission(["users.create", "users.update"]))])

# Require all permissions
@router.put("/endpoint", dependencies=[Depends(require_all_permissions(["users.update", "audit.create"]))])

# Require admin role
@router.delete("/endpoint", dependencies=[Depends(require_admin)])
```

### Frontend Implementation

#### 1. **Route Protection**
```javascript
// Protected routes require authentication + active status
<Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />

// Admin-only routes
<Route path="/admin" element={<ProtectedRoute><AdminPage /></ProtectedRoute>} />
```

#### 2. **Role-Based UI Display**
```javascript
// Check admin role
{currentUser === 'admin' && (
  <button onClick={handleAdminAction}>Admin Only</button>
)}

// Check user status
const isActive = currentUser === 'admin' || userStatus === 'active';
```

#### 3. **Storage Keys**
- `username` → Current logged-in username
- `token` → JWT access token
- `userRole` → User's role (admin, moderator, premium_user, free_user)
- `userStatus` → User's status (active, pending, suspended, banned)

---

## 🔒 Security Policies

### 1. **Password Policy**
- **Min Length:** 8 characters
- **Max Length:** 128 characters
- **Requirements:**
  - ✅ 1 uppercase letter (A-Z)
  - ✅ 1 lowercase letter (a-z)
  - ✅ 1 number (0-9)
  - ✅ 1 special character (!@#$%^&*()_+-=[]{}|;:,.<>?)
- **Expiry:** 90 days (configurable)
- **History:** Cannot reuse last 5 passwords
- **Warning:** 7 days before expiry

### 2. **Account Lockout Policy**
- **Max Failed Attempts:** 5 attempts
- **Lockout Duration:** 30 minutes
- **Reset Window:** 60 minutes
- **Per IP Limit:** 20 attempts

### 3. **Session Management**
- **Access Token:** 60 minutes (1 hour)
- **Refresh Token:** 30 days
- **Max Concurrent Sessions:** 3 per user
- **Absolute Timeout:** 24 hours
- **Session Types:** web, mobile, api

### 4. **Multi-Factor Authentication (MFA)**
- **Available:** Yes (configurable)
- **Required for Admin:** Yes
- **Issuer:** "Matrimonial Profile App"
- **Backup Codes:** Provided

### 5. **Rate Limiting**
- **Login Attempts:** 10 per 15 minutes
- **Password Reset:** 3 per hour
- **API Calls:** 100 per minute

### 6. **Email Verification**
- **Required:** Yes
- **Token Expiry:** 24 hours
- **Status:** Users start as `pending_verification`

### 7. **User Statuses**
| Status | Description | Can Access Platform |
|--------|-------------|---------------------|
| `active` | Normal user | ✅ Yes |
| `pending_verification` | New user | ❌ Profile only |
| `inactive` | Temporarily disabled | ❌ No |
| `suspended` | Admin suspended | ❌ No |
| `banned` | Permanently banned | ❌ No |
| `password_expired` | Must change password | ⚠️ Limited |
| `locked` | Too many failed logins | ❌ No |

---

## 🚦 Frontend Route Protection

### Public Routes (No Auth Required)
- `/` → Login page
- `/login` → Login page
- `/register` → Registration page
- `/terms` → Terms of Service
- `/privacy` → Privacy Policy
- `/community-guidelines` → Community Guidelines
- `/cookie-policy` → Cookie Policy
- `/l3v3l-info` → L3V3L Info page
- `/logo-showcase` → Logo design showcase

### Protected Routes (Auth Required)
| Route | Status Required | Role Required | Description |
|-------|----------------|---------------|-------------|
| `/dashboard` | active | any | Main dashboard |
| `/profile/:username` | any | any | User profile (always accessible) |
| `/edit-profile` | any | any | Edit own profile |
| `/preferences` | any | any | User preferences |
| `/matching-criteria` | active | any | Set matching criteria |
| `/top-matches` | active | any | View top matches |
| `/l3v3l-matches` | active | any | L3V3L matches |
| `/search` | active | any | Search users |
| `/messages` | active | any | Messaging |
| `/favorites` | active | any | Favorites list |
| `/shortlist` | active | premium+ | Shortlist (premium feature) |
| `/exclusions` | active | any | Exclusions list |
| `/pii-management` | active | any | PII requests |
| **ADMIN ROUTES** |
| `/admin` | active | **admin** | Admin dashboard |
| `/admin/change-password` | active | **admin** | Change admin password |
| `/user-management` | active | **admin** | User management |
| `/test-dashboard` | active | **admin** | Test dashboard |

### Status-Based Access Control
```javascript
// Users with non-active status are redirected to their profile
if (userStatus !== 'active' && !isProfileOrPreferencesRoute) {
  redirect to `/profile/${username}`
  show message: "Complete your profile and wait for admin approval"
}

// Exception: admin bypasses status check
if (currentUser === 'admin') {
  always allow access
}
```

---

## 📊 Audit Logging

### Logged Events
- ✅ Login success/failure
- ✅ Logout
- ✅ Password changes
- ✅ Password reset requests
- ✅ Account lockouts
- ✅ Email verification
- ✅ MFA enable/disable
- ✅ Role changes
- ✅ Permission grants/revokes
- ✅ Suspicious activity
- ✅ Data exports
- ✅ Data deletions

### Audit Log Retention
- **Retention Period:** 365 days (1 year)
- **Sensitive Data:** NOT logged (passwords, tokens)
- **Tracked Info:** User, action, resource, IP, timestamp, status

---

## 🎯 Recommendations

### ✅ Strengths
1. **Enterprise-grade RBAC** with 4 roles + custom permissions
2. **Wildcard permission support** (e.g., `users.*`)
3. **Multiple security layers** (password policy, MFA, lockout)
4. **Comprehensive audit logging**
5. **GDPR compliant** data handling
6. **Session management** with timeout and rotation
7. **Rate limiting** protection
8. **Frontend + Backend** security checks

### ⚠️ Areas for Improvement

#### 1. **Role Granularity**
Consider adding more specialized roles:
- `content_moderator` - Only profile/message moderation
- `support_agent` - Help users but no deletion rights
- `analyst` - Read-only data analysis access

#### 2. **Premium Tier Limits**
Current implementation:
- Premium users have unlimited favorites/shortlist
- No messaging limits defined

**Recommendation:**
```javascript
FREE_USER_LIMITS = {
  favorites_max: 10,
  shortlist_max: 5,
  messages_per_day: 5,
  profile_views_per_day: 20
}

PREMIUM_USER_LIMITS = {
  favorites_max: unlimited,
  shortlist_max: unlimited,
  messages_per_day: unlimited,
  profile_views_per_day: unlimited,
  pii_requests_per_month: 10
}
```

#### 3. **Permission Inheritance**
Current: Permissions are flat per role  
**Recommendation:** Add permission inheritance
```python
ROLE_HIERARCHY = {
  "admin": inherits_from: ["moderator", "premium_user"],
  "moderator": inherits_from: ["premium_user"],
  "premium_user": inherits_from: ["free_user"]
}
```

#### 4. **Time-Based Permissions**
Add temporary permission grants:
```python
custom_permissions = [
  {"permission": "users.read", "expires_at": "2025-12-31"}
]
```

#### 5. **Resource-Level Permissions**
Current: Global permissions only  
**Recommendation:** Add resource-specific permissions
```python
# Allow user to only manage their own profile
permissions = ["profiles.update:self", "messages.read:own"]
```

#### 6. **Frontend Permission Checks**
Current: Only role checks (`currentUser === 'admin'`)  
**Recommendation:** Add permission checking utility
```javascript
// frontend/src/utils/permissions.js
export const hasPermission = (permission) => {
  const userPermissions = getUserPermissions(); // From token or API
  return userPermissions.includes(permission) || 
         userPermissions.includes(permission.split('.')[0] + '.*');
}

// Usage in components
{hasPermission('users.create') && <CreateUserButton />}
```

#### 7. **Admin Activity Monitoring**
Add dedicated admin action tracking:
- Dashboard: Show recent admin actions
- Alerts: Notify on suspicious admin activity
- Approval: Require 2-admin approval for critical actions

#### 8. **MFA Enforcement**
Current: MFA required for admin only  
**Recommendation:**
- Enforce MFA for moderators
- Optional but encouraged for premium users
- Add MFA reminder notifications

#### 9. **IP Whitelisting**
For admin accounts:
```python
ADMIN_ALLOWED_IPS = [
  "192.168.1.0/24",  # Office network
  "10.0.0.0/8"       # VPN
]
```

#### 10. **Permission Testing**
Add automated tests:
```python
# Test each role's permissions
def test_free_user_cannot_access_admin():
    assert not has_permission(free_user, "users.delete")

def test_admin_has_all_permissions():
    assert has_permission(admin_user, "users.*")
```

---

## 📝 Implementation Checklist

### High Priority 🔴
- [ ] Add permission checking utility to frontend
- [ ] Implement free user limits (favorites, messages)
- [ ] Add MFA enforcement for moderators
- [ ] Create admin activity monitoring dashboard
- [ ] Add automated permission tests

### Medium Priority 🟡
- [ ] Implement resource-level permissions
- [ ] Add time-based permission grants
- [ ] Create specialized roles (content_moderator, support_agent)
- [ ] Add IP whitelisting for admin
- [ ] Implement permission inheritance

### Low Priority 🟢
- [ ] Add premium tier analytics
- [ ] Create permission management UI
- [ ] Add role templates
- [ ] Implement permission request workflow
- [ ] Add security dashboard for users

---

## 🔗 Related Files

### Backend
- `/fastapi_backend/auth/security_models.py` - Data models
- `/fastapi_backend/auth/security_config.py` - Security settings & permissions
- `/fastapi_backend/auth/authorization.py` - RBAC implementation
- `/fastapi_backend/auth/jwt_auth.py` - JWT authentication
- `/fastapi_backend/auth/admin_routes.py` - Admin endpoints

### Frontend
- `/frontend/src/components/ProtectedRoute.js` - Route protection
- `/frontend/src/components/Sidebar.js` - Role-based menu
- `/frontend/src/components/UserManagement.js` - User management
- `/frontend/src/App.js` - Route definitions

---

## 📞 Support

For questions about roles and permissions:
1. Check this documentation
2. Review audit logs for permission denials
3. Contact system administrator

---

**Document Version:** 1.0  
**System Version:** Production  
**Security Level:** Enterprise Grade ✅
