# DateTime Storage Bug Fix Summary

**Date:** November 15, 2025  
**Issue:** "Favorited By" count showing 0 despite users favoriting the profile  
**Root Cause:** `createdAt` stored as ISO string instead of datetime object  
**Status:** ✅ FIXED

---

## 🐛 Problem

The dashboard showed:
```
💖 FAVORITED BY
0
Others who liked you
```

Even though siddharthdas007 had favorited admin's profile!

---

## 🔍 Root Cause

### The Bug

Three collections were storing `createdAt` as **ISO strings** instead of **datetime objects**:

**Bad Code (before fix):**
```python
favorite = {
    "userUsername": username,
    "favoriteUsername": target_username,
    "createdAt": datetime.utcnow().isoformat()  # ❌ Converts to string!
}
```

**Database stored:**
```json
{
  "createdAt": "2025-11-16T02:37:53.105211"  // ❌ String, not datetime
}
```

### Why It Failed

The query tries to filter by date:
```python
cutoff_date = datetime.utcnow() - timedelta(days=7)

favorites = await db.favorites.find({
    "favoriteUsername": username,
    "createdAt": {"$gte": cutoff_date}  # ❌ Comparing string to datetime fails!
})
```

MongoDB cannot compare strings to datetime objects, so the query returned **no results**.

---

## ✅ The Fix

### 1. Fixed Code (routes.py)

**Favorites (line 2099):**
```python
favorite = {
    "userUsername": username,
    "favoriteUsername": target_username,
    "createdAt": datetime.utcnow()  # ✅ Store as datetime, not ISO string
}
```

**Shortlists (line 2466):**
```python
shortlist_item = {
    "userUsername": username,
    "shortlistedUsername": target_username,
    "notes": notes,
    "createdAt": datetime.utcnow()  # ✅ Store as datetime, not ISO string
}
```

**Exclusions (line 2625):**
```python
exclusion = {
    "userUsername": username,
    "excludedUsername": target_username,
    "reason": reason,
    "createdAt": datetime.utcnow()  # ✅ Store as datetime, not ISO string
}
```

### 2. Database Migration

Created migration script: `migrations/fix_datetime_fields.py`

**Results:**
```
✅ Fixed 7 favorites
✅ Fixed 12 shortlists  
✅ Fixed 21 exclusions
📊 Total: 40 documents migrated
```

**After Migration:**
```json
{
  "createdAt": ISODate("2025-11-16T02:37:53.105Z")  // ✅ Datetime object
}
```

---

## 📊 Verification

### Before Fix
```bash
$ python3 check_favorite_exists.py
✅ FAVORITE EXISTS!
   Created: 2025-11-16T02:37:53.105211
   ⚠️  createdAt is not a datetime: <class 'str'>
```

### After Fix
```bash
$ python3 check_favorite_exists.py
✅ FAVORITE EXISTS!
   Created: 2025-11-16 02:37:53.105000
   Age: 0 days old
   ✅ Within 7-day window (should be visible)
```

---

## 🎯 Impact

This bug affected THREE collections:

| Collection | Impact | Fixed |
|------------|--------|-------|
| **favorites** | "Favorited By" count always 0 | ✅ 7 records |
| **shortlists** | "Their Shortlists" count wrong | ✅ 12 records |
| **exclusions** | Time-based filtering broken | ✅ 21 records |

All three used the **same 7-day time filter**, so they were all broken!

---

## 🚀 Deployment Steps

### 1. Restart Backend
```bash
cd /Users/rajsiripuram02/opt/appsrc/profiledata
./bstart.sh
```

### 2. Test Dashboard
- Open http://localhost:3000/dashboard
- Check "Favorited By" count - should show **1** (or more)
- Check "Their Shortlists" count - should be accurate
- Verify time filters work correctly

### 3. Test "Favorited By" Modal
- Click on "Favorited By" card
- Should show: **siddharthdas007** (and others who favorited you)
- Verify profile info displays correctly (not encrypted)

---

## 🧪 Testing Commands

### Check Favorite Status
```bash
python3 check_favorite_exists.py
```

### Run Migration (if needed again)
```bash
python3 migrations/fix_datetime_fields.py
```

### Verify Dashboard Stats API
```bash
curl http://localhost:8000/api/users/their-favorites/admin
```

---

## 📝 Related Fixes

This session also fixed:
1. **Encrypted PII display** - Profile views and requests showing `gAAAAA...`
2. **Missing PII decryption** - Multiple endpoints not decrypting user data
3. **DateTime storage bug** - This issue (favorites, shortlists, exclusions)

---

## ⚠️ Important Notes

### Time Filter Behavior

The system has a **7-day retention window** for:
- Profile views
- Favorites received
- Shortlists received

This is controlled by `profile_view_history_days` in system settings (default: 7).

**Admin can change this in system settings:**
```javascript
{
  "profile_view_history_days": 30  // Show last 30 days
}
```

### Future Considerations

1. **Consider removing time filter** for favorites/shortlists (they're more permanent than views)
2. **Or make separate settings** for each:
   - `profile_view_retention_days`
   - `favorites_retention_days` (or unlimited)
   - `shortlists_retention_days` (or unlimited)

---

## 📚 Files Modified

### Backend Code
- `routes.py` - Fixed datetime storage in 3 endpoints
- `migrations/fix_datetime_fields.py` - Database migration script
- `check_favorite_exists.py` - Verification script

### Documentation
- `DATETIME_BUG_FIX_SUMMARY.md` - This file
- `PII_DECRYPTION_FIX_SUMMARY.md` - Related PII fix

---

## ✅ Checklist

- [x] Fixed favorites datetime storage
- [x] Fixed shortlists datetime storage
- [x] Fixed exclusions datetime storage
- [x] Created migration script
- [x] Ran migration (40 docs fixed)
- [x] Verified favorite is now datetime
- [x] Verified within 7-day window
- [x] Documented fix
- [ ] Restart backend
- [ ] Test dashboard UI
- [ ] Verify "Favorited By" shows count
- [ ] Deploy to production

---

**Last Updated:** November 15, 2025, 6:45 PM PST  
**Fixed By:** Cascade AI  
**Migration Status:** ✅ Complete (40 documents)  
**Backend Restart:** Pending
