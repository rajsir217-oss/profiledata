# Production Deployment Guide - Bulk Invitation System

## Summary
This guide covers deploying the new bulk invitation system to production, including:
- ✅ Backend API changes (bulk send endpoint)
- ✅ Frontend UI updates (bulk selection, email subject editing)
- ✅ Database schema updates (emailSubject, comments fields)
- ✅ Import 367 invitations from Excel files

## Pre-Deployment Steps

### 1. Verify Local Changes
```bash
cd /Users/rajsiripuram02/opt/appsrc/profiledata

# Check modified files
git status

# Key files changed:
# - fastapi_backend/routers/invitations.py (bulk send endpoint)
# - fastapi_backend/services/email_sender.py (custom email subject)
# - fastapi_backend/models/invitation_models.py (new fields)
# - fastapi_backend/requirements.txt (openpyxl added)
# - frontend/src/components/InvitationManager.js (bulk UI)
```

### 2. Upload Excel Files to GCS
```bash
# Upload data files to Google Cloud Storage
gsutil cp data_migration/girls_list.xlsx gs://matrimonial-staging-data/invitations/
gsutil cp data_migration/boys_List.xlsx gs://matrimonial-staging-data/invitations/
```

## Deployment Steps

### Step 1: Deploy Backend
```bash
cd deploy_gcp
./deploy-production.sh
```

This will:
- Deploy updated backend code to Cloud Run
- Install openpyxl dependency
- Update environment variables
- Restart backend service

### Step 2: Deploy Frontend
Frontend is deployed automatically with backend, but verify:
```bash
# Check frontend is deployed
gcloud run services describe matrimonial-frontend \
  --project=matrimonial-staging \
  --region=us-central1
```

### Step 3: Run Data Import in Production

**Option A: Via Cloud Run Job**
```bash
# Create a one-time job to import data
gcloud run jobs create import-invitations \
  --image=gcr.io/matrimonial-staging/matrimonial-backend \
  --region=us-central1 \
  --project=matrimonial-staging \
  --execute-now \
  --command="python,migrations/import_invitation_data.py"
```

**Option B: Via Cloud Shell**
```bash
# Connect to production database from Cloud Shell
gcloud auth login
gcloud config set project matrimonial-staging

# Download files from GCS
gsutil cp gs://matrimonial-staging-data/invitations/*.xlsx /tmp/

# Run import script locally connecting to production DB
cd /tmp
git clone https://github.com/your-repo/profiledata.git
cd profiledata/fastapi_backend
pip install -r requirements.txt
python migrations/import_invitation_data.py
```

**Option C: Manual Via MongoDB**
If the script doesn't work in Cloud Run, you can import via MongoDB directly.

## Post-Deployment Verification

### 1. Test Bulk Invitation UI
1. Go to https://l3v3lmatches.com/invitations
2. Login as admin
3. Verify 367 invitations are visible
4. Check bulk selection works
5. Test sending 1-2 invitations

### 2. Verify Data Fields
```bash
# Check invitations have correct fields
mongo "mongodb+srv://production-cluster" --eval "
  db.invitations.findOne({}, {
    emailSubject: 1,
    comments: 1,
    emailStatus: 1
  })
"
```

Should show:
```json
{
  "emailSubject": "You're Invited to Join USVedika for US Citizens & GC Holders",
  "comments": "Male" or "Female",
  "emailStatus": "pending"
}
```

### 3. Test Bulk Send
1. Select 2-3 invitations
2. Click "Send Selected"
3. Verify emails are sent
4. Check status changes to "sent"

## Rollback Plan

If issues occur:

### 1. Revert Backend
```bash
# Deploy previous version
gcloud run services update matrimonial-backend \
  --image=gcr.io/matrimonial-staging/matrimonial-backend:previous \
  --project=matrimonial-staging \
  --region=us-central1
```

### 2. Remove Imported Invitations
```bash
# Delete pending invitations (if needed)
db.invitations.deleteMany({
  emailStatus: "pending",
  createdAt: { $gte: ISODate("2025-11-28T00:00:00Z") }
})
```

## Known Issues & Fixes Applied

### 1. Invalid Email Addresses
**Issue:** Some emails had trailing periods or commas
**Fix:** Applied in production via:
```bash
python fix_invalid_emails.py
python fix_multi_emails.py
```

### 2. Invalid SMS Status
**Issue:** Some invitations had `smsStatus: "not_sent"` which isn't in enum
**Fix:** Applied via:
```bash
python fix_sms_status.py
```

### 3. Missing Model Fields
**Issue:** InvitationDB model missing emailSubject, comments
**Fix:** Updated models/invitation_models.py (deployed)

## Success Criteria

- ✅ 367 invitations imported with status "pending"
- ✅ All invitations have emailSubject and comments fields
- ✅ Bulk selection works in UI
- ✅ Email sending with custom subject works
- ✅ No validation errors when loading invitations
- ✅ "View more" pagination works correctly

## Support

If issues arise:
1. Check Cloud Run logs: `gcloud run services logs read matrimonial-backend`
2. Check frontend logs in browser console
3. Verify MongoDB connection and data
4. Review CORS settings if frontend can't reach backend
