# SMS MFA Quick Setup Guide

## 🚀 Quick Start (5 Minutes)

### Step 1: Install Twilio Package

```bash
cd fastapi_backend
pip install twilio==8.10.0
```

### Step 2: Add Environment Variables

Add to `fastapi_backend/.env.local`:

```bash
# For Development (no SMS, use mock codes)
ENVIRONMENT=development

# For Production (real SMS via Twilio)
ENVIRONMENT=production
TWILIO_ACCOUNT_SID=your_account_sid_here
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_FROM_PHONE=+1234567890
```

### Step 3: Restart Backend

```bash
# Kill existing backend
pkill -f uvicorn

# Start fresh
cd fastapi_backend
uvicorn main:app --reload --port 8000
```

### Step 4: Test in Development Mode

**Without Twilio credentials, you can still test using mock codes!**

```bash
# 1. Login first
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "your_username",
    "password": "your_password"
  }'

# Save the access_token from response

# 2. Send verification code
curl -X POST http://localhost:8000/api/auth/phone/send-code \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"phone": "+1234567890"}'

# Response will include mock_code in development:
# {
#   "success": false,
#   "message": "SMS service not configured",
#   "mock_code": "123456",  ← Use this code!
#   "expires_at": "..."
# }

# 3. Verify phone with mock code
curl -X POST http://localhost:8000/api/auth/phone/verify \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+1234567890",
    "code": "123456"
  }'

# 4. Enable MFA (will return backup codes)
curl -X POST http://localhost:8000/api/auth/mfa/enable \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+1234567890",
    "verification_code": "123456"
  }'

# Save the backup codes! They'll look like:
# ["A1B2-C3D4", "E5F6-G7H8", ...]
```

---

## 📱 Production Setup (With Real SMS)

### Step 1: Create Twilio Account

1. Go to https://www.twilio.com/try-twilio
2. Sign up (free trial available)
3. Verify your email and phone

### Step 2: Get Credentials

1. Go to **Console Dashboard**
2. Find **Account SID** (starts with AC...)
3. Find **Auth Token** (click to reveal)
4. Copy both

### Step 3: Get Phone Number

**Option A: Trial (Free)**
- Use trial number provided by Twilio
- Can only send to verified numbers
- Adds "Sent from a Twilio trial account" prefix

**Option B: Buy Number ($1-2/month)**
1. Go to **Phone Numbers** → **Buy a Number**
2. Search for US number
3. Buy number with SMS capability
4. Copy the phone number (+1234567890)

### Step 4: Update .env.local

```bash
ENVIRONMENT=production
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_FROM_PHONE=+1234567890
```

### Step 5: Verify a Number (Trial Only)

If using trial account:
1. Go to **Phone Numbers** → **Verified Caller IDs**
2. Click **Add a new number**
3. Enter your personal phone
4. Verify with code

Now you can test SMS to your phone!

### Step 6: Test Real SMS

```bash
# Send code (will actually send SMS!)
curl -X POST http://localhost:8000/api/auth/phone/send-code \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"phone": "+YOUR_VERIFIED_PHONE"}'

# Check your phone for SMS with 6-digit code
# Then verify:

curl -X POST http://localhost:8000/api/auth/phone/verify \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+YOUR_VERIFIED_PHONE",
    "code": "CODE_FROM_SMS"
  }'
```

---

## 🔒 Enable MFA for Your Account

### Using cURL:

```bash
# 1. Login
TOKEN=$(curl -s -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"YOUR_USERNAME","password":"YOUR_PASSWORD"}' \
  | jq -r '.access_token')

# 2. Send verification code
curl -X POST http://localhost:8000/api/auth/phone/send-code \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"phone":"+1234567890"}'

# 3. Verify phone (use mock_code from response in dev)
curl -X POST http://localhost:8000/api/auth/phone/verify \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"phone":"+1234567890","code":"123456"}'

# 4. Enable MFA (SAVE THE BACKUP CODES!)
curl -X POST http://localhost:8000/api/auth/mfa/enable \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"phone":"+1234567890","verification_code":"123456"}' \
  | jq '.codes'
```

**IMPORTANT:** Save those backup codes somewhere safe!

---

## 🧪 Test MFA Login

### Step 1: Logout / Use Incognito

### Step 2: Try to Login (Will Fail with MFA Required)

```bash
curl -v -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "YOUR_USERNAME",
    "password": "YOUR_PASSWORD"
  }'

# Response: 403 Forbidden
# Headers: X-MFA-Required: true
# Body: {"detail": "MFA code required"}
```

