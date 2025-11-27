# ContactEmail Refactor - November 26, 2025

## Summary

Refactored frontend and backend to consistently use `contactEmail` instead of `email` field for user profiles.

---

## Why This Change?

### Before:
- **Database:** Stores email as `contactEmail`
- **Backend:** Mapped `contactEmail` → `email` for backwards compatibility
- **Frontend:** Mixed usage - some components used `email`, some `contactEmail`
- **Problem:** Confusing, extra mapping logic, inconsistent

### After:
- **Database:** Stores email as `contactEmail` ✅
- **Backend:** Returns `contactEmail` as-is (no mapping) ✅
- **Frontend:** Always uses `contactEmail` ✅
- **Result:** Clean, consistent, no extra logic needed

---

## Files Changed

### Frontend (3 files)

#### 1. `/frontend/src/components/UserManagement.js`
**Changed:**
- User table display: `user.email` → `user.contactEmail` (line 716)
- RoleActionModal: `user.email || user.contactEmail` → `user.contactEmail` (line 863)
- GenericActionModal: `user.email || user.contactEmail` → `user.contactEmail` (line 974)

```javascript
// Before
<td>{user.email}</td>
<p>{user.email || user.contactEmail || 'No email'}</p>

// After
<td>{user.contactEmail}</td>
<p>{user.contactEmail || 'No email'}</p>
```

#### 2. `/frontend/src/components/ContactUs.js`
**Changed:**
- Pre-fill form email: `profile.email` → `profile.contactEmail` (line 57)

```javascript
// Before
email: profile.email || ''

// After
email: profile.contactEmail || ''
```

#### 3. `/frontend/src/components/AdminPage.js`
**Already correct!** ✅
- Was already using `user.contactEmail` everywhere
- No changes needed

---

### Backend (1 file)

#### `/fastapi_backend/auth/admin_routes.py`

**Changes:**

1. **Removed email field mapping** from `get_all_users()` (line 85-91)
   ```python
   # REMOVED this mapping logic:
   if 'contactEmail' in users[i] and not users[i].get('email'):
       users[i]['email'] = users[i]['contactEmail']
   ```

2. **Removed email field mapping** from `get_user_details()` (line 126-133)
   ```python
   # REMOVED this mapping logic:
   if 'contactEmail' in user and not user.get('email'):
       user['email'] = user['contactEmail']
   ```

3. **Simplified search query** (line 62-68)
   ```python
   # Before
   query["$or"] = [
       {"username": {"$regex": search, "$options": "i"}},
       {"email": {"$regex": search, "$options": "i"}},        # ← Removed
       {"contactEmail": {"$regex": search, "$options": "i"}},
       ...
   ]
   
   # After
   query["$or"] = [
       {"username": {"$regex": search, "$options": "i"}},
       {"contactEmail": {"$regex": search, "$options": "i"}},  # Only this
       ...
   ]
   ```

---

## What Stayed the Same

### ✅ No Changes Needed:

**Frontend components that don't use user profiles:**
- `AdminContactManagement.js` - Uses `ticket.email` (contact form tickets, not user profiles)
- `InvitationManager.js` - Uses `invitation.email` (invitation data, not user profiles)
- `InviteFriends.js` - Uses `invitation.email` (invitation data, not user profiles)
- `Register2.js` - Already correctly uses `contactEmail`

**These are fine because they deal with different data types (tickets, invitations), not user profiles.**

---

## Testing Checklist

After deployment:

- [ ] Admin panel shows email addresses (not empty)
- [ ] User table displays emails correctly
- [ ] Search by email works in admin panel
- [ ] Role assignment modal shows user email
- [ ] User action modals show email
- [ ] Contact Us form pre-fills user email
- [ ] Profile page shows email correctly
- [ ] All emails are decrypted (not showing "gAAAAA...")

---

## Benefits

### ✅ Code Quality
- **Cleaner:** No mapping logic needed
- **Simpler:** Frontend and backend use same field name
- **Consistent:** One field name throughout the app

### ✅ Performance
- **Faster:** No extra mapping in backend
- **Less memory:** No duplicate field in response

### ✅ Maintainability
- **Easier to understand:** Field names match database
- **Less confusion:** New developers see `contactEmail` everywhere
- **Fewer bugs:** No mismatch between `email` and `contactEmail`

---

## Migration Notes

### For New Features:
**Always use `contactEmail` for user profiles:**
```javascript
// ✅ Correct
user.contactEmail

// ❌ Wrong
user.email
```

### For Existing Code:
If you find any code using `user.email` for profiles:
1. Change to `user.contactEmail`
2. Remove any fallback: `user.email || user.contactEmail`
3. Test the component

---

## Database Field Reference

### PII Fields (Encrypted):
- ✅ `contactEmail` - User's email address
- ✅ `contactNumber` - User's phone number
- ✅ `location` - User's location
- ✅ `linkedinUrl` - User's LinkedIn profile

### Other Email Fields (Different Purpose):
- `invitation.email` - Email where invitation was sent
- `ticket.email` - Email from contact form submission

**Don't confuse these with user profile `contactEmail`!**

---

## Summary

**What we did:**
- Removed backend `contactEmail` → `email` mapping
- Updated frontend to use `contactEmail` everywhere
- Simplified search queries

**Why it matters:**
- Cleaner code
- Better performance  
- Easier to maintain
- Consistent field naming

**Status:** ✅ **READY TO DEPLOY**

---

## Deploy

```bash
# Backend
cd deploy_gcp
./deploy-production.sh  # Choose option 1

# Frontend (if needed later)
./deploy-production.sh  # Choose option 2
```

**Verification:**
After backend deployment, admin panel should show emails in the EMAIL column immediately (no frontend deployment needed since it was already prepared for this change).
