# Image Focal Point - Design Document

**Created:** Jan 8, 2026  
**Status:** Planning  
**Component:** SearchResultCard, UserCard profile images

---

## Problem Statement

Profile images in SearchResultCard display with `object-fit: cover` which crops the image to fit the container. The current `object-position: center top` focuses on the top of the image, which works poorly for full-body shots where the person is in the lower portion of the frame.

**Example:** A photo with a large tree at the top and person standing at the bottom shows mostly tree, not the person's face.

---

## Current Implementation

**File:** `/frontend/src/components/SearchPage2.css`

```css
.card-profile-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center top;  /* Problem: focuses on top of image */
}
```

---

## Solution Options

### Option 1: Simple CSS Change (Quick Fix)

**Change:** `object-position: center top` → `object-position: center 35%`

**Pros:**
- 1 line change, instant deployment
- Focuses on upper-third where faces typically are in portraits

**Cons:**
- Still a guess - won't work for all photo compositions
- No user control

**Effort:** 5 minutes

---

### Option 2: User-Defined Focal Point (Recommended)

Allow users to set a focal point for each uploaded image.

#### Backend Changes

**Add to image schema:**
```python
# In user profile or images collection
{
  "images": [
    {
      "url": "path/to/image.jpg",
      "focalPointX": 50,  # 0-100, percentage from left
      "focalPointY": 35,  # 0-100, percentage from top
      "uploadedAt": "2026-01-08T..."
    }
  ]
}
```

**Default values:** `focalPointX: 50, focalPointY: 35` (center-upper third)

#### Frontend Changes

**1. ImageManagerModal - Add focal point selector:**
```javascript
// When user clicks on image preview
const handleSetFocalPoint = (e) => {
  const rect = e.target.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width) * 100;
  const y = ((e.clientY - rect.top) / rect.height) * 100;
  setFocalPoint({ x: Math.round(x), y: Math.round(y) });
};

// Visual indicator
<div 
  className="focal-point-marker"
  style={{ left: `${focalPoint.x}%`, top: `${focalPoint.y}%` }}
/>
```

**2. SearchResultCard/UserCard - Use focal point:**
```javascript
// In component
const focalX = user.images?.[currentImageIndex]?.focalPointX ?? 50;
const focalY = user.images?.[currentImageIndex]?.focalPointY ?? 35;

// In JSX
<img
  src={imageUrl}
  style={{ objectPosition: `${focalX}% ${focalY}%` }}
  className="card-profile-image"
/>
```

**Effort:** 2-4 hours

---

### Option 3: AI-Powered Face Detection (Advanced)

Automatically detect faces on image upload and set focal point.

#### Implementation

**1. On image upload, call face detection API:**
```python
# Using AWS Rekognition, Google Vision, or local ML model
async def detect_face_focal_point(image_path: str) -> dict:
    # Detect faces in image
    faces = await face_detection_api.detect(image_path)
    
    if faces:
        # Use center of first (largest) face
        face = faces[0]
        return {
            "focalPointX": face.center_x,
            "focalPointY": face.center_y
        }
    
    # Default if no face detected
    return {"focalPointX": 50, "focalPointY": 35}
```

**2. Store result with image metadata**

**3. Use in frontend (same as Option 2)**

**Pros:**
- Fully automatic
- Accurate for photos with visible faces

**Cons:**
- Requires external API or ML model
- Processing time on upload
- Cost for API calls
- May fail on artistic/unusual photos

**Effort:** 1-2 days

---

### Option 4: Hybrid Approach (Best UX)

1. **Auto-detect** focal point on upload using face detection
2. **Allow manual override** in ImageManagerModal
3. **Show preview** of how image will appear in cards

---

## Recommendation

**Immediate:** Apply Option 1 (CSS quick fix) to improve current experience

**Short-term:** Implement Option 2 (user-defined focal point) for full control

**Future:** Consider Option 3 (AI detection) as enhancement

---

## Files to Modify

### Option 1 (Quick Fix)
- `/frontend/src/components/SearchPage2.css` - Change object-position

### Option 2 (User Focal Point)
- `/frontend/src/components/SearchPage2.css` - Remove static object-position
- `/frontend/src/components/SearchResultCard.js` - Add dynamic object-position style
- `/frontend/src/components/UserCard.js` - Add dynamic object-position style
- `/frontend/src/components/ImageManagerModal.js` - Add focal point selector UI
- `/frontend/src/components/ImageManagerModal.css` - Focal point marker styles
- `/fastapi_backend/routes.py` - Update image upload to accept focal point
- `/fastapi_backend/models/` - Update image schema if needed

---

## UI Mockup - Focal Point Selector

```
┌─────────────────────────────────────┐
│  Set Focus Point                    │
│  Click on the image where you want  │
│  the focus to be when cropped       │
├─────────────────────────────────────┤
│  ┌─────────────────────────────┐    │
│  │                             │    │
│  │         🌳 Tree             │    │
│  │                             │    │
│  │           ⊕ ← focal point   │    │
│  │         👤 Person           │    │
│  │                             │    │
│  └─────────────────────────────┘    │
│                                     │
│  Preview:                           │
│  ┌───────────┐                      │
│  │   👤      │  ← How it will       │
│  │  Person   │    appear in cards   │
│  └───────────┘                      │
│                                     │
│  [Reset to Center]  [Save]          │
└─────────────────────────────────────┘
```

---

## Related Components

- `SearchResultCard.js` - Uses `.card-profile-image`
- `UserCard.js` - Uses similar image display
- `Profile.js` - Full profile image display
- `ImageManagerModal.js` - Image upload/management
- `PhotoVisibilityManager.js` - Photo privacy settings

---

## Notes

- Default focal point should be `center 35%` (upper third) as this works best for typical portrait photos
- Consider adding a "preview" mode in ImageManagerModal showing how the image will appear in different card sizes
- Mobile users may need a different UI for setting focal point (drag instead of click)
