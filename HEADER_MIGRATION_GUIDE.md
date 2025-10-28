# Page Header Migration Guide

## Problem
Headers are inconsistent across pages:
- Different styles (gradient, flat, centered, left-aligned)
- Different layouts (with/without icons, subtitles)
- Inconsistent spacing and responsive behavior

## Solution
Use the new `PageHeader` component for consistency.

---

## Usage Examples

### 1. Dashboard (Gradient with Actions)
```jsx
import PageHeader from './components/PageHeader';

<PageHeader
  icon="📊"
  title="My Dashboard"
  subtitle="Welcome back, Admin User!"
  variant="gradient"
  actions={
    <>
      <button className="header-icon-btn">🦋</button>
      <button className="header-icon-btn">🔍</button>
      <button className="btn-toggle">
        <span className="toggle-option">📇 Cards</span>
        <span className="toggle-option">☰ Rows</span>
      </button>
    </>
  }
/>
```

### 2. L3V3L Matches (Minimal with Centered Title)
```jsx
<PageHeader
  icon="🦋"
  title="My L3V3L Matches"
  subtitle="Discover connections based on Love, Loyalty, Laughter, Vulnerability, and Elevation"
  variant="minimal"
  actions={
    <div className="view-toggle">
      <button className="view-btn active">📇 Cards</button>
      <button className="view-btn">☰ Rows</button>
    </div>
  }
/>
```

### 3. Advanced Search (Minimal with Actions)
```jsx
<PageHeader
  icon="🔍"
  title="Advanced Search"
  variant="minimal"
  actions={
    <>
      <button className="header-icon-btn">🔍</button>
      <button className="header-icon-btn danger">✕</button>
      <button className="header-icon-btn">💾</button>
      <button className="header-icon-btn">📋</button>
    </>
  }
/>
```

### 4. Dynamic Scheduler (Flat with Button)
```jsx
<PageHeader
  icon="📅"
  title="Dynamic Scheduler"
  subtitle="Manage scheduled jobs and automation tasks"
  variant="flat"
  actions={
    <button className="btn btn-primary">
      ➕ Create New Job
    </button>
  }
/>
```

### 5. Activity Logs (Minimal)
```jsx
<PageHeader
  icon="📊"
  title="Activity Logs"
  subtitle="Monitor user activities and system events"
  variant="minimal"
/>
```

### 6. Privacy & Data Management (Gradient)
```jsx
<PageHeader
  icon="🔒"
  title="Privacy & Data Management"
  subtitle="Manage who can access your private information"
  variant="gradient"
  actions={
    <button className="header-icon-btn">☰</button>
  }
/>
```

### 7. Role Management (Flat)
```jsx
<PageHeader
  icon="🛡️"
  title="Role Management"
  subtitle="View and understand role permissions, limits, and hierarchy"
  variant="flat"
/>
```

### 8. Notification Management (Gradient)
```jsx
<PageHeader
  icon="🔔"
  title="Notification Management"
  subtitle="Manage notification queue and email/SMS templates"
  variant="gradient"
  actions={
    <button className="btn btn-secondary">🔄 Refresh</button>
  }
/>
```

### 9. Preferences (Gradient)
```jsx
<PageHeader
  icon="⚙️"
  title="Preferences"
  subtitle="Manage your account settings and notification preferences"
  variant="gradient"
/>
```

---

## Variants

### `gradient` (Default)
- Purple gradient background
- White text
- Best for: Main pages, dashboards

### `flat`
- Solid surface color
- Border
- Best for: Secondary pages, admin tools

### `minimal`
- No background
- Transparent
- Best for: Search pages, list views

---

## Migration Checklist

Replace these inconsistent headers:

- [ ] Dashboard.js - Use gradient variant
- [ ] L3V3LMatches.js - Use minimal variant
- [ ] SearchPage.js - Use minimal variant
- [ ] MessagePage.js - Use flat variant
- [ ] PrivacyPage.js - Use gradient variant
- [ ] RoleManagement.js - Use flat variant
- [ ] ActivityLogs.js - Use minimal variant
- [ ] DynamicScheduler.js - Use flat variant
- [ ] NotificationManagement.js - Use gradient variant
- [ ] Preferences.js - Use gradient variant

---

## Benefits

✅ **Consistent UX** - Same look and feel across all pages
✅ **Responsive** - Mobile-friendly out of the box
✅ **Maintainable** - Change once, update everywhere
✅ **Flexible** - 3 variants for different contexts
✅ **Accessible** - Proper semantic HTML

---

## Notes

- Replace existing page headers with this component
- Keep the same icons and text for familiarity
- Choose variant based on page importance:
  - **gradient**: Main user-facing pages
  - **flat**: Admin/settings pages
  - **minimal**: Content-heavy pages
