# 🚀 Production Deployment Guide - With Encryption

**Complete guide for deploying ProfileData to Google Cloud with PII encryption**

---

## 📋 Quick Links

- **Deployment Script:** `deploy_gcp/deploy_with_encryption.sh`
- **Key Rotation Guide:** `fastapi_backend/KEY_ROTATION_GUIDE.md`
- **Encryption Guide:** `fastapi_backend/PII_ENCRYPTION_GUIDE.md`
- **Implementation Summary:** `IMPLEMENTATION_SUMMARY.md`

---

## 🎯 Deployment Scenarios

### Scenario 1: First Production Deployment (New Setup)

```bash
cd deploy_gcp

# 1. Setup encryption (first time only)
./deploy_with_encryption.sh --setup-encryption

# This will:
# - Generate new production encryption key
# - Save key to GCP Secret Manager
# - Grant access to Cloud Run service
# - Prompt you to save key in secure location

# 2. Deploy application
./deploy_with_encryption.sh

# This will:
# - Build Docker image
# - Deploy to Cloud Run
# - Mount encryption secret
# - Verify encryption is working
```

### Scenario 2: Regular Deployment (Encryption Already Setup)

```bash
cd deploy_gcp

# Just deploy (encryption already configured)
./deploy_with_encryption.sh
```

### Scenario 3: Key Rotation (Advanced)

```bash
cd deploy_gcp

# Rotate encryption key
./deploy_with_encryption.sh --rotate-key

# Then follow KEY_ROTATION_GUIDE.md for migration steps
```

---

## 🔐 First-Time Setup Walkthrough

### Step 1: Prepare Production Environment

```bash
# 1. Ensure you're logged into GCP
gcloud auth login
gcloud config set project profiledata-438623

# 2. Verify MongoDB Atlas connection
# Test connection string from .env.production

# 3. Verify Redis Cloud connection
# Test Redis URL from .env.production
```

### Step 2: Setup Encryption

```bash
cd deploy_gcp
./deploy_with_encryption.sh --setup-encryption
```

**What happens:**
1. Script generates new encryption key
2. Displays key on screen
3. **YOU MUST SAVE THIS KEY!** (password manager, vault)
4. Creates GCP Secret Manager secret
5. Grants Cloud Run access

**Expected Output:**
```
🔐 Generating new encryption key...
Generated key: abc123XYZ456...=

⚠️  CRITICAL: Save this key in a secure location NOW!
   - Password manager (1Password, LastPass)
   - Encrypted vault
   - Team secure documentation

Have you saved the key? (yes/no): yes

✅ Secret created successfully
✅ Service account access granted
```

### Step 3: Migrate Production Database

```bash
# Connect to production MongoDB and encrypt existing PII
cd fastapi_backend

# Use production MongoDB URL and new encryption key
MONGODB_URL="mongodb+srv://rajl3v3l_db_user:3F01eZUHTY9tx07u@mongocluster0.rebdf0h.mongodb.net/matrimonialDB?retryWrites=true&w=majority&appName=MongoCluster0" \
ENCRYPTION_KEY="<production-key-from-step-2>" \
python migrations/encrypt_existing_pii.py --dry-run

# If dry-run looks good, apply:
MONGODB_URL="mongodb+srv://..." \
ENCRYPTION_KEY="<production-key>" \
python migrations/encrypt_existing_pii.py

# Verify:
MONGODB_URL="mongodb+srv://..." \
ENCRYPTION_KEY="<production-key>" \
python migrations/encrypt_existing_pii.py --verify
```

### Step 4: Deploy Application

```bash
cd deploy_gcp
./deploy_with_encryption.sh
```

**What happens:**
1. Builds Docker image from source
2. Pushes to Google Container Registry
3. Deploys to Cloud Run
4. Mounts encryption key from Secret Manager
5. Verifies encryption health

