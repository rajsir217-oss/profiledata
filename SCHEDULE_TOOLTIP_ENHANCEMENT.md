# Schedule Button Tooltip Enhancement

**Feature:** Hover tooltip showing scheduled notification details  
**Date:** Oct 22, 2025  
**Status:** ✅ Complete

---

## What Was Added

Enhanced the ⏰ schedule button to show rich tooltip information on hover:

### Tooltip Content:

#### No Schedules:
```
"Schedule Notification - No active schedules"
```

#### Single Schedule:
```
"One-time: 10/25/2025, 2:00:00 PM
Recipients: active users"
```

or

```
"Recurring: weekly at 9:00:00 AM
Recipients: all users"
```

#### Multiple Schedules:
```
"2 active schedules
Click to view details"
```

---

## Visual Enhancements

### 1. Button State Indicator
- **Default:** Gray button (no schedules)
- **Has Schedules:** Gradient blue/purple with pulse animation
- **Hover:** Scales up slightly

### 2. Badge Count
- Small red badge in top-right corner
- Shows number of active schedules
- Only visible when count > 0

### 3. Pulse Animation
- Gentle pulsing effect when schedules are active
- Draws attention to scheduled templates
- Stops on hover

---

## Implementation Details

### Files Modified:

#### `TemplateManager.js`:
```javascript
// 1. Added state for scheduled notifications
const [scheduledNotifications, setScheduledNotifications] = useState([]);

// 2. Load scheduled notifications on mount
const loadScheduledNotifications = async () => {
  const response = await fetch('/api/notifications/scheduled');
  const data = await response.json();
  setScheduledNotifications(data);
};

// 3. Generate tooltip based on schedules
const getScheduleTooltip = (template) => {
  const schedules = scheduledNotifications.filter(
    s => s.templateId === template._id && s.enabled
  );
  
  if (schedules.length === 0) {
    return 'Schedule Notification - No active schedules';
  }
  
  if (schedules.length === 1) {
    // Show schedule details
    const schedule = schedules[0];
    const typeText = schedule.scheduleType === 'one_time' ? 'One-time' : 'Recurring';
    const timeText = ...;
    const recipientText = schedule.recipientType.replace('_', ' ');
    return `${typeText}: ${timeText}\nRecipients: ${recipientText}`;
  }
  
  return `${schedules.length} active schedules\nClick to view details`;
};

// 4. Apply to button
<button
  className={`btn-icon schedule-btn ${hasSchedules ? 'has-schedules' : ''}`}
  title={getScheduleTooltip(template)}
>
  ⏰
  {hasSchedules && <span className="schedule-count">{count}</span>}
</button>
```

#### `TemplateManager.css`:
```css
/* Button with schedules - gradient + pulse */
.schedule-btn.has-schedules {
  background: linear-gradient(135deg, var(--primary-color) 0%, var(--secondary-color) 100%);
  color: white;
  animation: pulse-schedule 2s ease-in-out infinite;
}

/* Badge count */
.schedule-count {
  position: absolute;
  top: -6px;
  right: -6px;
  background: var(--danger-color);
  color: white;
  border-radius: 50%;
  width: 18px;
  height: 18px;
  font-size: 0.7rem;
  font-weight: 600;
}

/* Pulse animation */
@keyframes pulse-schedule {
  0%, 100% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.4); }
  50% { box-shadow: 0 0 0 6px rgba(99, 102, 241, 0); }
}
```

---

## Example Tooltips

### Example 1: NEW MESSAGE Template
```
Button State: ⏰ with "2" badge (pulsing gradient)

Tooltip on Hover:
"2 active schedules
Click to view details"
```

### Example 2: PROFILE VIEWED Template
```
Button State: ⏰ with "1" badge (pulsing gradient)

Tooltip on Hover:
"Recurring: daily at 9:00:00 AM
Recipients: active users"
```

### Example 3: UNREAD MESSAGES Template
```
Button State: ⏰ (no badge, gray)

Tooltip on Hover:
"Schedule Notification - No active schedules"
```

---

## User Experience Flow

```
1. User hovers over ⏰ button
   ↓
2. Browser shows tooltip with:
   - Schedule type (one-time/recurring)
   - Next run time
   - Recipient type
   ↓
3. User sees visual indicators:
   - Pulsing gradient = has schedules
   - Badge count = number of schedules
   - Plain gray = no schedules
   ↓
4. User clicks to open modal for:
   - Creating new schedule
   - Viewing existing schedules
```

---

## Benefits

### 1. **Quick Information**
Users can see schedule status without clicking

### 2. **Visual Feedback**
Pulsing button draws attention to active schedules

### 3. **At-a-Glance Status**
Badge count shows how many schedules exist

### 4. **Detailed Preview**
Tooltip shows actual schedule details

### 5. **No Extra Clicks**
All info available on hover

---

## Technical Notes

### Tooltip Format:
- Uses browser's native `title` attribute
- Supports multi-line text with `\n`
- Auto-wraps on most browsers
- Works on mobile (long-press)

### Data Loading:
- Scheduled notifications loaded on component mount
- Reloaded after creating new schedule
- Efficient filtering by template ID

### Performance:
- Schedules loaded once, cached in state
- Tooltip generated on-the-fly (no extra API calls)
- Filter operation is O(n) but n is small (< 100 typically)

---

## Testing

### Test 1: No Schedules
```
1. Find template with no schedules
2. Hover over ⏰ button
3. Expected: "Schedule Notification - No active schedules"
4. Expected: Gray button, no badge
```

### Test 2: Single Schedule
```
1. Create a schedule for a template
2. Refresh page
3. Hover over ⏰ button
4. Expected: Shows schedule details
5. Expected: Gradient pulsing button with "1" badge
```

### Test 3: Multiple Schedules
```
1. Create 2+ schedules for same template
2. Refresh page
3. Hover over ⏰ button
4. Expected: "2 active schedules\nClick to view details"
5. Expected: Badge shows correct count
```

### Test 4: Different Schedule Types
```
One-time schedule tooltip:
"One-time: 10/25/2025, 2:00:00 PM
Recipients: active users"

Recurring daily:
"Recurring: daily at 9:00:00 AM
Recipients: all users"

Recurring weekly:
"Recurring: weekly at 5:00:00 PM
Recipients: test"
```

---

## Future Enhancements (Optional)

### 1. Rich Tooltip Component
Replace browser tooltip with custom React component:
- Better styling
- Click to expand
- Show all schedules
- Edit/delete buttons

### 2. Tooltip Content
Add more details:
- Created by: admin
- Last run: 2 hours ago
- Next run: in 22 hours
- Success rate: 98%

### 3. Color Coding
Different colors based on schedule type:
- One-time: Orange
- Daily: Blue
- Weekly: Green
- Monthly: Purple

### 4. Schedule Preview
Mini calendar showing next 5 run times

---

## Summary

✅ **Tooltip shows:**
- Schedule type (one-time/recurring)
- Next run time
- Recipient type
- Count for multiple schedules

✅ **Visual indicators:**
- Gradient button when schedules exist
- Pulse animation
- Badge count
- Gray when no schedules

✅ **User benefits:**
- Quick status check
- No extra clicks needed
- Clear visual feedback
- Detailed information on hover

---

**Status:** ✅ Complete and Ready to Use  
**Created:** Oct 22, 2025
