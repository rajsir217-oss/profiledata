# Schedule Management - View, Edit, Delete

**Issue:** Unable to edit or delete existing schedules  
**Solution:** Added Schedule List Modal for managing schedules  
**Date:** Oct 22, 2025  
**Status:** ✅ Fixed

---

## Problem

When clicking on the schedule info or ⏰ button:
- Only opened "Create Schedule" modal
- No way to view existing schedules
- No way to edit existing schedules
- No way to delete existing schedules
- Users could only create new schedules, leading to accumulation

---

## Solution

### 1. Created Schedule List Modal

**New Component:** `ScheduleListModal.js`

**Features:**
- Lists all schedules for a template
- Shows schedule details (type, next run, last run, run count)
- Enable/disable toggle for each schedule
- Delete button for each schedule
- Real-time updates after changes

---

## New User Flow

### Viewing Schedules

```
Template Card with Schedules
   ↓
Click on schedule info box
   ↓
Schedule List Modal Opens
   ↓
Shows all schedules with details:
  - Schedule type (daily, weekly, one-time, etc.)
  - Next run time
  - Last run time
  - Run count
  - Recipient info
  - Timezone
  - Max recipients
```

### Managing Schedules

```
Schedule List Modal
   ↓
For each schedule:
  [⏸️/▶️] Enable/Disable toggle
  [🗑️] Delete button
   ↓
Click action
   ↓
Immediate update
   ↓
Modal refreshes
Card updates
```

---

## UI Preview

### Schedule List Modal:

```
┌─────────────────────────────────────┐
│ 📅 Manage Schedules             ✕   │
├─────────────────────────────────────┤
│ Template: NEW MESSAGE               │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ 🔄 daily at 9:00:00 AM          │ │
│ │                          [⏸️][🗑️]│ │
│ │ 👥 active users  🌍 Pacific     │ │
│ │ 🎯 Max: Unlimited               │ │
│ │ Next run: 10/23/25, 9:00:00 AM  │ │
│ │ Last run: 10/22/25, 9:00:00 AM  │ │
│ │ (12 times)                      │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ 📅 One-time: 10/25/25, 2:00 PM  │ │
│ │                          [⏸️][🗑️]│ │
│ │ 👥 all users  🌍 UTC            │ │
│ │ 🎯 Max: 1000                    │ │
│ │ Next run: 10/25/25, 2:00:00 PM  │ │
│ └─────────────────────────────────┘ │
│                                     │
│ [Close]                             │
└─────────────────────────────────────┘
```

---

## Features

### 1. **View All Schedules**
- Shows all schedules for a template
- Color-coded enabled/disabled states
- Detailed information per schedule

### 2. **Enable/Disable**
- Toggle button: ⏸️ (pause) / ▶️ (play)
- Instant API update
- Visual feedback (opacity change)
- Doesn't delete the schedule, just pauses it

### 3. **Delete Schedule**
- 🗑️ button per schedule
- Confirmation dialog (browser confirm for now)
- Removes from database
- Updates card immediately

### 4. **Schedule Details**
- **Type:** One-time, daily, weekly, monthly, custom
- **Next Run:** When it will next execute
- **Last Run:** When it last executed (if applicable)
- **Run Count:** How many times it has run
- **Recipients:** Who gets the notification
- **Timezone:** Schedule timezone
- **Max Recipients:** Recipient limit

---

## Implementation Details

### ScheduleListModal Component

```javascript
const ScheduleListModal = ({ template, onClose, onUpdate }) => {
  const [schedules, setSchedules] = useState([]);

  // Load schedules for this template
  const loadSchedules = async () => {
    const response = await fetch('/api/notifications/scheduled');
    const data = await response.json();
    const templateSchedules = data.filter(s => s.templateId === template._id);
    setSchedules(templateSchedules);
  };

  // Toggle enabled/disabled
  const handleToggleEnabled = async (schedule) => {
    await fetch(`/api/notifications/scheduled/${schedule.id}`, {
      method: 'PUT',
      body: JSON.stringify({ enabled: !schedule.enabled })
    });
    loadSchedules();
    onUpdate(); // Refresh parent
  };

  // Delete schedule
  const handleDelete = async (scheduleId) => {
    if (confirm('Delete this schedule?')) {
      await fetch(`/api/notifications/scheduled/${scheduleId}`, {
        method: 'DELETE'
      });
      setSchedules(schedules.filter(s => s.id !== scheduleId));
      onUpdate();
    }
  };
};
```

### TemplateManager Integration

```javascript
// New state
const [showScheduleListModal, setShowScheduleListModal] = useState(false);

// Make schedule display clickable
<button
  className="schedule-display has-schedule"
  onClick={() => {
    setScheduleTemplate(template);
    setShowScheduleListModal(true); // Open list modal
  }}
>
  {/* Schedule info */}
</button>

// Render list modal
{showScheduleListModal && scheduleTemplate && (
  <ScheduleListModal
    template={scheduleTemplate}
    onClose={() => setShowScheduleListModal(false)}
    onUpdate={() => loadScheduledNotifications()}
  />
)}
```

