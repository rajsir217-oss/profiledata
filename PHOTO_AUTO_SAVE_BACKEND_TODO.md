# Photo Auto-Save Backend Implementation

## 🎯 Overview
Frontend has been updated with auto-save functionality for photo uploads. Backend needs two new API endpoints.

## ✅ Frontend Changes (Already Completed)
- `ImageManager.js`: Auto-uploads photos when selected (in edit mode)
- `ImageManager.js`: Auto-saves when setting profile picture
- `Register2.js`: Passes `username` and `isEditMode` props to ImageManager
- `ImageManager.css`: Added loading spinners and status banners

## 🔧 Backend API Endpoints Needed

### 1. **POST `/api/users/profile/{username}/upload-photos`**

**Purpose:** Auto-upload new photos while in edit mode

**Request:**
- Headers: `Authorization: Bearer <token>`
- Content-Type: `multipart/form-data`
- Body:
  ```
  images: File[] (one or more image files)
  existingImages: JSON string array (URLs of existing images to maintain order)
  ```

**Response:**
```json
{
  "images": [
    "uploads/user123/photo1.jpg",
    "uploads/user123/photo2.jpg",
    "uploads/user123/photo3.jpg"
  ],
  "message": "Photos uploaded successfully"
}
```

**Logic:**
1. Verify JWT token and username match
2. Validate image files (format, size < 5MB each)
3. Save images to disk/S3 with unique names
4. Combine new image URLs with existingImages array (maintaining order)
5. Update user's `images` field in MongoDB
6. Return updated images array

**Error Cases:**
- 401: Unauthorized (token invalid or username mismatch)
- 400: File validation failed (wrong format, too large)
- 413: Total images exceed 5
- 500: Server error (upload failed, DB update failed)

---

### 2. **PUT `/api/users/profile/{username}/reorder-photos`**

**Purpose:** Change profile picture by reordering images (first image = profile pic)

**Request:**
- Headers: `Authorization: Bearer <token>`
- Content-Type: `application/json`
- Body:
  ```json
  {
    "imageOrder": [
      "uploads/user123/photo3.jpg",  // New profile picture
      "uploads/user123/photo1.jpg",
      "uploads/user123/photo2.jpg"
    ]
  }
  ```

**Response:**
```json
{
  "images": [
    "uploads/user123/photo3.jpg",
    "uploads/user123/photo1.jpg",
    "uploads/user123/photo2.jpg"
  ],
  "message": "Profile picture updated successfully"
}
```

**Logic:**
1. Verify JWT token and username match
2. Validate imageOrder array matches user's existing images
3. Update user's `images` field with new order
4. Return updated images array

**Error Cases:**
- 401: Unauthorized
- 400: Invalid imageOrder (doesn't match existing images)
- 500: DB update failed

---

## 📝 Implementation Notes

### Security
- ✅ Verify JWT token on both endpoints
- ✅ Ensure username in URL matches token username (or is admin)
- ✅ Validate file types (only images)
- ✅ Enforce file size limits (5MB per file)
- ✅ Enforce max 5 photos total

### Backend File Location
Likely in: `/fastapi_backend/routes.py` or create `/fastapi_backend/routers/photo_upload.py`

### Existing Code to Reference
Check existing `/profile/{username}` PUT endpoint for:
- How image uploads are currently handled
- How to update user's images field
- JWT authentication pattern

### Testing Checklist
- [ ] Upload single photo in edit mode
- [ ] Upload multiple photos in edit mode
- [ ] Set profile picture (first image)
- [ ] Verify correct image order in DB
- [ ] Test with invalid token
- [ ] Test with oversized files
- [ ] Test exceeding 5 photo limit
- [ ] Test with non-image files

---

## 🚀 Next Steps

1. **Implement Backend Endpoints**
   - Add route handlers in FastAPI
   - Add file upload logic
   - Add validation and error handling

2. **Test End-to-End**
   - Test in edit-profile page
   - Verify auto-upload works
   - Verify profile picture change works
   - Check database updates correctly

3. **User Experience Verification**
   - Upload shows spinner
   - Success message appears
   - Photos immediately visible
   - No need to click "Save Changes"

---

## 💡 Current Behavior

**Registration Mode (isEditMode=false):**
- Photos added to `newImages` array (in memory)
- Uploaded when full form submitted
- No auto-save

**Edit Mode (isEditMode=true):**
- Photos auto-uploaded immediately ✨
- Profile picture auto-saved immediately ✨
- No main "Save Changes" button needed for photos
