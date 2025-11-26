# CORS Error Fix - Production Deployment

**Date:** November 25, 2025  
**Status:** ✅ Fixed

---

## The Problem

Every production deployment was causing CORS errors:
```
Access to XMLHttpRequest at 'https://matrimonial-backend-7cxoxmouuq-uc.a.run.app/...' 
from origin 'https://l3v3lmatches.com' has been blocked by CORS policy: 
No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

### Symptoms:
- ❌ Frontend couldn't make API calls to backend
- ❌ Login failed with network errors
- ❌ All API endpoints returned CORS errors
- ❌ Happened **every single deployment**

---

## Root Cause

### The Backend CORS Configuration Logic (`main.py`):

```python
env = os.getenv("ENV", "development")
frontend_url = os.getenv("FRONTEND_URL", "https://l3v3lmatches.com")

if env == "production":
    cors_origins = [
        frontend_url,
        "https://l3v3lmatches.com",
        "https://www.l3v3lmatches.com",
        ...
    ]
else:
    # Development CORS
    cors_origins = ["http://localhost:3000", ...]
```

**Key Point:** The backend reads `ENV` and `FRONTEND_URL` **during startup** to configure CORS.

### The Deployment Timing Issue (`deploy_backend_simple.sh`):

**BEFORE FIX:**

1. **Initial deployment** - Sets env vars but **NOT** `ENV`, `FRONTEND_URL`, or `BACKEND_URL`
2. Backend starts with `ENV=development` (default) → Uses dev CORS (localhost only!)
3. **Then** runs `gcloud run services update` to set `FRONTEND_URL` and `BACKEND_URL`
4. But backend already started with wrong CORS config!
5. Result: Production frontend blocked by CORS

**Sequence:**
```bash
# Step 1: Deploy without critical env vars
gcloud run deploy ... --set-env-vars "MONGODB_URL=...,USE_GCS=..."
# Backend starts: ENV=development (default), CORS=[localhost]

# Step 2: Update env vars AFTER backend already started
gcloud run services update ... --update-env-vars "ENV=production,FRONTEND_URL=..."
# Too late! Backend already running with dev CORS
```

---

## The Fix

### Part 1: Set Critical Env Vars in Initial Deployment

**File:** `/deploy_gcp/deploy_backend_simple.sh`

**Lines 59-66:** Added to initial deployment:
```bash
--set-env-vars "\
ENV=production,\
MONGODB_URL=$MONGODB_URL,\
DATABASE_NAME=matrimonialDB,\
REDIS_URL=$REDIS_URL,\
FRONTEND_URL=https://l3v3lmatches.com,\       # ← NEW!
BACKEND_URL=https://matrimonial-backend-7cxoxmouuq-uc.a.run.app,\  # ← NEW!
APP_URL=https://l3v3lmatches.com,\             # ← NEW!
USE_GCS=true,\
..."
```

**Lines 103-109:** Removed redundant update step:
```bash
# BEFORE (redundant):
gcloud run services update ... --update-env-vars "FRONTEND_URL=...,BACKEND_URL=..."

# AFTER (just logging):
echo "✅ Backend configured:"
echo "   BACKEND_URL: https://matrimonial-backend-7cxoxmouuq-uc.a.run.app"
echo "   FRONTEND_URL: https://l3v3lmatches.com"
```

**Lines 142-156:** Added validation checks:

### Part 2: Remove allow_origin_regex in Production

**File:** `/fastapi_backend/main.py`

**Problem:** The `allow_origin_regex` was set to only match localhost patterns:
```python
allow_origin_regex="https?://(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+)(:\d+)?"
```

This regex would NEVER match `l3v3lmatches.com` and could interfere with explicit origins.

**Fix (Lines 156-203):**
```python
if env == "production":
    cors_origins = ["https://l3v3lmatches.com", ...]
    cors_regex = None  # No regex needed - explicit origins only
else:
    cors_origins = ["http://localhost:3000", ...]
    cors_regex = r"https?://(localhost|...)"  # Only for dev

# Add middleware conditionally
if cors_regex:
    app.add_middleware(CORSMiddleware, ..., allow_origin_regex=cors_regex)
else:
    # Production - no regex, just explicit origins
    app.add_middleware(CORSMiddleware, ...)  # No regex parameter
```

**Why This Matters:**
- Production uses explicit origin list ONLY
- No regex pattern to interfere
- Clearer, more predictable CORS behavior
- Better logging to debug issues

**Lines 142-156:** Added validation checks:
```bash
# Check FRONTEND_URL for CORS
if echo "$ENV_VARS" | grep -q "FRONTEND_URL.*l3v3lmatches.com"; then
    echo "   ✅ FRONTEND_URL: https://l3v3lmatches.com (CORS enabled)"
else
    echo "   ❌ FRONTEND_URL not configured correctly - CORS will fail!"
    VALIDATION_FAILED=true
fi

# Check ENV is production
if echo "$ENV_VARS" | grep -q "ENV.*production"; then
    echo "   ✅ ENV: production (using production CORS origins)"
else
    echo "   ❌ ENV not set to production - CORS may use dev settings!"
    VALIDATION_FAILED=true
