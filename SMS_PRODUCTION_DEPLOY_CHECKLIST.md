# SMS Production Deployment - Final Checklist

**Date:** November 16, 2025  
**Status:** ⚠️ READY - NEEDS CLOUD RUN UPDATE

---

## ✅ COMPLETED

### 1. GCP Secret Manager
- [x] `SIMPLETEXTING_API_TOKEN` created
- [x] `SIMPLETEXTING_ACCOUNT_PHONE` created  
- [x] Secrets verified in matrimonial-staging project

### 2. Code & Configuration
- [x] `.env.production` configured with Secret Manager refs
- [x] `SMS_PROVIDER=simpletexting` set
- [x] SimpleTexting service implemented (`simpletexting_service.py`)
- [x] SMS OTP integration complete
- [x] MFA SMS support added
- [x] Opt-out sync configured

### 3. Local Testing
- [x] SMS sending verified locally
- [x] Test script works: `test_sms_to_admin.py`
- [x] Phone number subscribed: (203) 216-5623

---

## ⚠️ ACTION REQUIRED BEFORE DEPLOYMENT

### Step 1: Update Cloud Run Service Configuration

**Current Issue:** Cloud Run service needs SMS environment variables added.

**Add these environment variables:**

```bash
gcloud run services update profiledata-backend \
  --region=us-central1 \
  --project=matrimonial-staging \
  --update-env-vars SMS_PROVIDER=simpletexting \
  --update-secrets SIMPLETEXTING_API_TOKEN=SIMPLETEXTING_API_TOKEN:latest,SIMPLETEXTING_ACCOUNT_PHONE=SIMPLETEXTING_ACCOUNT_PHONE:latest
```

### Step 2: Verify Secret Manager Permissions

```bash
# Get service account
SERVICE_ACCOUNT=$(gcloud run services describe profiledata-backend \
  --region=us-central1 \
  --project=matrimonial-staging \
  --format='value(spec.template.spec.serviceAccountName)')

# Verify access to SMS secrets
gcloud secrets get-iam-policy SIMPLETEXTING_API_TOKEN --project=matrimonial-staging | grep "$SERVICE_ACCOUNT"
gcloud secrets get-iam-policy SIMPLETEXTING_ACCOUNT_PHONE --project=matrimonial-staging | grep "$SERVICE_ACCOUNT"
```

**If no output, grant access:**

```bash
gcloud secrets add-iam-policy-binding SIMPLETEXTING_API_TOKEN \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/secretmanager.secretAccessor" \
  --project=matrimonial-staging

gcloud secrets add-iam-policy-binding SIMPLETEXTING_ACCOUNT_PHONE \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/secretmanager.secretAccessor" \
  --project=matrimonial-staging
```

---

## 🧪 POST-DEPLOYMENT TESTING

### 1. Verify Environment Variables Loaded

```bash
# Check Cloud Run logs after deployment
gcloud run services logs read profiledata-backend \
  --region=us-central1 \
  --project=matrimonial-staging \
  --limit=50 | grep -i "simpletexting\|sms"
```

**Expected:** `✅ SimpleTexting SMS Service initialized (Phone: 83386***)`

### 2. Test SMS MFA Login

1. Go to https://l3v3lmatches.com/login
2. Login with user that has SMS MFA enabled
3. Verify SMS code is received
4. Check SimpleTexting dashboard for delivery status

### 3. Test OTP Verification

1. Trigger email verification flow
2. Choose SMS verification
3. Verify SMS code is received
4. Complete verification

### 4. Check SimpleTexting Dashboard

**URL:** https://app2.simpletexting.com/

- [ ] Messages sent successfully
- [ ] No delivery failures
- [ ] Phone number still subscribed (not opted out)

---

## 🔧 TROUBLESHOOTING COMMANDS

### Check if SMS service is loaded:

```bash
# View recent Cloud Run logs
gcloud run services logs read profiledata-backend \
  --region=us-central1 \
  --project=matrimonial-staging \
  --limit=100 | grep -E "SMS|SimpleTexting"
```

### Test SMS from production:

```python
# SSH into Cloud Run instance or use Cloud Shell
curl -X POST https://api.l3v3lmatches.com/test-sms \
  -H "Content-Type: application/json" \
  -d '{"phone": "2032165623", "message": "Test from production"}'
```

### Verify Secret values:

```bash
gcloud secrets versions access latest \
  --secret=SIMPLETEXTING_API_TOKEN \
  --project=matrimonial-staging

gcloud secrets versions access latest \
  --secret=SIMPLETEXTING_ACCOUNT_PHONE \
  --project=matrimonial-staging
```

---

## 📋 DEPLOYMENT COMMAND

Once Cloud Run is updated with SMS env vars, deploy normally:

```bash
cd deploy_gcp
./deploy-production.sh
# Choose option 3 (Both) or 1 (Backend only)
```

---

## 🚨 CRITICAL CONFIGURATION

**SimpleTexting Account Phone:** (833) 861-1131  
**Test Phone Number:** (203) 216-5623  
**API Token:** `43339a928aa050c78570a4cab404c396`  
**Provider:** SimpleTexting (not Twilio)  

---

## ✅ FINAL CHECKLIST

Before deploying to production:

- [ ] Run Step 1: Update Cloud Run with SMS env vars
- [ ] Run Step 2: Verify Secret Manager permissions
- [ ] Deploy backend using `./deploy-production.sh`
- [ ] Check logs for "SimpleTexting SMS Service initialized"
- [ ] Test SMS MFA login
- [ ] Test OTP verification
- [ ] Monitor SimpleTexting dashboard for 24 hours

---

## 📞 SUPPORT

**SimpleTexting Dashboard:** https://app2.simpletexting.com/  
**Account Phone:** (833) 861-1131  
**Test Phone:** (203) 216-5623  

**Related Docs:**
- `fastapi_backend/SMS_DEPLOYMENT_CHECKLIST.md`
- `fastapi_backend/SIMPLETEXTING_INTEGRATION.md`
- `fastapi_backend/SMS_OPT_OUT_SYNC.md`
