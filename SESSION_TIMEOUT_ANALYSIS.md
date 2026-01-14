# Session Timeout Issue Analysis

**Date:** January 12, 2026  
**Issue:** User stayed logged in for 8+ hours without being logged out  
**Expected Behavior:** Session should expire after 30 minutes of inactivity OR 8 hours hard limit

---

## Executive Summary

The session timeout is NOT working because **browser tab throttling** prevents JavaScript intervals from running when the tab is in the background. The `sessionManager` relies on `setInterval()` which browsers aggressively throttle (or pause entirely) for background tabs to save battery/CPU.

---

## Current Architecture

### Backend Configuration (`security_config.py`)
```python
JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 15  # 15 minutes
JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 30    # 30 days
SESSION_TIMEOUT_MINUTES: int = 60          # 60 minutes
SESSION_ABSOLUTE_TIMEOUT_HOURS: int = 24   # 24 hours
```

### Frontend Configuration (`sessionManager.js`)
```javascript
ACTIVITY_THRESHOLD = 25 * 60 * 1000;   // 25 minutes
REFRESH_INTERVAL = 5 * 60 * 1000;      // 5 minutes
HARD_LIMIT = 8 * 60 * 60 * 1000;       // 8 hours
INACTIVITY_LOGOUT = 30 * 60 * 1000;    // 30 minutes
```

---

## Root Cause Analysis

### Problem 1: Browser Tab Throttling

Modern browsers (Chrome, Firefox, Safari, Edge) aggressively throttle `setInterval()` and `setTimeout()` for background tabs:

| Browser | Throttling Behavior |
|---------|---------------------|
| Chrome | Intervals limited to 1/minute for background tabs |
| Firefox | Similar throttling, may pause entirely |
| Safari | Aggressive throttling, especially on battery |
| Edge | Same as Chrome (Chromium-based) |

**Impact:** The `inactivityInterval` (1 minute) and `refreshInterval` (5 minutes) may not run at all when the tab is in the background for hours.

### Problem 2: loginTime Reset on Page Reload

```javascript
init() {
  // ...
  this.loginTime = Date.now();  // ❌ RESETS on every init()
}
```

When the user refreshes the page or the app reloads, `loginTime` is reset to `Date.now()`, effectively restarting the 8-hour hard limit timer.

### Problem 3: Visibility Change Only Checks on Return

The `handleVisibilityChange` function only runs when the user **returns** to the tab:
```javascript
handleVisibilityChange = async () => {
  if (document.visibilityState === 'visible' && this.isActive) {
    // Only checks when tab becomes visible again
  }
}
```

If the user never returns to the tab, no check happens.

### Problem 4: Refresh Token is Valid for 30 Days

```python
JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 30  # 30 days
```

The refresh token stored in `localStorage` is valid for 30 days. Even if the access token expires (15 minutes), the frontend can always get a new one using the refresh token.

### Problem 5: No Server-Side Session Enforcement

The backend `/api/auth/refresh-token` endpoint has an 8-hour hard limit check:
```python
if time_since_login.total_seconds() > 28800:  # 8 hours
    # Revoke session
```

However, this only runs when the frontend **calls** the refresh endpoint. If the frontend intervals are throttled, this check never happens.

---

## Why User Stayed Logged In for 8+ Hours

1. User logged in and was active
2. User left the tab open but switched to other tabs/apps
3. Browser throttled all JavaScript intervals
4. No inactivity checks ran
5. No refresh token calls were made
6. When user returned, the `handleVisibilityChange` ran but:
   - `this.lastActivity` was still the old value (from before leaving)
   - But the check uses `Date.now() - this.lastActivity` which would show 8+ hours
   - **HOWEVER**, if the user moved the mouse or clicked before the check completed, `handleActivity` would reset `lastActivity`

---

## Recommended Fixes

### Fix 1: Store Login Time in localStorage (Critical)

