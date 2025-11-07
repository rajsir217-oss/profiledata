# Saved Search Notifications - Email Alerts for New Matches

## Overview

Users can now receive **automatic email notifications** when new profiles match their saved search criteria. This feature allows users to stay updated on potential matches without manually running searches.

## Features ✨

### 1. **Per-Search Notification Configuration**
   - Enable/disable notifications for each saved search individually
   - Configure notification frequency (Daily or Weekly)
   - Set specific time for notifications (e.g., 9:00 AM, 6:00 PM)
   - For weekly notifications, choose the day of week (Monday-Sunday)

### 2. **Smart Notification System**
   - Only sends emails when **new matches** are found
   - Avoids duplicate notifications for profiles already sent
   - Respects user's chosen schedule (time & frequency)
   - Tracks notification history per search

### 3. **Beautiful Email Templates**
   - Professional HTML emails with gradient headers
   - Individual profile cards for each match
   - Shows: Name, age, location, education, occupation, L3V3L score
   - Direct links to view full profiles
   - Unsubscribe/manage preferences link

## How to Use 🎯

### For Users:

1. **Go to Search Page** (`/search`)
2. **Apply your desired filters** (gender, age, location, etc.)
3. **Click "Save Search" button** (💾 icon)
4. **In the Save Search Modal**:
   - Enter a name for your search (auto-generated based on criteria)
   - **Enable Email Notifications** checkbox ✅
   - Choose **Frequency**: Daily or Weekly
   - Select **Time**: Pick the hour you want to receive emails
   - (For Weekly) Select **Day of Week**: Monday-Sunday
5. **Click "Save Search"**

### Example Configurations:

**Daily Morning Updates:**
- Frequency: Daily
- Time: 09:00 AM
- Sends every day at 9 AM if new matches found

**Weekly Monday Digest:**
- Frequency: Weekly  
- Day: Monday
- Time: 06:00 PM
- Sends every Monday at 6 PM if new matches found

**Weekend Updates:**
- Frequency: Weekly
- Day: Saturday
- Time: 10:00 AM
- Sends every Saturday at 10 AM if new matches found

## For Admins: Setting Up the Job Scheduler 🔧

### 1. Navigate to Dynamic Scheduler
   - Go to `/admin/scheduler` (admin only)
   - Look for **"Saved Search Matches Notifier"** job template

### 2. Create Scheduled Job
   - **Template**: Saved Search Matches Notifier
   - **Schedule**: Hourly (recommended) or every 30 minutes for real-time alerts
   - **Parameters**:
     - `batchSize`: 50 (number of users to process per run)
     - `lookbackHours`: 24 (only notify for profiles created in last 24 hours)
     - `appUrl`: Your app URL (e.g., `https://matrimonial.com`)

### 3. Recommended Cron Schedule
```
0 * * * *  # Every hour on the hour
```
or
```
*/30 * * * *  # Every 30 minutes
```

## Technical Details 🛠️

### Database Schema

**saved_searches collection:**
```javascript
{
  username: "john_doe",
  name: "F 28-32 5'4-5'8",
  description: "Female, 28-32 years, 5'4\" to 5'8\"",
  criteria: { gender: "Female", ageMin: 28, ageMax: 32, ... },
  minMatchScore: 75,
  notifications: {
    enabled: true,
    frequency: "daily",  // or "weekly"
    time: "09:00",       // 24-hour format HH:MM
    dayOfWeek: "monday"  // only for weekly
  },
  createdAt: "2025-01-15T10:30:00Z"
}
```

**saved_search_notifications collection** (tracking):
```javascript
{
  username: "john_doe",
  search_id: "507f1f77bcf86cd799439011",
  notified_matches: ["jane_smith", "sarah_jones", ...],
  last_notification_at: "2025-01-15T09:00:00Z",
  last_notification_sent: "2025-01-15T09:00:00Z"
}
```

### Job Execution Flow

1. **Job runs on schedule** (every hour recommended)
2. **Loads all saved searches** from database
3. **For each search**:
   - Check if notifications enabled ✅
   - Check if it's the right time/day to send 📅
   - Run the search criteria against database
   - Filter for profiles created in last 24 hours (new profiles only)
   - Exclude profiles already notified
   - If new matches found:
     - Send email with match details 📧
     - Mark matches as notified
     - Update last notification timestamp

