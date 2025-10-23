# Schedule Customization - Admin Control

## Feature: Customizable Job Schedules

Admins can now easily customize when jobs run using a visual schedule editor with quick presets.

---

## What Changed

### Enhanced Job Creation Modal - Step 3

**Before:**
- Manual cron expression entry
- No visual helpers
- Confusing for non-technical users

**After:**
- 5 Quick presets: ⏰ Hourly, 📅 Daily, 📆 Weekly, 🗓️ Monthly, ⚙️ Custom
- Visual day/time pickers
- Live cron expression preview
- Timezone selector with common zones

---

## UI Overview

```
┌─────────────────────────────────────────────┐
│ Step 3: Set Schedule                        │
├─────────────────────────────────────────────┤
│ Schedule Preset:                            │
│ [⏰ Hourly] [📅 Daily] [📆 Weekly*]         │
│ [🗓️ Monthly] [⚙️ Custom]                    │
│                                             │
│ Day of Week:                                │
│ [Monday        ▼]                           │
│                                             │
│ Time of Day:                                │
│ [09:00]                                     │
│ → Runs every Monday at 09:00                │
│                                             │
│ 📋 Cron Expression: 0 9 * * 1               │
│                                             │
│ Timezone:                                   │
│ [Pacific Time (Los Angeles) ▼]              │
│                                             │
│ Timeout: [3600] seconds                     │
└─────────────────────────────────────────────┘
```

---

## Features

### 1. Quick Presets

#### ⏰ Hourly
- **Cron:** `0 * * * *`
- **Runs:** Every hour at the top of the hour
- **Use case:** High-frequency monitoring, cache clearing

#### 📅 Daily
- **Cron:** `MM HH * * *` (configurable time)
- **Runs:** Every day at specified time
- **Picker:** Time selector
- **Use case:** Daily reports, backups, cleanup

#### 📆 Weekly
- **Cron:** `MM HH * * D` (configurable day + time)
- **Runs:** Specific day each week at specified time
- **Pickers:** 
  - Day of week dropdown (Monday-Sunday)
  - Time selector
- **Use case:** Weekly digest emails, weekly reports

#### 🗓️ Monthly
- **Cron:** `MM HH 1 * *` (1st of month, configurable time)
- **Runs:** 1st day of each month at specified time
- **Picker:** Time selector
- **Use case:** Monthly invoices, monthly summaries

#### ⚙️ Custom
- **Full Control:** Interval or cron expression
- **Interval:** Enter seconds (e.g., 3600 = 1 hour)
- **Cron:** Manual expression entry with format help
- **Use case:** Complex schedules, specific requirements

---

### 2. Visual Helpers

#### Day of Week Selector (Weekly)
```javascript
<select>
  <option>Monday</option>
  <option>Tuesday</option>
  ...
</select>
```

#### Time Picker (Daily/Weekly/Monthly)
```javascript
<input type="time" value="09:00" />
```
- Browser-native time picker
- 24-hour format
- Easy selection

#### Live Preview
Shows what the schedule means in plain English:
- Daily: "Runs every day at 09:00"
- Weekly: "Runs every Monday at 09:00"  
- Monthly: "Runs on the 1st of each month at 09:00"

#### Cron Expression Display
```
📋 Cron Expression: 0 9 * * 1
```
Shows the generated cron for verification

---

### 3. Timezone Support

Common timezones pre-populated:
- **UTC** - Universal Time
- **America/Los_Angeles** - Pacific Time
- **America/Denver** - Mountain Time
- **America/Chicago** - Central Time
- **America/New_York** - Eastern Time
- **Asia/Kolkata** - India
- **Europe/London** - UK

---

## Usage Examples

### Example 1: Weekly Digest Email

**Goal:** Send digest every Monday at 9 AM Pacific Time

**Steps:**
1. Create job from "Weekly Digest Emailer" template
2. Step 3: Select "📆 Weekly" preset
3. Day: Select "Monday"
4. Time: Set to "09:00"
5. Timezone: Select "America/Los_Angeles"
6. Result: `0 9 * * 1` cron in PT zone

---

### Example 2: Daily Backup

**Goal:** Backup database every day at 2 AM

**Steps:**
1. Create job from backup template
2. Step 3: Select "📅 Daily" preset
3. Time: Set to "02:00"
4. Timezone: Select "UTC"
5. Result: `0 2 * * *` cron in UTC

---

### Example 3: Hourly Sync

**Goal:** Sync data every hour

**Steps:**
1. Create job from sync template
2. Step 3: Select "⏰ Hourly" preset
3. No additional configuration needed
4. Result: `0 * * * *` cron

---

### Example 4: Complex Custom Schedule

**Goal:** Run every 15 minutes

**Steps:**
1. Create job
2. Step 3: Select "⚙️ Custom" preset
3. Schedule Type: "Cron Expression"
4. Cron: Enter `*/15 * * * *`
5. Or choose "Interval" and enter `900` seconds

---

## Technical Details

### Cron Expression Format

