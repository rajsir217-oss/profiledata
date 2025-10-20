# Debug 401 Error on Notifications Page

## What You're Seeing

```
api.js:356 Unauthorized access to notifications API - token may be invalid or expired
```

This means:
- ✅ The page is loading (not redirecting to login)
- ✅ The API call is being made
- ❌ The backend is rejecting the authentication

## Quick Diagnostic Steps

### Step 1: Open Browser Console

Press `F12` or `Cmd+Option+I` and look for these logs:

```
🔐 Auth check: { hasToken: true/false, tokenPreview: '...', username: '...' }
📡 Fetching notification preferences...
❌ Failed to load preferences:
Error details: { status: 401, message: '...' }
```

### Step 2: Check Authentication

**In Console, run:**
```javascript
// Check if logged in
const token = localStorage.getItem('token');
const username = localStorage.getItem('username');

console.log('Token exists:', !!token);
console.log('Username:', username);

// Check token expiration
if (token) {
  try {
    const parts = token.split('.');
    const payload = JSON.parse(atob(parts[1]));
    const exp = new Date(payload.exp * 1000);
    console.log('Token expires:', exp);
    console.log('Current time:', new Date());
    console.log('Is expired:', exp < new Date());
  } catch (e) {
    console.error('Invalid token format');
  }
}
```

## Common Scenarios

### Scenario 1: Token Expired ⏰
**Console shows:**
```
Token expires: Mon Oct 20 2025 11:00:00
Current time: Mon Oct 20 2025 11:15:00
Is expired: true
```

**Solution:**
1. Click "🔑 Log In Again" button
2. Or manually: `window.location.href = '/login'`

### Scenario 2: No Token ❌
**Console shows:**
```
Token exists: false
Username: null
```

**Solution:**
You're not actually logged in. Go to `/login`.

### Scenario 3: Invalid Token Format 🔧
**Console shows:**
```
Invalid token format
```

**Solution:**
Token is corrupted. Clear and re-login:
```javascript
localStorage.clear();
window.location.href = '/login';
```

### Scenario 4: Token Valid But Still 401 🤔
**Console shows:**
```
Token expires: Mon Oct 20 2025 12:00:00 (future)
Is expired: false
Error details: { status: 401, message: 'Could not validate credentials' }
```

**Possible Causes:**
1. **Secret key changed on backend** - Everyone needs to re-login
2. **Token format issue** - Check `config.py` settings
3. **Token not being sent** - Check Network tab

## Network Tab Inspection

1. Open **Developer Tools** → **Network** tab
2. Reload the notifications page
3. Find the `preferences` request (filter: XHR)
4. Click on it → **Headers** tab

**Check Request Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**If Authorization header is missing:**
- Token interceptor isn't working
- Check `api.js` notificationsApi setup

**If Authorization header is present but still 401:**
- Backend is rejecting the token
- Check backend logs for JWT errors

## Backend Logs

Check your backend terminal for errors:

```
ERROR: Could not validate credentials
ERROR: Invalid token
JWTError: Signature verification failed
```

These indicate:
- Token signed with different secret
- Token format incorrect
- Algorithm mismatch

## Quick Fixes

### Fix 1: Fresh Login (Most Common)
```javascript
// In browser console
localStorage.clear();
window.location.href = '/login';
```

### Fix 2: Check Token
```javascript
// Verify token structure
const token = localStorage.getItem('token');
if (token) {
  const parts = token.split('.');
  console.log('Parts:', parts.length); // Should be 3
  console.log('Header:', atob(parts[0]));
  console.log('Payload:', atob(parts[1]));
}
```

### Fix 3: Manual Token Test
```bash
# Test with curl (replace TOKEN with your token)
curl http://localhost:8000/api/notifications/preferences \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

**Expected:** JSON with preferences  
**If 401:** Token is definitely invalid/expired

## What I Fixed

### 1. Better Error Messages
- Shows "Session expired" for 401
- Provides "Log In Again" button
- Logs detailed error info

### 2. Auth Debugging
- Logs token status on page load
- Shows token expiration
- Provides retry option

### 3. Graceful Failure
- Page doesn't redirect immediately
- Shows helpful error UI
- Allows retry without navigation

## Still Stuck?

If none of the above works, check:

1. **Backend is running:** `curl http://localhost:8000/health`
2. **Token secret matches:** Check `config.py` in backend
3. **CORS settings:** Check `main.py` allows your frontend URL
4. **Database accessible:** Check MongoDB connection

## Next Steps

1. **Run the diagnostic in console** (Step 2 above)
2. **Check if token is expired**
3. **If expired:** Click "Log In Again" button
4. **If valid but still failing:** Check backend logs
5. **If stuck:** Re-login with `localStorage.clear()`

The most common fix is simply **logging in again** because tokens expire after 15 minutes by default.