**Expected Output:**
```
🚀 Deploying to Cloud Run...
✅ Deployment complete!
🔍 Verifying encryption setup...
✅ Encryption is enabled and working!

================================================
   ✅ Deployment Successful!
================================================

Service URL:
https://matrimonial-backend-7cxoxmouuq-uc.a.run.app
```

### Step 5: Verify Production

```bash
# Test encryption health endpoint
curl https://matrimonial-backend-7cxoxmouuq-uc.a.run.app/health/encryption

# Expected response:
{
  "encryption_enabled": true,
  "test_results": {
    "overall_status": "healthy",
    "round_trip": "success"
  },
  "configuration": {
    "encrypted_fields": ["contactEmail", "contactNumber", "location", "dateOfBirth", "linkedinUrl"]
  }
}
```

---

## 🔍 Health Check Endpoints

### Basic Encryption Health

```bash
GET /health/encryption
```

**Returns:**
- Encryption enabled status
- Key configuration details
- Encryption/decryption test results
- Encrypted fields list
- Recommendations

**Example:**
```bash
curl https://your-backend.run.app/health/encryption | jq
```

### Database Encryption Verification

```bash
GET /health/encryption/verify-database
```

**Returns:**
- Sample of encrypted users
- Field-by-field encryption status
- Overall encryption percentage
- Warnings if unencrypted data found

**Example:**
```bash
curl https://your-backend.run.app/health/encryption/verify-database | jq
```

---

## 🔄 Key Rotation (Advanced)

**When to rotate:**
- Every 6-12 months (scheduled)
- Security incident
- Employee offboarding
- Compliance requirement

**How to rotate:**
1. Read `KEY_ROTATION_GUIDE.md` thoroughly
2. Backup everything (database + old key)
3. Run rotation script:
   ```bash
   ./deploy_with_encryption.sh --rotate-key
   ```
4. Follow manual migration steps in guide
5. Verify rotation
6. Monitor for 24-48 hours

**See:** `fastapi_backend/KEY_ROTATION_GUIDE.md` for complete instructions

---

## 🚨 Troubleshooting

### "ENCRYPTION_KEY not found in Secret Manager"

**Problem:** First deployment without setup

**Solution:**
```bash
./deploy_with_encryption.sh --setup-encryption
```

### "Decryption failed" errors in logs

**Possible causes:**
1. Wrong encryption key (dev vs prod mismatch)
2. Data not encrypted yet (run migration)
3. Corrupted data in database

**Solution:**
```bash
# Check encryption health
curl https://your-backend.run.app/health/encryption

# Verify database
curl https://your-backend.run.app/health/encryption/verify-database

# If data not encrypted, run migration again
```

### "Permission denied" on deployment script

**Solution:**
```bash
chmod +x deploy_with_encryption.sh
```

### Deployment fails with "Secret not found"

**Check:**
```bash
# List secrets
gcloud secrets list --project=profiledata-438623

# If ENCRYPTION_KEY missing, setup again
./deploy_with_encryption.sh --setup-encryption
```

---

## 📊 Monitoring

### What to Monitor

**Cloud Run Logs:**
```bash
gcloud logging read "resource.type=cloud_run_revision" \
    --limit 50 \
    --format json \
    --project=profiledata-438623
```

**Look for:**
- `🔓 PII decrypted` - Normal operation
- `⚠️ Decryption skipped` - Encryption disabled or error
- `❌ Failed to decrypt` - Wrong key or corrupted data

### Health Check Monitoring

**Setup automated checks:**
```bash
# Cron job to check encryption health every hour
0 * * * * curl -s https://your-backend.run.app/health/encryption | jq -r '.test_results.overall_status'
```

**Alert if:**
- `encryption_enabled` = false
- `overall_status` != "healthy"
- Response timeout

---

## 🔐 Security Best Practices

### ✅ DO

1. **Different keys per environment**
   - Dev: `<dev-key>`
   - Staging: `<staging-key>`
   - Production: `<prod-key>`

2. **Backup encryption key**
   - Password manager (1Password, LastPass)
   - GCP Secret Manager (primary)
   - Team vault (shared backup)
   - Offline encrypted backup

