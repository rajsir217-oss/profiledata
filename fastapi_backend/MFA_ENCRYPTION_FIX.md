# MFA Email Encryption Bug Fix

**Date:** November 15, 2025  
**Issue:** Production MFA failing with "recipient address not valid RFC 5321"  
**Root Cause:** Encrypted email addresses being sent directly to SMTP without decryption

---

## Problem Description

When MFA is enabled in production, the error occurs:

```
Failed to send email: {'gAAAAABpGKJMbBf0M__-a-1-101CTUtPU4StmPD1qo7_M7y...': 
(553, b'5.1.3 The recipient address <gAAAAABpGKJMbBf0M__...> is not a valid RFC 5321 address.')}
```

### Root Cause

1. **Production has PII encryption enabled** - `contactEmail` and `contactNumber` fields are encrypted in the database using Fernet encryption
2. **MFA code retrieves encrypted values** - When sending MFA codes, the system retrieves email/phone from database
3. **No decryption before use** - The encrypted string (starting with `gAAAAAB`) was passed directly to email/SMS services
4. **SMTP rejects encrypted email** - Email service tries to send to `gAAAAABp...@example.com` (invalid email format)

---

## Files Fixed

### 1. `/fastapi_backend/auth/mfa_routes.py`

**Changes:**
- ✅ Added `from crypto_utils import get_encryptor` import
- ✅ Added `_decrypt_contact_info()` helper function
- ✅ Decrypt email/phone in `send_mfa_code()` before sending (line 313-317)
- ✅ Decrypt email/phone in `get_mfa_status()` before masking (line 85-89)

**Key Fix:**
```python
# DECRYPT contact info if encrypted (production PII encryption)
if phone:
    phone = _decrypt_contact_info(phone)
if email:
    email = _decrypt_contact_info(email)
```

### 2. `/fastapi_backend/auth/auth_routes.py`

**Changes:**
- ✅ Added `from crypto_utils import get_encryptor` import
- ✅ Added `_decrypt_contact_info()` helper function  
- ✅ Decrypt email/phone in login flow before masking MFA contact (line 291-299)

### 3. `/fastapi_backend/auth/otp_routes.py` ⚠️ NEW FIX

**Changes:**
- ✅ Added `from crypto_utils import get_encryptor` import
- ✅ Added `_decrypt_contact_info()` helper function
- ✅ Decrypt email/phone in `send_otp_code()` before sending (line 74-88)
- ✅ Decrypt email/phone in `get_verification_status()` (line 246-253)
- ✅ Decrypt email/phone in `update_otp_preference()` (line 280-291)
- ✅ Decrypt email/phone in `get_otp_preference()` (line 334-341)

**Affected Endpoint:**
- `POST /api/auth/otp/send` - This was causing the 500 error shown in screenshot

**Key Fix:**
```python
# Get contact info and DECRYPT if encrypted
if mfa_channel == "sms":
    phone = user.get("contactNumber", "")
    phone = _decrypt_contact_info(phone)
    contact_masked = f"{phone[:3]}***{phone[-2:]}" if len(phone) > 5 else "***"
else:  # email
    email = user.get("contactEmail") or user.get("email", "")
    email = _decrypt_contact_info(email)
    contact_masked = f"{email[0]}***@{email.split('@')[1]}" if email and '@' in email else "***"
```

---

## How It Works

### Helper Function: `_decrypt_contact_info()`

```python
def _decrypt_contact_info(value: str) -> str:
    """
    Decrypt contact info (email/phone) if encrypted
    
    - Checks if value starts with 'gAAAAA' (Fernet token prefix)
    - If encrypted: decrypts using PIIEncryption from crypto_utils
    - If not encrypted: returns value as-is (for dev/legacy data)
    - On error: returns original value (graceful degradation)
    """
    if not value:
        return value
    
    if isinstance(value, str) and value.startswith('gAAAAA'):
        try:
            encryptor = get_encryptor()
            decrypted = encryptor.decrypt(value)
            logger.debug(f"🔓 Decrypted contact info")
            return decrypted
        except Exception as e:
            logger.error(f"❌ Failed to decrypt: {e}")
            return value
    
    return value
```

### Encryption Detection

- **Encrypted data** always starts with `gAAAAA` (Fernet token format)
- **Example encrypted email:** `gAAAAABpGKJMbBf0M__-a-1-101CTUtPU4StmPD1qo7_M7yZdyjLAv34JT4KaKNyFC6IneC4pddUH8XtXFYQIfVFto33H6V5JVZ4Wv37qotyyjfgZOqbrPQ=`
- **After decryption:** `user@example.com`

---

## Testing Instructions

### 1. Test MFA Email Send (Production)

