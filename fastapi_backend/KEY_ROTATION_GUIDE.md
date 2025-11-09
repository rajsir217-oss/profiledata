# 🔄 Encryption Key Rotation Guide

**CRITICAL: Key rotation is a complex operation. Follow these steps exactly.**

---

## 🚨 When to Rotate Keys

Rotate your encryption key when:
- ✅ **Scheduled rotation** (recommended: every 6-12 months)
- ✅ **Security incident** (key potentially compromised)
- ✅ **Employee offboarding** (someone with key access leaves)
- ✅ **Compliance requirement** (GDPR, HIPAA, etc.)

**DO NOT rotate keys casually** - it requires careful planning!

---

## 📋 Pre-Rotation Checklist

Before starting, ensure you have:

- [ ] **Full database backup** (critical - allows rollback)
- [ ] **Current encryption key** (saved securely)
- [ ] **Maintenance window** (2-4 hours recommended)
- [ ] **Rollback plan** documented
- [ ] **Team notification** sent
- [ ] **Monitoring alerts** configured
- [ ] **Production access** (database, GCP, Cloud Run)

---

## 🔐 Rotation Strategy

### Option A: Zero-Downtime Rotation (Recommended)

**Best for:** Production systems with active users

**Process:**
1. Add new encryption key alongside old key
2. Decrypt data with old key
3. Re-encrypt data with new key
4. Switch to new key
5. Remove old key

### Option B: Maintenance Window Rotation

**Best for:** Systems that can afford downtime

**Process:**
1. Schedule maintenance window
2. Stop application
3. Decrypt all data with old key
4. Encrypt all data with new key
5. Update application with new key
6. Start application

---

## 🛠️ Step-by-Step: Zero-Downtime Rotation

### **Phase 1: Preparation (Before Maintenance)**

#### 1. Backup Everything

```bash
# Backup MongoDB
mongodump --uri="mongodb+srv://..." --out=/backup/pre-rotation-$(date +%Y%m%d)

# Backup encryption key
echo "OLD_KEY: <current-key>" > /secure/backup/encryption-keys-$(date +%Y%m%d).txt
chmod 600 /secure/backup/encryption-keys-$(date +%Y%m%d).txt
```

#### 2. Generate New Key

```bash
cd fastapi_backend
python crypto_utils.py

# Save output:
# NEW_KEY: abc123...XYZ=
```

**⚠️ Save new key in:**
- Password manager
- Encrypted backup
- Team vault

#### 3. Test Rotation Locally

```bash
# Use test database
MONGODB_URL="mongodb://localhost:27017/test_rotation" \
ENCRYPTION_KEY_OLD="<old-key>" \
ENCRYPTION_KEY_NEW="<new-key>" \
python migrations/rotate_encryption_key.py --dry-run
```

---

### **Phase 2: Execution (During Maintenance)**

#### 4. Add New Key to Secret Manager

```bash
# Create new version (keeps old version active)
echo -n "<new-key>" | gcloud secrets versions add ENCRYPTION_KEY \
    --data-file=- \
    --project=profiledata-438623
```

#### 5. Update Application to Support Dual Keys

Temporarily update `crypto_utils.py` to handle both keys:

```python
# Temporary dual-key support
OLD_KEY = settings.encryption_key_old  # From old secret version
NEW_KEY = settings.encryption_key      # From new secret version

def decrypt(self, encrypted_data):
    # Try new key first
    try:
        return self.cipher_new.decrypt(encrypted_data.encode('utf-8')).decode('utf-8')
    except:
        # Fall back to old key
        return self.cipher_old.decrypt(encrypted_data.encode('utf-8')).decode('utf-8')
```

#### 6. Deploy Updated Application

```bash
cd deploy_gcp
./deploy_with_encryption.sh  # Deploys with dual-key support
```

#### 7. Run Re-Encryption Migration

