# Template Unification - Job Templates & Notification Templates

## Problem Solved

**Before:** Two separate template systems with no connection:
1. **Dynamic Scheduler** - Job templates (Python code in `/job_templates/`)
2. **Template Manager** - Notification templates (MongoDB `notification_templates`)

**After:** Unified system where both are visible and interconnected

---

## Changes Made

### 1. Backend API Enhancement (`routers/notifications.py`)

Added `include_job_templates` parameter to `/api/notifications/templates`:

```python
@router.get("/templates")
async def get_templates(
    channel: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    include_job_templates: bool = Query(False),  # NEW
    current_user: dict = Depends(get_current_user),
    service: NotificationService = Depends(get_notification_service)
):
```

**What it does:**
- Fetches notification templates from MongoDB (as before)
- If `include_job_templates=true`, also loads job templates from `/job_templates/*.py` files
- Marks each template with `type: "notification"` or `type: "job"`
- Returns unified list

---

### 2. Frontend Template Manager Updates

#### A. Load Both Types (`TemplateManager.js`)

```javascript
// OLD:
const response = await fetch('http://localhost:8000/api/notifications/templates');

// NEW:
const response = await fetch('http://localhost:8000/api/notifications/templates?include_job_templates=true');
```

#### B. Display Type Badges

Each template now shows:
- **Channel badge:** 📧 Email, 📱 SMS, ⚙️ Job
- **Category badge:** 💕 Match, 🔧 System, etc.
- **Type badge:** 
  - `⚙️ Job` (blue background)
  - `📧 Notification` (purple background)
- **Schedule badge:** ⏰ `0 9 * * MON` (for jobs only)

#### C. Different Actions for Each Type

**Notification Templates:**
- ✏️ Edit Template
- 👁️ Preview
- 📤 Send Test
- ⏸️/▶️ Enable/Disable

**Job Templates:**
- 📋 View Job in Scheduler (navigates to Dynamic Scheduler)
- ➕ Create Job from Template (pre-selects template in scheduler)

---

### 3. Filter Enhancements

#### Category Filter

```
All Categories
Notification Categories:
  💕 Match
  👀 Activity
  💬 Messages
  🔐 Privacy
  📊 Engagement
  ⚙️ Custom
Job Categories:
  🔧 System
  📧 Communication
  🧹 Maintenance
  🔔 Notification
```

#### Channel Filter

```
All Channels
📧 Email
📱 SMS
🔔 Push
⚙️ Job  ← NEW
```

---

## How It Works

### Template Manager View

```
┌─────────────────────────────────────────┐
│ 📧 Template Manager   [🔄 Refresh] [➕] │
├─────────────────────────────────────────┤
│ 🔍 Search: [____]                       │
│ Category: [All Categories ▼]            │
│ Channel: [All Channels ▼]               │
│ 10 templates                            │
├─────────────────────────────────────────┤
│ ┌─────────────────────────────────────┐ │
│ │ 💕 NEW MATCH      🟢 Active         │ │
│ │ 📧 email  🏷️ match  📧 Notification │ │
│ │ You have a new match...             │ │
│ │ [✏️] [👁️] [📤] [⏸️]                  │ │
│ └─────────────────────────────────────┘ │
│ ┌─────────────────────────────────────┐ │
│ │ 📧 EMAIL NOTIFIER   🟢 Active       │ │
│ │ ⚙️ job  🔧 system  ⏰ 0 */5 * * *   │ │
│ │ ⚙️ Job                              │ │
│ │ Send bulk emails to recipients      │ │
│ │ [📋] [➕]                            │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

---

## Usage Scenarios

### Scenario 1: View All Templates

**User Action:** Opens Template Manager

**Result:**
- Sees 6 notification templates (NEW MATCH, PROFILE VIEWED, etc.)
- Sees 10+ job templates (Email Notifier, Database Cleanup, etc.)
- Can filter by category, channel, or search

### Scenario 2: Create Job from Template

**User Action:** 
1. In Template Manager, finds "Email Notifier" job template
2. Clicks ➕ "Create Job from Template" button

**Result:**
- Navigates to Dynamic Scheduler
- Template is pre-selected in job creation form
- User fills in schedule and enables

### Scenario 3: View Job Details

**User Action:**
1. In Template Manager, finds a job template
2. Clicks 📋 "View Job in Scheduler" button

**Result:**
- Navigates to Dynamic Scheduler Jobs tab
- Can see if job is already created/running

### Scenario 4: Filter Job Templates Only

**User Action:**
1. Sets Channel filter to "⚙️ Job"
2. Sets Category to "System"

**Result:**
- Shows only system maintenance jobs
- Hides all notification templates

---

## Technical Details

### Job Template Structure

Each `.py` file in `/job_templates/` must have:

```python
TEMPLATE = {
    "name": "Email Notifier",
    "type": "scheduled",
    "schedule": "0 */5 * * *",
    "description": "Send bulk emails...",
    "enabled": True,
    "jobFunction": """
        async def run_job(db, logger):
            # Job code here
    """,
    "tags": ["notification", "email"],
    "metadata": {
        "category": "communication",  # Used for filtering
        "priority": "high"
    }
}
```

### Notification Template Structure

```javascript
{
    "_id": "507f1f77bcf86cd799439011",
    "trigger": "new_match",
    "channel": "email",
    "category": "match",
    "subject": "You have a new match!",
    "body": "<html>...</html>",
    "active": true,
    "type": "notification",  // Added by API
    "createdAt": "2025-10-22T...",
    "updatedAt": "2025-10-22T..."
}
```

---

## Benefits

### 1. **Single Source of Truth**
- All templates visible in one place
- No confusion about where templates are

### 2. **Easy Job Creation**
- Click button to create job from template
- No need to manually find/copy template code

### 3. **Better Filtering**
- Filter by notification vs job
- Filter by category (system, communication, etc.)
- Search across all templates

### 4. **Consistent UX**
- Same card design for both types
- Clear visual indicators (badges, icons)
- Appropriate actions for each type

### 5. **Cross-Linking**
- From Template Manager → Dynamic Scheduler
- From Dynamic Scheduler → Can add link back (future)

---

## Future Enhancements

### Phase 2: Reverse Link
Add to Dynamic Scheduler job creation:
- "View notification templates" button
- Opens Template Manager with filters applied

### Phase 3: Template Dependencies
Show which jobs use which notification templates:
```
Email Notifier Job
  ↳ Uses: NEW_MATCH template
  ↳ Uses: PROFILE_VIEWED template
