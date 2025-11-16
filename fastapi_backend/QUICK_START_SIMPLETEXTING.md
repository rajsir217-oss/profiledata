# 🚀 SimpleTexting Quick Start

**Status:** ✅ CONFIGURED & READY TO USE

---

## ⚡ 3-Step Quick Start

### Step 1: Verify Configuration ✅

```bash
cd fastapi_backend
cat .env | grep SIMPLETEXTING
```

**Expected output:**
```
SIMPLETEXTING_API_TOKEN=fce1fd7f37d8b2f61cd96986c947e6c3
SIMPLETEXTING_ACCOUNT_PHONE=3338611131
```

✅ **Already configured!**

---

### Step 2: Test SMS Sending

```bash
python test_simpletexting.py
```

**What happens:**
1. Loads your API credentials
2. Initializes SimpleTexting service
3. Asks for a phone number to test
4. Sends a test MFA code
5. Shows delivery status

**Enter your phone when prompted:**
```
Enter phone number to test: +15551234567
```

**Expected SMS message:**
```
[test_profile] Login code: 123456

Expires in 5 minutes.
Didn't request this? Ignore this message.
```

---

### Step 3: Restart Backend

```bash
./bstart.sh
```

**Check logs for:**
```
✅ SimpleTexting SMS Service initialized (Phone: 33386***)
```

✅ **You're done! SMS MFA is live!**

---

## 🧪 Test MFA Flow

### Enable MFA for a User

```bash
# 1. Login to get token
curl -X POST "http://localhost:8000/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "password": "testpass"
  }'

# Save the access_token from response

# 2. Enable SMS MFA
curl -X POST "http://localhost:8000/api/auth/mfa/enable" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "channel": "sms",
    "phone": "+15551234567",
    "verification_code": "123456"
  }'
```

### Test Login with MFA

```bash
# Login (will require MFA code)
curl -X POST "http://localhost:8000/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "password": "testpass"
  }'

# Response will be 403 with:
{
  "detail": "MFA_REQUIRED",
  "mfa_channel": "sms",
  "contact_masked": "555***67"
}

# Check your phone - you'll receive:
# [testuser] Login code: 123456

# Complete login with MFA code:
curl -X POST "http://localhost:8000/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "password": "testpass",
    "mfa_code": "123456"
  }'
```

---

## 📊 What's Already Set Up

✅ **Configuration Files:**
- `.env` - API credentials configured
- `config.py` - Settings class updated
- `services/simpletexting_service.py` - Service ready
- `services/sms_service.py` - OTPManager integrated

✅ **Features Working:**
- MFA login codes via SMS
- Email/phone verification via SMS
- Password reset codes via SMS
- Multi-profile support (username in messages)
- Auto phone number formatting
- Error handling & logging

✅ **No Additional Setup Needed:**
- Dependencies installed (httpx)
- Service auto-detects SimpleTexting
- Fallback to Twilio (if needed)
- Encrypted PII decryption (fixed earlier)

---

## 🔍 Troubleshooting

### If SMS doesn't send:

**1. Check environment variables:**
```bash
python -c "
import os
from dotenv import load_dotenv
load_dotenv()
print('Token:', os.getenv('SIMPLETEXTING_API_TOKEN')[:20] + '...')
print('Phone:', os.getenv('SIMPLETEXTING_ACCOUNT_PHONE'))
print('Provider:', os.getenv('SMS_PROVIDER'))
"
```

**2. Check backend logs:**
```bash
tail -f logs/app.log | grep -i simpletexting
```

**Expected:**
```
✅ SimpleTexting SMS Service initialized (Phone: 33386***)
```

**3. Restart backend:**
```bash
./bstop.sh
./bstart.sh
```

---

## 📱 Message Examples

**MFA Login:**
```
[username] Login code: 789012

Expires in 5 minutes.
Didn't request this? Ignore this message.
```

**Verification:**
```
[username] Your verification code is: 345678

This code will expire in 10 minutes.
Do not share this code with anyone.
```

**Password Reset:**
```
[username] Password reset code: 901234

Expires in 15 minutes.
Didn't request this? Secure your account.
```

---

## 💡 Tips

1. **Username in messages** helps when parents manage multiple profiles with same phone
2. **Rate limiting** built-in: 60s between resend attempts
3. **Phone formatting** automatic: converts any format to SimpleTexting format
4. **Costs** ~$0.04 per SMS - monitor in dashboard

---

## 📚 Full Documentation

- **Integration Guide:** `SIMPLETEXTING_INTEGRATION.md`
- **Multi-Profile Support:** `MULTI_PROFILE_MFA_SOLUTION.md`
- **MFA Encryption Fix:** `MFA_ENCRYPTION_FIX.md`

---

## ✅ You're Ready!

SimpleTexting SMS is **fully integrated and ready to use**.

**Next:** Run the test script!

```bash
python test_simpletexting.py
```

🎉 **Happy texting!**
