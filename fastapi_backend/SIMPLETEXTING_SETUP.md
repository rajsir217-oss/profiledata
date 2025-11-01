# SimpleTexting SMS Setup Guide 📱

**Why SimpleTexting?** Clean API, US/Canada optimized, business-focused, great for OTP/MFA!

---

## 🎯 **Quick Start (10 minutes)**

### **Step 1: Create SimpleTexting Account**

1. **Go to:** https://simpletexting.com
2. Click **"Try It Free"**
3. **Fill out signup:**
   - Business name
   - Your name
   - Email
   - Password
4. **Choose a plan:**
   - 14-day free trial (no credit card needed!)
   - Plans start at $29/month (500 credits)
   - $0.03-$0.04 per SMS

### **Step 2: Get Your Phone Number**

1. Log into dashboard: https://app2.simpletexting.com
2. Go to **Settings** → **Phone Numbers**
3. **Choose number type:**
   - **Local number** (best for personal texting) - $15/month
   - **Toll-free** (1-800) - $25/month
   - **Dedicated short code** (enterprise) - $500/month
4. **Select your number**
5. **Save your number:** e.g., `8005551234`

### **Step 3: Get API Token**

1. In dashboard, go to **Settings** → **Integrations**
2. Click **"Webhooks & API"**
3. Scroll to **"API Access"** section
4. **Request API Access:**
   - Email: support@simpletexting.net
   - Subject: "API Access Request"
   - Message: "Hi, I need API access for OTP/MFA authentication in my dating app"
5. **Wait for approval** (usually 1-2 business days)
6. **Copy your API Token** when approved

---

## ⚙️ **Configuration**

### **Add to `.env.local`:**

```bash
# SMS Provider Configuration
SMS_PROVIDER=simpletexting

# SimpleTexting Credentials
SIMPLETEXTING_API_TOKEN=st_1234567890abcdef
SIMPLETEXTING_ACCOUNT_PHONE=8005551234
```

**That's it!** No complex setup like Twilio or AWS!

---

## 🧪 **Test Your Setup**

### **Option 1: Backend Test**

```bash
cd fastapi_backend

# Test with curl
curl -X POST http://localhost:8000/api/auth/otp/send \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "channel": "sms",
    "phone": "+1234567890"
  }'
```

### **Option 2: Python Test Script**

```python
import asyncio
from services.simpletexting_service import SimpleTextingService

async def test():
    service = SimpleTextingService()
    result = await service.send_otp(
        phone="+1234567890",
        otp="123456",
        purpose="verification"
    )
    print(result)

asyncio.run(test())
```

---

## 💰 **Pricing Breakdown**

### **SimpleTexting Costs:**

| Item | Cost | Details |
|------|------|---------|
| **Phone Number** | $15-25/month | Local or Toll-free |
| **Base Plan** | $29/month | 500 credits included |
| **Per SMS** | $0.03-$0.04 | Additional messages |
| **Setup Fee** | $0 | No setup cost |

### **Example Costs:**

**100 users/month OTP:**
- 200 SMS (send + resend) = ~$8
- Phone number = $15
- Plan = $29
- **Total: $29/month** (credits cover it)

**1,000 users/month OTP:**
- 2,000 SMS = ~$80
- Phone number = $15
- Plan = $99/month (3,000 credits)
- **Total: $99/month** (credits cover it)

---

## 🔥 **Why Choose SimpleTexting?**

### **vs Twilio:**
✅ **Simpler API** - Just Bearer token  
✅ **Better for business** - Built for marketing/notifications  
✅ **US/Canada focused** - Optimized for your market  
✅ **Two-way SMS included** - No extra setup  
❌ More expensive at scale

### **vs AWS SNS:**
✅ **Much easier setup** - No IAM, no sandbox  
✅ **Better support** - Real humans  
✅ **Business features** - Autoresponders, templates  
✅ **Instant activation** - No waiting for production  
❌ Costs more per SMS

### **Best For:**
- ✅ US/Canada businesses
- ✅ SMBs needing simplicity
- ✅ Apps with moderate SMS volume (< 10K/month)
- ✅ Teams wanting managed service
- ✅ Businesses needing compliance help

---

## 📝 **API Reference**

### **Send OTP**