```bash
# This script decrypts with OLD key, encrypts with NEW key
cd fastapi_backend

# Preview
ENCRYPTION_KEY_OLD="<old-key>" \
ENCRYPTION_KEY_NEW="<new-key>" \
python migrations/rotate_encryption_key.py --dry-run

# Execute (use production DB URL)
MONGODB_URL="mongodb+srv://..." \
ENCRYPTION_KEY_OLD="<old-key>" \
ENCRYPTION_KEY_NEW="<new-key>" \
python migrations/rotate_encryption_key.py

# Expected output:
# ✅ Re-encrypted 109 users
# ✅ All data now uses new key
```

#### 8. Verify Re-Encryption

```bash
python migrations/rotate_encryption_key.py --verify

# Should show:
# ✅ All data encrypted with NEW key
# ❌ No data using OLD key
```

---

### **Phase 3: Finalization (After Migration)**

#### 9. Remove Dual-Key Support

Revert `crypto_utils.py` to single-key mode (remove old key fallback).

#### 10. Deploy Final Version

```bash
cd deploy_gcp
./deploy_with_encryption.sh
```

#### 11. Disable Old Secret Version

```bash
# List versions
gcloud secrets versions list ENCRYPTION_KEY --project=profiledata-438623

# Disable old version (keeps it for emergency rollback)
gcloud secrets versions disable <old-version-number> \
    --secret=ENCRYPTION_KEY \
    --project=profiledata-438623
```

#### 12. Monitor for 24-48 Hours

Watch for:
- Decryption errors in logs
- Profile update failures
- User complaints about missing data

If issues arise, see "Emergency Rollback" below.

#### 13. Delete Old Key Version (After 30 Days)

```bash
# Only after confirming everything works perfectly
gcloud secrets versions destroy <old-version-number> \
    --secret=ENCRYPTION_KEY \
    --project=profiledata-438623
```

---

## 🚨 Emergency Rollback

If rotation fails:

### Quick Rollback (If migration not completed)

```bash
# 1. Restore old secret version
gcloud secrets versions enable <old-version-number> \
    --secret=ENCRYPTION_KEY \
    --project=profiledata-438623

# 2. Update Cloud Run to use old version
gcloud run services update matrimonial-backend \
    --update-secrets=ENCRYPTION_KEY=ENCRYPTION_KEY:<old-version> \
    --region=us-central1 \
    --project=profiledata-438623

# 3. Restart service
gcloud run services update matrimonial-backend \
    --region=us-central1 \
    --project=profiledata-438623
```

### Full Rollback (If migration completed but issues found)

```bash
# 1. Restore database from backup
mongorestore --uri="mongodb+srv://..." /backup/pre-rotation-YYYYMMDD

# 2. Revert to old encryption key (see Quick Rollback above)

# 3. Restart application
```

---

## 🔧 Rotation Migration Script

Create this script: `migrations/rotate_encryption_key.py`

```python
#!/usr/bin/env python3
"""
Rotate encryption key - decrypt with old, encrypt with new
"""

import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from crypto_utils import PIIEncryption
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def rotate_key(dry_run=False):
    # Get keys from environment
    old_key = os.getenv('ENCRYPTION_KEY_OLD')
    new_key = os.getenv('ENCRYPTION_KEY_NEW')
    mongodb_url = os.getenv('MONGODB_URL')
    
    if not old_key or not new_key:
        logger.error("❌ Both ENCRYPTION_KEY_OLD and ENCRYPTION_KEY_NEW required")
        return
    
    # Initialize encryptors
    old_encryptor = PIIEncryption(old_key)
    new_encryptor = PIIEncryption(new_key)
    
    # Connect to MongoDB
    client = AsyncIOMotorClient(mongodb_url)
    db = client['matrimonialDB']
    
    logger.info("🔄 Starting key rotation...")
    
    encrypted_fields = ['contactEmail', 'contactNumber', 'location', 'dateOfBirth', 'linkedinUrl']
    
    users = await db.users.find({}).to_list(length=None)
    logger.info(f"📊 Processing {len(users)} users...")
    
    for user in users:
        username = user.get('username')
        update_doc = {}
        
        for field in encrypted_fields:
            if field in user and user[field]:
                try:
                    # Decrypt with OLD key
                    decrypted = old_encryptor.decrypt(user[field])
                    
                    # Encrypt with NEW key
                    re_encrypted = new_encryptor.encrypt(decrypted)
                    
                    update_doc[field] = re_encrypted
                    
                except Exception as e:
                    logger.error(f"❌ Failed to rotate {field} for {username}: {e}")
        
        if update_doc and not dry_run:
            await db.users.update_one(
                {"username": username},
                {"$set": update_doc}
            )
            logger.info(f"✅ Re-encrypted {username}: {list(update_doc.keys())}")
        elif update_doc:
            logger.info(f"🔍 [DRY RUN] Would re-encrypt {username}: {list(update_doc.keys())}")
    
    logger.info("✅ Key rotation complete!")
    client.close()

if __name__ == "__main__":
    import sys
    dry_run = '--dry-run' in sys.argv
    asyncio.run(rotate_key(dry_run=dry_run))
```

