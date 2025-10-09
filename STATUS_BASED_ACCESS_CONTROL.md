# Status-Based Access Control Implementation

## Overview
Implemented frontend access control that restricts non-active users to only their profile page, edit profile, and preferences pages.

## How It Works

### 1. ProtectedRoute Component (`/frontend/src/components/ProtectedRoute.js`)
- Wraps all protected routes
- Checks user status on every route change
- Fetches user profile to get current status
- Redirects non-active users to their profile page with a message

### 2. Access Rules

**Allowed for ALL logged-in users (regardless of status):**
- `/profile/:username` (own profile only)
- `/edit-profile`
- `/preferences`

**Requires ACTIVE status:**
- `/dashboard`
- `/admin`
- `/matching-criteria`
- `/top-matches`
- `/shortlists`
- `/search`
- `/favorites`
- `/shortlist`
- `/exclusions`
- `/messages`
- `/requests`
- `/pii-management`
- `/user-management`
- `/test-dashboard`

**Public (no login required):**
- `/login`
- `/register`
- `/` (redirects to login)

### 3. User Experience

**For Non-Active Users:**
1. User tries to access a protected page (e.g., Dashboard)
2. ProtectedRoute checks their status
3. If status is not "active" (e.g., "pending", "suspended", "banned"):
   - User is redirected to their profile page
   - A warning message is displayed explaining their status
   - Message auto-dismisses after 10 seconds or can be manually closed

**Status Message Example:**
```
⚠️ Account Status Notice
Your account status is "pending". Please complete your profile and wait for admin approval to access other features.
```

### 4. Status Values
- **active**: Full access to all features
- **pending**: Limited to profile/edit/preferences only
- **suspended**: Limited to profile/edit/preferences only
- **banned**: Limited to profile/edit/preferences only

## Files Modified

1. **`/frontend/src/components/ProtectedRoute.js`** (NEW)
   - Main access control logic
   - Status checking and redirection

2. **`/frontend/src/App.js`**
   - Imported ProtectedRoute
   - Wrapped all protected routes with ProtectedRoute component

3. **`/frontend/src/components/Profile.js`**
   - Added statusMessage state
   - Added useEffect to check for status messages from sessionStorage
   - Added status alert UI component

## Testing

To test the feature:

1. **Create a pending user:**
   ```bash
   # In MongoDB or through registration
   # Set user status to "pending"
   ```

2. **Login as pending user:**
   - Try to access Dashboard
   - Should be redirected to profile with warning message

3. **Admin activates user:**
   - User can now access all features

## Security Notes

- This is **frontend-only** protection
- Backend should also validate user status for API requests
- Status is checked on every route change
- Uses sessionStorage for one-time message display
- Automatically re-checks status when navigating between pages

## Future Enhancements

1. Add backend middleware to validate status on API calls
2. Add different messages for different status values
3. Add visual indicators in sidebar for disabled menu items
4. Cache status check for better performance (with periodic refresh)
5. Add WebSocket notification when status changes