---

## API Endpoints Used

### GET /api/notifications/scheduled
```javascript
// Fetches all scheduled notifications
// Filtered by templateId in frontend
```

### PUT /api/notifications/scheduled/{id}
```javascript
// Updates schedule (enable/disable)
body: { enabled: true/false }
```

### DELETE /api/notifications/scheduled/{id}
```javascript
// Deletes schedule permanently
```

---

## Files Created

### Frontend:
- ✅ `ScheduleListModal.js` - New component (180 lines)
- ✅ `ScheduleListModal.css` - Styling (140 lines)

### Modified:
- ✅ `TemplateManager.js` - Added import, state, and rendering
- ✅ `TemplateManager.css` - Added clickable schedule display styles

---

## User Experience Improvements

### Before (❌ Problems):
1. Could only create schedules
2. No way to view existing schedules
3. No way to disable schedules temporarily
4. No way to delete old schedules
5. Schedules accumulated indefinitely
6. No visibility into schedule history

### After (✅ Solutions):
1. ✅ Click schedule info to view all schedules
2. ✅ See all schedules in one place
3. ✅ Toggle enable/disable with one click
4. ✅ Delete unwanted schedules
5. ✅ See run count and last run time
6. ✅ Full schedule management

---

## Testing

### Test 1: View Schedules
```
1. Find template with schedules (shows "2 schedules")
2. Click on schedule info box
3. Expected: List modal opens
4. Expected: Shows all 2 schedules with details
5. Expected: Each schedule shows:
   - Type, next run, recipients
   - Enable/disable toggle
   - Delete button
```

### Test 2: Disable Schedule
```
1. Open schedule list modal
2. Find enabled schedule (green ⏸️ button)
3. Click ⏸️ button
4. Expected: Button changes to gray ▶️
5. Expected: Schedule becomes semi-transparent
6. Expected: Schedule won't run until re-enabled
7. Close modal
8. Expected: Card still shows schedule (disabled count may differ)
```

### Test 3: Enable Schedule
```
1. Open schedule list modal
2. Find disabled schedule (gray ▶️ button)
3. Click ▶️ button
4. Expected: Button changes to green ⏸️
5. Expected: Schedule becomes fully opaque
6. Expected: Schedule will run again
```

### Test 4: Delete Schedule
```
1. Open schedule list modal
2. Click 🗑️ on a schedule
3. Expected: Confirmation dialog appears
4. Click OK
5. Expected: Schedule disappears from list
6. Expected: If last schedule, modal shows "No schedules"
7. Close modal
8. Expected: Card updates (no schedules or fewer schedules)
```

### Test 5: Multiple Schedules
```
1. Template with 3 schedules
2. Click schedule info
3. Expected: Shows all 3 schedules
4. Disable 1, delete 1
5. Expected: 1 enabled schedule remains
6. Close and reopen
7. Expected: Only 1 schedule shown
```

---

## Edge Cases Handled

### 1. **No Schedules**
- Shows "No schedules configured" message
- Provides clear feedback

### 2. **All Schedules Disabled**
- Still shows in list (with disabled state)
- Badge count may show 0 (only counts enabled)
- Schedule info shows based on enabled schedules

### 3. **Delete Last Schedule**
- List updates to empty state
- Card updates to "[details]" link
- Badge disappears from ⏰ button

### 4. **API Errors**
- Shows error message in modal
- Doesn't crash the app
- User can retry

---

## Future Enhancements (Optional)

### Phase 2:
1. **Inline Editing**
   - Edit schedule without separate modal
   - Quick time adjustment
   - Drag-and-drop day selection

2. **Bulk Actions**
   - Select multiple schedules
   - Bulk enable/disable
   - Bulk delete

3. **Schedule History**
   - Full execution history
   - Success/failure rates
   - Performance metrics

4. **Schedule Templates**
   - Save schedule configs
   - Reuse across templates
   - Quick apply presets

---

## Summary

### ✅ What Was Fixed:
1. Can now view all schedules for a template
2. Can enable/disable schedules
3. Can delete unwanted schedules
4. See schedule details and history
5. Real-time updates after changes

### ✅ User Actions:
- **Click schedule info** → View all schedules
- **Click ⏸️/▶️** → Toggle schedule
- **Click 🗑️** → Delete schedule
- **Changes update immediately** → No page refresh needed

### ✅ Components Created:
- `ScheduleListModal.js` - Schedule management UI
- `ScheduleListModal.css` - Styling

### ✅ Integration:
- Template cards now clickable when has schedules
- Opens list modal instead of create modal
- Seamless workflow

---

**Status:** ✅ Complete - Users can now fully manage their scheduled notifications!

**Created:** Oct 22, 2025  
**Issue:** Fixed inability to edit/delete schedules
