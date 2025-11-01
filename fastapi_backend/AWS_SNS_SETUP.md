# AWS SNS Setup Guide

**Complete guide to setting up AWS SNS for SMS**

---

## 📋 Prerequisites

- Computer with internet access
- Email address (for AWS account)
- Phone number for testing
- Credit/debit card (for verification - AWS won't charge you!)

---

## 🚀 Step 1: Create AWS Account (10 minutes)

### 1.1 Sign Up

1. Go to https://aws.amazon.com
2. Click **"Create an AWS Account"**
3. Enter your email address
4. Choose **"Personal"** account type
5. Fill in your details:
   - Full name
   - Phone number
   - Address

### 1.2 Payment Information

**Don't worry!** AWS Free Tier includes:
- ✅ **1 Million SMS per month FREE**
- ✅ No charges unless you exceed limits
- ✅ Can set spending alerts

Enter your credit/debit card (required for verification only)

### 1.3 Phone Verification

- AWS will call or text you
- Enter the verification code

### 1.4 Choose Support Plan

- Select **"Basic Support - Free"**

### 1.5 Account Activation

- Wait 5-10 minutes for account activation
- Check your email for confirmation

---

## 🔑 Step 2: Get AWS Credentials (5 minutes)

### 2.1 Sign in to AWS Console

1. Go to https://console.aws.amazon.com
2. Sign in with your email and password

### 2.2 Create IAM User (Recommended - More Secure)

1. **Go to IAM Service:**
   - Search for "IAM" in the top search bar
   - Click **"IAM"** (Identity and Access Management)

2. **Create User:**
   - Click **"Users"** in left sidebar
   - Click **"Create user"** button
   - User name: `sns-sms-user`
   - Click **"Next"**

3. **Set Permissions:**
   - Select **"Attach policies directly"**
   - Search for: `AmazonSNSFullAccess`
   - Check the box next to it
   - Click **"Next"**
   - Click **"Create user"**

4. **Create Access Key:**
   - Click on the user you just created
   - Go to **"Security credentials"** tab
   - Scroll down to **"Access keys"**
   - Click **"Create access key"**
   - Choose **"Application running outside AWS"**
   - Click **"Next"**
   - Add description: "SMS OTP for dating app"
   - Click **"Create access key"**

5. **SAVE YOUR CREDENTIALS:**
   ```
   Access Key ID: AKIAIOSFODNN7EXAMPLE
   Secret Access Key: wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
   ```
   
   ⚠️ **CRITICAL:** Copy both values NOW! You can't view them again!

---

## 📍 Step 3: Choose AWS Region (1 minute)

AWS has different regions. Choose one close to you:

**Recommended Regions:**
- 🇺🇸 **US East (N. Virginia):** `us-east-1` - Cheapest, most reliable
- 🇺🇸 **US West (Oregon):** `us-west-2`
- 🇪🇺 **EU (Ireland):** `eu-west-1`
- 🇦🇺 **Asia Pacific (Sydney):** `ap-southeast-2`

**Best choice for most users:** `us-east-1`

---

## 💰 Step 4: Set Spending Limit (Optional but Recommended)

### 4.1 Set SMS Spending Limit

1. Go to **SNS Console:** https://console.aws.amazon.com/sns
2. Make sure you're in the correct region (top right corner)
3. Click **"Text messaging (SMS)"** in left sidebar
4. Click **"Account spend limit"**
5. Set limit:
   - **For testing:** $5-10/month
   - **For production:** $50-100/month
6. Click **"Set limit"**

### 4.2 Set Up Billing Alerts

1. Go to **Billing Console:** https://console.aws.amazon.com/billing
2. Click **"Budgets"** in left sidebar
3. Click **"Create budget"**
4. Choose **"Zero spend budget"** template
5. Enter your email
6. Click **"Create budget"**

You'll get alerts if you're charged anything!

---

## 🧪 Step 5: Run Test Script

### 5.1 Install AWS SDK

```bash
cd fastapi_backend
pip install boto3
```

### 5.2 Run Test Script

```bash
python3 test_aws_sns.py
```

### 5.3 Enter Your Credentials

```
Enter AWS Access Key ID: AKIAIOSFODNN7EXAMPLE
Enter AWS Secret Access Key: wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
Enter AWS Region (default: us-east-1): us-east-1
Enter phone number to test (+1234567890): +12345678901
```

### 5.4 Test Results

**If successful:**
```
✅ AWS credentials are valid!
✅ SMS sent successfully!
Check your phone for the message
```

**If in sandbox mode:**
```
⚠️  Account is in SANDBOX mode
You can only send SMS to verified phone numbers
```

---

## 🏖️ Step 6: Exit Sandbox Mode (5-10 minutes)

### Why?
- Sandbox mode = can only send to verified numbers
- Production mode = can send to ANY number

### How to Exit:

1. **Go to SNS Console:** https://console.aws.amazon.com/sns
2. Click **"Text messaging (SMS)"** in left sidebar
3. Look for **"Sandbox status"** section
4. Click **"Move to production"** or **"Request production access"**
5. Fill out the form:
   - **Use case:** Transactional messages (OTP codes, notifications)
   - **Website URL:** Your app URL
   - **Support email:** Your support email
   - **Expected volume:** 10,000 SMS/month
   - **Opt-in process:** Users opt-in by registering
6. Submit request

**Approval Time:** Usually instant to 24 hours

**While waiting, you can:**
- Verify your personal phone number
- Test with verified numbers
- Continue development

---

## ✅ Step 7: Verify Phone Number (If in Sandbox)

### Option A: Via Test Script

1. Run: `python3 test_aws_sns.py`
2. When prompted, choose to verify phone
3. Enter verification code from SMS

### Option B: Via AWS Console

1. Go to SNS Console
2. Click **"Text messaging (SMS)"**
3. Click **"Sandbox destination phone numbers"**
4. Click **"Add phone number"**
5. Enter phone number (+12345678901)
6. Click **"Add phone number"**
7. Check your phone for verification code
8. Enter code and click **"Verify phone number"**

---

## 🎯 Step 8: Add to Your App

After test script succeeds, add to `.env.local`:

```bash
# SMS Provider
SMS_PROVIDER=aws_sns

# AWS Credentials
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
AWS_REGION=us-east-1
```

---

## 🔍 Troubleshooting

### Error: "InvalidClientTokenId"
**Cause:** Wrong Access Key ID
**Fix:** Double-check your credentials

### Error: "SignatureDoesNotMatch"
**Cause:** Wrong Secret Access Key
**Fix:** Regenerate access key in IAM console

### Error: "OptedOut"
**Cause:** Phone number has opted out of SMS
**Fix:** 
1. Go to SNS Console
2. Text messaging (SMS) → Opted out phone numbers
3. Remove the number

### Error: "InvalidParameter: Invalid phone number"
**Cause:** Wrong phone format
**Fix:** Use E.164 format: +12345678901 (include country code)

### SMS Not Received
**Possible causes:**
1. ✅ Account in sandbox mode (verify phone first)
2. ✅ Wrong phone number format
3. ✅ Phone carrier blocked the message
4. ✅ Spending limit reached ($1 default)
5. ✅ Region doesn't support SMS to that country

**Check:**
- CloudWatch logs in AWS Console
- SMS activity in SNS Console

### Spending Limit Error
**Message:** "Daily SMS spend limit exceeded"
**Fix:**
1. SNS Console → Text messaging (SMS)
2. Account spend limit → Request increase
3. Or wait 24 hours for reset

---

## 💰 Cost Calculator

### Free Tier (First 12 Months):
- **1 Million SMS per month = FREE**

### After Free Tier:
- **US SMS:** $0.00645 per message
- **International:** Varies by country

### Examples:

**Scenario 1: Small App (1,000 users)**
- 5,000 OTP/month
- 10,000 notifications/month
- **Total:** 15,000 SMS/month
- **Cost:** $0 (within free tier)

**Scenario 2: Medium App (10,000 users)**
- 50,000 OTP/month
- 100,000 notifications/month
- **Total:** 150,000 SMS/month
- **Cost:** $0 (within free tier)

**Scenario 3: Large App (100,000 users)**
- 500,000 OTP/month
- 1,000,000 notifications/month
- **Total:** 1,500,000 SMS/month
- **Cost:**
  - First 1M: Free
  - Extra 500K: 500,000 × $0.00645 = **$3,225/month**

---

## 🔒 Security Best Practices

### ✅ DO:
- Use IAM user (not root account)
- Rotate access keys every 90 days
- Set spending limits
- Enable billing alerts
- Use environment variables (never commit credentials)
- Set least-privilege permissions

### ❌ DON'T:
- Share credentials in code
- Commit .env files to git
- Use root account credentials
- Give full admin access
- Ignore billing alerts

---

## 📊 Monitoring

### View SMS Activity:

1. **SNS Console → Text messaging (SMS) → Message deliveries**
   - See delivery status
   - Success/failure rates
   - Costs per message

2. **CloudWatch Logs**
   - Detailed delivery logs
   - Error messages
   - Debugging info

### Set Up Dashboards:

1. Go to CloudWatch Console
2. Create dashboard
3. Add widgets:
   - SMS sent (count)
   - SMS failed (count)
   - Total cost
   - Messages per day

---

## 🎓 Next Steps After Setup

1. ✅ Run test script (`python3 test_aws_sns.py`)
2. ✅ Verify SMS received on your phone
3. ✅ Add credentials to `.env.local`
4. ✅ Request production access (exit sandbox)
5. ⏳ I'll update the app code to use AWS SNS
6. ⏳ Test OTP flow in app
7. ⏳ Test notifications
8. ⏳ Deploy to production

---

## 📞 Need Help?

### AWS Support:
- **Documentation:** https://docs.aws.amazon.com/sns/
- **Forums:** https://forums.aws.amazon.com/
- **Support:** https://console.aws.amazon.com/support/

### Common Questions:

**Q: Is AWS Free Tier really free?**
A: Yes! 1M SMS/month for 12 months, no catch.

**Q: What happens after free tier expires?**
A: You pay $0.00645 per SMS. Still cheaper than Twilio!

**Q: Can I use multiple phone numbers?**
A: Yes, but you need to request sender IDs or buy phone numbers.

**Q: Which countries are supported?**
A: Most countries. Check: https://docs.aws.amazon.com/sns/latest/dg/sns-supported-regions-countries.html

**Q: Can I send to international numbers?**
A: Yes, but costs vary by country.

---

## ✅ Checklist

Before moving forward, make sure:

- [ ] AWS account created
- [ ] IAM user created with SNS permissions
- [ ] Access Key ID and Secret Key saved
- [ ] Spending limit set
- [ ] Billing alerts enabled
- [ ] Test script run successfully
- [ ] SMS received on phone
- [ ] Production access requested (if in sandbox)
- [ ] Credentials added to `.env.local`

**All checked?** → Ready to integrate into app! 🚀

---

**Last Updated:** October 31, 2025
