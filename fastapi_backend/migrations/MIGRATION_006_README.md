# Migration 006: Location Field Array-to-String Conversion

**Date:** December 5, 2025  
**Priority:** HIGH - Required before deploying UI changes  
**Estimated Time:** 2-5 minutes (depending on user count)

---

## 📋 Overview

This migration converts `partnerCriteria.location` from a multi-select array format to a free-text string format.

### Why This Change?

**Before (Array):**
```javascript
partnerCriteria: {
  location: ["California", "New York", "Texas"]
}
```

**After (String):**
```javascript
partnerCriteria: {
  location: "California, New York, Texas"
}
```

**Benefits:**
- Simpler user input (free text instead of multi-select dropdown)
- Allows any custom location text
- Default value: "Any Location"
- Backward compatible display in Profile component

---

## 🚀 How to Run

### 1. Automatic Migration (Recommended)

```bash
cd fastapi_backend/migrations
python run_migrations.py
```

This will:
- ✅ Detect pending migrations
- ✅ Run migration 006 automatically
- ✅ Record in migration_history collection
- ✅ Skip already-migrated records

### 2. Check Status

```bash
python run_migrations.py --status
```

Expected output:
```
Total Scripts: 6
Applied: 6
Pending: 0

📋 Migration List:
  ✅ 001_seed_email_templates - completed (2025-12-01 10:00)
  ✅ 002_add_notification_indexes - completed (2025-12-01 10:01)
  ...
  ✅ 006_migrate_location_to_string - completed (2025-12-05 12:58)
```

### 3. Manual Run (if needed)

```bash
cd fastapi_backend/migrations
python migrate_location_to_string.py
```

---

## ✅ Verification

### Check Migration Success

```bash
mongosh $MONGODB_URL
```

```javascript
// Count array-based locations (should be 0 after migration)
db.users.countDocuments({'partnerCriteria.location': {$type: 'array'}})

// Count string-based locations (should match total users)
db.users.countDocuments({'partnerCriteria.location': {$type: 'string'}})

// View sample migrated data
db.users.find(
  {'partnerCriteria.location': {$exists: true}}, 
  {username: 1, 'partnerCriteria.location': 1}
).limit(5)
```

### Expected Results

```javascript
// Sample migrated data:
{
  "_id": ObjectId("..."),
  "username": "user123",
  "partnerCriteria": {
    "location": "California, New York"  // Was: ["California", "New York"]
  }
}

{
  "_id": ObjectId("..."),
  "username": "user456",
  "partnerCriteria": {
    "location": "Any Location"  // Was: ["Any"] or []
  }
}
```

---

## 🔄 Conversion Logic

| Original Array | Converted String |
|----------------|------------------|
| `["California", "New York"]` | `"California, New York"` |
| `["Any"]` | `"Any Location"` |
| `["Any Location"]` | `"Any Location"` |
| `[]` (empty) | `"Any Location"` |
| `["Bangalore"]` | `"Bangalore"` |

---

## 🔐 Safety Features

1. **Idempotent:** Safe to run multiple times
2. **Batch Processing:** Processes in batches (100 at a time)
3. **Error Handling:** Continues on individual errors
4. **Progress Tracking:** Shows progress every 10 users
5. **Dry Run:** Use `--dry-run` flag to preview

---

## 🔙 Rollback

**Note:** This migration does not automatically save original array values in a separate field.

To rollback manually:

```javascript
// You would need to manually restore based on your backup
// Or use the string-to-array conversion if needed:

db.users.find({'partnerCriteria.location': {$type: 'string'}}).forEach(user => {
  let locations = user.partnerCriteria.location.split(', ');
  db.users.updateOne(
    {_id: user._id},
    {$set: {'partnerCriteria.location': locations}}
  );
});
```

**Best Practice:** Always backup before migration!

---

## 📞 Troubleshooting

### Error: "Module not found: motor"

```bash
pip install motor pymongo
```

### Error: "Connection refused"

Check your `MONGODB_URL` environment variable:
```bash
export MONGODB_URL="mongodb://localhost:27017/matrimonialDB"
```

### Migration shows "Already applied"

This is normal if you've already run it. Use `--verify` to check results.

---

## 🎯 Deployment Steps

1. **Before deployment:**
   ```bash
   # Backup database
   mongodump --uri="$MONGODB_URL" --out=/backup/pre_migration_$(date +%Y%m%d)
   
   # Run migration
   cd fastapi_backend/migrations
   python run_migrations.py
   
   # Verify
   python run_migrations.py --status
   ```

2. **Deploy code changes:**
   - Deploy backend (includes Profile.js with backward compatibility)
   - Deploy frontend (includes new text input for location)

3. **Post-deployment verification:**
   - Check `/edit-profile` page - should show text input for locations
   - Check profile pages - should display locations correctly
   - Test with both old and new user data

---

## 📚 Related Files

- `006_migrate_location_to_string.py` - Migration script
- `migrate_location_to_string.py` - Standalone migration tool
- `run_migrations.py` - Migration runner
- `Profile.js` - Updated to handle both array and string formats
- `Register2.js` - Updated to use text input
- `Register.js` - Updated to use text input

---

## ✅ Success Criteria

Migration is successful when:

- [ ] All array-based locations converted to strings
- [ ] No pending migrations remain
- [ ] Profile pages display locations correctly
- [ ] Edit profile shows text input (not multi-select)
- [ ] New registrations use string format
- [ ] No JavaScript errors on profile pages

---

**Questions?** Check `DEPLOYMENT_CHECKLIST.md` or contact the dev team.