3. **Monitor decryption errors**
   - Setup alerts in Cloud Logging
   - Review logs weekly

4. **Rotate keys regularly**
   - Schedule: Every 6-12 months
   - Follow rotation guide

5. **Use Secret Manager**
   - Never hardcode keys
   - Use GCP Secret Manager for production

### ❌ DON'T

1. **Never reuse dev key in production**
2. **Never commit keys to git**
3. **Never share keys in Slack/email**
4. **Never use same key across environments**
5. **Never disable encryption in production**

---

## 📚 File Reference

### Scripts
- `deploy_gcp/deploy_with_encryption.sh` - Deployment with encryption
- `fastapi_backend/migrations/encrypt_existing_pii.py` - Encrypt existing data
- `fastapi_backend/migrations/rotate_encryption_key.py` - Key rotation

### Documentation
- `PII_ENCRYPTION_GUIDE.md` - Complete encryption guide
- `KEY_ROTATION_GUIDE.md` - Key rotation procedures
- `IMPLEMENTATION_SUMMARY.md` - Quick reference

### Code
- `fastapi_backend/crypto_utils.py` - Encryption engine
- `fastapi_backend/config.py` - Configuration
- `fastapi_backend/routes.py` - Encrypt/decrypt logic
- `fastapi_backend/routers/system_health.py` - Health checks

---

## 🎯 Deployment Checklist

### Before First Deployment
- [ ] GCP account configured
- [ ] MongoDB Atlas connection tested
- [ ] Redis Cloud connection tested
- [ ] `.env.production` reviewed
- [ ] Encryption key generated
- [ ] Key saved in 3+ secure locations

### During Deployment
- [ ] Run `--setup-encryption` (first time only)
- [ ] Deploy application
- [ ] Run database migration
- [ ] Verify health checks pass
- [ ] Test profile updates work
- [ ] Check MongoDB for encrypted data

### After Deployment
- [ ] Monitor logs for errors
- [ ] Test user workflows
- [ ] Verify PII is encrypted
- [ ] Document encryption key location
- [ ] Schedule first key rotation (6-12 months)

---

## 🆘 Emergency Contacts

**If deployment fails:**
1. Check Cloud Run logs
2. Verify Secret Manager access
3. Test database connectivity
4. Review health check endpoints

**If data lost:**
1. **STOP** all operations
2. Restore from backup
3. Verify encryption key intact
4. Re-run migration if needed

**If key lost:**
1. **ALL ENCRYPTED DATA UNRECOVERABLE**
2. Generate new key
3. Users must re-enter PII
4. Learn lesson: BACKUP KEYS!

---

## ✅ Success Criteria

Deployment is successful when:

- [ ] Application accessible at Cloud Run URL
- [ ] `/health/encryption` returns `"overall_status": "healthy"`
- [ ] `/health/encryption/verify-database` shows encrypted data
- [ ] Users can login
- [ ] Profile updates work
- [ ] PII displays correctly (decrypted)
- [ ] MongoDB shows encrypted values (gAAAAAB...)
- [ ] No errors in Cloud Run logs
- [ ] Encryption key backed up securely

---

## 🚀 Quick Command Reference

```bash
# First-time setup
./deploy_with_encryption.sh --setup-encryption

# Regular deployment
./deploy_with_encryption.sh

# Key rotation
./deploy_with_encryption.sh --rotate-key

# Check encryption health
curl https://your-backend.run.app/health/encryption

# Verify database encryption
curl https://your-backend.run.app/health/encryption/verify-database

# View logs
gcloud logging read "resource.type=cloud_run_revision" --limit 50

# Check secret
gcloud secrets versions list ENCRYPTION_KEY --project=profiledata-438623
```

---

**Questions?** Review the guides or check Cloud Run logs for specific errors.

**Remember:** The encryption key is the KEY to your users' privacy. Protect it like the crown jewels! 👑🔐