```

### Phase 4: Template Analytics
Show in Template Manager:
- Times used by jobs
- Last execution
- Success rate

---

## Files Modified

### Backend:
- ✅ `routers/notifications.py` - Added job template loading
- ✅ `models/notification_models.py` - Added WEEKLY_DIGEST trigger

### Frontend:
- ✅ `components/TemplateManager.js` - Unified view
- ✅ `components/TemplateManager.css` - Type badges styling

### Documentation:
- ✅ `TEMPLATE_UNIFICATION_GUIDE.md` - This file
- ✅ `WEEKLY_DIGEST_SETUP.md` - Digest email guide

---

## Testing

### Test 1: View All Templates
```bash
# Start backend
./bstart.sh

# Open browser
http://localhost:3000/event-queue-manager
# Click "Templates" tab
# Should see both notification and job templates
```

### Test 2: Filter Job Templates
```
1. Channel dropdown → Select "⚙️ Job"
2. Should show only job templates
3. Cards should have [📋] and [➕] buttons
```

### Test 3: Create Job from Template
```
1. Find "Email Notifier" job template
2. Click ➕ button
3. Should navigate to Dynamic Scheduler
4. Template should be pre-selected
```

### Test 4: Search Across All
```
1. Search: "email"
2. Should show:
   - Email Notifier (job)
   - NEW_MATCH (email channel)
   - Email notification templates
```

---

## Troubleshooting

### Issue: No job templates showing

**Check:**
1. Are files in `/job_templates/` directory?
2. Do they have `.py` extension?
3. Do they have `TEMPLATE` dictionary?
4. Is `include_job_templates=true` in API call?

**Fix:**
```bash
# Check files exist
ls fastapi_backend/job_templates/*.py

# Check API response
curl http://localhost:8000/api/notifications/templates?include_job_templates=true \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Issue: Type badge not showing

**Check:**
```javascript
// In browser console
console.log(templates.map(t => ({ 
  name: t.subject, 
  type: t.type 
})));
```

Should show `type: "notification"` or `type: "job"` for each.

### Issue: Job template details missing

**Check** `TEMPLATE` structure in `.py` file:
```python
TEMPLATE = {
    "metadata": {
        "category": "system"  # Required for filtering
    }
}
```

---

## API Reference

### Get All Templates (Unified)

```http
GET /api/notifications/templates?include_job_templates=true
Authorization: Bearer <token>
```

**Response:**
```json
[
  {
    "_id": "507f...",
    "trigger": "new_match",
    "channel": "email",
    "category": "match",
    "type": "notification",
    ...
  },
  {
    "_id": "job_email_notifier_template",
    "trigger": "Email Notifier Template",
    "channel": "job",
    "category": "communication",
    "type": "job",
    "schedule": "0 */5 * * *",
    ...
  }
]
```

### Filter by Type

**Notification only:**
```http
GET /api/notifications/templates?include_job_templates=false
```

**Job only:**
```http
GET /api/notifications/templates?include_job_templates=true&channel=job
```

---

## Summary

**Problem:** Two disconnected template systems
**Solution:** Unified view with type badges and appropriate actions
**Result:** Single place to manage all templates (notification + job)

✅ Template Manager shows both types
✅ Clear visual distinction (badges, icons)
✅ Different actions for each type
✅ Easy navigation between systems
✅ Better filtering and search

**Status:** ✅ Complete and Ready to Use

---

**Created:** Oct 22, 2025
**Last Updated:** Oct 22, 2025
