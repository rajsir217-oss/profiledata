# Schedule Info Display on Template Cards

**Feature:** Inline schedule information display on notification template cards  
**Date:** Oct 22, 2025  
**Status:** ✅ Complete

---

## What Was Added

Added inline schedule information display directly on notification template cards, showing:
1. **Schedule type** (One-time, daily, weekly, monthly, or multiple schedules)
2. **Next run time** (when the next notification will be sent)
3. **Interactive link** to add schedule when none exists

---

## Visual Display

### No Schedule:
```
┌─────────────────────────────────┐
│ NEW MESSAGE      🟢 Active      │
├─────────────────────────────────┤
│ 📧 email  🏷️ communication     │
│ New message from {match.name}   │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ Add scheduled time: [details]│ │ ← Clickable
│ │ Next Run: [details]          │ │
│ └─────────────────────────────┘ │
│                                 │
│ [✏️] [👁️] [📤] [⏰] [⏸️]       │
└─────────────────────────────────┘
```

### Single Schedule:
```
┌─────────────────────────────────┐
│ PROFILE VIEWED   🟢 Active      │
├─────────────────────────────────┤
│ 📧 email  🏷️ activity          │
│ {match.name} viewed your profile│
│                                 │
│ ┌─────────────────────────────┐ │
│ │ Add scheduled time: daily    │ │
│ │ Next Run: 10/23/25, 9:00 AM  │ │
│ └─────────────────────────────┘ │
│                                 │
│ [✏️] [👁️] [📤] [⏰ ①] [⏸️]     │
└─────────────────────────────────┘
```

### Multiple Schedules:
```
┌─────────────────────────────────┐
│ UNREAD MESSAGES  🟢 Active      │
├─────────────────────────────────┤
│ 📧 email  🏷️ engagement        │
│ You have unread messages        │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ Add scheduled time: 2 schedules│ │
│ │ Next Run: 10/23/25, 8:00 AM  │ │ ← Earliest
│ └─────────────────────────────┘ │
│                                 │
│ [✏️] [👁️] [📤] [⏰ ②] [⏸️]     │
└─────────────────────────────────┘
```

---

## Features

### 1. **No Schedule State**
When no schedules exist:
- Shows "Add scheduled time: [details]"
- Shows "Next Run: [details]"
- Entire line is clickable → Opens schedule modal
- Muted styling to indicate no active schedule

### 2. **Single Schedule State**
When one schedule exists:
- Shows schedule type (One-time, daily, weekly, monthly)
- Shows next run date/time
- Full date/time display with locale formatting
- Clear indication of when notification will send

### 3. **Multiple Schedules State**
When multiple schedules exist:
- Shows count: "2 schedules", "3 schedules", etc.
- Shows earliest next run time
- Indicates there are multiple schedules configured

### 4. **Interactive**
- Click "Add scheduled time: [details]" → Opens schedule modal
- Works alongside existing ⏰ button
- Badge count on ⏰ button shows number of schedules

---

## Implementation Details

### getScheduleDisplay Function

```javascript
const getScheduleDisplay = (template) => {
  const schedules = scheduledNotifications.filter(
    s => s.templateId === template._id && s.enabled
  );

  if (schedules.length === 0) {
    return null;  // No schedules
  }

  if (schedules.length === 1) {
    const schedule = schedules[0];
    const nextRun = schedule.nextRun ? new Date(schedule.nextRun) : null;
    
    return {
      type: schedule.scheduleType === 'one_time' ? 'One-time' : schedule.recurrencePattern,
      nextRun: nextRun ? nextRun.toLocaleString() : 'Calculating...',
      count: 1
    };
  }

  // Multiple schedules - find earliest
  const nextSchedule = schedules.reduce((earliest, current) => {
    const currentNext = new Date(current.nextRun);
    const earliestNext = new Date(earliest.nextRun);
    return currentNext < earliestNext ? current : earliest;
  });

  return {
    type: `${schedules.length} schedules`,
    nextRun: new Date(nextSchedule.nextRun).toLocaleString(),
    count: schedules.length
  };
};
```

### Display Logic

```jsx
{template.type !== 'job' && (
  <div className="template-schedule-info">
    {getScheduleDisplay(template) ? (
      // Has schedules - show info
      <div className="schedule-display">
        <div className="schedule-line">
          <span className="schedule-label">Add scheduled time:</span>
          <span className="schedule-value">{getScheduleDisplay(template).type}</span>
        </div>
        <div className="schedule-line">
          <span className="schedule-label">Next Run:</span>
          <span className="schedule-value">{getScheduleDisplay(template).nextRun}</span>
        </div>
      </div>
    ) : (
      // No schedules - show clickable link
      <div className="schedule-display no-schedule">
        <button
          className="add-schedule-link"
          onClick={() => {
            setScheduleTemplate(template);
            setShowScheduleModal(true);
          }}
        >
          <span className="schedule-label">Add scheduled time:</span>
          <span className="schedule-link">[details]</span>
        </button>
        <div className="schedule-line muted">
          <span className="schedule-label">Next Run:</span>
          <span className="schedule-value">[details]</span>
        </div>
      </div>
    )}
  </div>
)}
```

