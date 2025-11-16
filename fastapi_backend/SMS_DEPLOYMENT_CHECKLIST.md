# SMS Configuration Deployment Checklist

**Date:** November 15, 2025  
**Status:** ✅ CONFIGURED FOR ALL ENVIRONMENTS

---

## 📋 Environment Files Updated

| File | Status | Purpose |
|------|--------|---------|
| `.env` | ✅ | Main environment file |
| `.env.local` | ✅ | Local development |
| `.env.production` | ✅ | Production deployment |
| `.env.example` | ✅ | Documentation/template |

---

## 🔐 SimpleTexting Credentials

### Current Configuration
```bash
SIMPLETEXTING_API_TOKEN=43339a928aa050c78570a4cab404c396
SIMPLETEXTING_ACCOUNT_PHONE=8338611131
```

### How to Get Credentials
1. Go to: https://app2.simpletexting.com/
2. Navigate to: **API & Webhooks** section
3. Copy **API Token**
4. Note your **Account Phone Number** (833-861-1131)

---

## 🚀 Deployment Instructions

### Local Development (Already Configured ✅)

File: `.env.local`
```bash
SMS_PROVIDER=simpletexting
SIMPLETEXTING_API_TOKEN=43339a928aa050c78570a4cab404c396
SIMPLETEXTING_ACCOUNT_PHONE=8338611131
```

**Test:** Run `python3 test_sms_to_admin.py` to verify SMS sending works.

---

### Production Deployment (GCP Cloud Run)

#### Step 1: Add Secrets to GCP Secret Manager

```bash
# Add SimpleTexting API Token
gcloud secrets create SIMPLETEXTING_API_TOKEN \
  --data-file=- <<EOF
43339a928aa050c78570a4cab404c396
EOF

# Add SimpleTexting Account Phone
gcloud secrets create SIMPLETEXTING_ACCOUNT_PHONE \
  --data-file=- <<EOF
8338611131
EOF
```

#### Step 2: Grant Secret Access to Cloud Run Service

```bash
# Get service account email
SERVICE_ACCOUNT=$(gcloud run services describe profiledata-backend \
  --region=us-central1 \
  --format='value(spec.template.spec.serviceAccountName)')

# Grant access to secrets
gcloud secrets add-iam-policy-binding SIMPLETEXTING_API_TOKEN \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding SIMPLETEXTING_ACCOUNT_PHONE \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/secretmanager.secretAccessor"
```

#### Step 3: Update Cloud Run Service

File: `.env.production` is already configured to load from Secret Manager:
```bash
SIMPLETEXTING_API_TOKEN=${SIMPLETEXTING_API_TOKEN}
SIMPLETEXTING_ACCOUNT_PHONE=${SIMPLETEXTING_ACCOUNT_PHONE}
```

Cloud Run YAML should include:
```yaml
env:
  - name: SMS_PROVIDER
    value: "simpletexting"
  - name: SIMPLETEXTING_API_TOKEN
    valueFrom:
      secretKeyRef:
        name: SIMPLETEXTING_API_TOKEN
        key: latest
  - name: SIMPLETEXTING_ACCOUNT_PHONE
    valueFrom:
      secretKeyRef:
        name: SIMPLETEXTING_ACCOUNT_PHONE
        key: latest
```

#### Step 4: Deploy

```bash
gcloud run deploy profiledata-backend \
  --source . \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated
```

---

## 🧪 Testing Checklist

### Local Testing
- [ ] Backend starts without errors
- [ ] Test script sends SMS: `python3 test_sms_to_admin.py`
- [ ] SMS received on phone (203) 216-5623
- [ ] Login with SMS MFA works
- [ ] OTP verification with SMS works

### Production Testing
- [ ] Backend deploys successfully
- [ ] Environment variables loaded from Secret Manager
- [ ] SMS MFA sends messages
- [ ] SMS OTP verification sends messages
- [ ] Opt-out sync works (user texts STOP)
- [ ] Check SimpleTexting dashboard for delivery status

---

## 📊 Configuration Summary

### All Environments

```bash
# SMS Provider Selection
SMS_PROVIDER=simpletexting  # Primary provider

# SimpleTexting (Active)
SIMPLETEXTING_API_TOKEN=43339a928aa050c78570a4cab404c396
SIMPLETEXTING_ACCOUNT_PHONE=8338611131  # (833) 861-1131

# Twilio (Backup - not configured yet)
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM_PHONE=
```

---

## 🔧 Troubleshooting

### Issue: "SimpleTexting SMS Service disabled"

**Cause:** Environment variables not loaded

**Fix:**
```bash
# Check if variables are set
echo $SIMPLETEXTING_API_TOKEN
echo $SIMPLETEXTING_ACCOUNT_PHONE

# For local: Restart backend to reload .env.local
# For production: Check Secret Manager permissions
```

### Issue: SMS not received

**Possible causes:**
1. **Phone opted out** → Check SimpleTexting Contacts dashboard
2. **Invalid phone format** → Must be 10 digits (no +1)
3. **API rate limit** → Check SimpleTexting usage dashboard
4. **Carrier blocking** → Check if carrier allows toll-free SMS

**Debug:**
```bash
# Test directly
python3 test_sms_to_admin.py

# Check backend logs
# Look for "SimpleTexting API error" messages
```

### Issue: 409 OPT_OUT error

**Cause:** Phone number has unsubscribed

**Fix:**
1. Text **START** to (833) 861-1131 from the phone
2. Or re-subscribe in SimpleTexting dashboard
3. Our opt-out sync will update `smsOptIn` to `false` automatically

---

## 📱 SimpleTexting Dashboard

**URL:** https://app2.simpletexting.com/

### Monitor These:
- **Contacts** → Verify phone numbers are subscribed
- **Messages** → View sent message history
- **API & Webhooks** → Check API token status
- **Usage** → Monitor SMS quota

---

## 🔄 Maintenance

### Monthly Tasks
- [ ] Check SimpleTexting usage/billing
- [ ] Review opt-out rate in dashboard
- [ ] Rotate API token (if needed)
- [ ] Verify Secret Manager access

### Quarterly Tasks
- [ ] Review SMS delivery rates
- [ ] Update phone number list if needed
- [ ] Test failover to Twilio (if configured)
- [ ] Review and update documentation

---

## 📚 Related Documentation

- `SIMPLETEXTING_INTEGRATION.md` → Full API integration guide
- `SMS_OPT_OUT_SYNC.md` → Opt-out handling system
- `MULTI_PROFILE_MFA_SOLUTION.md` → Multi-profile MFA support
- `QUICK_START_SIMPLETEXTING.md` → Quick setup guide

---

## ✅ Status: READY FOR PRODUCTION

All environment files are configured and tested. SMS sending works in local development.

**Next steps for production:**
1. Add secrets to GCP Secret Manager
2. Update Cloud Run service configuration
3. Deploy and test

**Contact phone for testing:** (203) 216-5623  
**SimpleTexting account phone:** (833) 861-1131  
**Status:** Subscribed ✅
