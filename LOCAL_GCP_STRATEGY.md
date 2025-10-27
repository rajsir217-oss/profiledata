# Local vs GCP Environment Strategy

## Current Situation
- **Problem**: Image URLs are stored as full GCP URLs in MongoDB
- **Example**: `https://matrimonial-backend-458052696267.us-central1.run.app/uploads/image.jpg`
- **Issue**: When running locally, images still point to GCP

## Immediate Solution (Implemented)
Using **Hybrid Approach** - Local backend but GCP images:
- ✅ API calls: `http://localhost:8000` (local)
- ✅ MongoDB: `mongodb://localhost:27017` (local)
- ⚠️ Images: Still from GCP (for now)

## Long-term Solutions

### Option 1: Database Migration (Recommended)
**Goal**: Store only relative paths in database

#### Migration Steps:
1. Update all image URLs in MongoDB:
   ```javascript
   // Before: https://matrimonial-backend-458052696267.us-central1.run.app/uploads/xyz.jpg
   // After: /uploads/xyz.jpg
   ```

2. Create migration script:
   ```javascript
   // migration/migrate-image-urls.js
   async function migrateImageUrls() {
     const users = await db.users.find({});
     for (const user of users) {
       if (user.images) {
         user.images = user.images.map(url => {
           if (url.includes('/uploads/')) {
             return url.substring(url.indexOf('/uploads/'));
           }
           return url;
         });
         await db.users.updateOne({_id: user._id}, {$set: {images: user.images}});
       }
     }
   }
   ```

3. Update backend upload logic to save relative paths only

### Option 2: Local Image Sync
**Goal**: Download GCP images for local development

Create sync script:
```bash
#!/bin/bash
# scripts/sync-images.sh
# Download all images from GCP to local uploads folder

gsutil -m rsync -r gs://your-bucket-name/uploads ./fastapi_backend/uploads
```

### Option 3: Dual Database Strategy
**Goal**: Separate databases for local and production

- Local: `mongodb://localhost:27017/matrimonialDB_local`
- Production: `mongodb+srv://...@mongocluster0.../matrimonialDB`

## Recommended Implementation Plan

### Phase 1: Current (Hybrid) ✅
- Local backend API
- Local MongoDB
- GCP images (temporary)

### Phase 2: Migration
1. Create backup of production database
2. Write and test migration script
3. Migrate image URLs to relative paths
4. Update upload logic to save relative paths
5. Test thoroughly in staging

### Phase 3: Clean Separation
- Local: Everything local (API, DB, Images)
- GCP: Everything in cloud (API, DB, Images)

## Environment Detection Summary

| Environment | API | MongoDB | Images | Redis |
|------------|-----|---------|---------|--------|
| **Local** | `localhost:8000` | `localhost:27017` | GCP (temp) → Local (future) | `localhost:6379` |
| **GCP** | Cloud Run URL | MongoDB Atlas | GCS Bucket | Redis Cloud |

## Next Steps
1. ✅ Keep hybrid approach for now (working)
2. Plan migration during low-traffic period
3. Implement relative path storage
4. Optional: Set up image sync for developers

## Configuration Files to Update

### For Migration:
- `/fastapi_backend/services/upload_service.py` - Save relative paths
- `/frontend/src/utils/urlHelper.js` - Already prepared for relative paths
- Database migration script - To be created

### Current Config:
- ✅ `/frontend/src/config/apiConfig.js` - Environment detection
- ✅ `/frontend/src/utils/urlHelper.js` - Image URL handling
- ✅ `/fastapi_backend/config.py` - Backend configuration
