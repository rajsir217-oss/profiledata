# 🧪 Photo Auto-Save Testing Guide

## 🎯 What We're Testing
1. Photo auto-upload when selected (edit mode)
2. Profile picture auto-save when changed
3. Loading states and user feedback
4. Error handling
5. Database updates

---

## ✅ Pre-Test Checklist

### 1. **Backend Running**
```bash
cd /Users/rajsiripuram02/opt/appsrc/profiledata/fastapi_backend
python main.py
```
**Expected:** Server starts on port 8000

### 2. **Frontend Running**
```bash
cd /Users/rajsiripuram02/opt/appsrc/profiledata/frontend
npm start
```
**Expected:** App opens on http://localhost:3000

### 3. **MongoDB Running**
```bash
# Check if MongoDB is running
mongosh --eval "db.version()"
```
**Expected:** Returns MongoDB version

### 4. **Clear Browser Cache**
- Press `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows)
- Or open incognito window

### 5. **User Account Ready**
- Have a test user account
- User must be logged in
- User must have `userStatus: 'active'`

---

## 📋 Test Cases

### **Test 1: Auto-Upload Photos (New Upload)**

**Steps:**
1. Log in to test account
2. Navigate to `/edit-profile`
3. Scroll to "📸 Profile Images" section
4. Click "Upload New Photos" button
5. Select 1-2 photos (< 5MB each)

**Expected Results:**
- ✅ **Loading banner appears:** "Uploading photos..." with spinner (blue gradient)
- ✅ **API call:** Check Network tab for `POST /api/users/profile/{username}/upload-photos`
- ✅ **Success message:** "✅ 2 photos uploaded successfully!"
- ✅ **Photos appear immediately** in the photo grid
- ✅ **No need to click main "Save Changes" button**

**Verify in Database:**
```bash
mongosh
use matrimonialDB
db.users.findOne({username: "testuser"}, {images: 1})
```
**Expected:** New images added to `images` array

**Verify in Backend Logs:**
```
📤 Auto-upload request for user 'testuser' with 2 photo(s)
💾 Saving 2 new photo(s)...
✅ Photos auto-uploaded successfully for user 'testuser'
```

---

### **Test 2: Set Profile Picture (Reorder)**

**Steps:**
1. Already have 2+ photos uploaded
2. Click star (⭐) icon on second or third photo
3. Observe the loading state

**Expected Results:**
- ✅ **Loading banner appears:** "Saving changes..." with spinner (green gradient)
- ✅ **API call:** Check Network tab for `PUT /api/users/profile/{username}/reorder-photos`
- ✅ **Success message:** "✅ Profile picture updated successfully!"
- ✅ **Photo moves to first position immediately**
- ✅ **Orange "⭐ Profile Picture" badge appears on new first photo**

**Verify in Database:**
```bash
db.users.findOne({username: "testuser"}, {images: 1})
```
**Expected:** Images array reordered, new profile pic is first

**Verify in Backend Logs:**
```
🔄 Reorder photos request for user 'testuser'
✅ Photos reordered successfully for user 'testuser'
📸 New profile picture: uploads/testuser/photo2.jpg
```

---

### **Test 3: File Size Validation**

**Steps:**
1. Try to upload a file > 5MB

**Expected Results:**
- ❌ **Error message:** "❌ File 'largefile.jpg' is too large. Maximum 5MB per photo."
- ❌ **No upload happens**
- ❌ **No API call made**

---

### **Test 4: Max 5 Photos Limit**

**Steps:**
1. Already have 4 photos
2. Try to upload 2 more photos (total would be 6)

**Expected Results:**
- ❌ **Error message:** "❌ Maximum 5 photos allowed. Please remove some photos first."
- ❌ **No upload happens**
- ❌ **No API call made**

---

### **Test 5: Already Profile Picture**

**Steps:**
1. Click star (⭐) on photo that's already first

**Expected Results:**
- ℹ️ **Info message:** "ℹ️ This image is already your profile picture!"
- ❌ **No API call made**
- ❌ **No changes**

---

### **Test 6: Network Error Handling**

**Steps:**
1. Stop backend server
2. Try to upload a photo

**Expected Results:**
- ❌ **Error message:** "❌ Upload failed: [error details]"
- ❌ **Loading spinner stops**
- ❌ **Photos not saved**

**Then:**
1. Restart backend
2. Try again - should work

---

### **Test 7: Unauthorized Access (Security Test)**

**Steps:**
1. Log in as `user1`
2. Open DevTools Console
3. Try to upload to another user's profile:
```javascript
const formData = new FormData();
formData.append('images', new File(['test'], 'test.jpg'));
formData.append('existingImages', '[]');

fetch('http://localhost:8000/api/users/profile/user2/upload-photos', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('token')}`
  },
  body: formData
})
.then(r => r.json())
.then(console.log);
```

**Expected Results:**
- ❌ **403 Forbidden:** "You can only upload photos to your own profile"
- ❌ **No changes to user2's profile**

---