---

## 📊 Monitoring During Rotation

### Key Metrics to Watch

```bash
# Cloud Run logs
gcloud logging read "resource.type=cloud_run_revision AND severity>=ERROR" \
    --limit 50 \
    --format json

# Look for:
# - "Decryption failed"
# - "Invalid token"
# - "ENCRYPTION_KEY not configured"
```

### Health Check

```bash
# Test encryption health endpoint
curl https://matrimonial-backend-7cxoxmouuq-uc.a.run.app/health/encryption

# Should return:
# {
#   "encryption_enabled": true,
#   "key_version": "new",
#   "test_passed": true
# }
```

---

## ⏱️ Rotation Timeline

| Phase | Duration | Can App Stay Online? |
|-------|----------|---------------------|
| **Preparation** | 30-60 min | ✅ Yes |
| **Key Generation** | 5 min | ✅ Yes |
| **Dual-Key Deploy** | 10 min | ✅ Yes |
| **Re-Encryption** | 5-15 min | ✅ Yes (read-only recommended) |
| **Verification** | 10 min | ✅ Yes |
| **Final Deploy** | 10 min | ✅ Yes |
| **Monitoring** | 24-48 hours | ✅ Yes |

**Total:** ~2-3 hours active work + 24-48 hours monitoring

---

## 🎯 Success Criteria

Rotation is successful when:

- [ ] All users can login
- [ ] Profile updates work
- [ ] PII displays correctly
- [ ] No decryption errors in logs (24 hours)
- [ ] Verification script passes
- [ ] Old key disabled (but not destroyed yet)
- [ ] New key backed up securely

---

## 📞 Incident Response

### If users report missing PII data:

1. **Stop** - Don't continue rotation
2. **Check logs** - Look for decryption errors
3. **Verify backup** - Ensure backup is intact
4. **Rollback** - Restore old key and database
5. **Investigate** - Find root cause before retry

### If rotation hangs:

1. **Don't panic** - Database is still safe
2. **Check progress** - Count re-encrypted users
3. **Resume** - Script is idempotent, can re-run
4. **Monitor** - Watch Cloud Run logs

---

## 📚 Additional Resources

- [GCP Secret Manager Docs](https://cloud.google.com/secret-manager/docs)
- [Encryption Best Practices](https://cloud.google.com/security/encryption-at-rest/default-encryption)
- [NIST Key Management](https://csrc.nist.gov/publications/detail/sp/800-57-part-1/rev-5/final)

---

## ✅ Post-Rotation Checklist

After successful rotation:

- [ ] Old key disabled in Secret Manager
- [ ] New key backed up (3+ locations)
- [ ] Team notified of completion
- [ ] Documentation updated
- [ ] Rotation logged in audit trail
- [ ] Next rotation scheduled (6-12 months)
- [ ] Lessons learned documented

---

**Questions?** Review this guide carefully or consult security team before proceeding.

**Remember:** Careful preparation prevents problems. Rush leads to data loss.
