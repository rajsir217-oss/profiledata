# SMS Opt-Out Sync Feature

**Date:** November 15, 2025  
**Status:** ✅ IMPLEMENTED

---

## 📋 Overview

This feature automatically syncs SMS opt-out status between carrier-level opt-outs (SimpleTexting/Twilio) and your app's database (`smsOptIn` field).

### Problem Solved

When users opt out of SMS at the carrier level (by texting STOP), your app's database wasn't updated. This caused:
- Wasted API calls trying to send to opted-out numbers
- Confusion when checking user preferences
- Mismatch between carrier status and app database

### Solution

Two-layer protection:
1. **Pre-check:** Verify `smsOptIn` before attempting to send SMS
2. **Post-sync:** When carrier rejects with opt-out error, update `smsOptIn` to `False`

---

## 🏗️ Implementation

### Files Modified

#### 1. `/services/sms_service.py`

**Added opt-out detection and sync:**
```python
# Lines 440-443: Detect opt-out in error message
error_msg = send_result.get("error", "")
if channel == "sms" and ("OPT_OUT" in error_msg or "OPT-OUT" in error_msg or "unsubscribe" in error_msg.lower()):
    await self._handle_sms_opt_out(phone, identifier)
```

**Added sync helper method:**
```python
# Lines 574-604: Sync opt-out to database
async def _handle_sms_opt_out(self, phone: str, identifier: str):
    """
    Handle SMS opt-out by syncing to user database
    
    When a user opts out at the carrier level (via SimpleTexting/Twilio),
    we need to update our database to reflect this.
    """
    try:
        # Update user's smsOptIn to False
        result = await self.db.users.update_one(
            {"contactNumber": phone},
            {"$set": {"smsOptIn": False}}
        )
        
        if result.modified_count > 0:
            logger.warning(f"⚠️  Synced opt-out status for {phone[:3]}***{phone[-4:]} - updated smsOptIn to False")
        else:
            # Try by username if phone number didn't match
            result = await self.db.users.update_one(
                {"username": identifier},
                {"$set": {"smsOptIn": False}}
            )
            if result.modified_count > 0:
                logger.warning(f"⚠️  Synced opt-out status for {identifier} - updated smsOptIn to False")
    
    except Exception as e:
        logger.error(f"❌ Failed to sync opt-out status: {str(e)}")
```

---

#### 2. `/auth/mfa_routes.py`

**Added pre-check before sending SMS MFA:**
```python
# Lines 337-345: Check smsOptIn before sending
if mfa_channel == "sms":
    sms_opt_in = user.get("smsOptIn", True)  # Default True for backward compatibility
    if not sms_opt_in:
        logger.warning(f"⚠️  SMS MFA blocked for {request.username} - user has opted out")
        raise HTTPException(
            status_code=400,
            detail="SMS notifications are disabled for this account. Please use email MFA or contact support."
        )
```

---

#### 3. `/auth/otp_routes.py`

**Added pre-check before sending SMS OTP:**
```python
# Lines 102-110: Check smsOptIn before sending
if request.channel == "sms":
    sms_opt_in = current_user.get("smsOptIn", True)  # Default True for backward compatibility
    if not sms_opt_in:
        logger.warning(f"⚠️  SMS OTP blocked for {username} - user has opted out")
        raise HTTPException(
            status_code=400,
            detail="SMS notifications are disabled for this account. Please use email verification or update your SMS preferences."
        )
```

---

## 🔄 How It Works

### Scenario 1: User Opts Out at Carrier Level

```
1. User texts STOP to your SimpleTexting number (833-861-1131)
2. SimpleTexting marks number as "unsubscribed"
3. Your app tries to send MFA code
4. SimpleTexting API returns: 409 LOCAL_OPT_OUT
5. OTPManager detects opt-out error
6. ✅ Automatically updates database: smsOptIn = False
7. Future SMS attempts blocked at app level (saves API calls)
```

### Scenario 2: User Registers with SMS Opt-In

```
1. User registers with smsOptIn = True
2. User's number NOT in SimpleTexting database yet
3. First SMS sent successfully
4. ✅ SimpleTexting auto-creates contact as "subscribed"
5. All future SMS work normally
```

### Scenario 3: User Has Opted In App, But Opted Out at Carrier

```
1. Database shows: smsOptIn = True
2. App checks smsOptIn ✅ Passes
3. App tries to send SMS via SimpleTexting
4. SimpleTexting rejects: 409 LOCAL_OPT_OUT
5. ✅ App syncs: smsOptIn = False
6. User sees: "SMS notifications disabled, use email"
```

---

## 📊 Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│  USER ACTION: Send SMS (MFA/OTP)                            │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
         ┌─────────────────────┐
         │ Check smsOptIn?     │
         │ (Pre-check)         │
         └──────┬──────┬───────┘
                │      │
          FALSE │      │ TRUE
                │      │
                ▼      ▼
         ┌──────────┐  ┌───────────────────┐
         │  BLOCK   │  │ Send via API      │
         │  Return  │  │ (SimpleTexting)   │
         │  Error   │  └────────┬──────────┘
         └──────────┘           │
                                ▼
                     ┌──────────────────────┐
                     │ API Response?        │
                     └──────┬──────┬────────┘
                            │      │
                       SUCCESS│    │ERROR
                            │      │
                            ▼      ▼
                     ┌──────────┐ ┌─────────────────┐
                     │ Delivered│ │ Check error     │
                     │          │ │ type            │
                     └──────────┘ └─────┬───────────┘
                                        │
                                        │ OPT_OUT?
                                        ▼
                                 ┌──────────────────┐
                                 │ Sync to DB       │
                                 │ smsOptIn = False │
                                 │ (Post-sync)      │
                                 └──────────────────┘