### Schedule Matching Logic

**Daily Notifications:**
- Sends if current hour matches notification time
- Example: If time is 09:00, sends between 09:00-09:59

**Weekly Notifications:**
- Sends if current hour matches time AND current day matches dayOfWeek
- Example: If Monday at 6 PM, sends every Monday between 18:00-18:59

**Duplicate Prevention:**
- Tracks `last_notification_sent` timestamp
- Won't send same profile twice to same user for same search
- Uses `notified_matches` array to track sent profiles

## Email Template Preview 📧

```
╔══════════════════════════════════════╗
║  🔍 New Matches for Your Saved Search ║
║  We found 3 new profiles matching    ║
║  your criteria!                       ║
╚══════════════════════════════════════╝

📌 Saved Search: "F 28-32 5'4-5'8"
Female, 28-32 years, 5'4" to 5'8", L3V3L Score ≥75%

Found 3 new matches for you!

┌─────────────────────────────────────┐
│ Sarah J.         🦋 92% Match       │
│                                     │
│ 📅 30 years old  📏 5'6"           │
│ 📍 San Francisco 🎓 Master's Degree │
│ 💼 Software Engineer                │
│                                     │
│ [View Full Profile →]               │
└─────────────────────────────────────┘

[... more match cards ...]

────────────────────────────────────────
You're receiving this email because you 
have saved searches on ProfileData.

Manage your preferences: [Settings]

© 2025 ProfileData. All rights reserved.
```

## Benefits 🎉

### For Users:
- ✅ Never miss potential matches
- ✅ Automated, hassle-free notifications
- ✅ Customizable schedule (your time, your day)
- ✅ Only get notified about NEW profiles
- ✅ Beautiful, professional emails
- ✅ Multiple saved searches with different schedules

### For Platform:
- ✅ Increased user engagement
- ✅ Higher return rates to platform
- ✅ Better match discovery
- ✅ Reduced manual searching
- ✅ Configurable per user preferences

## UI/UX Highlights 🎨

### Save Search Modal
- **Tab 1: Save Current Search**
  - Auto-generated search name (editable)
  - Current criteria preview with badges
  - L3V3L score indicator
  - **Notification Schedule Section** (new!)
    - Checkbox to enable notifications
    - Frequency dropdown (Daily/Weekly)
    - Day selector (for Weekly)
    - Time picker with AM/PM display
    - Visual gradient background with border

- **Tab 2: Manage Searches**
  - List of all saved searches
  - Shows notification schedule badge if enabled
  - Example: "📧 Daily at 9:00 AM" or "📧 monday at 6:00 PM"
  - Edit/Delete actions

### Notification Schedule Badge
- Displayed on each saved search in manage tab
- Color-coded with gradient background
- Shows frequency and time at a glance
- Only appears if notifications enabled

## Testing Checklist ✅

### Frontend Testing:
- [ ] Open Search page and create a search
- [ ] Click Save Search
- [ ] Enable notifications checkbox
- [ ] Select Daily frequency, set time to 10:00 AM
- [ ] Save search
- [ ] Verify saved search appears in Manage tab with "📧 Daily at 10:00 AM" badge
- [ ] Create another search with Weekly frequency (e.g., Monday 6:00 PM)
- [ ] Verify badge shows "📧 monday at 6:00 PM"

### Backend Testing:
- [ ] Check MongoDB `saved_searches` collection for notification data
- [ ] Create/schedule "Saved Search Matches Notifier" job in Dynamic Scheduler
- [ ] Run job manually and check logs
- [ ] Verify job stats show:
  - `searches_checked`: Total searches processed
  - `searches_with_schedule`: Searches with notifications enabled
  - `searches_due_now`: Searches that matched schedule
  - `skipped_not_due`: Searches skipped (wrong time/day)
  - `emails_sent`: Emails successfully sent

### Email Testing:
- [ ] Update `send_matches_email()` to use real email service (Twilio SendGrid, AWS SES, etc.)
- [ ] Send test email to yourself
- [ ] Verify email formatting looks good
- [ ] Check all links work
- [ ] Test on mobile email clients
- [ ] Test dark mode email rendering

## Future Enhancements 🚀

### Planned Features:
1. **Timezone Support**
   - Use user's timezone for notification scheduling
   - Convert UTC to user's local time

