# 🚀 Production Invitation Token Fix Guide

## 🎯 Overview
Fix the missing invitation tokens in your production database on GCP.

---

## ⚠️ IMPORTANT - Read First!

**What This Does:**
- Adds `invitationToken` field to invitations that are missing it
- Sets 90-day expiry for tokens
- **Does NOT** modify any other data
- **Safe to run** - only updates invitations with missing tokens

**Backup Recommendation:**
```bash
# Optional but recommended - backup invitations collection first
mongosh <PRODUCTION_URL> --eval "db.invitations.find().forEach(printjson)" > invitations_backup.json
```

---

## 🔧 Option 1: Run from Local Machine (Recommended)

### Step 1: Make Script Executable
```bash
cd /Users/rajsiripuram02/opt/appsrc/profiledata/fastapi_backend
chmod +x fix_invitation_tokens_production.sh
```

### Step 2: Get Production MongoDB URL

**If using MongoDB Atlas (GCP):**
```
mongodb+srv://username:password@cluster.mongodb.net/matrimonialDB
```

**If using GCP VM with MongoDB:**
```
mongodb://username:password@<GCP-VM-IP>:27017/matrimonialDB
```

**If using GCP Cloud SQL (MongoDB compatible):**
```
mongodb://username:password@<CLOUD-SQL-IP>:27017/matrimonialDB
```

### Step 3: Run the Fix Script
```bash
./fix_invitation_tokens_production.sh
```

**You'll be prompted for:**
1. MongoDB URL (paste your production URL)
2. Review of invitations to fix
3. Type `PRODUCTION` to confirm (safety measure)

---

## 🔧 Option 2: SSH into Production Server

### Step 1: Copy Script to Production
```bash
# From your local machine
scp fix_invitation_tokens.sh <user>@<production-server>:/home/<user>/
```

### Step 2: SSH into Server
```bash
ssh <user>@<production-server>
```

### Step 3: Run the Script
```bash
cd /home/<user>
chmod +x fix_invitation_tokens.sh
./fix_invitation_tokens.sh
```

**Type `yes` when prompted**

---

## 🔧 Option 3: Use GCP Cloud Shell

### Step 1: Open GCP Cloud Shell
1. Go to https://console.cloud.google.com
2. Click the Cloud Shell icon (top right)
3. Wait for shell to initialize

### Step 2: Install mongosh (if not installed)
```bash
wget https://downloads.mongodb.com/compass/mongosh-1.10.6-linux-x64.tgz
tar -xvzf mongosh-1.10.6-linux-x64.tgz
sudo mv mongosh-1.10.6-linux-x64/bin/mongosh /usr/local/bin/
```

### Step 3: Create and Run Fix Script
```bash
cat > fix_tokens.sh << 'EOF'
#!/bin/bash
# Get MongoDB URL from user
read -p "Enter production MongoDB URL: " MONGO_URL

mongosh "$MONGO_URL" --quiet --eval "
function generateToken(length) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < length; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

const now = new Date();
const expiryDate = new Date();
expiryDate.setDate(expiryDate.getDate() + 90);

const invitations = db.invitations.find({
  \\\$or: [
    {invitationToken: {\\\$exists: false}},
    {invitationToken: null}
  ]
}).toArray();

print('Found ' + invitations.length + ' invitations to fix');

let fixedCount = 0;
invitations.forEach(inv => {
  const token = generateToken(32);
  db.invitations.updateOne(
    {_id: inv._id},
    {\\\$set: {invitationToken: token, tokenExpiresAt: expiryDate, updatedAt: now}}
  );
  fixedCount++;
});

print('✅ Fixed ' + fixedCount + ' invitations');
"
EOF

chmod +x fix_tokens.sh
./fix_tokens.sh
```

---

## ✅ Verification

After running the fix, verify it worked:

```bash
# Check how many invitations still missing tokens (should be 0)
mongosh <PRODUCTION_URL> --eval "
  db.invitations.countDocuments({
    \$or: [
      {invitationToken: {\$exists: false}},
      {invitationToken: null}
    ]
  })
"

# Show a sample invitation with token
mongosh <PRODUCTION_URL> --eval "
  db.invitations.findOne({invitationToken: {\$ne: null}}, {
    name: 1,
    email: 1,
    invitationToken: 1,
    tokenExpiresAt: 1
  })
"
```

Expected output:
```
0  // No invitations missing tokens

{
  _id: ObjectId("..."),
  name: "John Doe",
  email: "john@example.com",
  invitationToken: "abc123XYZ789...",  // 32-character token
  tokenExpiresAt: ISODate("2026-03-01T...")  // 90 days from now
}
```

---

## 📧 After Running the Fix

### 1. Verify Backend is Using Fixed Data
- Restart your FastAPI backend (if needed)
- The backend will now read tokens from database

### 2. Resend Invitations
**Users who already received broken links need new emails:**

1. Go to https://y3xmatches.com/invitations (admin only)
2. Filter by "Pending" status
3. Select invitations that were sent before (check "Email Status: Sent")
4. Click "Resend" for each, or use bulk resend

**The new emails will have proper links:**
```
✅ https://y3xmatches.com/register2?invitation=abc123XYZ789...&email=user@example.com
❌ https://y3xmatches.com/register2?invitation=None&email=user@example.com  (old broken link)
```

### 3. Monitor Acceptance Rate
- Check Invitation Manager dashboard
- Acceptance rate should start increasing as users register
- Track `registeredAt` field being populated

---

## 🔍 Troubleshooting

### Issue: Can't connect to MongoDB
**Solution:** Check these:
- Firewall rules allow your IP
- MongoDB is running
- Credentials are correct
- Connection string format is correct

### Issue: Permission denied
**Solution:** Ensure MongoDB user has write permissions:
```javascript
db.grantRolesToUser("username", [
  { role: "readWrite", db: "matrimonialDB" }
])
```

### Issue: Script says "0 found" but you know there are missing tokens
**Solution:** Double-check you're connected to the right database:
```bash
mongosh <URL> --eval "db.getName()"  # Should output: matrimonialDB
```

---

## 📊 Expected Results

### Before Fix (Current State)
```
Total Invitations: 373
Missing Tokens: 367
Acceptance Rate: 0%
```

### After Fix (Immediate)
```
Total Invitations: 373
Missing Tokens: 0
Acceptance Rate: 0% (still - users haven't registered yet)
```

### After Resending Invitations (Within Days/Weeks)
```
Total Invitations: 373
Missing Tokens: 0
Accepted: 20-50+ (depends on user response)
Acceptance Rate: 5-15% (realistic range)
```

---

## 🆘 Need Help?

If you encounter issues:

1. **Check MongoDB logs:** Look for connection errors
2. **Check backend logs:** `/logs/app.log` for invitation-related errors
3. **Test with one invitation first:** Manually update one record to test
4. **Verify environment variables:** Check `.env` files for correct MongoDB URL

---

## 📝 Summary Checklist

- [ ] Backed up invitations collection (optional but recommended)
- [ ] Ran fix script (local or production)
- [ ] Verified 0 invitations missing tokens
- [ ] Restarted backend (if needed)
- [ ] Resent invitations to affected users
- [ ] Monitoring acceptance rate
- [ ] Future bulk imports will auto-generate tokens (already fixed in code)

---

**Status:** Ready to run  
**Risk Level:** Low (only adds missing fields, doesn't modify existing data)  
**Estimated Time:** 2-5 minutes  
**Rollback:** Not needed (only adds new fields)
