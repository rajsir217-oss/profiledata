# Email Notifier Decryption Fix

**Date:** November 15, 2025  
**Issue:** Email notifier failing to send - encrypted email addresses  
**Status:** ✅ FIXED

---

## 🐛 Problem

**Error Message:**
```
admin:
{'gAAAAABpGSBDzcvmj7yfUfwRO8xrZJJwvbTPkt2i6xaSmrX...': 
(553, b'5.1.3 The recipient address <gAAAAAA...> is not a valid RFC 5321 address
```

**Root Cause:**
- Email notifier fetched `contactEmail` from database
- Email was encrypted: `gAAAAABpGSBDzcvmj7y...`
- Job tried to send to encrypted string instead of real email
- SMTP rejected invalid email address

---

## ✅ The Fix

### Added Email Decryption (Lines 145-156)

```python
# 🔓 Decrypt email if encrypted
from crypto_utils import get_encryptor
if recipient_email and recipient_email.startswith('gAAAAA'):
    try:
        encryptor = get_encryptor()
        decrypted_email = encryptor.decrypt(recipient_email)
        context.log("info", f"🔓 Decrypted email: {decrypted_email[:3]}***@{decrypted_email.split('@')[1]}")
        recipient_email = decrypted_email
    except Exception as decrypt_err:
        raise Exception(f"Failed to decrypt email address: {decrypt_err}")

context.log("info", f"✅ Using email: {recipient_email[:3]}***@{recipient_email.split('@')[1]}")
```

---

## 🎯 What Changed

| Component | Before | After |
|-----------|--------|-------|
| **Email Fetch** | Gets from DB | ✅ Same |
| **Encryption Check** | ❌ None | ✅ Checks for `gAAAAA` prefix |
| **Decryption** | ❌ Missing | ✅ Decrypts using crypto_utils |
| **Logging** | Shows encrypted email | ✅ Shows masked decrypted email |
| **Send** | Fails with encrypted | ✅ Sends to real email |

---

## 📊 Consistency with SMS Notifier

Both jobs now follow the same pattern:

### SMS Notifier (Already Fixed)
```python
# Decrypt phone if encrypted
if phone and phone.startswith('gAAAAA'):
    encryptor = get_encryptor()
    phone = encryptor.decrypt(phone)
```

### Email Notifier (Now Fixed)
```python
# Decrypt email if encrypted
if recipient_email and recipient_email.startswith('gAAAAA'):
    encryptor = get_encryptor()
    recipient_email = encryptor.decrypt(recipient_email)
```

---

## 🚀 Testing

### Restart Backend
```bash
cd /Users/rajsiripuram02/opt/appsrc/profiledata
./bstart.sh
```

### Run Email Notifier Job
1. Go to **Event Queue Manager**
2. Find **"Email Notifier"** job
3. Click **"Run Now"**
4. Check execution history

### Expected Result

**Before Fix:**
```
❌ Error: admin: (553, b'5.1.3 The recipient address <gAAAAA...> is not a valid RFC 5321 address')
```

**After Fix:**
```
✅ info: DB Fields - email: NOT SET, contactEmail: gAAAAA...
✅ info: 🔓 Decrypted email: adm***@example.com
✅ info: ✅ Using email: adm***@example.com
✅ info: Email sent successfully
```

---

## 📝 Complete Fix List (Email & SMS)

| Notifier | Issue | Fix | Status |
|----------|-------|-----|--------|
| **SMS** | Encrypted phone | Decrypt before send | ✅ Fixed |
| **SMS** | Wrong method name | Use `send_notification` | ✅ Fixed |
| **SMS** | Provider mismatch | Use SimpleTexting | ✅ Fixed |
| **Email** | Encrypted email | Decrypt before send | ✅ Fixed |
| **Both** | Query bug | Use `$in` for arrays | ✅ Fixed |

---

## ✅ Verification Checklist

- [x] Added email decryption logic
- [x] Check for `gAAAAA` prefix
- [x] Decrypt using crypto_utils
- [x] Log masked decrypted email
- [x] Match SMS notifier pattern
- [x] Documented fix
- [ ] Restart backend
- [ ] Run email notifier job
- [ ] Verify emails sent
- [ ] Check queue cleared

---

**Last Updated:** November 15, 2025, 8:10 PM PST  
**Fixed By:** Cascade AI  
**Backend Restart:** Required