```
* * * * *
│ │ │ │ │
│ │ │ │ └─── Day of week (0-6, 0=Sunday)
│ │ │ └───── Month (1-12)
│ │ └─────── Day of month (1-31)
│ └───────── Hour (0-23)
└─────────── Minute (0-59)
```

### Conversion Logic

The `applySchedulePreset()` function converts selections to cron:

```javascript
// Daily at 09:00
const [hour, minute] = '09:00'.split(':');
cronExpression = `${minute} ${hour} * * *`;
// Result: "0 9 * * *"

// Weekly Monday at 09:00
const dayMap = { Monday: 1, Tuesday: 2, ... };
cronExpression = `${minute} ${hour} * * ${dayMap['Monday']}`;
// Result: "0 9 * * 1"

// Monthly 1st at 09:00
cronExpression = `${minute} ${hour} 1 * *`;
// Result: "0 9 1 * *"
```

---

## Files Modified

### Frontend:
- ✅ `JobCreationModal.js` - Added preset buttons, pickers, conversion logic
- ✅ `JobCreationModal.css` - Styled preset buttons and preview box

---

## Testing

### Test 1: Weekly Digest Schedule
```
1. Template Manager → WEEKLY DIGEST → Click ➕
2. Navigates to Dynamic Scheduler
3. Fill Step 1: Select template
4. Fill Step 2: Job name "Weekly Digest"
5. Step 3: 
   - Click "📆 Weekly"
   - Day: "Monday"
   - Time: "09:00"
   - Timezone: "America/Los_Angeles"
6. Step 4: Review shows "Cron: 0 9 * * 1"
7. Create job
8. Verify job runs Mondays at 9 AM PT
```

### Test 2: Daily Cleanup
```
1. Create job from cleanup template
2. Step 3:
   - Click "📅 Daily"
   - Time: "02:00"
3. Review shows "Cron: 0 2 * * *"
4. Create job
5. Verify runs daily at 2 AM
```

### Test 3: Custom Interval
```
1. Create job
2. Step 3:
   - Click "⚙️ Custom"
   - Schedule Type: "Interval"
   - Interval: 1800 (30 minutes)
3. Create job
4. Verify runs every 30 minutes
```

---

## Benefits

### 1. **User-Friendly**
- No need to learn cron syntax
- Visual day/time pickers
- Plain English preview

### 2. **Flexible**
- 5 common presets
- Full custom control still available
- Timezone support

### 3. **Error-Proof**
- Preset buttons generate valid cron
- Time picker prevents invalid input
- Live preview shows what schedule means

### 4. **Admin Control**
- Admin sets when digest runs
- Per-job customization
- Easy to change later (edit job)

---

## Future Enhancements

### Phase 2: Per-User Preferences
Allow users to customize their own digest schedule:
```javascript
// In NotificationPreferences
{
  weeklyDigest: {
    enabled: true,
    day: "Friday",       // User choice
    time: "18:00",       // User choice
    timezone: "America/Los_Angeles"
  }
}
```

Job would query preferences and send at user's preferred time.

### Phase 3: Smart Scheduling
- Suggest optimal send times based on open rates
- Avoid sending during user's quiet hours
- A/B test different send times

### Phase 4: Schedule Templates
Save common schedules for reuse:
- "Business Hours" = Mon-Fri 9-5
- "Off-Peak" = Daily at 2 AM
- "Weekend" = Sat-Sun at 10 AM

---

## Troubleshooting

### Issue: Time picker shows wrong format

**Solution:** Browser native time picker uses 24-hour format. Make sure to:
- Enter 09:00 for 9 AM
- Enter 21:00 for 9 PM

### Issue: Job not running at expected time

**Check:**
1. Timezone setting - is it correct?
2. Server timezone - does it match?
3. Cron expression in job details - is it correct?

**Debug:**
```bash
# View job details
curl http://localhost:8000/api/admin/scheduler/jobs/:id \
  -H "Authorization: Bearer TOKEN"

# Check schedule field
"schedule": {
  "type": "cron",
  "expression": "0 9 * * 1",
  "timezone": "America/Los_Angeles"
}
```

### Issue: Preset button not applying

**Check browser console for errors**

If time picker value is empty, it defaults to "09:00". Set a value first.

---

## API Integration

The schedule is saved in job configuration:

```json
{
  "name": "Weekly Digest",
  "schedule": {
    "type": "cron",
    "expression": "0 9 * * 1",
    "timezone": "America/Los_Angeles"
  }
}
```

Backend (unified scheduler) reads this and executes accordingly.

---

## Summary

✅ **5 Quick Presets** - Hourly, Daily, Weekly, Monthly, Custom
✅ **Visual Pickers** - Day selector, time picker
✅ **Live Preview** - Plain English schedule description
✅ **Cron Display** - Shows generated cron expression
✅ **Timezone Support** - 7 common timezones pre-populated
✅ **Custom Control** - Advanced users can still write cron manually

**Result:** Admins can easily set job schedules without knowing cron syntax!

---

**Created:** Oct 22, 2025
**Status:** ✅ Complete and Ready to Use