```bash
POST https://api-app2.simpletexting.com/v2/api/messages
Authorization: Bearer YOUR_API_TOKEN
Content-Type: application/json

{
  "contactPhone": "2025551234",
  "accountPhone": "8005551234",
  "text": "Your verification code is: 123456",
  "mode": "AUTO"
}
```

### **Response:**

```json
{
  "data": {
    "id": "507f1f77bcf86cd799439011",
    "status": "sent",
    "credits_used": 1
  }
}
```

---

## 🔒 **Security Best Practices**

### **1. Protect Your API Token**

```bash
# ✅ Good - Environment variable
SIMPLETEXTING_API_TOKEN=st_abc123

# ❌ Bad - Hardcoded
api_token = "st_abc123"
```

### **2. Rate Limiting**

SimpleTexting has built-in rate limits:
- **100 SMS/minute** (default)
- Request increase if needed

### **3. Validate Phone Numbers**

Always validate before sending:
```python
def validate_us_phone(phone: str) -> bool:
    digits = ''.join(filter(str.isdigit, phone))
    return len(digits) == 10 or (len(digits) == 11 and digits[0] == '1')
```

### **4. Monitor Usage**

Check dashboard daily:
- Credits remaining
- Delivery rates
- Failed messages

---

## 🚨 **Troubleshooting**

### **"API Token Not Found"**
❌ **Problem:** Token not configured  
✅ **Solution:** Add to `.env.local` and restart server

### **"Invalid Phone Number"**
❌ **Problem:** Wrong format  
✅ **Solution:** Use 10 digits for US (no +1 prefix)

### **"Insufficient Credits"**
❌ **Problem:** Ran out of SMS credits  
✅ **Solution:** Add credits or upgrade plan

### **"Number Not Verified"**
❌ **Problem:** Need to verify recipient (if in test mode)  
✅ **Solution:** Go to dashboard → Contacts → Verify number

### **"Rate Limit Exceeded"**
❌ **Problem:** Sending too many SMS too fast  
✅ **Solution:** Implement queue or contact support for increase

---

## 📞 **Support**

### **SimpleTexting Support:**
- **Email:** support@simpletexting.net
- **Phone:** 1-866-450-4185
- **Chat:** Available in dashboard
- **Hours:** Mon-Fri 9am-5pm EST

### **API Documentation:**
- **Docs:** https://api-doc.simpletexting.com/
- **Support:** https://help.simpletexting.com/

---

## 🔄 **Migration from Twilio**

Already using Twilio? Easy migration!

### **1. Keep Twilio Running:**

```bash
# .env.local
SMS_PROVIDER=auto  # Try SimpleTexting first, fallback to Twilio
SIMPLETEXTING_API_TOKEN=your_token
TWILIO_ACCOUNT_SID=your_sid
```

### **2. Test SimpleTexting:**

Send some test OTPs through SimpleTexting

### **3. Switch Over:**

```bash
SMS_PROVIDER=simpletexting  # Use only SimpleTexting
```

### **4. Remove Twilio:**

Once confident, remove Twilio credentials

---

## ⚡ **Quick Comparison Table**

| Feature | SimpleTexting | Twilio | AWS SNS |
|---------|--------------|--------|---------|
| **Setup Time** | 🟢 10 min | 🟡 30 min | 🔴 2 hours |
| **API Complexity** | 🟢 Simple | 🟡 Medium | 🔴 Complex |
| **Cost/SMS** | 🟡 $0.03-0.04 | 🟢 $0.0075 | 🟢 $0.0065 |
| **Free Tier** | 🔴 No | 🟡 Trial credits | 🟢 1M/month |
| **Support** | 🟢 Excellent | 🟡 Good | 🔴 AWS docs |
| **US/Canada** | 🟢 Optimized | 🟢 Good | 🟡 OK |
| **Two-Way SMS** | 🟢 Built-in | 🟡 Extra setup | 🔴 Not included |
| **Business Features** | 🟢 Many | 🟡 Some | 🔴 None |

---

## 🎉 **You're Ready!**

SimpleTexting is configured! Your app can now:
- ✅ Send OTP codes via SMS
- ✅ Enable SMS-based MFA
- ✅ Send user notifications
- ✅ Choose between Email/SMS per user

**Next Steps:**
1. Test with a few SMS
2. Monitor delivery rates
3. Build frontend OTP components
4. Launch!

---

**Questions?** Check the API docs or email SimpleTexting support! 📱