2. **Notification Preferences Dashboard**
   - Centralized page to manage all saved search notifications
   - Bulk enable/disable
   - Notification history

3. **Email Digest Options**
   - Combine multiple searches into one email
   - Weekly digest with all matches

4. **SMS Notifications** (Premium)
   - Text message alerts for high-priority matches
   - Separate SMS schedule from email

5. **Push Notifications** (Mobile App)
   - Browser/mobile push for instant alerts
   - Optional quiet hours

6. **Smart Frequency**
   - Auto-adjust based on match volume
   - "Only when matches found" option
   - Rate limiting (max 1 email per day)

7. **Advanced Matching**
   - Notify only for matches above certain L3V3L score
   - Filter by specific criteria changes
   - Priority matches first

## Troubleshooting 🔧

### "Notifications not sending"
**Possible Causes:**
1. Job not scheduled in Dynamic Scheduler
2. Job schedule doesn't match notification time
3. Email service not configured
4. No new profiles matching criteria

**Solutions:**
1. Check `/admin/scheduler` for active job
2. Set job to run hourly or every 30 minutes
3. Configure SMTP settings in `.env`
4. Check `saved_search_notifications` collection for tracking

### "Getting notifications at wrong time"
**Possible Causes:**
1. Timezone mismatch (job uses UTC)
2. Job running outside notification window

**Solutions:**
1. Convert user time to UTC in backend
2. Adjust notification time in saved search settings
3. Check job logs for `is_notification_due()` output

### "Duplicate notifications"
**Possible Causes:**
1. `notified_matches` not being updated
2. Job running too frequently

**Solutions:**
1. Check `mark_matches_notified()` function
2. Review `update_last_notification_time()` calls
3. Verify MongoDB updates successful

## API Endpoints 📡

### Get Saved Searches
```http
GET /api/users/{username}/saved-searches
```

**Response:**
```json
{
  "savedSearches": [
    {
      "id": "507f1f77bcf86cd799439011",
      "name": "F 28-32 5'4-5'8",
      "description": "Female, 28-32 years...",
      "criteria": {...},
      "notifications": {
        "enabled": true,
        "frequency": "daily",
        "time": "09:00",
        "dayOfWeek": "monday"
      },
      "createdAt": "2025-01-15T10:30:00Z"
    }
  ],
  "count": 1
}
```

### Save Search with Notifications
```http
POST /api/users/{username}/saved-searches
```

**Request Body:**
```json
{
  "name": "F 28-32 5'4-5'8",
  "description": "Female, 28-32 years, 5'4\" to 5'8\"",
  "criteria": {
    "gender": "Female",
    "ageMin": 28,
    "ageMax": 32,
    "heightMinFeet": 5,
    "heightMinInches": 4,
    "heightMaxFeet": 5,
    "heightMaxInches": 8
  },
  "minMatchScore": 75,
  "notifications": {
    "enabled": true,
    "frequency": "daily",
    "time": "09:00",
    "dayOfWeek": "monday"
  }
}
```

## Files Modified 📝

### Frontend:
1. **SaveSearchModal.js** - Added notification schedule UI
2. **SaveSearchModal.css** - Styled notification section
3. **SearchPage2.js** - Handle notification data in save handler

### Backend:
1. **saved_search_matches_notifier.py** - Schedule-aware notification logic
2. **routes.py** - Already supports saving notification fields (no changes needed)

## Configuration ⚙️

### Environment Variables (Optional)
```bash
# Email Service (for production)
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASSWORD=your_sendgrid_api_key
FROM_EMAIL=notifications@matrimonial.com
FROM_NAME=ProfileData Matches

# App URL (for email links)
APP_URL=https://matrimonial.com
```

### Job Template Parameters
- `batchSize`: 50-200 users per run
- `lookbackHours`: 24-168 hours (1-7 days)
- `appUrl`: Base URL for profile links

## Summary

The **Saved Search Notifications** feature provides users with automated, scheduled email alerts when new profiles match their saved search criteria. With customizable daily/weekly schedules and beautiful HTML emails, users never miss potential matches while maintaining full control over notification frequency and timing.

**Status:** ✅ Fully Implemented and Ready for Testing
**Version:** 1.0
**Last Updated:** November 6, 2025
