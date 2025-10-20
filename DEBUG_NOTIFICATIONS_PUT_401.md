# Debug: PUT /api/notifications/preferences Returns 401

## Issue
- ✅ GET /api/notifications/preferences works (returns preferences)
- ❌ PUT /api/notifications/preferences fails with 401 Unauthorized

## This Is Strange Because:
Both endpoints use the same authentication system, so if GET works, PUT should also work.

---

## Step 1: Check Browser Console

**Refresh the notifications page and try to save. Look for these logs:**

### Expected Logs:
```javascript
// Token is being sent
🔑 Notifications API GET /api/notifications/preferences { hasToken: true, tokenPreview: 'eyJhbGciOiJIUzI1NiI...' }

// Preferences loaded
✅ Preferences loaded: {...}

// When you click Save:
🔑 Notifications API PUT /api/notifications/preferences { hasToken: true, tokenPreview: 'eyJhbGciOiJIUzI1NiI...' }
📤 Updating preferences: {...}

// Then either:
✅ Update successful: {...}
// OR
❌ Update failed: {...}
```

### Check:
1. **Does PUT show `hasToken: true`?**
   - If `false` → Token missing (logout and log back in)
   - If `true` → Token is being sent, but backend rejects it

2. **What's the exact error data?**
   - Look for the `❌ Update failed:` log
   - Note the `status`, `data`, and `message`

---

## Step 2: Check Network Tab

**Open Developer Tools → Network tab**

### A. Check for OPTIONS Request (CORS Preflight)
Before PUT, browser may send OPTIONS request:

1. **Look for:** `OPTIONS /api/notifications/preferences`
2. **Status should be:** 200 or 204
3. **If it's not 200/204:** CORS issue (backend not allowing PUT)

### B. Check PUT Request Headers
1. **Find:** `PUT /api/notifications/preferences`
2. **Click on it → Headers tab**
3. **Look for:** `Authorization: Bearer eyJhbGciOiJIUzI1NiI...`

**If Authorization header is MISSING:**
- Token interceptor not working for PUT
- This would be a bug in axios interceptor

**If Authorization header is PRESENT:**
- Token is being sent
- Backend is rejecting it for some reason

### C. Check Response
**Click on Response tab and see exact error:**

**Possible responses:**

```json
// 1. Not authenticated
{"detail": "Not authenticated"}
```
→ **Cause:** No Authorization header (interceptor failed)

```json
// 2. Token expired
{"detail": "Token has expired"}
```
→ **Cause:** Token expired between GET and PUT (unlikely but possible)

```json
// 3. Could not validate
{"detail": "Could not validate credentials"}
```
→ **Cause:** Token format invalid or secret key mismatch

```json
// 4. User not found
{"detail": "User not found"}
```
→ **Cause:** User was deleted (but GET worked, so unlikely)

---

## Step 3: Test Token Manually

**In browser console, run:**

```javascript
// Get your token
const token = localStorage.getItem('token');
console.log('Token:', token);

// Test GET (should work)
fetch('http://localhost:8000/api/notifications/preferences', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
}).then(r => r.json()).then(console.log);

// Test PUT (should fail)
fetch('http://localhost:8000/api/notifications/preferences', {
  method: 'PUT',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    channels: {}
  })
}).then(r => r.json()).then(console.log);
```

**Compare results:**
- If both fail → Token is expired, log out and log back in
- If GET works but PUT fails → Backend issue with PUT endpoint
- If both work → Axios interceptor issue

---

## Step 4: Check Backend Logs

**Look at your terminal where `./bstart.sh` is running:**

### When GET works, you should see:
```
📨 Incoming GET request to /api/notifications/preferences
✅ GET /preferences - User: aadhyadubey079
```

### When PUT is attempted, look for:
```
📨 Incoming PUT request to /api/notifications/preferences
✅ PUT /preferences - User: aadhyadubey079
```

**If you DON'T see the PUT log:**
- Request never reached the endpoint
- Auth failed before endpoint was called
- 401 is coming from the auth dependency

**If you DO see the PUT log:**
- Request reached endpoint successfully
- 401 is coming from somewhere else (not auth)

---

## Common Causes & Fixes

### Cause 1: Token Expired
**Symptoms:**
- GET worked initially
- PUT failed a few minutes later
- Console shows token expired error

**Fix:**
```javascript
// Log out and log back in
localStorage.clear();
window.location.href = '/login';
```

### Cause 2: CORS Preflight Failure
**Symptoms:**
- Network tab shows OPTIONS request failed
- PUT request never sent
- Console shows CORS error

**Fix:** Backend CORS settings need to allow PUT (should already be set)

### Cause 3: Axios Interceptor Not Working for PUT
**Symptoms:**
- Network tab shows PUT has NO Authorization header
- GET has Authorization header
- Console logs show `hasToken: false` for PUT

**Fix:** This would be a bug in axios setup. Restart frontend:
```bash
cd frontend
npm start
```

### Cause 4: Content-Type Issue
**Symptoms:**
- PUT request body is malformed
- FastAPI rejects before checking auth

**Fix:** Ensure Content-Type is application/json (should be automatic)

---

## Quick Tests to Run

### Test 1: Check Token Validity
```bash
# In browser console
const token = localStorage.getItem('token');
const parts = token.split('.');
const payload = JSON.parse(atob(parts[1]));
const exp = new Date(payload.exp * 1000);
console.log('Token expires:', exp);
console.log('Is expired:', exp < new Date());
```

### Test 2: Check Backend Health
```bash
curl http://localhost:8000/health
# Should return: {"status":"healthy"}
```

### Test 3: Test PUT with curl
```bash
# Replace TOKEN with your actual token
TOKEN="your_token_here"

curl -X PUT http://localhost:8000/api/notifications/preferences \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"channels": {}}'
```

**Expected:** Success response
**If 401:** Token issue on backend
**If 422:** Body validation issue
**If 200:** Axios issue on frontend

---

## What I Added for Debugging

### Frontend (`api.js`):
1. **Request logging:** Shows method, URL, token status
2. **Detailed error logging:** Shows full error details
3. **Update logging:** Shows what's being sent

### Backend (`routers/notifications.py`):
1. **GET endpoint logging:** Shows when called and which user
2. **PUT endpoint logging:** Shows when called, which user, what updates
3. **Error logging:** Shows if PUT fails and why

### Check These Logs:
- **Frontend:** Open console (F12)
- **Backend:** Check terminal where `./bstart.sh` is running

---

## Next Steps

1. **Run Step 1** (check console logs)
2. **Run Step 2** (check Network tab)
3. **Run Step 3** (manual token test)
4. **Report findings:**
   - Does PUT show `hasToken: true` or `false`?
   - Does Network tab show Authorization header on PUT?
   - What's the exact error response?
   - Do backend logs show the PUT request arriving?

With these answers, we can pinpoint the exact issue!

---

## If All Else Fails

**Nuclear Option - Fresh Login:**
```javascript
// Clear everything
localStorage.clear();
sessionStorage.clear();

// Restart backend
// Ctrl+C in backend terminal
./bstart.sh

// Restart frontend
// Ctrl+C in frontend terminal
npm start

// Log in again
// Try notifications again
```

This ensures:
- Fresh token
- Clean interceptors
- No cached state
- All systems restarted

---

**Status:** Waiting for diagnostic results
**Date:** October 20, 2025
**Issue:** PUT 401 despite GET working