```bash
# Prerequisites
export ENCRYPTION_KEY="your-production-key"
export SMTP_HOST="smtp.gmail.com"
export SMTP_PORT=587
export SMTP_USER="your-email"
export SMTP_PASSWORD="your-app-password"

# Start backend
cd fastapi_backend
source venv/bin/activate
python main.py
```

**Test via API:**
```bash
# Enable MFA for a user
curl -X POST "http://localhost:8000/api/auth/mfa/enable" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "channel": "email",
    "email": "test@example.com",
    "verification_code": "123456"
  }'

# Send MFA code during login
curl -X POST "http://localhost:8000/api/auth/mfa/send-code" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "channel": "email"
  }'
```

**Expected Result:**
- ✅ Email sent successfully to actual email address
- ✅ No RFC 5321 errors
- ✅ Logs show "🔓 Decrypted contact info for MFA"
- ✅ User receives MFA code email

### 2. Test Login with MFA

```bash
# Login without MFA code
curl -X POST "http://localhost:8000/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "password": "password123"
  }'
```

**Expected Response:**
```json
{
  "detail": "MFA_REQUIRED",
  "mfa_channel": "email",
  "contact_masked": "t***@example.com"
}
```

- ✅ Masked email shows actual domain (not encrypted string)
- ✅ Frontend can display masked contact correctly

### 3. Verify Decryption Logs

```bash
# Check backend logs
tail -f logs/app.log | grep -i decrypt
```

**Expected Logs:**
```
🔓 Decrypted contact info for MFA
✅ OTP email sent to user@example.com (purpose: mfa)
```

### 4. Test Development Mode (No Encryption)

```bash
# Remove ENCRYPTION_KEY to test non-encrypted scenario
unset ENCRYPTION_KEY
python main.py
```

**Expected:**
- ✅ Works with plain text emails (legacy/dev mode)
- ✅ No decryption attempted
- ✅ No errors

---

## Environment Variables

### Required for Production

```bash
# PII Encryption Key (from crypto_utils.py)
ENCRYPTION_KEY="base64-encoded-32-byte-fernet-key"

# Email SMTP Settings
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USER="noreply@yourdomain.com"
SMTP_PASSWORD="app-specific-password"
FROM_EMAIL="noreply@yourdomain.com"
FROM_NAME="Your App Name"
```

### Generate New Encryption Key

```bash
cd fastapi_backend
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

---

## What Was NOT Changed

- ✅ Database schema - no migration needed
- ✅ Encryption/decryption logic in `crypto_utils.py`
- ✅ Email service (`email_otp_service.py`)
- ✅ SMS service (`sms_service.py`)
- ✅ Frontend code
- ✅ User data in database

**Only fix:** Decrypt PII **before** passing to email/SMS services

---

## Rollback Plan

If issues occur, revert these files:
```bash
cd fastapi_backend
git checkout HEAD~1 auth/mfa_routes.py auth/auth_routes.py auth/otp_routes.py
```

---

## Related Documentation

- **PII Encryption Guide:** `/fastapi_backend/PII_ENCRYPTION_GUIDE.md`
- **Key Rotation Guide:** `/fastapi_backend/KEY_ROTATION_GUIDE.md`
- **Crypto Utils:** `/fastapi_backend/crypto_utils.py`
- **MFA Setup:** `/fastapi_backend/SMS_MFA_SETUP.md`

---

## Summary

### Before Fix ❌
```
Database: contactEmail = "gAAAAABp..."
↓
MFA Code: email = "gAAAAABp..."
↓
SMTP: send_to("gAAAAABp...")
↓
ERROR: Not valid RFC 5321 address
```

### After Fix ✅
```
Database: contactEmail = "gAAAAABp..."
↓
MFA Code: email = _decrypt_contact_info("gAAAAABp...")
↓
Decrypted: email = "user@example.com"
↓
SMTP: send_to("user@example.com")
↓
SUCCESS: Email sent ✅
```

---

## Deployment Steps

1. **Pull latest code**
   ```bash
   cd fastapi_backend
   git pull origin main
   ```

2. **Verify environment variables**
   ```bash
   echo $ENCRYPTION_KEY  # Should be set
   echo $SMTP_HOST       # Should be set
   ```

3. **Restart backend**
   ```bash
   sudo systemctl restart profiledata-backend
   # OR
   ./restart_backend.sh
   ```

4. **Monitor logs**
   ```bash
   journalctl -u profiledata-backend -f
   # OR
   tail -f logs/app.log
   ```

5. **Test MFA flow**
   - Try logging in with MFA-enabled account
   - Verify email/SMS received
   - Check for decryption logs

---

## Support

If issues persist:
1. Check `ENCRYPTION_KEY` matches production database encryption
2. Verify SMTP credentials are correct
3. Check logs for decryption errors
4. Test with plain text email in dev mode first
5. Contact: raj@yourdomain.com

**Status:** ✅ Ready for production deployment
