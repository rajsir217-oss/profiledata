# Notifications API 404 Error - Fixed

## Problem
Frontend was getting **404 errors** when calling notification preferences endpoints:
```
GET /api/users/notifications/preferences → 404 Not Found
```

## Root Cause

### Issue 1: Base URL Conflict
- Frontend `api.js` has baseURL: `/api/users`
- All API calls get this prefix prepended
- When calling `api.get('/notifications/preferences')`:
  - Result: `/api/users/notifications/preferences` ❌
  - Expected: `/api/notifications/preferences` ✅

### Issue 2: Auth Token Type Mismatch
- `get_current_user()` returns `TokenData` object (has `.username` property)
- Router endpoints were typed as `current_user: str`
- Direct usage as string failed

## Solution

### 1. Created Separate Notifications API Instance (`/frontend/src/api.js`)

Added dedicated axios instance similar to `imageAccessApi`:

```javascript
const notificationsApi = axios.create({
  baseURL: 'http://localhost:8000'  // No /api/users prefix
});

// Add auth token interceptor
notificationsApi.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export const notifications = {
  getPreferences: async () => {
    const response = await notificationsApi.get('/api/notifications/preferences');
    return response.data;
  },
  
  updatePreferences: async (preferences) => {
    const response = await notificationsApi.put('/api/notifications/preferences', preferences);
    return response.data;
  },
  
  resetPreferences: async () => {
    const response = await notificationsApi.post('/api/notifications/preferences/reset');
    return response.data;
  }
};
```

### 2. Updated Frontend Component (`/frontend/src/components/NotificationPreferences.js`)

```javascript
// Before
import api from '../api';
const response = await api.get('/notifications/preferences');

// After
import { notifications } from '../api';
const data = await notifications.getPreferences();
```

### 3. Fixed Backend Router (`/fastapi_backend/routers/notifications.py`)

**Type Fixes:**
```python
# Before
from auth import get_current_user

@router.get("/preferences")
async def get_notification_preferences(
    current_user: str = Depends(get_current_user),  # ❌ Wrong type
    ...
):
    prefs = await service.get_preferences(current_user)  # ❌ Used as string

# After
from models import TokenData
from auth import get_current_user

@router.get("/preferences")
async def get_notification_preferences(
    current_user: TokenData = Depends(get_current_user),  # ✅ Correct type
    ...
):
    prefs = await service.get_preferences(current_user.username)  # ✅ Extract username
```

**All endpoints fixed:**
- ✅ `GET /api/notifications/preferences`
- ✅ `PUT /api/notifications/preferences`
- ✅ `POST /api/notifications/preferences/reset`
- ✅ `GET /api/notifications/queue`
- ✅ `DELETE /api/notifications/queue/{id}`
- ✅ `GET /api/notifications/analytics`
- ✅ `POST /api/notifications/unsubscribe`
- ✅ And all other endpoints

## Files Modified

### Frontend
- `/frontend/src/api.js` - Added `notificationsApi` and `notifications` export
- `/frontend/src/components/NotificationPreferences.js` - Updated to use `notifications` API

### Backend
- `/fastapi_backend/routers/notifications.py` - Fixed all TokenData handling

## Testing

### 1. Backend is running:
```bash
./bstart.sh
```

### 2. Verify endpoint:
```bash
# Get auth token
curl -X POST http://localhost:8000/api/users/login \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"test"}'

# Test preferences endpoint
curl http://localhost:8000/api/notifications/preferences \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 3. Frontend test:
1. Navigate to Notification Preferences page
2. Preferences should load without 404 errors
3. Updates should save successfully

## Result

✅ **404 errors resolved**  
✅ **Notification preferences page functional**  
✅ **Proper authentication token handling**  
✅ **Consistent API pattern across the app**

## Pattern for Future APIs

When adding new API endpoints that aren't under `/api/users`:

```javascript
// Create separate axios instance in api.js
const newFeatureApi = axios.create({
  baseURL: 'http://localhost:8000'
});

// Add auth interceptor
newFeatureApi.interceptors.request.use(/* ... */);

// Export API methods
export const newFeature = {
  getData: async () => {
    const response = await newFeatureApi.get('/api/new-feature/data');
    return response.data;
  }
};
```

This keeps the codebase organized and prevents base URL conflicts.
