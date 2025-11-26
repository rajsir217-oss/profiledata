# Production Deployment Checklist

**Last Updated:** November 25, 2025

---

## Before Deploying

### 1. Check Local Changes
```bash
git status
# Make sure all changes are committed
```

### 2. Test Locally (Optional but Recommended)
```bash
cd fastapi_backend
./bstart.sh
# Verify backend starts without errors
```

---

## Deploy to Production

### Simple: Run Main Script
```bash
cd deploy_gcp
./deploy-production.sh
```

**Choose:**
- **Option 1:** Backend only (if only backend changes)
- **Option 2:** Frontend only (if only frontend changes)  
- **Option 3:** Both (recommended for safety)

---

## What Gets Deployed (Backend)

### ✅ Auto-Deployed
1. **All Python code** in `/fastapi_backend/`
2. **Environment variables:**
   - `ENV=production`
   - `FRONTEND_URL=https://l3v3lmatches.com`
   - `BACKEND_URL=https://matrimonial-backend-7cxoxmouuq-uc.a.run.app`
   - All database, storage, email, SMS configs
3. **CORS configuration** (production mode, no regex)
4. **Notification templates** (runs `update_pii_granted_template.py`)

### ⚠️ NOT Auto-Deployed
- **Secrets** (must be set in Google Secret Manager):
  - `SECRET_KEY`
  - `ENCRYPTION_KEY`
  - `SMTP_USER`, `SMTP_PASSWORD`
  - `SIMPLETEXTING_API_TOKEN`, `SIMPLETEXTING_ACCOUNT_PHONE`

---

## Post-Deployment Verification

### 1. Check Deployment Logs
```bash
# Should show:
✅ All critical configurations validated successfully!
```

### 2. Verify Backend Started
```bash
gcloud run services logs read matrimonial-backend \
  --region us-central1 \
  --limit 20 \
  --project matrimonial-staging
```

**Look for:**
```
🔒 Production CORS enabled for: ['https://l3v3lmatches.com', ...]
✅ Successfully connected to MongoDB
✅ Redis connected successfully
[INFO] Starting gunicorn
```

**Should NOT see:**
```
[ERROR] Worker failed to boot
ModuleNotFoundError
ImportError
```

### 3. Test Login
1. Open https://l3v3lmatches.com/login
2. Try logging in
3. **Should work!** No CORS errors in browser console

### 4. Check Browser Console
Press F12 → Console tab

**Should NOT see:**
- ❌ CORS errors
- ❌ `Access to XMLHttpRequest blocked by CORS policy`
- ❌ Network errors on `/api/users/login`

**Should see:**
- ✅ Successful login requests (status 200)
- ✅ Token stored in localStorage

---

## Common Issues & Fixes

### Issue: CORS Errors Still Happening

**Check:**
```bash
# 1. Verify ENV is production
gcloud run services describe matrimonial-backend \
  --region us-central1 \
  --format="value(spec.template.spec.containers[0].env)" | grep ENV

# Should show: ENV=production

# 2. Check backend logs
gcloud run services logs read matrimonial-backend \
  --region us-central1 \
  --limit 50 | grep CORS

# Should show: Production CORS enabled for: ['https://l3v3lmatches.com', ...]
```

**If wrong:**
```bash
# Redeploy
cd deploy_gcp
./deploy_backend_simple.sh
```

---

### Issue: Backend Won't Start

**Check logs:**
```bash
gcloud run services logs read matrimonial-backend \
  --region us-central1 \
  --limit 100 | grep -i error
```

**Common errors:**

1. **ModuleNotFoundError: No module named 'utils.branding'**
   - **Fix:** Check `utils/__init__.py` exists
   - **Fix:** Rename `utils.py` to `utils.py.old`

2. **ImportError: cannot import name 'get_full_image_url'**
   - **Fix:** Merge `utils.py` into `utils/__init__.py`

3. **Worker failed to boot**
   - **Fix:** Check for Python syntax errors in recently changed files

---

### Issue: Template Variables Not Working

**Example:** Email shows `{match.firstName}` instead of actual name

**Check:**
```bash
# Verify template was updated
cd fastapi_backend
python3 update_pii_granted_template.py

# Should show:
# ✅ Updated pii_granted template successfully!
```

**If not updated:**
- Template update runs AFTER backend deployment
- Check `deploy-production.sh` includes template update step (line 186-188)

---

## Files That Were Fixed

### Backend
- ✅ `main.py` - CORS config (no regex in production)
- ✅ `utils/__init__.py` - Merged utils.py, added branding
- ✅ `utils/branding.py` - Reads whitelabel.json
- ✅ `services/event_dispatcher.py` - Template variable fixes
- ✅ `job_templates/email_notifier_template.py` - Branding
- ✅ `job_templates/sms_notifier_template.py` - Branding
- ✅ `job_templates/email_notification.py` - Branding
- ✅ `services/email_otp_service.py` - Branding

### Deployment
- ✅ `deploy_backend_simple.sh` - ENV vars in initial deployment
- ✅ `deploy-production.sh` - Template updates, CORS docs

### Documentation
- ✅ `CORS_FIX.md` - Complete CORS fix documentation
- ✅ `DEPLOYMENT_CHECKLIST.md` - This file

---

## Quick Reference

### Deploy Backend Only
```bash
cd deploy_gcp
./deploy-production.sh
# Choose: 1
```

### Deploy Both Backend + Frontend
```bash
cd deploy_gcp
./deploy-production.sh
# Choose: 3
```

### Check Backend Status
```bash
gcloud run services describe matrimonial-backend \
  --region us-central1 \
  --format="value(status.url,status.conditions[0].type)"
```

### View Recent Logs
```bash
gcloud run services logs read matrimonial-backend \
  --region us-central1 \
  --limit 50
```

### Check Environment Variables
```bash
gcloud run services describe matrimonial-backend \
  --region us-central1 \
  --format="value(spec.template.spec.containers[0].env)"
```

---

## Emergency Rollback

If deployment breaks production:

```bash
# 1. List recent revisions
gcloud run revisions list \
  --service matrimonial-backend \
  --region us-central1 \
  --limit 5

# 2. Rollback to previous revision
gcloud run services update-traffic matrimonial-backend \
  --region us-central1 \
  --to-revisions=matrimonial-backend-00199-jss=100

# Replace with actual working revision number
```

---

## Success Criteria

✅ **Deployment successful if:**
1. Validation shows: `✅ All critical configurations validated successfully!`
2. Backend logs show: `🔒 Production CORS enabled for: ['https://l3v3lmatches.com', ...]`
3. Login works at https://l3v3lmatches.com
4. No CORS errors in browser console
5. Backend worker starts without errors

🎉 **Production is healthy!**
