# 🎯 Tooltip Component - Usage Guide

## Overview
A reusable, accessible tooltip component for contextual help throughout the app.

## Features
✅ **Theme-aware** - Adapts to all app themes (Cozy Light, Dark, Rose, etc.)  
✅ **Accessible** - Keyboard navigation, ARIA labels, focus states  
✅ **Flexible positioning** - Top, bottom, left, right  
✅ **Two modes** - Info icon or wrap existing elements  
✅ **Responsive** - Mobile-optimized  
✅ **Smooth animations** - Fade-in effect  

---

## Installation

Import the component:
```javascript
import Tooltip from './components/Tooltip';
```

---

## Usage Examples

### 1. **Basic Info Icon** (Most Common)
Perfect for form fields and labels:

```javascript
<label>
  Email Address
  <Tooltip text="We'll never share your email" icon />
</label>
```

### 2. **Wrap Existing Text**
Add help to any element:

```javascript
<Tooltip text="This is your unique identifier in the system">
  <span>Username</span>
</Tooltip>
```

### 3. **Different Positions**
Control where the tooltip appears:

```javascript
// Top (default)
<Tooltip text="Help text" icon />

// Bottom
<Tooltip text="Help text" position="bottom" icon />

// Left
<Tooltip text="Help text" position="left" icon />

// Right
<Tooltip text="Help text" position="right" icon />
```

### 4. **Custom Width**
For longer help text:

```javascript
<Tooltip 
  text="This is a longer explanation that needs more space to properly convey the information to the user."
  maxWidth="350px"
  icon 
/>
```

### 5. **With Form Fields**
```javascript
<div className="form-group">
  <label>
    Birth Month
    <Tooltip 
      text="Select your birth month. This is used to calculate your age for matching."
      position="right"
      icon 
    />
  </label>
  <select name="birthMonth">
    <option>January</option>
    {/* ... */}
  </select>
</div>
```

### 6. **With Buttons**
```javascript
<button disabled>
  Delete Account
  <Tooltip 
    text="This action is disabled because you have pending messages."
    position="top"
    icon 
  />
</button>
```

### 7. **Complex Content**
For multi-line or formatted help:

```javascript
<Tooltip 
  text="Premium users get: Unlimited messages, Advanced search, Priority support"
  maxWidth="300px"
  position="bottom"
  icon 
/>
```

---

## Real-World Examples in Your App

### Admin Dashboard - Column Headers
```javascript
<th>
  Days Active
  <Tooltip 
    text="Number of days since user registration"
    position="top"
    icon 
  />
</th>
```

### Search Page - Filter Options
```javascript
<div className="filter-group">
  <label>
    Age Range
    <Tooltip 
      text="Set minimum and maximum age for your matches. Leave blank for no restriction."
      position="right"
      maxWidth="280px"
      icon 
    />
  </label>
  <input type="number" placeholder="Min" />
  <input type="number" placeholder="Max" />
</div>
```

### Profile Page - Visibility Settings
```javascript
<div className="privacy-setting">
  <label>
    Show Phone Number
    <Tooltip 
      text="Only users you've matched with can see your phone number"
      position="bottom"
      icon 
    />
  </label>
  <input type="checkbox" />
</div>
```

### Notification Settings
```javascript
<div className="notification-option">
  <label>
    Email Digest
    <Tooltip 
      text="Receive a daily summary of new matches and messages instead of individual emails"
      position="right"
      maxWidth="300px"
      icon 
    />
  </label>
  <select>
    <option>Daily</option>
    <option>Weekly</option>
  </select>
</div>
```

---

## Props Reference

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `text` | string | *required* | Help text to display |
| `icon` | boolean | `false` | Show as info icon (ℹ️) |
| `position` | string | `'top'` | Tooltip position: `'top'`, `'bottom'`, `'left'`, `'right'` |
| `maxWidth` | string | `'250px'` | Maximum width of tooltip bubble |
| `children` | node | - | Element to wrap (required if `icon=false`) |

---

## Styling Guide

### Colors (Auto-adapts to Theme)
- Background: `var(--card-background)`
- Text: `var(--text-color)`
- Border: `var(--border-color)`
- Icon: `var(--primary-color)` → `var(--secondary-color)` on hover

### Spacing
- Icon size: 20px × 20px (18px on mobile)
- Padding: 10px × 14px (8px × 12px on mobile)
- Distance from target: 8px
- Border radius: `var(--radius-md)`

---

## Accessibility

✅ **Keyboard Navigation**
- Tab to focus on info icon
- Shows tooltip on focus (not just hover)
- Escape dismisses tooltip

✅ **Screen Readers**
- ARIA labels: `role="tooltip"` and `aria-label="Help information"`
- Semantic HTML structure

✅ **High Contrast Mode**
- Thicker borders in high-contrast settings
- Increased font weight

---

## Best Practices

### ✅ DO:
- Use concise, helpful text (1-2 sentences)
- Place tooltips near relevant content
- Use consistent positioning across similar elements
- Test on mobile devices (tooltips auto-shrink)

### ❌ DON'T:
- Put essential information only in tooltips
- Use for very long explanations (consider a help page instead)
- Nest tooltips within tooltips
- Override theme colors (let it adapt automatically)

---

## Where to Add Tooltips in Your App

### High Priority (Add First):
1. **Admin Dashboard** - Table column headers
2. **Search Filters** - Each filter option
3. **Profile Editing** - Privacy/visibility settings
4. **Registration Form** - Complex fields (birth info, preferences)
5. **Settings Pages** - Notification options, account settings

### Medium Priority:
1. **Dashboard Stats** - What each metric means
2. **Matching Criteria** - How scoring works
3. **L3V3L Features** - Explain compatibility algorithm
4. **Payment/Subscription** - Feature differences

### Nice-to-Have:
1. **Navigation Items** - For less obvious pages
2. **Action Buttons** - When disabled (explain why)
3. **Badges/Labels** - Explain status indicators

---

## Advanced: Creating Contextual Help Icons

For pages with multiple help points, create a helper component:

```javascript
// HelpIcon.js
import Tooltip from './Tooltip';

const HelpIcon = ({ children, position = 'top', maxWidth = '250px' }) => (
  <Tooltip text={children} icon position={position} maxWidth={maxWidth} />
);

export default HelpIcon;

// Usage:
<label>
  Email
  <HelpIcon>We'll never share your email with anyone</HelpIcon>
</label>
```

---

## Testing Checklist

Before deploying:
- [ ] Tooltip appears on hover
- [ ] Tooltip appears on focus (keyboard)
- [ ] Tooltip positions correctly (all 4 positions)
- [ ] Responsive on mobile (smaller size)
- [ ] Works in all themes (light/dark)
- [ ] Doesn't overlap important content
- [ ] Accessible via keyboard navigation
- [ ] Smooth fade-in animation

---

## Performance

- Lightweight: ~3KB total (JS + CSS)
- No external dependencies
- Pure CSS animations (hardware-accelerated)
- Lazy rendering (only when visible)

---

## Browser Support

✅ Chrome, Firefox, Safari, Edge (latest 2 versions)  
✅ Mobile browsers (iOS Safari, Chrome Android)  
⚠️ IE11: Works but no smooth animations

---

## Next Steps

1. **Add to common pages**: Start with Admin Dashboard and Search
2. **Gather feedback**: Ask users if help text is clear
3. **Iterate**: Adjust wording based on user questions
4. **Expand**: Add tooltips to new features as you build them

---

## Questions?

See the component code for implementation details or modify `Tooltip.css` to adjust styling.

Happy helping! 🎯