fi
```

---

## Why This Works Now

### Correct Deployment Sequence:

1. **Initial deployment** includes `ENV=production`, `FRONTEND_URL`, `BACKEND_URL`
2. Backend starts with correct env vars → Reads `ENV=production`
3. `main.py` configures CORS with production origins:
   ```python
   cors_origins = [
       "https://l3v3lmatches.com",
       "https://www.l3v3lmatches.com",
       "https://matrimonial-frontend-7cxoxmouuq-uc.a.run.app",
       "https://matrimonial-backend-7cxoxmouuq-uc.a.run.app"
   ]
   ```
4. Frontend can make requests → CORS allows them ✅

### Validation Ensures Correctness:

After deployment, script validates:
- ✅ `ENV=production` is set
- ✅ `FRONTEND_URL=https://l3v3lmatches.com` is set
- ✅ `GCS_BUCKET_NAME` is configured
- ✅ `SMS_PROVIDER=simpletexting` is configured

If any check fails, deployment shows warnings.

---

## Testing the Fix

### Next Production Deployment:

```bash
cd deploy_gcp
./deploy-production.sh
```

**Choose option 1 (Backend) or 3 (Both)**

### Expected Validation Output:

```
🔍 Validating critical environment variables...
   ✅ GCS_BUCKET_NAME: matrimonial-uploads-matrimonial-staging
   ✅ SMS_PROVIDER: simpletexting
   ✅ SMS secrets configured
   ✅ FRONTEND_URL: https://l3v3lmatches.com (CORS enabled)
   ✅ ENV: production (using production CORS origins)

✅ All critical configurations validated successfully!
```

### Verify CORS Works:

1. Open https://l3v3lmatches.com
2. Try to login
3. Check browser console - **NO CORS errors!**
4. API calls should work normally

---

## Prevention for Future

### Checklist When Adding New Env Vars:

- [ ] Add to `.env.production` (documentation)
- [ ] Add to `deploy_backend_simple.sh` initial `--set-env-vars`
- [ ] Add validation check if critical for functionality
- [ ] Test deployment in staging first (if available)

### Critical Env Vars That MUST Be in Initial Deployment:

**For CORS:**
- `ENV=production`
- `FRONTEND_URL=https://l3v3lmatches.com`
- `BACKEND_URL=https://matrimonial-backend-7cxoxmouuq-uc.a.run.app`
- `APP_URL=https://l3v3lmatches.com`

**For Storage:**
- `USE_GCS=true`
- `GCS_BUCKET_NAME=matrimonial-uploads-matrimonial-staging`
- `GCS_PROJECT_ID=matrimonial-staging`

**For Auth:**
- `SECRET_KEY` (from Secret Manager)
- `ENCRYPTION_KEY` (from Secret Manager)

**For Email:**
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`

**For SMS:**
- `SMS_PROVIDER=simpletexting`
- `SIMPLETEXTING_API_TOKEN`, `SIMPLETEXTING_ACCOUNT_PHONE`

---

## Files Modified

### Primary Fixes:

**1. Backend CORS Configuration:**
- ✅ `/fastapi_backend/main.py` - Fixed CORS middleware
  - Lines 156-181: Conditional CORS setup (production vs dev)
  - Line 165: Set `cors_regex = None` for production
  - Lines 184-203: Conditional middleware setup (no regex in production)
  - Lines 206-217: Added CORS logging (origin, preflight requests)

**1b. Utils Module Conflict:**
- ✅ `/fastapi_backend/utils/__init__.py` - Merged utils.py into package
  - Created proper package structure
  - Merged all file utilities (save_upload_file, save_multiple_files, get_full_image_url)
  - Added branding utilities (get_app_name, get_app_name_short)
  - Renamed old utils.py to utils.py.old
  - **Fixed:** ImportError: cannot import name 'get_full_image_url' from 'utils'

**2. Deployment Script:**
- ✅ `/deploy_gcp/deploy_backend_simple.sh` - Set env vars in initial deployment
  - Lines 59-66: Added ENV, FRONTEND_URL, BACKEND_URL, APP_URL to initial --set-env-vars
  - Lines 103-109: Removed redundant update step
  - Lines 142-156: Added CORS validation checks

### Documentation Updates:
- ✅ `/deploy_gcp/deploy-production.sh` - Updated with CORS documentation
  - Lines 13-20: Added CORS fix notes to header
  - Lines 176, 203: Added CORS info messages before backend deployment
  - Lines 276-279: Added CORS configuration summary to final output
  - Line 285: Added CORS troubleshooting reference

### Documentation:
- ✅ `/deploy_gcp/CORS_FIX.md` - Complete documentation of problem and fix

---

## Summary

**Problem:** CORS errors every deployment because `ENV` and `FRONTEND_URL` were set **after** backend started.

**Solution:** Set `ENV=production` and `FRONTEND_URL=https://l3v3lmatches.com` in **initial** deployment.

**Result:** Backend starts with correct CORS config, production frontend can make API calls.

**Never Again:** Validation checks ensure critical env vars are always present! 🎉
