# Image Bucket Configuration Fix

**Date:** November 16, 2025  
**Issue:** Profile images broken after deployment  
**Status:** ✅ FIXED

---

## 🐛 Problem

After running `setup-sms-production.sh`, profile images stopped loading on https://l3v3lmatches.com.

**Root Cause:**
- The SMS setup script updated Cloud Run with `--update-env-vars` and `--update-secrets`
- This inadvertently reset `GCS_BUCKET_NAME` to a default/incorrect value
- Backend was looking for images in `matrimonial-images-prod` (doesn't exist)
- Actual images are in `matrimonial-uploads-matrimonial-staging` ✅

---

## ✅ Solution

Fixed by updating the Cloud Run service with correct bucket name:

```bash
gcloud run services update matrimonial-backend \
  --region=us-central1 \
  --project=matrimonial-staging \
  --update-env-vars GCS_BUCKET_NAME=matrimonial-uploads-matrimonial-staging
```

**New revision:** `matrimonial-backend-00166-cpd`

---

## 🔍 How to Diagnose

### 1. Check what bucket Cloud Run is using:
```bash
gcloud run services describe matrimonial-backend \
  --region=us-central1 \
  --project=matrimonial-staging \
  --format="value(spec.template.spec.containers[0].env)" \
  | grep "GCS_BUCKET_NAME"
```

**Expected:** `GCS_BUCKET_NAME = matrimonial-uploads-matrimonial-staging`

### 2. Check what bucket images are actually in:
```bash
# Get an image URL from a user profile
curl -s "https://matrimonial-backend-7cxoxmouuq-uc.a.run.app/api/users/profile/admin?requester=admin" \
  | python3 -m json.tool \
  | grep "images" -A2
```

**Expected:** URLs like `https://storage.googleapis.com/matrimonial-uploads-matrimonial-staging/uploads/...`

### 3. Verify bucket exists and has images:
```bash
gsutil ls gs://matrimonial-uploads-matrimonial-staging/uploads/ | head -5
```

### 4. Test direct image access:
```bash
# Pick any image URL from step 2
curl -I "https://storage.googleapis.com/matrimonial-uploads-matrimonial-staging/uploads/[image-id].png"
```

**Expected:** `HTTP/2 200`

---

## 🛡️ Prevention

### Option 1: Use Comprehensive Sync Script

Created `sync-all-env-vars.sh` to sync ALL environment variables:

```bash
cd deploy_gcp
./sync-all-env-vars.sh
```

This ensures all Cloud Run env vars match `.env.production`.

### Option 2: Update setup-sms-production.sh

Modified `setup-sms-production.sh` to preserve existing env vars:

```bash
# Instead of --update-env-vars (which can reset others)
# Use --set-env-vars to explicitly set all values
```

### Option 3: Always Verify After Deployment

After any Cloud Run update, verify critical env vars:

```bash
# Check GCS bucket
gcloud run services describe matrimonial-backend \
  --region=us-central1 --project=matrimonial-staging \
  --format="value(spec.template.spec.containers[0].env)" \
  | grep "GCS_BUCKET_NAME"

# Check SMS config
gcloud run services describe matrimonial-backend \
  --region=us-central1 --project=matrimonial-staging \
  --format="value(spec.template.spec.containers[0].env)" \
  | grep "SMS_PROVIDER\|SIMPLETEXTING"
```

---

## 📋 Critical Environment Variables

These must ALWAYS be set correctly:

### Storage
```bash
USE_GCS=true
GCS_BUCKET_NAME=matrimonial-uploads-matrimonial-staging  # ⚠️ CRITICAL
GCS_PROJECT_ID=matrimonial-staging
```

### URLs
```bash
BACKEND_URL=https://matrimonial-backend-7cxoxmouuq-uc.a.run.app
FRONTEND_URL=https://l3v3lmatches.com
APP_URL=https://l3v3lmatches.com
```

### SMS
```bash
SMS_PROVIDER=simpletexting
SIMPLETEXTING_API_TOKEN (secret)
SIMPLETEXTING_ACCOUNT_PHONE (secret)
```

### Database
```bash
MONGODB_URL (secret)
DATABASE_NAME=matrimonialDB
REDIS_URL (secret)
```

---

## 🚀 Quick Recovery Commands

If images break again:

```bash
# 1. Fix the bucket name
gcloud run services update matrimonial-backend \
  --region=us-central1 \
  --project=matrimonial-staging \
  --update-env-vars GCS_BUCKET_NAME=matrimonial-uploads-matrimonial-staging

# 2. Or sync all env vars
cd deploy_gcp
./sync-all-env-vars.sh

# 3. Verify fix
curl -s "https://l3v3lmatches.com" | grep "storage.googleapis.com/matrimonial-uploads"
```

---

## 📚 Related Files

- `.env.production` - Source of truth for all env vars
- `deploy_gcp/setup-sms-production.sh` - SMS-specific config
- `deploy_gcp/sync-all-env-vars.sh` - Comprehensive env sync
- `deploy_gcp/deploy-production.sh` - Main deployment script

---

## ✅ Verification Checklist

After deployment, verify:

- [ ] Images load on https://l3v3lmatches.com
- [ ] GCS_BUCKET_NAME = `matrimonial-uploads-matrimonial-staging`
- [ ] Backend logs show no GCS errors
- [ ] SMS still works (SMS_PROVIDER = simpletexting)
- [ ] WebSockets connected (check browser console)

---

**Last Updated:** November 16, 2025  
**Fixed By:** Correcting GCS_BUCKET_NAME in Cloud Run  
**Prevention:** Use `sync-all-env-vars.sh` for comprehensive updates
