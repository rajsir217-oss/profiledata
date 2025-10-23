# Session Debugging Guide

## Issue: Both browsers showing same user after some time

### Steps to Debug:

1. **Check Browser Sync Status**
   - Chrome: Settings → You and Google → Turn off sync
   - Edge: Settings → Profiles → Turn off sync
   
2. **Clear All Data**
   ```javascript
   // Open browser console (F12) and run:
   localStorage.clear();
   sessionStorage.clear();
   location.reload();
   ```

3. **Check Token Uniqueness**
   ```javascript
   // In each browser console:
   console.log('Username:', localStorage.getItem('username'));
   console.log('Token:', localStorage.getItem('token'));
   console.log('User Role:', localStorage.getItem('userRole'));
   ```

4. **Verify API Responses**
   ```javascript
   // Check what the API returns for current user:
   fetch('http://localhost:8000/api/users/profile/' + localStorage.getItem('username'), {
     headers: {
       'Authorization': 'Bearer ' + localStorage.getItem('token')
     }
   })
   .then(r => r.json())
   .then(d => console.log('API Profile Data:', d));
   ```

## Expected Behavior:

- **Chrome (normal user):**
  - username: "raj001" (or whatever you logged in with)
  - token: unique JWT token for raj001
  - role: "free_user"

- **Edge (admin):**
  - username: "admin"
  - token: unique JWT token for admin  
  - role: "admin"

## Common Causes:

### 1. Browser Profile Sync
**Problem:** Chrome/Edge syncing localStorage across devices
**Solution:** Disable browser sync or use Incognito/InPrivate mode

### 2. Shared Network Storage
**Problem:** Enterprise/school networks with roaming profiles
**Solution:** Use private/incognito mode

### 3. Token Refresh Bug
**Problem:** Frontend not properly handling token refresh
**Solution:** Check if both browsers are somehow using same token

### 4. Storage Event Bug
**Problem:** Storage event listener firing incorrectly
**Solution:** This only affects same-browser tabs, not cross-browser

## Fix: Add User Isolation

Add this to TopBar.js to prevent cross-contamination:

```javascript
useEffect(() => {
  const checkLoginStatus = async () => {
    const username = localStorage.getItem('username');
    const token = localStorage.getItem('token');
    
    // VERIFY token matches username
    if (username && token) {
      try {
        // Decode JWT to verify it matches username
        const payload = JSON.parse(atob(token.split('.')[1]));
        const tokenUsername = payload.sub;
        
        if (tokenUsername !== username) {
          console.error('❌ Token/username mismatch! Logging out...');
          handleLogout();
          return;
        }
        
        setIsLoggedIn(true);
        setCurrentUser(username);
        // ... rest of code
      } catch (error) {
        console.error('❌ Invalid token:', error);
        handleLogout();
        return;
      }
    }
  };
  
  checkLoginStatus();
}, []);
```

## Test in Incognito/Private Mode

To completely isolate sessions:

1. **Chrome:** Ctrl+Shift+N (Incognito)
2. **Edge:** Ctrl+Shift+P (InPrivate)

Login with different users in each incognito window. They should NEVER share data.