---

## CSS Styling

### Container
```css
.template-schedule-info {
  margin-top: 0.75rem;
  padding: 0.75rem;
  background: var(--hover-background);
  border-radius: 6px;
  border: 1px solid var(--border-color);
}
```

### Schedule Lines
```css
.schedule-line {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.85rem;
}

.schedule-label {
  color: var(--text-secondary);
  font-weight: 500;
}

.schedule-value {
  color: var(--text-color);
  font-weight: 600;
}
```

### Interactive Link
```css
.add-schedule-link {
  background: none;
  border: none;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  width: 100%;
  transition: all 0.2s;
}

.add-schedule-link:hover {
  transform: translateX(2px);
}

.schedule-link {
  color: var(--primary-color);
  font-weight: 600;
}
```

---

## User Experience

### Discovery
1. User sees template card
2. Notices schedule info box below description
3. Sees either:
   - "[details]" link if no schedule
   - Actual schedule details if configured

### Interaction
1. Click "[details]" or ⏰ button
2. Schedule modal opens
3. Configure schedule
4. Submit
5. Card updates to show schedule details

### Information at a Glance
- **Type:** What kind of schedule (daily, weekly, etc.)
- **Timing:** When it will next run
- **Status:** Active or not (via badge count)

---

## Benefits

### 1. **Immediate Visibility**
- No need to hover or click to see schedule status
- Clear indication of configured schedules
- Easy to scan multiple cards

### 2. **Quick Access**
- Click "[details]" to add schedule
- No hunting for ⏰ button
- Intuitive call-to-action

### 3. **Information Density**
- Shows schedule type and next run
- Doesn't clutter the card
- Compact and readable

### 4. **Consistency**
- Same display format across all cards
- Predictable information location
- Theme-aware styling

---

## Files Modified

### JavaScript:
- ✅ `TemplateManager.js` - Added `getScheduleDisplay()` function
- ✅ `TemplateManager.js` - Added schedule info display section

### CSS:
- ✅ `TemplateManager.css` - Added `.template-schedule-info` styles
- ✅ `TemplateManager.css` - Added `.schedule-display`, `.schedule-line` styles
- ✅ `TemplateManager.css` - Added `.add-schedule-link` interactive styles

---

## Display Rules

### Shows Schedule Info When:
- ✅ Template is a notification (not a job)
- ✅ Component has loaded scheduled notifications
- ✅ Always visible (either link or details)

### Doesn't Show When:
- ❌ Template is a job type (jobs have their own schedule display)

---

## Date/Time Formatting

### Using toLocaleString()
```javascript
nextRun.toLocaleString()

Examples:
- "10/23/2025, 9:00:00 AM"
- "12/31/2025, 11:59:00 PM"
```

### Automatic Timezone
- Uses user's browser timezone
- Consistent with user's locale
- No manual formatting needed

---

## Testing

### Test 1: No Schedule
```
1. Find template with no schedules
2. Look for schedule info box
3. Should show:
   "Add scheduled time: [details]" (clickable)
   "Next Run: [details]" (muted)
4. Click "[details]"
5. Schedule modal should open
```

### Test 2: Single Schedule
```
1. Create a schedule for a template
2. Refresh page
3. Should show:
   "Add scheduled time: daily"
   "Next Run: 10/23/25, 9:00:00 AM"
4. Time should be in local timezone
```

### Test 3: Multiple Schedules
```
1. Create 2+ schedules for same template
2. Refresh page
3. Should show:
   "Add scheduled time: 2 schedules"
   "Next Run: [earliest time]"
4. Badge on ⏰ button shows "2"
```

---

## Future Enhancements

### Phase 2 (Optional):
1. **Relative Time Display**
   - "Runs in 2 hours"
   - "Runs tomorrow at 9 AM"
   - More human-readable

2. **Schedule Type Icons**
   - 📅 One-time
   - 🔄 Recurring
   - ⏰ Custom

3. **Quick Edit**
   - Click time to edit schedule
   - Inline time picker
   - No modal needed

4. **Schedule Preview**
   - Show next 3 run times
   - Hover tooltip with details
   - Visual timeline

---

## Accessibility

### Keyboard Navigation
- Tab to "[details]" link
- Enter/Space to activate
- Clear focus states

### Screen Readers
- Labels are descriptive
- Interactive elements announced
- Semantic HTML structure

### Visual Clarity
- High contrast text
- Theme-aware colors
- Clear visual hierarchy

---

## Summary

✅ **Schedule info displayed inline** on template cards  
✅ **Shows schedule type** (daily, weekly, one-time, etc.)  
✅ **Shows next run time** (actual date/time)  
✅ **Clickable link** to add schedule when none exists  
✅ **Theme-aware styling** using CSS variables  
✅ **Works with existing features** (⏰ button, badges, tooltips)  

**Result:** Users can see schedule status at a glance without any extra clicks!

---

**Created:** Oct 22, 2025  
**Status:** ✅ Complete and Ready to Use