### Step 3: Request MFA Code

```bash
curl -X POST http://localhost:8000/api/auth/mfa/send-code \
  -H "Content-Type: application/json" \
  -d '{"username":"YOUR_USERNAME"}'

# In development, response includes mock_code
# In production, check your phone for SMS
```

### Step 4: Login with MFA Code

```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "YOUR_USERNAME",
    "password": "YOUR_PASSWORD",
    "mfa_code": "123456"
  }'

# Success! Returns access_token and refresh_token
```

### Step 5: Try Backup Code

```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "YOUR_USERNAME",
    "password": "YOUR_PASSWORD",
    "mfa_code": "A1B2-C3D4"
  }'

# Success! Backup code is consumed (can't use again)
```

---

## 🛠️ API Endpoints Summary

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/auth/phone/send-code` | POST | ✅ | Send verification code |
| `/api/auth/phone/verify` | POST | ✅ | Verify phone |
| `/api/auth/phone/resend-code` | POST | ✅ | Resend code |
| `/api/auth/phone/status` | GET | ✅ | Check verification status |
| `/api/auth/mfa/status` | GET | ✅ | Check MFA status |
| `/api/auth/mfa/enable` | POST | ✅ | Enable MFA |
| `/api/auth/mfa/disable` | POST | ✅ | Disable MFA |
| `/api/auth/mfa/send-code` | POST | ❌ | Send login MFA code |
| `/api/auth/mfa/verify-code` | POST | ❌ | Verify login MFA code |
| `/api/auth/mfa/regenerate-backup-codes` | POST | ✅ | Get new backup codes |

---

## 🐛 Troubleshooting

### "SMS service not configured"

**In Development:**
- ✅ This is normal! Use the `mock_code` from the response
- Set `ENVIRONMENT=development` in `.env.local`

**In Production:**
- ❌ Check Twilio credentials in `.env.local`
- Verify credentials are correct
- Check Twilio account has funds

### "No OTP found or OTP already used"

- OTP expired (10 min for verification, 5 min for MFA)
- Already verified
- **Solution:** Request new code with resend endpoint

### "Too many failed attempts"

- Entered wrong code 5 times
- **Solution:** Request new code

### "Invalid phone number format"

- Must be E.164 format: `+1234567890`
- US numbers should have 10-11 digits
- Include country code (+1 for US)

### Backend error: "No module named 'twilio'"

```bash
cd fastapi_backend
pip install twilio==8.10.0
```

### MongoDB connection issues

- Make sure MongoDB is running
- Check `otp_codes` collection exists (auto-created)

---

## 📊 Database Queries

### Check OTP Codes

```javascript
// MongoDB shell
use matrimonialDB

// View all OTP codes
db.otp_codes.find().pretty()

// View OTPs for specific user
db.otp_codes.find({identifier: "username"}).pretty()

// View unexpired OTPs
db.otp_codes.find({
  expires_at: {$gt: new Date()}
}).pretty()

// Clean up expired OTPs manually
db.otp_codes.deleteMany({
  expires_at: {$lt: new Date()}
})
```

### Check User MFA Status

```javascript
// View user's MFA settings
db.users.findOne(
  {username: "username"},
  {
    "mfa": 1,
    "status.phone_verified": 1,
    "contactNumber": 1
  }
).pretty()

// Disable MFA manually (emergency)
db.users.updateOne(
  {username: "username"},
  {
    $set: {
      "mfa.mfa_enabled": false,
      "mfa.mfa_backup_codes": []
    }
  }
)
```

---

## ✅ Success Checklist

- [ ] Twilio package installed
- [ ] Environment variables set
- [ ] Backend restarted
- [ ] Can send verification code
- [ ] Can verify phone number
- [ ] Can enable MFA
- [ ] Backup codes saved
- [ ] Can login with MFA code
- [ ] Can login with backup code
- [ ] Frontend UI planned

---

## 🚀 Next: Frontend Implementation

See `SMS_MFA_IMPLEMENTATION.md` for frontend component specifications.

Key components needed:
1. `PhoneVerification.js` - Phone verification flow
2. `MFASettings.js` - Enable/disable MFA
3. `Login.js` (update) - MFA step during login
4. `BackupCodesModal.js` - Display backup codes

---

## 📞 Support

Backend implementation is complete and tested!

For questions:
1. Check the logs: `tail -f fastapi_backend/logs/app.log`
2. Check Twilio dashboard for delivery status
3. Review `SMS_MFA_IMPLEMENTATION.md` for full documentation

**Happy Coding!** 🎉