### **Test 8: Registration Mode (Should NOT Auto-Save)**

**Steps:**
1. Log out
2. Go to `/register` or `/register2`
3. Fill out form
4. Upload photos in "Profile Images" section

**Expected Results:**
- ✅ **Photos stored in memory** (`newImages` array)
- ❌ **No immediate upload** (no API call)
- ✅ **Message:** "📸 2 photos selected. Click 'Save Changes' to upload."
- ✅ **Photos uploaded only when full form submitted**

---

### **Test 9: Drag & Drop Reorder (Manual)**

**Steps:**
1. Have 3+ photos
2. Drag second photo to first position

**Expected Results:**
- ✅ **Photos reorder visually**
- ❌ **No auto-save in this case** (drag is different from star click)
- ℹ️ **Traditional save flow** - needs main "Save Changes" button

---

### **Test 10: Multiple Rapid Uploads**

**Steps:**
1. Upload 1 photo
2. Immediately upload another photo (while first is still uploading)

**Expected Results:**
- ✅ **First upload completes**
- ✅ **Second upload queues or waits**
- ✅ **Both photos saved eventually**
- ❌ **No race conditions or lost photos**

---

## 🐛 Common Issues & Fixes

### **Issue 1: "404 Not Found" on Upload**
**Cause:** Backend not running or wrong URL
**Fix:**
```bash
cd fastapi_backend
python main.py
```

### **Issue 2: "401 Unauthorized"**
**Cause:** Invalid or expired JWT token
**Fix:**
1. Log out and log in again
2. Check `localStorage.getItem('token')` in console

### **Issue 3: Photos Don't Appear**
**Cause:** Browser cache
**Fix:**
1. Hard refresh: `Cmd+Shift+R`
2. Clear localStorage
3. Try incognito mode

### **Issue 4: "CORS Error"**
**Cause:** Frontend/backend port mismatch
**Fix:**
- Ensure frontend on port 3000
- Ensure backend on port 8000
- Check CORS settings in `main.py`

### **Issue 5: File Upload Fails Silently**
**Cause:** No error handling in frontend
**Fix:**
- Check browser console for errors
- Check backend logs for errors

---

## 📊 Success Criteria

### **Must Pass:**
- [x] Test 1: Auto-upload works
- [x] Test 2: Profile picture change works
- [x] Test 3: File size validation works
- [x] Test 4: Max 5 photos limit works
- [x] Test 5: Already profile pic message shows
- [x] Test 6: Network errors handled gracefully
- [x] Test 7: Unauthorized access blocked
- [x] Test 8: Registration mode doesn't auto-save

### **Should Pass:**
- [ ] Test 9: Manual drag reorder works
- [ ] Test 10: Multiple rapid uploads work

---

## 🔍 Debugging Checklist

If something doesn't work:

1. **Check Backend Logs:**
   ```bash
   # Look for these log lines
   📤 Auto-upload request...
   💾 Saving X new photo(s)...
   ✅ Photos auto-uploaded successfully...
   🔄 Reorder photos request...
   ```

2. **Check Frontend Console:**
   ```javascript
   // Should see these logs
   📤 Auto-uploading X photos...
   ✅ Photos auto-uploaded: X
   🌟 setAsProfilePic called with index: X
   ✅ Profile picture auto-saved to server
   ```

3. **Check Network Tab:**
   - See `POST /api/users/profile/{username}/upload-photos` request
   - See `PUT /api/users/profile/{username}/reorder-photos` request
   - Check request/response bodies

4. **Check Database:**
   ```bash
   mongosh
   use matrimonialDB
   db.users.findOne({username: "testuser"})
   ```

5. **Check File System:**
   ```bash
   ls -la fastapi_backend/uploads/{username}/
   ```

---

## 📝 Test Results Template

Use this to track your test results:

```
## Test Results - [Date]

### Test 1: Auto-Upload
- Status: ✅ Pass / ❌ Fail
- Notes: 

### Test 2: Set Profile Picture
- Status: ✅ Pass / ❌ Fail
- Notes: 

### Test 3: File Size Validation
- Status: ✅ Pass / ❌ Fail
- Notes: 

### Test 4: Max 5 Photos
- Status: ✅ Pass / ❌ Fail
- Notes: 

### Test 5: Already Profile Pic
- Status: ✅ Pass / ❌ Fail
- Notes: 

### Test 6: Network Error
- Status: ✅ Pass / ❌ Fail
- Notes: 

### Test 7: Unauthorized Access
- Status: ✅ Pass / ❌ Fail
- Notes: 

### Test 8: Registration Mode
- Status: ✅ Pass / ❌ Fail
- Notes: 

## Overall Status
- [ ] All critical tests pass
- [ ] Ready for production
- [ ] Issues found: [list]
```

---

## 🚀 Ready to Test!

1. Start backend: `python main.py`
2. Start frontend: `npm start`
3. Log in to test account
4. Navigate to `/edit-profile`
5. Follow Test 1 → Test 8
6. Document results
7. Report any issues

**Good luck! 🎉**
