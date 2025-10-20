# 401 Unauthorized Error - Troubleshooting Guide

## Error
```
GET http://localhost:8000/api/notifications/preferences 401 (Unauthorized)
```

## What 401 Means
The request is **reaching the server** but **authentication is failing** before it gets to the endpoint handler.

## Quick Checks

### 1. Are You Logged In?

**Check in Browser Console:**
```javascript
localStorage.getItem('token')
localStorage.getItem('user')
```

**Expected:**
- `token` should return a JWT string (long alphanumeric string)
- `user` should return a username

**If null/undefined:**
- ❌ You're not logged in
- ✅ Solution: Log in first at `/login`

### 2. Is the Token Valid?

**Check Token Expiration:**
```javascript
// Paste this in browser console
const token = localStorage.getItem('token');
if (token) {
  const payload = JSON.parse(atob(token.split('.')[1]));
  const exp = new Date(payload.exp * 1000);
  console.log('Token expires:', exp);
  console.log('Is expired:', exp < new Date());
}
```

**If expired:**
- ❌ Token has expired (default: 15 minutes)
- ✅ Solution: Log out and log in again

### 3. Is the Token Being Sent?

**Check Network Tab:**
1. Open Developer Tools → Network tab
2. Reload the notification preferences page
3. Find the `preferences` request
4. Check **Request Headers**

**Expected:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**If missing:**
- ❌ Token interceptor isn't working
- ✅ Solution: Check `api.js` notificationsApi interceptor

### 4. Backend Token Validation

**Check Backend Logs:**
Look for errors like:
- `Could not validate credentials`
- `JWTError`
- `Invalid token`

## Common Causes & Solutions

### Cause 1: Not Logged In
**Symptom:** No token in localStorage

**Solution:**
1. Go to `/login`
2. Log in with valid credentials
3. Navigate back to notification preferences

### Cause 2: Token Expired
**Symptom:** Token exists but is expired

**Solution:**
1. Log out (clears old token)
2. Log in again (gets fresh token)

**Note:** Default token expiry is 15 minutes. Can be changed in backend:
```python
# auth/legacy_auth.py
expire = datetime.utcnow() + timedelta(minutes=15)  # Change this
```

### Cause 3: Token Secret Mismatch
**Symptom:** Token looks valid but backend rejects it

**Check backend `config.py`:**
```python
secret_key: str = "your-secret-key-here"
algorithm: str = "HS256"
```

**Solution:**
- Ensure `secret_key` hasn't changed
- If changed, all users must log in again

### Cause 4: CORS Issues
**Symptom:** Token sent but request blocked

**Check backend CORS settings in `main.py`:**
```python
allow_origins=[
    "http://localhost:3000",  # Should include your frontend URL
    ...
],
allow_credentials=True,  # MUST be True for auth
```

## What I Fixed

### 1. Added Response Interceptor
```javascript
// api.js
notificationsApi.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Auto-redirect to login on 401
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
```

### 2. Auto-Create Default Preferences
```python
# routers/notifications.py
prefs = await service.get_preferences(current_user.username)
if not prefs:
    # Auto-create defaults for new users
    prefs = await service.create_default_preferences(current_user.username)
```

## Testing Steps

### 1. Verify Login Works
```bash
# Test login endpoint
curl -X POST http://localhost:8000/api/users/login \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"testpass"}'
```

**Expected Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "username": "testuser"
}
```

### 2. Test Authenticated Request
```bash
# Save token from login
TOKEN="your_token_here"

# Test notifications endpoint
curl http://localhost:8000/api/notifications/preferences \
  -H "Authorization: Bearer $TOKEN"
```

**Expected:** 200 OK with preferences data

**If 401:** Token validation is failing on backend

### 3. Frontend Test
1. **Clear all storage:**
   ```javascript
   localStorage.clear()
   sessionStorage.clear()
   ```

2. **Log in fresh:**
   - Navigate to `/login`
   - Enter credentials
   - Verify redirect to dashboard

3. **Check token:**
   ```javascript
   console.log('Token:', localStorage.getItem('token'))
   ```

4. **Navigate to notifications:**
   - Go to notification preferences page
   - Should load without 401

## Still Getting 401?

### Debug Mode

Add this to NotificationPreferences component:

```javascript
useEffect(() => {
  const token = localStorage.getItem('token');
  console.log('Token exists:', !!token);
  console.log('Token value:', token?.substring(0, 20) + '...');
  
  if (token) {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      console.log('Token payload:', payload);
      console.log('Token expires:', new Date(payload.exp * 1000));
      console.log('Is expired:', new Date(payload.exp * 1000) < new Date());
    } catch (e) {
      console.error('Invalid token format:', e);
    }
  }
}, []);
```

### Backend Debug Mode

Add logging to auth handler:

```python
# auth/legacy_auth.py
async def get_current_user(token: str = Depends(oauth2_scheme)):
    logger.info(f"Validating token: {token[:20]}...")  # First 20 chars
    
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        logger.info(f"Token payload: {payload}")
        username: str = payload.get("sub")
        
        if username is None:
            logger.error("No username in token payload")
            raise credentials_exception
            
        logger.info(f"Authenticated user: {username}")
        return TokenData(username=username)
    except JWTError as e:
        logger.error(f"JWT validation failed: {e}")
        raise credentials_exception
```

## Next Steps

1. **Check if you're logged in** (most common cause)
2. **Clear storage and re-login** (if token expired)
3. **Check browser console** for warnings
4. **Check backend logs** for auth errors
5. **Test with curl** to isolate frontend vs backend issues

If still failing after all checks, the issue is likely in backend token validation configuration.
