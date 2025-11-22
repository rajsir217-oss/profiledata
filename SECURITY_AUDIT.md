# Security Audit Report

**Date:** November 21, 2025
**Severity Level:** CRITICAL

## 🚨 Critical Vulnerabilities

### 1. Admin Endpoints Unprotected
**File:** `fastapi_backend/routes.py`
**Endpoint:** `GET /api/users/admin/users`
**Issue:** This endpoint returns all user data (including PII) and does **not** check for authentication or admin privileges. It relies solely on `Depends(get_database)`.
**Impact:** Full database dump possible by any unauthenticated user.
**Fix:**
```python
@router.get("/admin/users")
async def get_all_users(
    ...,
    current_user: dict = Depends(get_current_user)  # Add this
):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
```

### 2. Profile Deletion Unprotected
**File:** `fastapi_backend/routes.py`
**Endpoint:** `DELETE /api/users/profile/{username}`
**Issue:** No authentication check. Allows deleting any user account by knowing the username.
**Impact:** malicious deletion of user accounts.
**Fix:**
```python
async def delete_user_profile(
    username: str,
    current_user: dict = Depends(get_current_user), # Add this
    db = Depends(get_database)
):
    if current_user["username"] != username and current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
```

### 3. Insecure Direct Object References (IDOR)
**File:** `fastapi_backend/routes.py`
**Affected Endpoints:**
*   `POST /favorites/{target_username}` (uses `username` param/body)
*   `DELETE /favorites/{target_username}`
*   `POST /shortlist/{target_username}`
*   `POST /exclusions/{target_username}`
*   `GET /{username}/saved-searches`
*   `POST /pii-request`
*   `GET /messages/{username}` (can read anyone's messages)

**Issue:** The API trusts the `username` passed in the URL or Body instead of using the authenticated user's identity from the JWT token.
**Impact:** Users can perform actions (add favorites, read messages) on behalf of other users.
**Fix:** ALWAYS derive the "actor" username from `current_user["username"]`.
```python
# ❌ WRONG
async def add_favorite(username: str, ...):

# ✅ CORRECT
async def add_favorite(current_user: dict = Depends(get_current_user), ...):
    username = current_user["username"]
```

### 4. Hardcoded Secrets
**File:** `fastapi_backend/routes.py` (Line ~1507)
**Issue:** `ADMIN_PASSWORD = "admin"` is hardcoded.
**Impact:** Trivial privilege escalation if admin account exists.
**Fix:** Use environment variables or a proper database-backed password verification (which `login_user` already does!). The `change_admin_password` endpoint logic is flawed.

## ⚠️ High Severity Issues

### 1. PII Exposure in Logs
**Issue:** Extensive logging of user data in `routes.py`.
**Impact:** Sensitive data might end up in log files (though some attempts to mask are made).
**Fix:** Review `logger.info` calls to ensure no PII (email, phone, etc.) is logged in cleartext.

### 2. JSON Parsing DoS
**Issue:** `json.loads` used directly on input fields without `try/except` in `update_user_profile`.
**Impact:** Sending invalid JSON causes 500 Internal Server Error.
**Fix:** Wrap all `json.loads` in `try/except json.JSONDecodeError` blocks.

## 🔒 Recommended Action Plan

1.  **Immediate:** Apply `Depends(get_current_user)` to ALL routes in `routes.py`.
2.  **Immediate:** Replace all usage of `username` parameters for the "actor" with `current_user["username"]`.
3.  **Immediate:** Fix the Admin endpoint permissions.
4.  **Short-term:** Refactor `routes.py` into smaller, manageable files to make security reviews easier.