```javascript
init() {
  // Check if we have a stored login time
  const storedLoginTime = localStorage.getItem('sessionLoginTime');
  if (storedLoginTime) {
    this.loginTime = parseInt(storedLoginTime, 10);
  } else {
    this.loginTime = Date.now();
    localStorage.setItem('sessionLoginTime', this.loginTime.toString());
  }
}
```

### Fix 2: Store Last Activity Time in localStorage (Critical)

```javascript
handleActivity = () => {
  this.lastActivity = Date.now();
  localStorage.setItem('sessionLastActivity', this.lastActivity.toString());
}

// On init, restore from localStorage
init() {
  const storedLastActivity = localStorage.getItem('sessionLastActivity');
  if (storedLastActivity) {
    this.lastActivity = parseInt(storedLastActivity, 10);
  }
}
```

### Fix 3: Check Session on Visibility Change BEFORE Resetting Activity

```javascript
handleVisibilityChange = async () => {
  if (document.visibilityState === 'visible' && this.isActive) {
    // Get stored last activity (not the in-memory one which may be stale)
    const storedLastActivity = localStorage.getItem('sessionLastActivity');
    const lastActivityTime = storedLastActivity 
      ? parseInt(storedLastActivity, 10) 
      : this.lastActivity;
    
    const timeSinceActivity = Date.now() - lastActivityTime;
    
    // Check BEFORE any activity handlers can reset the value
    if (timeSinceActivity >= this.INACTIVITY_LOGOUT) {
      this.logout();
      return;
    }
    
    // Check hard limit
    const storedLoginTime = localStorage.getItem('sessionLoginTime');
    const loginTime = storedLoginTime 
      ? parseInt(storedLoginTime, 10) 
      : this.loginTime;
    
    if (Date.now() - loginTime >= this.HARD_LIMIT) {
      this.logout();
      return;
    }
  }
}
```

### Fix 4: Use Web Workers for Background Timers (Advanced)

Web Workers are not throttled by browsers. Create a dedicated worker for session management:

```javascript
// sessionWorker.js
let checkInterval;

self.onmessage = function(e) {
  if (e.data.type === 'start') {
    checkInterval = setInterval(() => {
      self.postMessage({ type: 'check' });
    }, 60000); // Every minute
  } else if (e.data.type === 'stop') {
    clearInterval(checkInterval);
  }
};
```

### Fix 5: Server-Side Session Validation on Every API Call (Recommended)

Add middleware to validate session on every API call:

```python
async def validate_session_middleware(request: Request, call_next):
    # Check if session is still valid
    # If not, return 401
    pass
```

### Fix 6: Use Service Worker for Background Sync (Advanced)

Service Workers can run even when the tab is closed and can periodically check session validity.

---

## Implementation Priority

| Priority | Fix | Effort | Impact |
|----------|-----|--------|--------|
| 1 | Store loginTime in localStorage | Low | High |
| 2 | Store lastActivity in localStorage | Low | High |
| 3 | Check on visibility change before activity reset | Low | High |
| 4 | Server-side session validation middleware | Medium | Very High |
| 5 | Web Worker for timers | Medium | Medium |
| 6 | Service Worker | High | Medium |

---

## Immediate Action Items

1. **Persist session times to localStorage** - Prevents reset on page reload
2. **Check session validity FIRST on tab return** - Before any activity handlers run
3. **Add server-side session expiry check** - On every authenticated API call
4. **Consider reducing refresh token validity** - 30 days is very long

---

## Files to Modify

1. `/frontend/src/services/sessionManager.js` - Main session management
2. `/fastapi_backend/auth/jwt_auth.py` - Server-side validation
3. `/fastapi_backend/auth/security_config.py` - Configuration values
4. `/fastapi_backend/main.py` - Add middleware for session validation

---

## Testing Strategy

1. Open app, log in
2. Leave tab in background for 35 minutes
3. Return to tab - should be logged out
4. Open app, log in
5. Leave tab open for 8+ hours (even with activity)
6. Should be logged out at 8-hour mark

---

