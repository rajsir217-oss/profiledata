# User Role Migration - Default role_name Fix

## Issue

New user profiles were being created without the `role_name` field, resulting in null values. This prevented proper role-based access control.

## Root Cause

The user registration endpoint in `routes.py` (line ~562) was missing the `role_name` field when creating the user document, while the `/api/auth/register` endpoint in `auth_routes.py` correctly set it using `security_settings.DEFAULT_USER_ROLE`.

## Fix Applied

### 1. Code Fix (routes.py)
Added default role assignment to user registration:

```python
# Role & Permissions
"role_name": "free_user",  # Default role for new users
```

**Location:** `/fastapi_backend/routes.py` line 565

### 2. Migration Script
Created migration to fix existing users with null role_name.

**File:** `/migrations/add_default_role_to_users.py`

## How to Run Migration

```bash
cd /Users/rajsiripuram02/opt/appsrc/profiledata/fastapi_backend

# Run the migration
python3 migrations/add_default_role_to_users.py
```

The script will:
1. Find all users with null or missing `role_name`
2. Show count and sample users
3. Ask for confirmation
4. Update all users to `role_name = "free_user"`
5. Verify the update

## Expected Output

```
============================================================
Migration: Add default role_name to existing users
============================================================

📊 Found 15 users without role_name
Will set role_name = 'free_user' for these users

Sample users to be updated:
  - john_doe (profileId: P001234)
  - jane_smith (profileId: P001235)
  ... and 13 more

Proceed with updating 15 users? (yes/no): yes

✅ Migration completed successfully!
   Matched: 15 users
   Modified: 15 users

✅ All users now have role_name assigned!
```

## Verification

After running the migration, verify in MongoDB:

```javascript
// Check for users without role_name
db.users.count({$or: [{role_name: {$exists: false}}, {role_name: null}]})
// Should return: 0

// Check role distribution
db.users.aggregate([
  {$group: {_id: "$role_name", count: {$sum: 1}}},
  {$sort: {count: -1}}
])
// Should show: free_user, admin, premium_user, etc.
```

## Default Roles

From `auth/security_config.py`:

- **DEFAULT_USER_ROLE:** `"free_user"`
- **SYSTEM_ROLES:** `["admin", "moderator", "premium_user", "free_user"]`

## Role Limits

### free_user (Default)
- Favorites: 10 max
- Shortlist: 5 max
- Messages per day: 5
- Profile views per day: 20
- PII requests per month: 3
- Search results: 20 max

### premium_user
- Favorites: Unlimited
- Shortlist: Unlimited
- Messages per day: Unlimited
- Profile views per day: Unlimited
- PII requests per month: 10
- Search results: 100 max

### admin/moderator
- All limits: Unlimited

## Future Prevention

Both registration endpoints now set `role_name`:
- ✅ `/api/auth/register` (auth_routes.py) - Uses `security_settings.DEFAULT_USER_ROLE`
- ✅ `/api/users/register` (routes.py) - Hardcoded `"free_user"`

All new users will have `role_name = "free_user"` by default.

## Date
November 29, 2025
