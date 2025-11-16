# Multi-Profile MFA Solution

**Date:** November 15, 2025  
**Issue:** Support parent managing multiple profiles with same email/phone  
**Solution:** Include username in MFA messages (SIMPLE!)

---

## Problem Statement

### Use Case
Parent wants to create profiles for 2 adult children using the **same parent email/phone**:

```javascript
// Daughter's Profile
{
  "username": "daughter_profile",
  "contactEmail": "parent@example.com",     // Same
  "contactNumber": "+1234567890"            // Same
}

// Son's Profile  
{
  "username": "son_profile",
  "contactEmail": "parent@example.com",     // Same
  "contactNumber": "+1234567890"            // Same
}
```

### The Issue

**Before Fix:**
```
Email Subject: "Your Login Code - L3V3L Dating"
Email Body: "Someone is trying to log in to your account. Code: 123456"
```

**Problem:** Parent receives 2 codes and doesn't know which profile each code is for! 😵

---

## Current Uniqueness Constraints

| Field | Status | Notes |
|-------|--------|-------|
| `username` | ✅ **UNIQUE** | Primary identifier |
| `contactEmail` | ⚠️ **UNIQUE (enforced)** | Lines 232-240 in routes.py |
| `contactNumber` | ✅ **NOT UNIQUE** | Already allows duplicates |

**Key Insight:** Phone numbers CAN already be duplicated! Only email has uniqueness constraint.

---

## Solution: Profile-Specific MFA Messages ✅

Instead of complex "account manager" features, we simply **include the username in all MFA messages**.

### After Fix

**Email:**
```
Subject: 🔒 Login Code for daughter_profile - L3V3L Dating

Body:
Someone is trying to log in to profile 'daughter_profile'. 
Please use the code below to complete authentication.

Your verification code: 123456
This code expires in 5 minutes.
```

**SMS:**
```
[daughter_profile] Login code: 123456

Expires in 5 minutes.
Didn't request this? Ignore this message.
```

**Now parent knows:** "Ah! This code is for my daughter's profile!" ✅

---

## Files Updated

### 1. `/services/email_otp_service.py`

**Lines 93-114:**
```python
# OLD
subject_map = {
    "mfa": f"🔒 Your Login Code - {self.app_name}",
}
message_text = "Someone is trying to log in to your account..."

# NEW ✅
subject_map = {
    "mfa": f"🔒 Login Code for {username} - {self.app_name}",
}
message_text = f"Someone is trying to log in to profile '{username}'..."
```

**Changes:**
- ✅ Added username to email subject
- ✅ Added username to email body
- ✅ Applied to all purposes: verification, mfa, password_reset

---

### 2. `/services/sms_service.py`

**Lines 68-121:**
```python
# OLD
async def send_otp(self, phone, otp, purpose):
    message_body = f"Your login code is: {otp}"

# NEW ✅
async def send_otp(self, phone, otp, purpose, username=None):
    profile_prefix = f"[{username}] " if username else ""
    message_body = f"{profile_prefix}Login code: {otp}"
```

**Changes:**
- ✅ Added `username` parameter
- ✅ Prefix all messages with `[username]`
- ✅ Applied to: Twilio SMS service
- ✅ Updated call sites (lines 282, 408)

---

### 3. `/services/simpletexting_service.py`

**Lines 29-85:**
```python
# OLD
async def send_otp(self, phone, otp, purpose):
    message_text = f"Your login code is: {otp}"

# NEW ✅
async def send_otp(self, phone, otp, purpose, username=None):
    profile_prefix = f"[{username}] " if username else ""
    message_text = f"{profile_prefix}Login code: {otp}"
```

**Changes:**
- ✅ Added `username` parameter
- ✅ Prefix all messages with `[username]`
- ✅ Applied to: SimpleTexting SMS service
- ✅ Updated call site (line 406)

---

## Message Examples

### Email MFA (All Purposes)

**Verification:**
```
Subject: 🔐 Verification Code for son_profile - L3V3L Dating
Body: You requested to verify your email address for profile 'son_profile'.
Code: 123456
```

**MFA Login:**
```
Subject: 🔒 Login Code for daughter_profile - L3V3L Dating
Body: Someone is trying to log in to profile 'daughter_profile'.
Code: 789012
```

**Password Reset:**
```
Subject: 🔑 Password Reset for son_profile - L3V3L Dating
Body: You requested to reset your password for profile 'son_profile'.
Code: 345678
```

---

### SMS MFA (All Purposes)

**Verification:**
```
[son_profile] Your verification code is: 123456

This code will expire in 10 minutes.
Do not share this code with anyone.
```

**MFA Login:**
```
[daughter_profile] Login code: 789012

Expires in 5 minutes.
Didn't request this? Ignore this message.
```

**Password Reset:**
```
[son_profile] Password reset code: 345678

Expires in 15 minutes.
Didn't request this? Secure your account.
```

---

## Next Step: Remove Email Uniqueness Constraint?

