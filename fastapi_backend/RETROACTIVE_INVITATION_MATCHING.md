# 🔄 Retroactive Invitation Matching

## 📋 Problem

Some users registered via invitation links **before** the invitation acceptance tracking was fixed. These invitations show as "Sent" instead of "Accepted", even though the user successfully registered.

**Root Cause:**
- Invitation acceptance tracking bug (fixed in Register2.js)
- Historical registrations happened before the fix
- Invitations remain in "Sent" status

---

## ✅ Solution: Match Invitations to Existing Users

This script matches invitation emails with registered users and updates the invitation status retroactively.

**What it does:**
1. Finds all invitations NOT marked as "accepted"
2. For each invitation email, checks if a user exists with that `contactEmail`
3. If found, updates the invitation:
   - `emailStatus` → "ACCEPTED"
   - `smsStatus` → "ACCEPTED"
   - `registeredUsername` → user's username
   - `registeredAt` → user's registration date

---

## 🚀 Usage

### Local Development

**Dry Run (safe - shows what will be updated):**
```bash
cd fastapi_backend
./match_invitations.sh
```

**Live Run (updates database):**
```bash
./match_invitations.sh --live
```

---

### Production

**Dry Run:**
```bash
cd fastapi_backend
./match_invitations_production.sh
```

**Live Run:**
```bash
./match_invitations_production.sh --live
```

When prompted:
1. Enter your production MongoDB URL
2. Type `YES` to confirm

---

## 📊 Example Output

```
================================================================================
🔍 MATCHING INVITATIONS TO REGISTERED USERS
================================================================================
Database: matrimonialDB
Mode: DRY RUN (no changes)

📊 Found 20 invitations to check

  ✅ [1/20] MATCH: John Doe (john@example.com) → User: johndoe123
      Registered: 2025-11-28 10:30:00
  ✅ [2/20] MATCH: Jane Smith (jane@example.com) → User: janesmith456
      Registered: 2025-11-29 14:20:00
  ⏭️  [3/20] No user found: Bob Wilson (bob@example.com)
  ...

================================================================================
📊 SUMMARY
================================================================================
Total Invitations Checked: 20
✅ Matched (user exists): 15
⏭️  Not Matched (no user): 5

⚠️  DRY RUN MODE - No changes were made to the database
   Run with --live flag to apply changes
================================================================================
```

---

## 🔍 How It Works

### Matching Logic

```python
# Find invitation by email
invitation = db.invitations.find_one({"email": "user@example.com"})

# Look for user with this email
user = db.users.find_one({"contactEmail": "user@example.com"})

# If both exist, link them
if user:
    db.invitations.update_one(
        {"_id": invitation["_id"]},
        {
            "$set": {
                "emailStatus": "ACCEPTED",
                "registeredUsername": user["username"],
                "registeredAt": user["created_at"]
            }
        }
    )
```

---

## ⚠️ Important Notes

### Safe to Run Multiple Times
- **Idempotent:** Can be run multiple times safely
- Only updates invitations that are NOT already accepted
- Skips invitations that are already correctly linked

### No Data Loss
- **Dry run first:** Always test with dry run mode
- **Reversible:** Can manually revert changes if needed
- **Logs all changes:** Shows exactly what was updated

### Production Checklist
✅ Run dry run first to see what will change  
✅ Review the matched invitations  
✅ Backup database (optional but recommended)  
✅ Run live mode with confirmation  
✅ Verify acceptance rate in Admin Dashboard  

---

## 📈 Expected Results

### Before Running Script

**Admin Dashboard - Invitations:**
```
Total Invitations: 100
Sent: 85
Accepted: 15
Acceptance Rate: 15%
```

### After Running Script

**Admin Dashboard - Invitations:**
```
Total Invitations: 100
Sent: 35
Accepted: 65
Acceptance Rate: 65%  ← Much better!
```

---

## 🔗 Related Fixes

This script is part of a comprehensive invitation system fix:

1. ✅ **Backend Token Generation:** Fixed bulk import to generate tokens
2. ✅ **Acceptance Tracking:** Fixed Register2.js API endpoint
3. ✅ **Token Validation:** Fixed ObjectId → string conversion
4. ✅ **Retroactive Matching:** This script (for historical data)
5. ✅ **Auto Token Generation:** Bulk send/resend generates tokens if missing

---

## 🧪 Testing

### Test with Sample Data

**Create test invitation:**
```javascript
// In Admin Dashboard → Invitations
// Create invitation for: test@example.com
```

**Register test user:**
```javascript
// Go to /register2?invitation=TOKEN&email=test@example.com
// Complete registration with email: test@example.com
```

**Run matching script:**
```bash
./match_invitations.sh
# Should show: ✅ MATCH: test@example.com
```

**Verify in database:**
```javascript
db.invitations.findOne({email: "test@example.com"})
// Should show: emailStatus: "ACCEPTED", registeredUsername: "testuser"
```

---

## 📝 Files Created

1. **match_invitations_to_users.py** - Python script (local dev)
2. **match_invitations.sh** - Bash wrapper (local dev)
3. **match_invitations_production.sh** - MongoDB shell version (production)
4. **RETROACTIVE_INVITATION_MATCHING.md** - This documentation

---

## 🎯 Success Criteria

After running this script, you should see:

✅ **Accurate Acceptance Rate**
- Reflects actual user registrations
- Shows true conversion metrics

✅ **Proper User Linkage**
- Invitations linked to registered users
- `registeredUsername` field populated

✅ **Clean Dashboard**
- "Sent" count reduced
- "Accepted" count increased
- Acceptance rate improved

---

## 🆘 Troubleshooting

### Issue: No matches found

**Possible causes:**
1. User email doesn't match invitation email exactly
2. User registered with different email
3. User hasn't registered yet

**Solution:** Check user's `contactEmail` field manually

---

### Issue: Script fails with connection error

**Solution:**
```bash
# Verify MongoDB URL is correct
mongosh "$MONGO_URL" --eval "db.users.countDocuments({})"
```

---

### Issue: Partial updates

**Solution:**
- Script logs errors for failed updates
- Re-run the script - it will skip already-updated invitations
- Check error messages for specific issues

---

## 📅 Maintenance

### When to Run

- **After fixing historical invitation bugs:** One-time retroactive fix
- **Periodically:** Check for any missed acceptances
- **After data migrations:** Re-link invitations if needed

### Scheduling (Optional)

```bash
# Add to cron for weekly check (Sunday 2 AM)
0 2 * * 0 cd /path/to/fastapi_backend && ./match_invitations.sh --live >> match_invitations.log 2>&1
```

---

**Created:** November 30, 2025  
**Purpose:** Retroactively match invitations to registered users  
**Impact:** Improves invitation acceptance tracking accuracy
