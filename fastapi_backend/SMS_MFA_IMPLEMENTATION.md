# SMS-Based MFA & Phone Verification System

**Created:** October 31, 2025  
**Status:** Backend Complete ✅ | Frontend Pending ⏳

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Backend Implementation](#backend-implementation)
4. [API Endpoints](#api-endpoints)
5. [Database Schema](#database-schema)
6. [Configuration](#configuration)
7. [Development Mode](#development-mode)
8. [Security Features](#security-features)
9. [Frontend Implementation (TODO)](#frontend-implementation-todo)
10. [Testing](#testing)

---

## Overview

This system provides SMS-based Two-Factor Authentication (2FA/MFA) and phone number verification using Twilio.

### Features

✅ **Phone Verification**
- Send 6-digit OTP via SMS
- 10-minute expiry
- Rate limiting (1 request per minute)
- Phone number formatting and validation

✅ **SMS-Based MFA**
- Login protection with SMS codes
- 5-minute expiry for MFA codes
- 10 backup recovery codes (XXXX-XXXX format)
- Backup codes are single-use and hashed
- Seamless integration with existing auth flow

✅ **Security**
- OTP codes stored in database with expiry
- Maximum 5 verification attempts
- Backup codes hashed like passwords
- Rate limiting on code requests
- Automatic cleanup of expired codes

---

## Architecture

### Components

```
┌─────────────────────────────────────────────────────────────┐
│                    SMS MFA System                            │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────┐      ┌───────────────────┐           │
│  │  SMSService      │◄─────│  OTPManager       │           │
│  │  (Twilio)        │      │  (DB Operations)  │           │
│  └──────────────────┘      └───────────────────┘           │
│           │                          │                       │
│           ▼                          ▼                       │
│  ┌──────────────────┐      ┌───────────────────┐           │
│  │  Phone Routes    │      │  MFA Routes       │           │
│  │  /auth/phone/*   │      │  /auth/mfa/*      │           │
│  └──────────────────┘      └───────────────────┘           │
│           │                          │                       │
│           └──────────┬───────────────┘                       │
│                      ▼                                       │
│            ┌──────────────────┐                             │
│            │  Auth Routes     │                             │
│            │  Login Flow      │                             │
│            └──────────────────┘                             │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

**1. Phone Verification:**
```
User → Send Code → OTPManager.create_otp() 
                → SMSService.send_otp() 
                → Twilio API 
                → User receives SMS

User → Enter Code → OTPManager.verify_otp() 
                  → Update user.status.phone_verified = true
```

**2. Enable MFA:**
```
User → Verify Phone → Enable MFA 
                    → Generate backup codes 
                    → Hash backup codes 
                    → Update user.mfa.mfa_enabled = true
```

**3. Login with MFA:**
```
User → Username/Password → Check mfa_enabled 
                         → Send SMS code 
                         → User enters code 
                         → Verify OTP or backup code 
                         → Issue JWT tokens
```

---

## Backend Implementation

### Files Created

1. **`services/sms_service.py`** (408 lines)
   - `SMSService` - Twilio integration
   - `OTPManager` - OTP lifecycle management
   - Phone number formatting
   - Development mode support

2. **`auth/otp_models.py`** (90 lines)
   - Pydantic models for requests/responses
   - Phone number validation
   - OTP code validation

3. **`auth/phone_routes.py`** (200 lines)
   - POST `/api/auth/phone/send-code`
   - POST `/api/auth/phone/verify`
   - POST `/api/auth/phone/resend-code`
   - GET `/api/auth/phone/status`

4. **`auth/mfa_routes.py`** (400 lines)
   - GET `/api/auth/mfa/status`
   - POST `/api/auth/mfa/enable`
   - POST `/api/auth/mfa/disable`
   - POST `/api/auth/mfa/send-code`
   - POST `/api/auth/mfa/verify-code`
   - POST `/api/auth/mfa/regenerate-backup-codes`

### Files Modified

1. **`auth/auth_routes.py`**
   - Updated login flow to support SMS MFA
   - Added backup code verification
   - Returns `X-MFA-Required: true` header when MFA needed

2. **`main.py`**
   - Registered `phone_router`
   - Registered `mfa_router`

3. **`requirements.txt`**
   - Added `twilio==8.10.0`

4. **`.env.example`**
   - Added `ENVIRONMENT` variable

---

## API Endpoints

### Phone Verification

#### 1. Send Verification Code
```http
POST /api/auth/phone/send-code
Authorization: Bearer {token}
Content-Type: application/json

{
  "phone": "+1234567890"
}

Response:
{
  "success": true,
  "message": "Verification code sent successfully",
  "phone_masked": "+12***90",
  "expires_at": "2025-10-31T14:00:00Z",
  "mock_code": "123456"  // Only in development
}
```

#### 2. Verify Phone
```http
POST /api/auth/phone/verify
Authorization: Bearer {token}
Content-Type: application/json

{
  "phone": "+1234567890",
  "code": "123456"
}

Response:
{
  "success": true,
  "message": "Phone number verified successfully!",
  "phone_verified": true
}
```

#### 3. Resend Code
```http
POST /api/auth/phone/resend-code
Authorization: Bearer {token}
Content-Type: application/json

{
  "phone": "+1234567890"
}

Response: Same as send-code
```

#### 4. Get Phone Status
```http
GET /api/auth/phone/status
Authorization: Bearer {token}

Response:
{
  "phone_verified": true,
  "phone": "+1234567890",
  "phone_masked": "+12***90",
  "verified_at": "2025-10-31T13:30:00Z"
}
```

### MFA Endpoints

#### 1. Get MFA Status
```http
GET /api/auth/mfa/status
Authorization: Bearer {token}

Response:
{
  "mfa_enabled": false,
  "phone": null,
  "phone_masked": null,
  "enabled_at": null,
  "backup_codes_count": 0
}
```

#### 2. Enable MFA
```http
POST /api/auth/mfa/enable
Authorization: Bearer {token}
Content-Type: application/json

{
  "phone": "+1234567890",
  "verification_code": "123456"  // From phone verification
}

Response:
{
  "codes": [
    "A1B2-C3D4",
    "E5F6-G7H8",
    ...10 codes total
  ],
  "generated_at": "2025-10-31T13:45:00Z",
  "message": "MFA enabled! Save these backup codes securely."
}
```

#### 3. Disable MFA
```http
POST /api/auth/mfa/disable
Authorization: Bearer {token}
Content-Type: application/json

{
  "password": "current_password",
  "code": "123456"  // Optional MFA code
}

Response:
{
  "success": true,
  "message": "MFA has been disabled successfully"
}
```

#### 4. Send MFA Code (Login)
```http
POST /api/auth/mfa/send-code
Content-Type: application/json

{
  "username": "john_doe"
}

Response:
{
  "success": true,
  "message": "MFA code sent to your phone",
  "phone_masked": "+12***90",
  "expires_at": "2025-10-31T14:00:00Z"
}
```

#### 5. Verify MFA Code (Login)
```http
POST /api/auth/mfa/verify-code
Content-Type: application/json

{
  "username": "john_doe",
  "code": "123456"  // Or "A1B2-C3D4" for backup code
}

Response:
{
  "success": true,
  "message": "MFA code verified successfully",
  "backup_code_used": false
}
```

#### 6. Regenerate Backup Codes
```http
POST /api/auth/mfa/regenerate-backup-codes
Authorization: Bearer {token}

Response:
{
  "codes": ["A1B2-C3D4", "E5F6-G7H8", ...],
  "generated_at": "2025-10-31T14:00:00Z",
  "message": "New backup codes generated. Old codes are no longer valid."
}
```

---

## Database Schema

### Users Collection Updates

```javascript
{
  "username": "john_doe",
  "contactNumber": "+1234567890",  // Phone number
  
  "status": {
    "phone_verified": true,  // NEW: Phone verification status
    "phone_verified_at": ISODate("2025-10-31T13:30:00Z")  // NEW
  },
  
  "mfa": {
    "mfa_enabled": true,  // UPDATED: Now supports SMS
    "mfa_type": "sms",  // NEW: "sms" or "totp"
    "mfa_secret": null,  // Not used for SMS MFA
    "mfa_backup_codes": [  // UPDATED: Hashed backup codes
      "$2b$12$...",  // Hashed code
      "$2b$12$...",
      ...
    ],
    "mfa_enabled_at": ISODate("2025-10-31T13:45:00Z"),
    "mfa_disabled_at": null  // NEW: Track when disabled
  }
}
```

### New Collection: otp_codes

```javascript
{
  "_id": ObjectId("..."),
  "identifier": "john_doe",  // Username or email
  "phone": "+1234567890",
  "code": "123456",  // Plain text OTP
  "purpose": "verification",  // "verification", "mfa", "password_reset"
  "attempts": 0,
  "max_attempts": 5,
  "expires_at": ISODate("2025-10-31T14:00:00Z"),
  "created_at": ISODate("2025-10-31T13:50:00Z"),
  "verified": false,
  "used": false,
  "expired": false  // Set when code expires
}
```

**Indexes:**
```javascript
db.otp_codes.createIndex({ "identifier": 1, "purpose": 1, "verified": 1 })
db.otp_codes.createIndex({ "expires_at": 1 }, { expireAfterSeconds: 0 })  // TTL index
```

---

## Configuration

### Environment Variables

Add to `.env.local`:

```bash
# SMS/Twilio Configuration
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_FROM_PHONE=+1234567890

# Environment
ENVIRONMENT=development  # or production
```

### Get Twilio Credentials

1. Sign up at https://www.twilio.com
2. Go to Console Dashboard
3. Copy **Account SID** and **Auth Token**
4. Buy a phone number or use trial number
5. Add credentials to `.env.local`

### Twilio Costs

- **Trial Account:** Free with limitations
- **Production:**
  - US SMS: ~$0.0079 per message
  - International varies by country
  - Pay as you go

---

## Development Mode

### Mock OTP Codes

When `ENVIRONMENT=development` and SMS fails (no Twilio credentials):

```json
{
  "success": false,
  "error": "SMS service not configured",
  "mock_code": "123456",  // ← Actual code for testing
  "expires_at": "2025-10-31T14:00:00Z"
}
```

**Usage:**
1. Call send-code endpoint
2. Get `mock_code` from response
3. Use that code to verify

### Bypass SMS in Development

```python
# In sms_service.py, SMSService.send_otp()
if not self.enabled:
    logger.warning(f"SMS not sent - service disabled")
    return {
        "success": False,
        "error": "SMS service not configured",
        "mock_code": otp  # ← Returned for dev testing
    }
```

---

## Security Features

### 1. OTP Security
- **Expiry:** 10 min (verification), 5 min (MFA)
- **Max Attempts:** 5 tries then code invalid
- **Single Use:** Codes marked as used after verification
- **Rate Limiting:** 1 request per minute for resend

### 2. Backup Codes
- **Format:** XXXX-XXXX (8 alphanumeric)
- **Hashed:** Stored with bcrypt like passwords
- **Single Use:** Removed from database after use
- **Count:** 10 codes generated
- **Regeneration:** Old codes invalidated

### 3. MFA Disable Security
- Requires current password
- Optional MFA code verification
- Logged in audit trail

### 4. Phone Number Validation
- E.164 format enforcement
- US numbers (10-11 digits)
- Auto-formatting with country code

### 5. Database Security
- OTP codes have TTL index (auto-delete)
- Failed attempts tracked
- Expired codes marked and cleaned up

---

## Frontend Implementation (TODO)

### Components Needed

#### 1. Phone Verification Component
**Path:** `/frontend/src/components/PhoneVerification.js`

**Features:**
- Phone number input with formatting
- Send code button
- 6-digit code input
- Resend code (with countdown timer)
- Success/error messages

**Props:**
```javascript
<PhoneVerification 
  onVerified={(phone) => {}}
  initialPhone={user.contactNumber}
/>
```

#### 2. MFA Settings Component
**Path:** `/frontend/src/components/MFASettings.js`

**Features:**
- MFA status display
- Enable MFA wizard:
  1. Verify phone
  2. Show backup codes
  3. Confirm and enable
- Disable MFA (with password)
- Regenerate backup codes
- Download backup codes as text

**UI States:**
- MFA Disabled → Show "Enable" button
- MFA Enabled → Show status + "Disable" button

#### 3. Login MFA Step
**Path:** Update `/frontend/src/components/Login.js`

**Flow:**
1. User enters username/password
2. If response has `X-MFA-Required: true`
3. Show MFA code input
4. Auto-send SMS code
5. User enters 6-digit code or backup code
6. Verify and complete login

**UI:**
```jsx
{mfaRequired && (
  <div className="mfa-step">
    <p>Enter the 6-digit code sent to {phoneMasked}</p>
    <input 
      type="text" 
      maxLength="6" 
      placeholder="000000"
      autoFocus
    />
    <button onClick={resendCode}>Resend Code</button>
    <a href="#" onClick={showBackupCodeInput}>Use backup code</a>
  </div>
)}
```

#### 4. Backup Codes Display
**Component:** `BackupCodesModal.js`

**Features:**
- Display all 10 codes
- Copy all button
- Download as .txt button
- Print button
- Warning: "Save these codes securely"

---

## Testing

### Manual Testing

**1. Phone Verification:**
```bash
# Send code
curl -X POST http://localhost:8000/api/auth/phone/send-code \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"phone": "+1234567890"}'

# Verify code (use mock_code from response in dev)
curl -X POST http://localhost:8000/api/auth/phone/verify \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"phone": "+1234567890", "code": "123456"}'
```

**2. Enable MFA:**
```bash
curl -X POST http://localhost:8000/api/auth/mfa/enable \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"phone": "+1234567890", "verification_code": "123456"}'
```

**3. Login with MFA:**
```bash
# Step 1: Login (will get MFA required error)
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "john_doe", "password": "password123"}'

# Step 2: Send MFA code
curl -X POST http://localhost:8000/api/auth/mfa/send-code \
  -H "Content-Type: application/json" \
  -d '{"username": "john_doe"}'

# Step 3: Login with MFA code
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "john_doe", "password": "password123", "mfa_code": "123456"}'
```

### Automated Tests (TODO)

Create: `/tests/test_sms_mfa.py`

**Test Cases:**
- Phone number validation
- OTP creation and expiry
- OTP verification (success/failure)
- Max attempts exceeded
- Rate limiting on resend
- MFA enable/disable
- Backup code generation and verification
- Login flow with SMS MFA
- Development mode mock codes

---

## Troubleshooting

### Issue: SMS not sending

**Check:**
1. Twilio credentials in `.env.local`
2. Phone number format (+1234567890)
3. Twilio account has funds (production)
4. Phone number is verified (trial account)

**Solution:**
- In development, use `mock_code` from response
- Check logs for Twilio errors
- Verify Twilio dashboard for delivery status

### Issue: "No OTP found or OTP already used"

**Cause:** OTP expired or already verified

**Solution:**
- Request new code with resend-code endpoint
- Check expiry time in response

### Issue: "Too many failed attempts"

**Cause:** 5 invalid code attempts

**Solution:**
- Request new OTP code
- OTP manager will reset attempts

### Issue: Backend can't import twilio

**Cause:** Package not installed

**Solution:**
```bash
cd fastapi_backend
pip install twilio==8.10.0
# or
pip install -r requirements.txt
```

---

## Next Steps

### Immediate (Backend Complete ✅)
- [x] SMS service with Twilio
- [x] OTP manager and validation
- [x] Phone verification endpoints
- [x] MFA enable/disable endpoints
- [x] Login flow integration
- [x] Backup codes system
- [x] Development mode support

### Frontend (Pending ⏳)
- [ ] PhoneVerification component
- [ ] MFASettings component
- [ ] Update Login.js for MFA step
- [ ] BackupCodesModal component
- [ ] Add to User Profile/Security settings page

### Testing (Pending ⏳)
- [ ] Write automated tests
- [ ] End-to-end testing
- [ ] Load testing for OTP system

### Documentation (Pending ⏳)
- [ ] User guide for enabling MFA
- [ ] Admin guide for Twilio setup
- [ ] API documentation in Swagger

---

## Summary

✅ **Backend Implementation:** COMPLETE  
⏳ **Frontend Implementation:** PENDING  
⏳ **Testing:** PENDING  
⏳ **Production Deployment:** PENDING

**Total Lines of Code:** ~1,500 lines  
**New Files:** 4  
**Modified Files:** 4  
**New API Endpoints:** 10

**Ready for:** Frontend development and integration testing

---

## Support

For issues or questions:
1. Check this documentation first
2. Review API endpoint responses
3. Check backend logs
4. Verify Twilio credentials
5. Test in development mode first

**Last Updated:** October 31, 2025