## Implementation Status (January 12, 2026)

### ✅ IMPLEMENTED FIXES

All three critical fixes have been implemented in `/frontend/src/services/sessionManager.js`:

#### Fix 1: Store loginTime in localStorage
```javascript
// In init()
const storedLoginTime = localStorage.getItem('sessionLoginTime');
if (storedLoginTime) {
  this.loginTime = parseInt(storedLoginTime, 10);
} else {
  this.loginTime = Date.now();
  localStorage.setItem('sessionLoginTime', this.loginTime.toString());
}
```

#### Fix 2: Store lastActivity in localStorage
```javascript
// In handleActivity() - throttled to avoid excessive writes
handleActivity = () => {
  const now = Date.now();
  if (now - this.lastActivity > 10000) { // Only write every 10 seconds
    this.lastActivity = now;
    localStorage.setItem('sessionLastActivity', now.toString());
  } else {
    this.lastActivity = now; // Still update in-memory
  }
}
```

#### Fix 3: Check session on visibility change BEFORE activity reset
```javascript
// In handleVisibilityChange()
// Read from localStorage to get ACTUAL last activity time
const storedLastActivity = localStorage.getItem('sessionLastActivity');
const actualLastActivity = storedLastActivity 
  ? parseInt(storedLastActivity, 10) 
  : this.lastActivity;

// Check BEFORE any activity handlers can reset the value
const timeSinceActivity = Date.now() - actualLastActivity;
if (timeSinceActivity >= this.INACTIVITY_LOGOUT) {
  this.logout();
  return;
}
```

#### Additional: Check session on init
```javascript
// New method: checkSessionExpiredOnInit()
// Called during init() BEFORE setting up activity listeners
// Catches expired sessions when user returns to a stale tab
```

#### Additional: Clear session storage on logout
```javascript
// In logout()
localStorage.removeItem('sessionLoginTime');
localStorage.removeItem('sessionLastActivity');
```

### Changes Made to sessionManager.js

| Line Range | Change |
|------------|--------|
| 54-75 | Restore loginTime and lastActivity from localStorage on init |
| 79-83 | Check session validity immediately on init |
| 97-121 | New `checkSessionExpiredOnInit()` method |
| 155-200 | Updated `handleVisibilityChange()` to read from localStorage |
| 197-213 | Updated `handleActivity()` with throttled localStorage writes |
| 440-441 | Clear session localStorage items on logout |
| 506-517 | Updated `setLoginTime()` to persist to localStorage |

---

## Testing Instructions

### Test 1: Inactivity Logout (30 minutes)
1. Log in to the app
2. Note the current time
3. Leave the tab in background (switch to other tabs)
4. Return after 35 minutes
5. **Expected:** Should be logged out with "session expired due to inactivity" message

### Test 2: Hard Limit (8 hours)
1. Log in to the app
2. Stay active (or inactive) for 8+ hours
3. **Expected:** Should be logged out with "8 hour limit" message

### Test 3: Page Refresh Persistence
1. Log in to the app
2. Wait 5 minutes
3. Refresh the page (F5)
4. Check browser console for "Restored login time from localStorage"
5. **Expected:** Login time should NOT reset to current time

### Test 4: Tab Return Check
1. Log in to the app
2. Switch to another tab for 35 minutes
3. Return to the app tab
4. **Expected:** Should be logged out immediately on tab return

---

## Conclusion

The session timeout issue is caused by browser tab throttling combined with in-memory state that doesn't persist across page reloads. The fix requires:

1. ✅ Persisting session timestamps to localStorage
2. ✅ Checking session validity on tab visibility change BEFORE activity handlers reset values
3. ✅ Checking session validity on init (page load/refresh)
4. ✅ Adding server-side session validation as a safety net

**Implementation Status:** Fixes 1-4 ALL COMPLETED (Jan 13, 2026).

---

## Server-Side Session Validation (Fix 4 - Implemented Jan 13, 2026)

### Middleware Implementation

