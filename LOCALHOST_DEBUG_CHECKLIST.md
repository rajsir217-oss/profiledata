# Localhost Debugging Checklist for Notification Management

## 🔍 Issue: http://localhost:3000/notification-management

### Step 1: Verify Services Are Running

#### Frontend (React)
```bash
# Check if running on port 3000
lsof -i :3000

# If not running, start it:
cd /Users/rajsiripuram02/opt/appsrc/profiledata/frontend
npm start

# Expected output: "Starting the development server..."
# And browser should open to http://localhost:3000
```

#### Backend (FastAPI)
```bash
# Check if running on port 8000
lsof -i :8000

# If not running, start it:
cd /Users/rajsiripuram02/opt/appsrc/profiledata/fastapi_backend
python -m uvicorn main:app --reload

# Expected output: "Uvicorn running on http://0.0.0.0:8000"
```

### Step 2: Check Authentication

#### Browser Console Check
```javascript
// Open browser console (F12) and run:
console.log('Username:', localStorage.getItem('username'));
console.log('Role:', localStorage.getItem('userRole'));
console.log('Token:', localStorage.getItem('token') ? 'Present' : 'Missing');

// Expected: Role should be "admin" for notification management
```

#### If Not Admin:
1. Log out and log back in as admin user
2. Or manually set role for testing:
```javascript
localStorage.setItem('userRole', 'admin');
location.reload();
```

### Step 3: Test API Endpoints

#### Test Backend Connection
```bash
# Test basic backend connection
curl http://localhost:8000/

# Test notification endpoint (should return 401 without auth)
curl -i http://localhost:8000/api/notifications/queue

# Expected: 401 Unauthorized (means endpoint exists)
```

### Step 4: Check Component Loading

#### Browser Console Errors
Open http://localhost:3000/notification-management and check console for:

**Common Errors:**
- `Failed to load resource: the server responded with a status of 404`
- `Cannot read property '...' of undefined`
- `Module not found: Can't resolve '...'`

#### Network Tab Issues
1. Open DevTools → Network tab
2. Reload the page
3. Look for red (failed) requests
4. Check if `/api/notifications/queue` fails

### Step 5: Verify Component Files

Make sure these files exist:
```bash
# Check key component files
ls -la /Users/rajsiripuram02/opt/appsrc/profiledata/frontend/src/components/NotificationManagement.js
ls -la /Users/rajsiripuram02/opt/appsrc/profiledata/frontend/src/components/UniversalTabContainer.js
ls -la /Users/rajsiripuram02/opt/appsrc/profiledata/frontend/src/components/EventQueueManager.js
```

### Step 6: Check Environment Configuration

#### Frontend Config
```bash
# Check .env.local exists and has correct values
cat /Users/rajsiripuram02/opt/appsrc/profiledata/frontend/.env.local

# Should contain:
# REACT_APP_BACKEND_URL=http://localhost:8000
# REACT_APP_FRONTEND_URL=http://localhost:3000
```

### Step 7: Common Issues & Fixes

#### Issue: White Screen
**Cause**: JavaScript error preventing render
**Fix**: Check browser console for errors

#### Issue: Redirected to Dashboard
**Cause**: Not admin user or authentication failed
**Fix**: Log in as admin or set role manually

#### Issue: "Cannot find module" 
**Cause**: Missing dependencies
**Fix**: 
```bash
cd frontend && npm install
```

#### Issue: API calls failing
**Cause**: Backend not running or CORS issues
**Fix**: Start backend and check CORS configuration

#### Issue: Component not rendering
**Cause**: Import errors or missing components
**Fix**: Check all component imports exist

### Step 8: Manual Testing

#### Test Individual Components
```javascript
// In browser console, test if components load:
import('./components/NotificationManagement.js').then(module => {
  console.log('✅ NotificationManagement loaded');
}).catch(err => {
  console.error('❌ NotificationManagement failed:', err);
});
```

#### Test API Directly
```javascript
// Test API call in console:
fetch('http://localhost:8000/api/notifications/queue', {
  headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
})
.then(response => console.log('API Status:', response.status))
.catch(error => console.error('API Error:', error));
```

### Step 9: Quick Fix Commands

#### Restart Everything
```bash
# Kill any existing processes
pkill -f "node.*3000"
pkill -f "uvicorn.*8000"

# Clear caches
cd frontend && rm -rf node_modules/.cache && npm start

# In another terminal:
cd fastapi_backend && python -m uvicorn main:app --reload
```

#### Reset Authentication
```javascript
// In browser console:
localStorage.clear();
location.href = '/login';
```

### Step 10: If Still Not Working

1. **Check browser version** - Update if outdated
2. **Clear browser cache** - Hard refresh (Ctrl+F5)
3. **Try different browser** - Chrome/Firefox/Safari
4. **Check system resources** - Enough RAM/CPU
5. **Restart computer** - Last resort

---

## 📞 Debug Information to Collect

If asking for help, provide:
1. **Browser console errors** (full text)
2. **Network tab screenshots** (failed requests)
3. **Terminal output** (frontend/backend startup logs)
4. **Authentication status** (username, role)
5. **Operating system** and browser version

---

## 🚀 Expected Working State

When everything works:
1. Frontend runs on http://localhost:3000
2. Backend runs on http://localhost:8000
3. User is logged in as admin
4. Page loads with 4 tabs: EventQ, Logs, DeliveryLog, MsgTempl
5. No console errors
6. API calls return data (or 401 for unauthenticated)

---

*Last Updated: February 20, 2026*
