# dateOfBirth → birthMonth/birthYear Migration Guide

## Overview

Production database uses `dateOfBirth` field, but the application now requires separate `birthMonth` and `birthYear` fields for better age calculations and filtering.

This guide explains the migration process and backward compatibility implementation.

## Migration Steps

### Step 1: Run Migration Script (Dry Run First!)

```bash
cd /Users/rajsiripuram02/opt/appsrc/profiledata/fastapi_backend/migrations

# DRY RUN: Preview what will be migrated
python migrate_dateofbirth_to_birth_fields.py --dry-run

# Review the output carefully
```

**Expected Output:**
```
🔄 Starting dateOfBirth migration...
======================================================================
🔍 DRY RUN MODE - No changes will be made to the database

📊 Found X users with dateOfBirth field

1/X ✅ username1: 1990-05-15 → birthMonth=5, birthYear=1990
2/X ✅ username2: 03/22/1985 → birthMonth=3, birthYear=1985
3/X ⏭️  username3: Already has birthMonth/birthYear, skipping
...

======================================================================
📊 Migration Summary:
   Total users: X
   ✅ Successfully migrated: Y
   ⏭️  Skipped (already complete): Z
   ❌ Failed: 0

💡 Run without --dry-run to apply changes to database
======================================================================
```

### Step 2: Execute Actual Migration

**ONLY after reviewing dry-run results:**

```bash
# Apply the migration
python migrate_dateofbirth_to_birth_fields.py

# Should see similar output without "dry run" warnings
```

### Step 3: Verify Migration

```bash
# Check for remaining incomplete profiles
cd ../scripts
python find_incomplete_profiles.py
```

**Expected:**
```
🔍 Searching for incomplete profiles...
============================================================
📊 Found 0 incomplete profiles
✅ All profiles are complete!
============================================================
```

## Backward Compatibility

The backend now supports **both formats** during transition:

### Registration Endpoint

```python
# NEW FORMAT (preferred)
birthMonth: int = 5
birthYear: int = 1990

# OR LEGACY FORMAT (automatically parsed)
dateOfBirth: str = "1990-05-15"
```

**Supported dateOfBirth formats:**
- ISO: `"1990-05-15"` or `"1990-05-15T00:00:00"`
- Slash: `"05/15/1990"` or `"5/15/1990"` (MM/DD/YYYY)

### How It Works

1. **Check for birthMonth/birthYear first**
2. **If missing**, try to parse `dateOfBirth`
3. **Extract month and year** from dateOfBirth
4. **Validate** the extracted values
5. **Store as birthMonth/birthYear** in database

## Frontend Compatibility

The ProfileCompletionChecker recognizes both formats:

```javascript
// Won't show banner if user has EITHER:
const hasBirthData = (
  (user.birthMonth && user.birthYear) ||  // New format
  user.dateOfBirth                         // Legacy format
);
```

## Troubleshooting

### Issue: Migration script fails to parse some dates

**Solution:** Check the date format in your database:

```javascript
// MongoDB shell
db.users.find(
  { dateOfBirth: { $exists: true } },
  { username: 1, dateOfBirth: 1 }
).limit(5)
```

Add additional parsing logic if needed in `parse_date_of_birth()` function.

### Issue: Users still showing "Age: undefined"

**Possible causes:**
1. Migration not run yet
2. Date format not recognized
3. User has neither format

**Check user data:**
```javascript
db.users.findOne(
  { username: "problematic_username" },
  { birthMonth: 1, birthYear: 1, dateOfBirth: 1 }
)
```

### Issue: Registration fails with "Invalid dateOfBirth format"

**User provided:** Unsupported date format

**Solution:** Ask user to use:
- YYYY-MM-DD (e.g., 1990-05-15)
- MM/DD/YYYY (e.g., 05/15/1990)

## Testing

### Test Migration Script

```bash
# Create test data
mongo matrimonialDB
db.users.insertOne({
  username: "test_migration",
  dateOfBirth: "1990-05-15",
  firstName: "Test",
  lastName: "User"
})

# Run migration
cd migrations
python migrate_dateofbirth_to_birth_fields.py --dry-run

# Check result
mongo matrimonialDB
db.users.findOne({ username: "test_migration" })
# Should show: birthMonth: 5, birthYear: 1990

# Clean up
db.users.deleteOne({ username: "test_migration" })
```

### Test Backend Compatibility

```bash
# Test with new format
curl -X POST http://localhost:8000/api/users/register \
  -F "username=test_new" \
  -F "birthMonth=5" \
  -F "birthYear=1990" \
  ...

# Test with legacy format
curl -X POST http://localhost:8000/api/users/register \
  -F "username=test_legacy" \
  -F "dateOfBirth=1990-05-15" \
  ...
```

## Migration Statistics

After migration, generate a report:

```bash
cd scripts
python find_incomplete_profiles.py > migration_report.txt
```

Share this report to confirm all profiles are complete.

## Rollback Plan

**If migration fails badly:**

1. **Restore from backup** (you did back up, right?)
2. **Or manually restore:**

```javascript
// MongoDB: Remove migrated fields
db.users.updateMany(
  { dateOfBirth: { $exists: true } },
  { $unset: { birthMonth: "", birthYear: "" } }
)
```

**Note:** Only do this if migration corrupted data!

## Post-Migration Cleanup (Optional)

After successful migration and verification:

```javascript
// Remove old dateOfBirth field (OPTIONAL - NOT RECOMMENDED YET)
// Keep it for now as a backup
db.users.updateMany(
  { 
    birthMonth: { $exists: true },
    birthYear: { $exists: true },
    dateOfBirth: { $exists: true }
  },
  { $unset: { dateOfBirth: "" } }
)
```

**Recommendation:** Keep `dateOfBirth` field for now as backup. Can remove after 30 days of stable operation.

## Timeline

1. **Day 1:** Deploy backend changes with backward compatibility
2. **Day 1:** Run migration script (dry-run first!)
3. **Day 1:** Verify migration results
4. **Day 2-7:** Monitor for issues
5. **Day 7+:** Consider removing `dateOfBirth` field (optional)

## Files Modified

### Backend
- ✅ `fastapi_backend/routes.py` - Added `parse_date_of_birth()` helper
- ✅ `fastapi_backend/routes.py` - Updated registration validation
- ✅ `fastapi_backend/migrations/migrate_dateofbirth_to_birth_fields.py` - New migration script

### Frontend  
- ✅ `frontend/src/components/ProfileCompletionChecker.js` - Recognizes both formats

### Scripts
- ✅ `fastapi_backend/scripts/find_incomplete_profiles.py` - Excludes users with `dateOfBirth`

## Support

**Questions?** Check logs for detailed error messages:

```bash
# Backend logs
tail -f logs/app.log | grep "birth"

# Migration logs
python migrate_dateofbirth_to_birth_fields.py 2>&1 | tee migration.log
```

---

**Migration Date:** 2025-11-17  
**Status:** ✅ Ready to Execute  
**Risk Level:** 🟢 Low (backward compatible, dry-run available)