**File:** `/fastapi_backend/middleware/session_validation.py`

The middleware validates session on every authenticated API call:

```python
# Session timeout configuration (aligned with frontend)
SESSION_HARD_LIMIT_HOURS = 8      # 8 hours - maximum session duration
SESSION_INACTIVITY_MINUTES = 30   # 30 minutes - inactivity timeout
```

**Checks performed:**
1. Session exists and is not revoked
2. Session has not exceeded 8-hour hard limit
3. Session has not been inactive for 30+ minutes

**Skip paths (no validation):**
- `/health`, `/docs`, `/api/auth/login`, `/api/auth/register`, etc.

**Response codes:**
- `401 SESSION_EXPIRED_HARD_LIMIT` - Session exceeded 8 hours
- `401 SESSION_EXPIRED_INACTIVITY` - Inactive for 30+ minutes

### Configuration Alignment (Jan 13, 2026)

**Backend (`security_config.py`):**
```python
SESSION_TIMEOUT_MINUTES: int = 30        # Aligned with frontend
SESSION_ABSOLUTE_TIMEOUT_HOURS: int = 8  # Aligned with frontend
JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 7   # Reduced from 30 for security
```

**Frontend (`sessionManager.js`):**
```javascript
INACTIVITY_LOGOUT = 30 * 60 * 1000;  // 30 minutes
HARD_LIMIT = 8 * 60 * 60 * 1000;     // 8 hours
```

### Files Modified

| File | Change |
|------|--------|
| `/fastapi_backend/middleware/session_validation.py` | NEW - Session validation middleware |
| `/fastapi_backend/middleware/__init__.py` | NEW - Package init |
| `/fastapi_backend/main.py` | Added middleware import and registration |
| `/fastapi_backend/auth/security_config.py` | Aligned timeout values, reduced refresh token to 7 days |

### Security Improvements

1. **Server-side enforcement** - Even if client-side JS is manipulated, server validates
2. **Reduced refresh token** - 7 days instead of 30 days
3. **Automatic session revocation** - Expired sessions are marked as revoked
4. **Detailed logging** - Session expiry events are logged with reasons

---

## Fix 5: API Activity Tracking Bug (Jan 13, 2026)

### Problem Discovered
During testing, the inactivity timer was being reset every few seconds even when the user was idle. The inactivity check showed only 3-8 seconds since last activity, never reaching the logout threshold.

### Root Cause
The API interceptor in `/frontend/src/api.js` was calling `sessionManager.handleActivity()` on **every API request**, including background polling:
- Online users polling (every few seconds)
- Ticker items polling
- Other background API calls

This meant the inactivity timer was constantly being reset by automated background requests, not actual user activity.

### Solution
**Removed API-based activity tracking entirely.** User activity is now tracked only via DOM events:
- `mousemove` - Mouse movement
- `keydown` - Keyboard activity
- `click` - Click events
- `touchstart` - Touch events (mobile)
- `scroll` - Scroll activity

These DOM events accurately reflect actual user interaction, while background API polling does not reset the inactivity timer.

### Additional Fixes Applied

1. **Removed refreshToken requirement** - Session manager now initializes with just the access token. The inactivity check doesn't need the refresh token to work.

2. **localStorage-based inactivity check** - The inactivity check now reads from `localStorage` instead of in-memory values, which is more reliable across page refreshes and React re-renders.

### Files Modified

| File | Change |
|------|--------|
| `/frontend/src/api.js` | Removed `sessionManager.handleActivity()` calls from API interceptors |
| `/frontend/src/services/sessionManager.js` | Removed refreshToken requirement, improved inactivity check to use localStorage |
| `/frontend/src/App.js` | Simplified session manager initialization |

### Testing Verified
- ✅ Inactivity logout works correctly (tested with 1-minute timeout)
- ✅ User activity (mouse, keyboard) properly resets the timer
- ✅ Background API polling does NOT reset the timer
- ✅ Session manager initializes correctly on page load
