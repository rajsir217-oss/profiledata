# 📧 SMTP Setup Guide for Local Development

## Quick Setup (5 minutes)

### Step 1: Enable 2-Factor Authentication
1. Go to: https://myaccount.google.com/security
2. Click **"2-Step Verification"**
3. Follow the prompts to enable it (if not already enabled)

### Step 2: Generate App Password
1. Go to: https://myaccount.google.com/apppasswords
   - Or search "App Passwords" in your Google Account settings
2. Select app: **Mail**
3. Select device: **Mac** (or "Other")
4. Click **Generate**
5. **Copy the 16-character password** (format: `xxxx xxxx xxxx xxxx`)

### Step 3: Update `.env.local`
Edit `fastapi_backend/.env.local`:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-actual-email@gmail.com
SMTP_PASSWORD=abcd efgh ijkl mnop    # Paste the 16-char password here
FROM_EMAIL=your-actual-email@gmail.com
FROM_NAME=L3V3L Dating (Dev)
```

### Step 4: Restart Backend
```bash
cd /Users/rajsiripuram02/opt/appsrc/profiledata
./bstart.sh
```

### Step 5: Test Email Sending
1. Go to **Dynamic Scheduler** in the app
2. Find **"Email Notifications"** job
3. Click **"Run Now"** (▶️)
4. Check your Gmail sent folder!

---

## Troubleshooting

### "Authentication failed" error
- Make sure you're using an **App Password**, not your regular Gmail password
- App Passwords are ONLY available if 2FA is enabled
- Remove any spaces from the password in `.env.local`

### Emails not sending
- Check backend logs for SMTP errors
- Verify SMTP_USER matches the email you're sending from
- Make sure backend was restarted after updating `.env.local`

### Can't find App Passwords option
- 2FA must be enabled first
- Some Google Workspace accounts may have this disabled by admin

---

## Alternative: Use Mailtrap (for testing)

If you don't want to use your real Gmail:

1. Sign up at: https://mailtrap.io (free)
2. Get your SMTP credentials
3. Update `.env.local`:

```env
SMTP_HOST=sandbox.smtp.mailtrap.io
SMTP_PORT=2525
SMTP_USER=your-mailtrap-username
SMTP_PASSWORD=your-mailtrap-password
FROM_EMAIL=test@example.com
FROM_NAME=L3V3L Dating (Test)
```

**Benefit:** Emails are captured in Mailtrap inbox (not actually sent).

---

## Production vs Local

| Setting | Production (`.env.production`) | Local (`.env.local`) |
|---------|-------------------------------|---------------------|
| SMTP_USER | From Secret Manager | Your real Gmail |
| SMTP_PASSWORD | From Secret Manager | App Password |
| FROM_EMAIL | noreply@l3v3l.com | Your Gmail |
| Purpose | Real users | Testing |

---

## Security Notes

⚠️ **Never commit `.env.local` with real credentials to Git!**

- `.env.local` is already in `.gitignore`
- App Passwords can be revoked anytime at https://myaccount.google.com/apppasswords
- Use Mailtrap for shared development environments

---

## Next Steps

Once SMTP is configured:
1. ✅ Email notifications will send from the queue
2. ✅ Check `notification_log` collection for sent emails
3. ✅ Verify delivery in your Gmail sent folder

**Need help?** Check backend logs or ask for assistance!
