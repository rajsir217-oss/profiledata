# Event Queue Issue - Debugging Guide

## Current Status
**Activity Log:** ✅ Working - Shows profile views, exclusions, shortlist actions  
**Event Queue:** ❌ Empty - No notifications being queued

## What We Found

### 1. Profile Views Not Appearing
**Why:** Anti-spam logic - only first 3 views trigger notifications
- View count 19-20 means it's been viewed many times
- Notifications only sent for views 1, 2, 3
- This is by design to prevent notification spam

**Test:** Have a NEW user view the profile (first time ever)

### 2. Exclusions Not Appearing  
**Why:** Privacy by design - no notifications for exclusions
- When user A excludes user B, B is NOT notified
- This is intentional for privacy reasons
- No notification will ever appear for exclusions

### 3. Shortlist Added Not Appearing
**Why:** Unknown - should work but doesn't
- Activity log shows: shortlist_added at 18:23:06
- Event Queue shows: No notification
- Dispatcher is being called (code review confirms)
- **Likely cause:** Silent failure in notification_service

## The Root Problem

The `notification_service.queue_notification()` method was **silently failing**:

```python
except Exception as e:
    print(f"Error queuing notification: {e}")  # ❌ Just prints to stdout
    return None  # ❌ Fails silently
```

**Possible reasons for failure:**
1. User disabled that notification type in preferences
2. Rate limit exceeded  
3. Enum conversion error
4. Quiet hours blocking
5. Database connection issue

But we couldn't see the errors because they were only `print()`ed, not logged!

## The Fix

Changed error handling to use proper logging:

```python
except Exception as e:
    import logging
    import traceback
    logger = logging.getLogger(__name__)
    logger.error(f"❌ Error queuing notification for {username}/{trigger}: {e}")
    logger.error(traceback.format_exc())
    return None
```

## How to Debug

### Step 1: Restart Backend
```bash
# Stop current backend (Ctrl+C)
./bstart.sh
```

### Step 2: Monitor Backend Logs
In a separate terminal:
```bash
# Watch backend logs
tail -f logs/*.log
# OR if logs go to stdout:
# Watch the terminal where backend is running
```

### Step 3: Trigger Actions
1. **Shortlist someone:**
   - User A shortlists User B
   - Check logs for: "❌ Error queuing notification" or "✅ Queued 'shortlist_added'"
   - Check Event Queue UI - should see notification

2. **Profile view (NEW user):**
   - User C views User D's profile (first time ever)
   - Check logs for errors/success
   - Check Event Queue UI

3. **PII Request:**
   - User E requests PII from User F
   - Check logs for errors/success
   - Check Event Queue UI

### Step 4: Check Backend Logs for Errors

Look for these error patterns:
```
❌ Error queuing notification for aadhyadubey079/shortlist_added: ...
❌ Invalid notification parameter for ...
User has disabled shortlist_added notifications
Rate limit exceeded
```

### Step 5: Verify User Preferences

If errors mention "User has disabled", check preferences:
```bash
mongosh matrimonialDB --eval "db.notification_preferences.findOne({username: 'TARGET_USERNAME'}, {channels: 1})"
```

Expected output:
```json
{
  "channels": {
    "shortlist_added": ["email"],  // Must have at least one channel
    "profile_view": ["push"],
    "pii_request": ["email", "sms"]
  }
}
```

If a trigger is missing or has empty array `[]`, that's why notifications fail!

## Expected Results After Fix

**Working notifications:**
- ✅ Shortlist Added → Email notification
- ✅ Favorite Added → Email + Push notification
- ✅ Profile View (first 3) → Push notification  
- ✅ PII Request → Email + SMS notification
- ✅ PII Granted → Email + Push notification
- ✅ PII Rejected → Email + Push notification

**Intentionally NOT notified:**
- ❌ User Excluded (privacy)
- ❌ Profile View #4+ (anti-spam)
- ❌ Shortlist Removed (cancels pending notification)

## Common Issues

### Issue 1: "Invalid notification parameter"
**Cause:** Typo in trigger/channel name  
**Fix:** Check spelling in event dispatcher handlers

### Issue 2: "User has disabled X notifications"
**Cause:** User preferences don't include that trigger  
**Fix:** Add default preferences or have user enable in settings

### Issue 3: "Rate limit exceeded"
**Cause:** Too many notifications in time period
**Fix:** Check rate limit settings in preferences

### Issue 4: No errors but still no notifications
**Cause:** Backend not restarted
**Fix:** Restart backend to load new code

## Files Changed

1. **routes.py** - Added event dispatchers for:
   - Profile viewed (lines 2930-2941, 2976-2986)
   - PII requested (lines 3198-3206)
   - PII granted (lines 3388-3398)
   - PII rejected (lines 3442-3452)

2. **notification_service.py** - Better error logging (lines 543-555)

## Commits

- `2d1d4f3` - Add proper error logging to notification queue
- `33d5a32` - Add missing event dispatchers for notifications  
- `134c89b` - Fix PII request notifications
- `9f73075` - Fix method name dispatch_event → dispatch

## Next Steps

1. ✅ Restart backend with `./bstart.sh`
2. ✅ Monitor logs in separate terminal
3. ✅ Test each action type (shortlist, profile view, PII request)
4. ✅ Check logs for specific error messages
5. ✅ Verify Event Queue shows notifications
6. ❌ Report any errors seen in logs
