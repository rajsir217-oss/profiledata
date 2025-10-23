# L3V3L Matching - Weekly/Monthly Digest Email

## Overview
Automated weekly or monthly digest emails that show users all their activity including:
- Profile views
- Favorites added
- Shortlist additions
- Messages received
- Blocks
- PII data requests
- Search appearances

## Template Created

### Email Structure
```
┌─────────────────────────────────────┐
│ [LOGO] L3V3L Matching Digest        │
│ one step closer to your happy family│
├─────────────────────────────────────┤
│ Hi Sarah,                           │
│ Here's your activity summary...     │
├─────────────────────────────────────┤
│ 🟢 You are Viewed By (3)            │
│ (1) Mike | 30 | 5'10" | Boston     │
│ (2) John | 28 | 6'0" | NYC         │
│ (3) Alex | 32 | 5'8" | LA          │
├─────────────────────────────────────┤
│ 🟠 You are added to Favorites (2)   │
│ (1) Emma | 27 | 5'5" | Chicago     │
│ (2) Lisa | 29 | 5'6" | Seattle     │
├─────────────────────────────────────┤
│ 🔵 You are added to Shortlisted (1) │
│ (1) Anna | 26 | 5'4" | Miami       │
├─────────────────────────────────────┤
│ 💬 Messages Received By (4)         │
│ ...                                 │
├─────────────────────────────────────┤
│     [View Full Dashboard]           │
├─────────────────────────────────────┤
│ Total Activity: 10 interactions     │
│ Notification Preferences | Unsubscribe
└─────────────────────────────────────┘
```

## Files Created

### 1. Template Seed Script
**File:** `fastapi_backend/seed_digest_template.py`

Creates the HTML email template in the database.

**Run:**
```bash
cd fastapi_backend
python3 seed_digest_template.py
```

### 2. Job Template
**File:** `fastapi_backend/job_templates/weekly_digest_notifier.py`

Scheduled job that:
- Runs every Monday at 9 AM
- Compiles user activity from past week
- Sends digest emails to opted-in users
- Skips users with no activity

**Schedule:** `0 9 * * MON` (9 AM every Monday)

### 3. Notification Triggers
**File:** `fastapi_backend/models/notification_models.py`

Added two new triggers:
- `WEEKLY_DIGEST`
- `MONTHLY_DIGEST`

## Installation Steps

### Step 1: Install Template
```bash
cd fastapi_backend
python3 seed_digest_template.py
```

**Output:**
```
🌱 Seeding L3V3L Matching Digest Template...
✅ Created weekly digest template with ID: 67...
🎉 Done!
```

### Step 2: Restart Backend
```bash
./bstart.sh
```

### Step 3: Create Scheduled Job

**Option A: Via Event Queue Manager UI**
1. Go to http://localhost:3000/event-queue-manager
2. Click "Jobs" tab
3. Click "➕ Create Job"
4. Select "Weekly Digest Emailer" from template dropdown
5. Set schedule: `0 9 * * MON`
6. Enable job
7. Save

**Option B: Via API**
```bash
curl -X POST http://localhost:8000/api/scheduler/create-from-template \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "template_name": "Weekly Digest Emailer",
    "enabled": true
  }'
```

### Step 4: Test Template

**Via Template Manager:**
1. Go to http://localhost:3000/event-queue-manager
2. Click "Templates" tab
3. Find "WEEKLY_DIGEST" template
4. Click 👁️ Preview button
5. Click 📤 Send Test button

## Data Structure

### Template Variables

```javascript
{
  recipient: {
    firstName: "Sarah",
    username: "sarah_j"
  },
  digest: {
    period: "week",              // "week" or "month"
    frequency: "weekly",         // "weekly" or "monthly"
    viewedBy: [                  // Array of profiles
      {
        firstName: "Mike",
        age: 30,
        height: "5'10\"",
        location: "Boston"
      }
    ],
    favoritedBy: [...],
    shortlistedBy: [...],
    messagesFrom: [...],
    blockedBy: [...],
    piiRequestsFrom: [...],
    searchedBy: [...],
    stats: {
      profileViews: 3,
      favorites: 2,
      shortlisted: 1,
      newMessages: 4,
      blockedBy: 0,
      piiRequests: 1,
      searchAppearances: 5,
      totalActivity: 16
    }
  },
  app: {
    dashboardUrl: "http://localhost:3000/dashboard",
    preferencesUrl: "http://localhost:3000/preferences",
    unsubscribeUrl: "http://localhost:3000/unsubscribe"
  }
}
```

## User Preferences

Users can control digest emails in their notification preferences:

```javascript
{
  channels: {
    weekly_digest: ["email"],  // Opt-in
    monthly_digest: ["email"]  // Opt-in
  }
}
```

**Default:** Disabled (users must opt-in)

## Activity Tracking

The digest compiles data from the `activity_logs` collection:

**Tracked Actions:**
- `PROFILE_VIEW` → "You are Viewed By"
- `FAVORITE_ADDED` → "You are added to Favorites"
- `SHORTLIST_ADDED` → "You are added to Shortlisted"
- `MESSAGE_SENT` → "Messages Received By"
- `USER_BLOCKED` → "You are blocked by"
- `PII_REQUESTED` → "You are requested PII data by"
- `SEARCH_APPEARANCE` → "You are Searched By"

## Job Behavior

### Weekly Digest Job
- **Runs:** Every Monday at 9 AM
- **Looks back:** 7 days
- **Limit:** 10 profiles per category
- **Skips:** Users with zero activity
- **Skips:** Users who haven't opted in

### Monthly Digest Job (Optional)
Change schedule to: `0 9 1 * *` (1st of month at 9 AM)

## Testing

### Manual Test
```bash
cd fastapi_backend
python3 -c "
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from job_templates.weekly_digest_notifier import TEMPLATE

async def test():
    client = AsyncIOMotorClient('mongodb://localhost:27017')
    db = client.matrimonialDB
    
    # Create mock logger
    class Logger:
        def info(self, msg): print(msg)
        def error(self, msg): print(msg)
    
    # Execute job function
    exec(TEMPLATE['jobFunction'], globals())
    result = await send_weekly_digest(db, Logger())
    print(f'Result: {result}')
    client.close()

asyncio.run(test())
"
```

### Test via UI
1. Create the job in Event Queue Manager
2. Click "▶️ Run Now" button
3. Check "Notifications" tab for queued emails
4. Check email inbox for delivered digest

## Customization

### Change Colors
Edit `seed_digest_template.py`:
```python
# Green section
"background-color: #8bc34a"  # Header
"background-color: #f1f8e9"  # Body

# Orange section
"background-color: #ff9800"  # Header
"background-color: #fff3e0"  # Body
```

### Change Schedule
```python
"schedule": "0 9 * * MON"  # Weekly (Monday 9 AM)
"schedule": "0 9 1 * *"    # Monthly (1st day 9 AM)
"schedule": "0 18 * * FRI" # Weekly (Friday 6 PM)
```

### Change Activity Limit
Edit `compile_user_digest()`:
```python
"viewedBy": viewed_by[:20],  # Show 20 instead of 10
```

## Monitoring

### Check Job Status
```bash
# Via API
curl http://localhost:8000/api/scheduler/jobs \
  -H "Authorization: Bearer YOUR_TOKEN"

# Check last run
# Look for job with name "Weekly Digest Emailer"
```

### Check Email Queue
```bash
# Via API
curl http://localhost:8000/api/notifications/queue?trigger=weekly_digest \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### View Logs
Backend terminal will show:
```
📊 Starting weekly digest email job...
   Found 50 active users
   Sent: 23
   Skipped: 25 (no activity or not opted in)
   Errors: 2
✅ Weekly digest job completed
```

## Troubleshooting

### No emails sent
**Check:**
1. Is job enabled? (Event Queue Manager → Jobs)
2. Do users have activity? (Activity Logs page)
3. Have users opted in? (Check notification_preferences collection)
4. Is email notifier job running? (Check email_notifier job)

### Template not found
```bash
# Re-run seed script
cd fastapi_backend
python3 seed_digest_template.py
```

### Job not triggering
**Check:**
1. Is unified scheduler running? (Backend logs)
2. Is job enabled in database?
3. Is schedule format correct? (Cron format)

## Future Enhancements

- [ ] Add digest preview page at `/digest-preview`
- [ ] Add "View in Browser" link
- [ ] Add charts/graphs to email
- [ ] Add weekly comparison stats
- [ ] Add personalized recommendations
- [ ] Add configurable digest day/time per user
- [ ] Add SMS digest option (summary only)
- [ ] Add push notification for digest availability

## Related Files

- `models/notification_models.py` - Trigger enums
- `services/notification_service.py` - Notification logic
- `routers/notifications.py` - API endpoints
- `job_templates/email_notifier_template.py` - Email sending job
- `frontend/src/components/NotificationPreferences.js` - User opt-in UI

## Support

For issues or questions:
1. Check backend logs for errors
2. Verify template exists in `notification_templates` collection
3. Verify job exists in `scheduled_jobs` collection
4. Test with single user first before enabling for all

---

**Status:** ✅ Ready to deploy
**Created:** Oct 22, 2025
**Last Updated:** Oct 22, 2025
