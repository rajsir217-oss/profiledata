# Notification Management Debug Guide

## 🔍 Production Error Investigation

### URL: https://l3v3lmatches.com/notification-management

## 📋 Debugging Steps

### 1. Check Browser Console
Open browser developer tools (F12) and check for:

#### JavaScript Errors:
- **Module import errors**: `Failed to load module '...'`
- **Component rendering errors**: `Cannot read property '...' of undefined`
- **API call errors**: `Network request failed`

#### Network Tab:
- **Failed requests**: Red (4xx, 5xx) status codes
- **CORS errors**: `Access-Control-Allow-Origin` issues
- **Authentication errors**: 401 Unauthorized responses

### 2. Common Issues & Solutions

#### Issue #1: Authentication Token Missing
**Symptoms:**
- 401 Unauthorized errors on API calls
- Redirect to login page

**Debug:**
```javascript
// In browser console
console.log('Token:', localStorage.getItem('token'));
console.log('Username:', localStorage.getItem('username'));
console.log('Role:', localStorage.getItem('userRole'));
```

**Solution:**
- User needs to log in again
- Check token expiration

#### Issue #2: API Endpoint Not Found
**Symptoms:**
- 404 errors on `/api/notifications/queue`
- 404 errors on `/api/notifications/analytics`

**Debug:**
```javascript
// Test API endpoints
fetch('https://matrimonial-backend-7cxoxmouuq-uc.a.run.app/api/notifications/queue', {
  headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
})
.then(response => console.log('Queue status:', response.status))
.catch(error => console.error('Queue error:', error));
```

#### Issue #3: Component Import Errors
**Symptoms:**
- White screen with no content
- Console shows module loading errors

**Debug:**
```javascript
// Check if components are loading
console.log('NotificationManagement loaded:', !!document.querySelector('.notification-management'));
console.log('UniversalTabContainer loaded:', !!document.querySelector('.universal-tab-container'));
```

#### Issue #4: Backend Service Down
**Symptoms:**
- All API calls fail
- Network timeout errors

**Debug:**
```javascript
// Test backend connectivity
fetch('https://matrimonial-backend-7cxoxmouuq-uc.a.run.app/')
.then(response => console.log('Backend status:', response.status))
.catch(error => console.error('Backend down:', error));
```

### 3. Specific Component Issues

#### EventQueueManager Component
**Potential Issues:**
- `getBackendApiUrl` function not working
- `useToast` hook not initialized
- `DeleteButton` component missing

**Debug Code:**
```javascript
// In browser console
window.debugEventQueue = {
  checkUrlHelper: () => {
    const helper = window.urlHelper || {};
    console.log('getBackendApiUrl:', helper.getBackendApiUrl);
    console.log('Backend URL:', helper.getBackendApiUrl?.('/api/notifications/queue'));
  },
  checkToast: () => {
    console.log('ToastService:', window.toastService);
    console.log('Toast listeners:', window.toastService?.listeners?.length);
  }
};
```

#### UniversalTabContainer Component
**Potential Issues:**
- Tab state management errors
- CSS styling issues
- Missing tab content

**Debug Code:**
```javascript
// Check tab container
window.debugTabs = {
  checkContainer: () => {
    const container = document.querySelector('.universal-tab-container');
    console.log('Container found:', !!container);
    console.log('Active tab:', container?.querySelector('.tab-button.active')?.textContent);
  }
};
```

### 4. Environment Configuration Issues

#### Runtime Config Check
```javascript
// Check runtime configuration
console.log('Runtime Config:', window.RUNTIME_CONFIG);
console.log('Backend URL:', window.RUNTIME_CONFIG?.SOCKET_URL);
console.log('API URL:', window.RUNTIME_CONFIG?.API_URL);
```

#### API Configuration Check
```javascript
// Check API endpoints
import { API_ENDPOINTS } from './config/apiConfig';
console.log('Notification queue URL:', API_ENDPOINTS.NOTIFICATION_QUEUE);
console.log('Notification analytics URL:', API_ENDPOINTS.NOTIFICATION_ANALYTICS);
```

### 5. Backend-Side Issues

#### Notification Service Status
Check if the notification service is properly initialized:

**Python Backend Check:**
```python
# In backend logs, look for:
# - "NotificationService initialized"
# - "GET /api/notifications/queue"
# - "GET /api/notifications/analytics"
```

#### Database Connection
```python
# Check MongoDB connection for notification collections
# - notification_queue
# - notification_log  
# - notification_templates
```

### 6. Quick Fix Commands

#### Clear Browser Cache
```javascript
// In browser console
localStorage.clear();
sessionStorage.clear();
location.reload();
```

#### Force Re-authentication
```javascript
// Clear auth and redirect
localStorage.removeItem('token');
localStorage.removeItem('username');
localStorage.removeItem('userRole');
window.location.href = '/login';
```

### 7. Production Monitoring

#### Key Metrics to Monitor
1. **API Response Times**: `/api/notifications/*` endpoints
2. **Error Rates**: 4xx/5xx responses
3. **Database Performance**: Notification queue queries
4. **Memory Usage**: Frontend bundle size

#### Log Patterns to Watch
```
# Frontend Errors
"Failed to load module"
"Cannot read property"
"Network request failed"

# Backend Errors  
"NotificationService error"
"Database connection failed"
"Authentication failed"
```

### 8. Emergency Rollback Plan

If the notification management page is completely broken:

1. **Disable the route temporarily**:
   ```javascript
   // In App.js, comment out the route
   // <Route path="/notification-management" element={<ProtectedRoute><NotificationManagement /></ProtectedRoute>} />
   ```

2. **Redirect to working page**:
   ```javascript
   <Route path="/notification-management" element={<Navigate to="/admin" replace />} />
   ```

3. **Restore previous version** from git if needed

---

## 🔧 Development Environment Fixes

### Local Testing
```bash
# Test notification endpoints locally
curl -H "Authorization: Bearer $TOKEN" \
     http://localhost:8000/api/notifications/queue

curl -H "Authorization: Bearer $TOKEN" \
     http://localhost:8000/api/notifications/analytics
```

### Component Isolation Testing
```javascript
// Test components in isolation
import NotificationManagement from './components/NotificationManagement';
import EventQueueManager from './components/EventQueueManager';
import UniversalTabContainer from './components/UniversalTabContainer';
```

---

## 📞 Support Information

### Error Reporting
When reporting issues, include:
1. **Browser console errors** (full stack traces)
2. **Network tab screenshots** (failed requests)
3. **User authentication status** (logged in/out)
4. **Browser and OS version**
5. **Time of occurrence** (for log correlation)

### Contact Information
- **Frontend Issues**: Check component imports and API calls
- **Backend Issues**: Check service initialization and database
- **Infrastructure**: Check deployment and environment variables

---

*Last Updated: February 20, 2026*
*Debug Guide Version: 1.0*
