# 🧪 Manual Testing Guide - Photo Auto-Save

## ✅ Quick Start (5 Minutes)

### **Step 1: Open the App**
1. Open browser: http://localhost:3000
2. Log in with your admin account

### **Step 2: Go to Edit Profile**
1. Click your profile or navigate to: http://localhost:3000/edit-profile
2. Scroll to "📸 Profile Images" section

### **Step 3: Test Auto-Upload**
1. Click **"Upload New Photos"** button
2. Select 1-2 image files (< 5MB each)
3. **Watch for:**
   - 🔵 Blue banner: "Uploading photos..."
   - 🔄 Spinner animation
   - ✅ Success: "✅ 2 photos uploaded successfully!"
   - 📸 Photos appear immediately in grid

4. **Verify:**
   - Open DevTools → Network tab
   - See `POST /api/users/profile/admin/upload-photos`
   - Status: 200 OK
   - Response has `images` array

### **Step 4: Test Set Profile Picture**
1. Click the **star (⭐) icon** on the second photo
2. **Watch for:**
   - 🟢 Green banner: "Saving changes..."
   - 🔄 Spinner animation
   - ✅ Success: "✅ Profile picture updated successfully!"
   - 📸 Photo moves to first position
   - 🌟 Orange "Profile Picture" badge appears

3. **Verify:**
   - Open DevTools → Network tab
   - See `PUT /api/users/profile/admin/reorder-photos`
   - Status: 200 OK
   - Response has reordered `images` array

### **Step 5: Verify No Save Button Needed**
- **Important:** Notice you did NOT need to scroll down and click "Save Changes"
- Photos are already saved!
- Profile picture is already changed!

---

## 🔍 What to Look For

### **✅ Success Indicators:**
1. **Loading States:**
   - Blue "Uploading photos..." banner with spinner
   - Green "Saving changes..." banner with spinner
   - Banners disappear after operation completes

2. **Success Messages:**
   - "✅ X photo(s) uploaded successfully!"
   - "✅ Profile picture updated successfully!"

3. **Visual Changes:**
   - Photos appear immediately after upload
   - Profile picture moves to first position after star click
   - Orange badge shows on profile picture

4. **Network Requests:**
   - `POST .../upload-photos` returns 200 OK
   - `PUT .../reorder-photos` returns 200 OK

5. **No Save Button:**
   - Main "Save Changes" button at bottom NOT needed
   - Changes are immediate!

### **❌ Error Indicators:**
1. **Red error messages:**
   - "❌ File too large"
   - "❌ Maximum 5 photos allowed"
   - "❌ Upload failed"

2. **Network errors:**
   - 401 Unauthorized (token expired - log in again)
   - 403 Forbidden (security issue)
   - 500 Server error (check backend logs)

---

## 📊 Quick Verification Checklist

After testing, verify:

**Frontend:**
- [ ] Photos uploaded immediately (no manual save)
- [ ] Profile picture changed immediately (no manual save)
- [ ] Loading spinners showed during operations
- [ ] Success messages displayed
- [ ] No console errors

**Backend (Check Terminal Running Backend):**
```bash
# Look for these log lines:
📤 Auto-upload request for user 'admin' with X photo(s)
💾 Saving X new photo(s)...
✅ Photos auto-uploaded successfully for user 'admin'
🔄 Reorder photos request for user 'admin'
✅ Photos reordered successfully for user 'admin'
```

**Database (Optional):**
```bash
mongosh
use matrimonialDB
db.users.findOne({username: "admin"}, {images: 1})
# Should see updated images array
```

---

## 🎯 Expected Behavior Summary

| Action | Before | After | Save Button Needed? |
|--------|--------|-------|---------------------|
| Upload photos | No photos | Photos visible | ❌ NO - Auto-saved! |
| Set profile pic | 2nd photo first | 2nd photo moved to 1st | ❌ NO - Auto-saved! |
| Drag reorder | Original order | New order | ✅ YES - Manual save |

---

## 🐛 Troubleshooting

### **Problem: No loading banner appears**
**Solution:**
- Hard refresh: `Cmd+Shift+R`
- Clear cache and reload
- Try incognito window

### **Problem: "401 Unauthorized" error**
**Solution:**
- Log out and log in again
- Token might be expired

### **Problem: Photos don't appear**
**Solution:**
- Check Network tab for errors
- Check backend terminal for errors
- Verify MongoDB is running

### **Problem: API endpoint 404**
**Solution:**
- Restart backend server
- Verify you're on `/edit-profile` page (not `/register`)
- Check you're logged in

---

## ✨ Success Criteria

**You're good to go if:**
- ✅ Photos upload immediately without clicking "Save Changes"
- ✅ Profile picture changes immediately without clicking "Save Changes"
- ✅ Loading spinners show during operations
- ✅ Success messages appear after operations
- ✅ No errors in console or network tab
- ✅ Backend logs show successful API calls
- ✅ Database shows updated images

---

## 📝 Test Results

**Date:** _______________________

**Upload Test:**
- [ ] Pass - Photos uploaded immediately
- [ ] Fail - Error: _________________

**Set Profile Picture Test:**
- [ ] Pass - Profile pic changed immediately
- [ ] Fail - Error: _________________

**Loading States:**
- [ ] Pass - Spinners and messages showed
- [ ] Fail - Issue: _________________

**No Save Button:**
- [ ] Pass - No manual save needed
- [ ] Fail - Still needs save button

**Overall Status:**
- [ ] ✅ Ready for production
- [ ] ⚠️ Issues found (list above)
- [ ] ❌ Major problems (describe)

---

**Next Steps:**
1. If all tests pass → Deploy to production! 🚀
2. If issues found → Check MANUAL_TEST_GUIDE.md troubleshooting
3. If major problems → Create GitHub issue with details

Good luck testing! 🦋✨
