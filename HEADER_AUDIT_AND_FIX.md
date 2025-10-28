# Header Audit & Standardization Plan

## Goal
Ensure EVERY page has a consistent header using the reusable `PageHeader` component with theme-aware CSS.

---

## Header Variants to Use

### 🎨 Gradient (Purple rounded box - like Dashboard)
**When to use:** Main user-facing pages, important features
- Dashboard ✅ (Already has it)
- L3V3L Matches ✅ (Just fixed)
- Preferences
- Privacy & PII Management
- Notification Management
- Messages

### 📋 Flat (Solid surface with border)
**When to use:** Admin tools, management pages
- Dynamic Scheduler
- Role Management  
- Activity Logs
- Event Queue Manager

### 🔍 Minimal (No background, just text)
**When to use:** Search-heavy pages, content-first pages
- Search Page
- Favorites
- Exclusions
- Shortlists

---

## Pages That Need Fixing

### ✅ DONE
1. **L3V3L Matches** - Changed to gradient variant

### 🔧 TO FIX - HIGH PRIORITY

#### 1. Dashboard.js
- **Current:** Custom purple header
- **Action:** Replace with `PageHeader` gradient variant
- **Priority:** HIGH (sets the standard)

#### 2. SearchPage.js (Advanced Search)
- **Current:** Custom centered header
- **Action:** Replace with `PageHeader` minimal variant + action buttons
- **Priority:** HIGH

#### 3. DynamicScheduler.js
- **Current:** Custom dark header
- **Action:** Replace with `PageHeader` flat variant
- **Priority:** HIGH

#### 4. ActivityLogs.js
- **Current:** Custom centered header
- **Action:** Replace with `PageHeader` flat variant
- **Priority:** MEDIUM

#### 5. NotificationManagement.js
- **Current:** Custom purple header
- **Action:** Replace with `PageHeader` gradient variant
- **Priority:** HIGH

#### 6. PIIManagement.js (Privacy & Data Management)
- **Current:** Custom purple header
- **Action:** Replace with `PageHeader` gradient variant
- **Priority:** HIGH

#### 7. RoleManagement.js
- **Current:** Custom header
- **Action:** Replace with `PageHeader` flat variant
- **Priority:** MEDIUM

#### 8. Messages.js
- **Current:** Light purple header bar
- **Action:** Replace with `PageHeader` gradient variant
- **Priority:** MEDIUM

#### 9. Preferences.js
- **Current:** Custom purple gradient header
- **Action:** Replace with `PageHeader` gradient variant
- **Priority:** MEDIUM

#### 10. Favorites.js
- **Current:** Check if has header
- **Action:** Add `PageHeader` minimal variant if needed
- **Priority:** LOW

#### 11. Exclusions.js
- **Current:** Check if has header
- **Action:** Add `PageHeader` minimal variant if needed
- **Priority:** LOW

#### 12. Shortlist.js
- **Current:** Check if has header
- **Action:** Add `PageHeader` minimal variant if needed
- **Priority:** LOW

---

## Migration Process

For each page:

### 1. Import PageHeader
```jsx
import PageHeader from './PageHeader';
```

### 2. Replace custom header with PageHeader

**BEFORE:**
```jsx
<div className="custom-header">
  <h1>🎯 Page Title</h1>
  <p>Subtitle text</p>
</div>
```

**AFTER:**
```jsx
<PageHeader
  icon="🎯"
  title="Page Title"
  subtitle="Subtitle text"
  variant="gradient"  // or "flat" or "minimal"
  actions={
    <button>Action Button</button>  // Optional
  }
/>
```

### 3. Remove old CSS
- Delete unused header CSS classes
- Keep any page-specific styles

### 4. Test
- Check on desktop
- Check on mobile
- Test theme switching
- Verify action buttons work

---

## Variant Decision Matrix

| Page Type | Variant | Reason |
|-----------|---------|--------|
| User Dashboard | gradient | Main landing, high importance |
| Feature Pages (L3V3L, Messages) | gradient | Core features, engaging |
| Settings/Preferences | gradient | User-facing settings |
| Admin Tools | flat | Management pages, less visual prominence |
| Search/Lists | minimal | Content-first, less distraction |
| Privacy/Legal | gradient | Important, user-facing |

---

## Testing Checklist

For each migrated page:
- [ ] Header appears correctly
- [ ] Icon shows properly
- [ ] Title and subtitle are readable
- [ ] Action buttons are positioned correctly
- [ ] Works on mobile (< 768px)
- [ ] Works on small mobile (< 480px)
- [ ] Adapts to all themes (Light, Dark, Rose, etc.)
- [ ] Smooth transition when switching themes
- [ ] No console errors

---

## Files to Update

1. `frontend/src/components/Dashboard.js`
2. `frontend/src/components/SearchPage.js`
3. `frontend/src/components/DynamicScheduler.js`
4. `frontend/src/components/ActivityLogs.js`
5. `frontend/src/components/NotificationManagement.js`
6. `frontend/src/components/PIIManagement.js`
7. `frontend/src/components/RoleManagement.js`
8. `frontend/src/components/Messages.js`
9. `frontend/src/components/Preferences.js`
10. Others as needed

---

## Next Steps

1. ✅ PageHeader component created (theme-aware)
2. ✅ L3V3L Matches migrated
3. 🔄 Migrate remaining high-priority pages
4. 🔄 Test all pages
5. 🔄 Update documentation
6. ✅ Remove old header CSS

---

## Notes

- Keep existing icons and text for familiarity
- Maintain action button functionality
- Test thoroughly before committing
- Document any issues or edge cases
- Consider user feedback on gradient vs flat choices