### Option 1: Keep Email Unique (Current) ✅ RECOMMENDED

**Status Quo:**
- Username: Unique ✅
- Email: Unique (enforced)
- Phone: Non-unique ✅

**Benefits:**
- ✅ Prevents accidental duplicate emails
- ✅ Clear data ownership
- ✅ No implementation changes needed
- ✅ Works with current MFA fix

**Workaround for Parents:**
- Parent creates separate email aliases (e.g., `parent+daughter@gmail.com`)
- Or uses different email addresses for each child

---

### Option 2: Allow Duplicate Emails

**Remove lines 232-240 from routes.py:**
```python
# REMOVE THIS:
if contactEmail:
    existing_email = await db.users.find_one({"contactEmail": contactEmail})
    if existing_email:
        raise HTTPException(status_code=409, detail="Email already registered")
```

**Add rate limiting:**
```python
# ADD THIS:
MAX_PROFILES_PER_EMAIL = 5

if contactEmail:
    email_count = await db.users.count_documents({"contactEmail": contactEmail})
    if email_count >= MAX_PROFILES_PER_EMAIL:
        raise HTTPException(
            status_code=400,
            detail=f"Maximum {MAX_PROFILES_PER_EMAIL} profiles per email"
        )
```

**Benefits:**
- ✅ Parent can use same email for all kids
- ✅ Username remains unique identifier
- ✅ MFA messages now include username (prevents confusion)

**Risks:**
- ⚠️ Potential for abuse (one person, many profiles)
- ⚠️ Need to update password reset flow (can't use email alone)
- ⚠️ Notification overload on single email

---

## Testing

### Test Scenario: Parent with 2 Kids

**Setup:**
1. Create profile: `daughter_profile` with `parent@example.com`
2. Create profile: `son_profile` with `parent@example.com` (if uniqueness removed)
3. Enable MFA for both profiles

**Test 1: Email MFA**
```bash
# Login to daughter_profile
POST /api/auth/login
{
  "username": "daughter_profile",
  "password": "***"
}

# Expected: Email with subject "Login Code for daughter_profile"
```

**Test 2: SMS MFA**
```bash
# Login to son_profile
POST /api/auth/login
{
  "username": "son_profile",
  "password": "***"
}

# Expected: SMS with "[son_profile] Login code: 123456"
```

**Test 3: OTP Verification**
```bash
# Send verification code
POST /api/auth/otp/send
Authorization: Bearer {daughter_token}
{
  "channel": "email"
}

# Expected: Email with "Verification Code for daughter_profile"
```

---

## Industry Best Practices

| **App Type** | **Email Policy** | **Rationale** |
|--------------|------------------|---------------|
| **Matrimonial (South Asian)** | ⚠️ Mixed | Cultural: Parents often manage profiles |
| **Dating (Western)** | ❌ Unique | One person = one account |
| **Family/Education** | ✅ Shared | Parent manages multiple kids |
| **Social Media** | ❌ Unique | Identity verification |
| **Streaming (Netflix)** | ✅ Sub-profiles | One account, many profiles |

**Recommendation for L3V3L:** 
- Start with **Option 1** (keep email unique, use message context)
- Monitor user feedback
- Add duplicate email support later if needed

---

## Summary

### What Changed ✅

1. **Email MFA messages** - Include username in subject and body
2. **SMS MFA messages** - Prefix with `[username]`  
3. **All OTP types** - Verification, MFA, password reset

### What Didn't Change

- ❌ Database schema
- ❌ Email uniqueness constraint (still enforced)
- ❌ Phone uniqueness (already allowed duplicates)
- ❌ Frontend code
- ❌ MFA flow logic

### Benefits

✅ **No confusion** when parent manages multiple profiles  
✅ **Simple implementation** (just message changes)  
✅ **Works with current setup** (no breaking changes)  
✅ **Future-proof** for duplicate email support  
✅ **Better UX** even for single-profile users

---

## Future Enhancements (Optional)

### 1. Add "Profile Manager" Feature
```javascript
{
  "username": "son_profile",
  "contactEmail": "son@example.com",
  "managed_by": "parent@example.com",  // Parent can access
  "profile_type": "managed"
}
```

### 2. Notification Grouping
- Parent receives digest: "You have 2 login attempts: daughter_profile, son_profile"
- Click to see which profile

### 3. Parent Dashboard
- Parent account can view/manage all linked profiles
- Switch between profiles without logging out

---

## Deployment

**Ready to deploy!** ✅

```bash
cd fastapi_backend
./bstart.sh  # Restart backend
```

**No database migration needed.**  
**No frontend changes needed.**

Test with:
```bash
# Login with MFA enabled
# Check email subject includes username
# Check SMS includes [username] prefix
```

---

## Support

If you want to **allow duplicate emails**:
1. Remove uniqueness check (routes.py lines 232-240)
2. Add rate limiting (max 5 profiles per email)
3. Update password reset to require username
4. Test thoroughly!

**Current solution works for both scenarios!** 🎉