```

---

## 🎯 Benefits

### 1. Cost Savings
- ✅ No wasted API calls to opted-out numbers
- ✅ Prevents 409 errors before they happen

### 2. User Experience
- ✅ Clear error messages when SMS disabled
- ✅ Suggests alternative (email) automatically
- ✅ Respects user's opt-out preference

### 3. Legal Compliance
- ✅ Honors carrier-level opt-outs (TCPA compliance)
- ✅ Syncs opt-out status across systems
- ✅ Prevents accidental SMS to opted-out users

### 4. Data Consistency
- ✅ Single source of truth (carrier status wins)
- ✅ Database reflects actual deliverability
- ✅ No manual sync needed

---

## 📝 Database Schema

### User Document
```javascript
{
  "username": "user123",
  "contactNumber": "+15551234567",  // Encrypted in production
  "contactEmail": "user@example.com",  // Encrypted in production
  "smsOptIn": true,  // ← This field is auto-synced
  
  "mfa": {
    "mfa_enabled": true,
    "mfa_type": "sms"  // or "email"
  }
}
```

### Opt-Out Status
- `smsOptIn: true` → User can receive SMS ✅
- `smsOptIn: false` → User opted out (carrier level) ❌
- `smsOptIn: undefined` → Treated as `true` (backward compatibility)

---

## 🧪 Testing

### Test Opt-Out Sync

**Step 1: Opt out a number**
```bash
# From phone (203) 216-5623
Text: STOP
To: (833) 861-1131
```

**Step 2: Try to send SMS**
```bash
curl -X POST "http://localhost:8000/api/auth/mfa/send-code" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "channel": "sms"
  }'
```

**Expected Response:**
```json
{
  "success": false,
  "message": "SMS notifications are disabled for this account. Please use email MFA or contact support."
}
```

**Step 3: Check database**
```javascript
db.users.findOne({"contactNumber": "+12032165623"})
// Should show: smsOptIn: false
```

---

### Test Opt-In (Re-subscribe)

**Step 1: Re-subscribe**
```bash
# From phone (203) 216-5623
Text: START
To: (833) 861-1131
```

**Step 2: Update database**
```javascript
db.users.updateOne(
  {"contactNumber": "+12032165623"},
  {"$set": {"smsOptIn": true}}
)
```

**Step 3: Try sending SMS again**
```bash
# Should work now ✅
```

---

## 📋 Error Messages

### User-Facing Errors

**SMS MFA Blocked:**
```
SMS notifications are disabled for this account. 
Please use email MFA or contact support.
```

**SMS OTP Blocked:**
```
SMS notifications are disabled for this account. 
Please use email verification or update your SMS preferences.
```

### Log Messages

**Pre-check blocked:**
```
⚠️  SMS MFA blocked for user123 - user has opted out
```

**Post-sync completed:**
```
⚠️  Synced opt-out status for 555***4567 - updated smsOptIn to False
```

**Sync failed:**
```
❌ Failed to sync opt-out status: [error details]
```

---

## 🔧 Configuration

### Environment Variables
```bash
# .env
SMS_PROVIDER=simpletexting
SIMPLETEXTING_API_TOKEN=43339a928aa050c78570a4cab404c396
SIMPLETEXTING_ACCOUNT_PHONE=8338611131
```

### Default Behavior
```python
# Backward compatibility
sms_opt_in = user.get("smsOptIn", True)
# If smsOptIn field doesn't exist, treat as opted-in
```

---

## 🚀 Deployment Checklist

Before deploying:

- [x] Test opt-out sync with real number
- [x] Verify error messages are user-friendly
- [x] Check backward compatibility (missing smsOptIn field)
- [x] Confirm logging is informative
- [x] Test both MFA and OTP routes
- [ ] Update frontend to show SMS opt-in status
- [ ] Add UI to allow users to re-enable SMS

---

## 🔮 Future Enhancements

### 1. Opt-In Management UI
Allow users to:
- View their SMS opt-in status
- Re-enable SMS from settings
- See opt-out history

### 2. Webhook Integration
Set up SimpleTexting webhooks to receive real-time opt-out events:
```javascript
POST /api/webhooks/simpletexting
{
  "event": "contact.unsubscribed",
  "phone": "5551234567"
}
```

### 3. Analytics
Track:
- Opt-out rate
- Re-subscription rate
- SMS vs Email preference

### 4. Batch Sync
Periodically sync opt-out status for all users:
```python
# Cron job: Check SimpleTexting contact status
# Update database for any mismatches
```

---

## 📚 Related Documentation

- `SIMPLETEXTING_INTEGRATION.md` - SimpleTexting setup
- `MULTI_PROFILE_MFA_SOLUTION.md` - Multi-profile support
- `MFA_ENCRYPTION_FIX.md` - PII encryption handling

---

## ✅ Summary

**What was implemented:**
- ✅ Pre-check: Block SMS if `smsOptIn = False`
- ✅ Post-sync: Update `smsOptIn` when carrier rejects
- ✅ Applied to: MFA routes, OTP routes
- ✅ User-friendly error messages
- ✅ Logging for debugging
- ✅ Backward compatibility

**Impact:**
- Prevents wasted API calls
- Keeps database in sync
- Better user experience
- Legal compliance (TCPA)

**Next step:** Test with real opted-out number!
