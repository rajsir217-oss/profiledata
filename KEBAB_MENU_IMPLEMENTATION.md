# Kebab Menu Feature Implementation

**Branch:** `feature/kebab-menu-actions`  
**Created:** November 16, 2025  
**Feature:** Context-aware bottom actions + expandable kebab menu for user cards

---

## 🎯 Objectives

1. **Reduce visual clutter** - Move secondary actions to kebab menu (⋮)
2. **Context-aware UI** - Bottom buttons change based on page context
3. **Scalability** - Easy to add new actions without UI restructure
4. **Consistency** - Same implementation across UserCard and SearchResultCard

---

## 🔴 MANDATORY GROUND RULES

### 1. Theme-Aware CSS Only
```css
/* ✅ ALWAYS use CSS variables */
background: var(--card-background);
color: var(--text-color);
border: 1px solid var(--border-color);
box-shadow: var(--shadow-md);
border-radius: var(--radius-md);

/* ❌ NEVER hardcode */
background: #ffffff;
color: #333;
border: 1px solid #ddd;
```

**Available CSS Variables:**
- Colors: `--primary-color`, `--secondary-color`, `--accent-color`
- Backgrounds: `--background-color`, `--surface-color`, `--card-background`
- Text: `--text-color`, `--text-secondary`, `--text-muted`
- Borders: `--border-color`, `--divider-color`
- Status: `--success-color`, `--danger-color`, `--warning-color`, `--info-color`
- Interactive: `--hover-background`, `--active-background`, `--selected-background`
- Shadows: `--shadow-sm`, `--shadow-md`, `--shadow-lg`, `--shadow-glow`
- Spacing: `--spacing-xs`, `--spacing-sm`, `--spacing-md`, `--spacing-lg`
- Radius: `--radius-sm`, `--radius-md`, `--radius-lg`, `--radius-xl`

**5 Themes to Test:**
1. Cozy Light (default)
2. Dark
3. Rose
4. Light Gray
5. Ultra Light Gray

### 2. NO Browser Modals EVER
```javascript
// ❌ NEVER USE
alert('Success!');
confirm('Are you sure?');
prompt('Enter reason:');

// ✅ ALWAYS USE
import Toast from './Toast';
setToast({ message: 'Success!', type: 'success' });

// For confirmations, use custom modal or 2-click DeleteButton
import DeleteButton from './DeleteButton';
```

### 3. NO !important Without Approval
```css
/* ❌ AVOID !important - indicates specificity problem */
.button { color: red !important; }

/* ✅ Increase specificity properly */
.kebab-menu .menu-item { color: red; }
.kebab-menu .menu-item.danger { color: var(--danger-color); }
```

### 4. Mobile-First Responsive Design
```css
/* Base styles for mobile */
.kebab-menu {
  width: 100%;
  max-width: 280px;
}

/* Tablet */
@media (min-width: 768px) {
  .kebab-menu {
    max-width: 320px;
  }
}

/* Desktop */
@media (min-width: 1024px) {
  .kebab-menu {
    max-width: 360px;
  }
}
```

**Key Mobile Considerations:**
- Touch targets: Minimum 44x44px (iOS) / 48x48px (Android)
- Menu items: Large enough for finger taps
- Kebab button: Positioned clearly, easy to tap
- Dropdown: Doesn't overflow viewport
- Bottom actions: Stack vertically on small screens if needed

### 5. Keep UserCard and SearchResultCard in SYNC
```javascript
// Both components MUST have:
// 1. Same kebab menu structure
// 2. Same CSS styling
// 3. Same handler props
// 4. Same context-based logic
```

**Files to Update Together:**
- `/frontend/src/components/UserCard.js`
- `/frontend/src/components/UserCard.css`
- `/frontend/src/components/SearchResultCard.js`
- `/frontend/src/components/SearchPage.css` (contains SearchResultCard styles)

### 6. No Hardcoded URLs or Configuration
```javascript
// ❌ NEVER hardcode
const API_URL = 'http://localhost:8000';

// ✅ ALWAYS use config
import { getBackendUrl } from '../config/apiConfig';
const API_URL = getBackendUrl();
```

### 7. Search Before Implementing
```bash
# Check if similar component exists
grep -r "KebabMenu\|DropdownMenu\|MoreActions" frontend/src/

# Check git history
git log --all --grep="kebab\|dropdown\|menu" --oneline
```

---

## 🏗️ Architecture

### Component Hierarchy
```
UserCard / SearchResultCard
├── Kebab Menu Button (⋮)
├── KebabMenu Component
│   ├── Profile Section
│   │   └── View Full Profile
│   ├── Lists Section
│   │   ├── Add/Remove Favorites
│   │   └── Add/Remove Shortlist
│   ├── Access Section
│   │   ├── Request Contact Info
│   │   ├── Request Email
│   │   ├── Request Phone
│   │   └── Request Photo Access
│   └── Actions Section
│       ├── Send Message
│       ├── Block User
│       └── Report User
└── Bottom Action Buttons (context-aware)
    ├── Primary Action (e.g., Message)
    └── Context Action (e.g., Remove from Favorites)
```

### Context-Based Bottom Actions

| Page/Context | Bottom Button 1 | Bottom Button 2 |
|--------------|----------------|----------------|
| My Messages | 💬 Open Chat | 🗑️ Delete Conversation |
| My Favorites | 💬 Message | 💔 Remove from Favorites |
| My Shortlists | 💬 Message | 📤 Remove from Shortlist |
| Not Interested | 👁️ View Profile | ✅ Unblock User |
| Search Results | 💬 Message | 👁️ View Profile |
| L3V3L Matches | 💬 Message | 👁️ View Profile |
| Profile Views | 💬 Message | 👁️ View Profile |
| PII Requests | ✅ Approve | ❌ Deny |

### Kebab Menu Structure (Universal)

**Profile Section:**
- 👁️ View Full Profile (always)

**Lists Section:**
- ⭐/❌ Toggle Favorites (conditional icon based on state)
- 📋/📤 Toggle Shortlist (conditional icon based on state)

**Access Section (conditional - only show if not granted):**
- 🔒 Request Contact Info
- 📧 Request Email
- 📱 Request Phone Number
- 📷 Request Photo Access

**Actions Section:**
- 💬 Send Message (hide if context is 'my-messages')
- 🚫 Block User (hide if already blocked)
- 🚩 Report User (always, danger style)

---

## 📱 Mobile UI Considerations

### 1. Kebab Button
```css
.kebab-button {
  width: 40px;
  height: 40px;
  min-width: 44px;  /* iOS minimum touch target */
  min-height: 44px;
  border-radius: var(--radius-md);
  background: transparent;
  border: 1px solid var(--border-color);
  padding: var(--spacing-xs);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
}

@media (max-width: 768px) {
  .kebab-button {
    min-width: 48px;  /* Android minimum touch target */
    min-height: 48px;
  }
}
```

### 2. Dropdown Menu Positioning
```css
.kebab-menu-dropdown {
  position: absolute;
  top: 100%;
  right: 0;
  z-index: 1000;
  margin-top: var(--spacing-xs);
  max-height: 80vh;  /* Don't overflow viewport */
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;  /* Smooth iOS scrolling */
}

@media (max-width: 768px) {
  .kebab-menu-dropdown {
    /* On mobile, could use bottom sheet style */
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    top: auto;
    max-height: 60vh;
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
    box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.15);
  }
}
```

### 3. Menu Items
```css
.menu-item {
  padding: var(--spacing-md) var(--spacing-lg);
  min-height: 48px;  /* Touch-friendly */
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  cursor: pointer;
  transition: background 0.2s ease;
}

.menu-item:active {
  background: var(--active-background);
  transform: scale(0.98);  /* Tactile feedback */
}
```

### 4. Bottom Action Buttons
```css
.bottom-actions {
  display: flex;
  gap: var(--spacing-sm);
  margin-top: var(--spacing-md);
}

.action-button {
  flex: 1;
  min-height: 44px;
  padding: var(--spacing-sm) var(--spacing-md);
  font-size: var(--font-size-base);
  border-radius: var(--radius-md);
}

@media (max-width: 480px) {
  .bottom-actions {
    flex-direction: column;  /* Stack on very small screens */
  }
  
  .action-button {
    width: 100%;
  }
}
```

---

## 🎨 Theme-Aware Styling

### Kebab Button States
```css
.kebab-button {
  background: var(--card-background);
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
}

.kebab-button:hover {
  background: var(--hover-background);
  border-color: var(--primary-color);
  color: var(--primary-color);
  box-shadow: var(--shadow-sm);
}

.kebab-button.active {
  background: var(--selected-background);
  border-color: var(--primary-color);
  color: var(--primary-color);
  box-shadow: 0 0 0 3px var(--primary-color-light);
}
```

### Menu Dropdown
```css
.kebab-menu-dropdown {
  background: var(--card-background);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  backdrop-filter: blur(10px);  /* Glassmorphism */
}

/* Section headers */
.menu-section-title {
  color: var(--text-muted);
  font-size: var(--font-size-xs);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: var(--spacing-sm) var(--spacing-lg);
  font-weight: 600;
}

/* Menu items */
.menu-item {
  color: var(--text-color);
  background: transparent;
}

.menu-item:hover {
  background: var(--hover-background);
  color: var(--primary-color);
}

.menu-item.danger {
  color: var(--danger-color);
}

.menu-item.danger:hover {
  background: var(--danger-light);
  color: var(--danger-color);
}

/* Dividers between sections */
.menu-divider {
  height: 1px;
  background: var(--divider-color);
  margin: var(--spacing-xs) 0;
}
```

### Dark Theme Adjustments
```css
body.theme-dark .kebab-menu-dropdown {
  /* Slightly lighter than card background for contrast */
  background: color-mix(in srgb, var(--card-background) 95%, white 5%);
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
}

body.theme-dark .menu-item:hover {
  background: color-mix(in srgb, var(--card-background) 90%, white 10%);
}
```

---

## 📋 Implementation Checklist

### Phase 1: Create KebabMenu Component
- [ ] Create `/frontend/src/components/KebabMenu.js`
- [ ] Create `/frontend/src/components/KebabMenu.css`
- [ ] Implement menu button (⋮)
- [ ] Implement dropdown with sections
- [ ] Add click-outside-to-close logic
- [ ] Add ESC key to close
- [ ] Add theme-aware styling
- [ ] Add mobile-responsive styles
- [ ] Test touch interactions
- [ ] Test keyboard navigation

### Phase 2: Update UserCard
- [ ] Add `context` prop to UserCard
- [ ] Add kebab menu handlers props
- [ ] Implement context-based bottom actions config
- [ ] Integrate KebabMenu component
- [ ] Remove old action buttons from always-visible area
- [ ] Update UserCard.css for new layout
- [ ] Test all 8 contexts
- [ ] Verify mobile layout

### Phase 3: Update SearchResultCard
- [ ] Add `context` prop to SearchResultCard
- [ ] Add kebab menu handlers props
- [ ] Implement context-based bottom actions config
- [ ] Integrate KebabMenu component
- [ ] Remove old action buttons from always-visible area
- [ ] Update SearchPage.css for new layout
- [ ] Ensure IDENTICAL to UserCard
- [ ] Test all contexts
- [ ] Verify mobile layout

### Phase 4: Update Parent Pages
- [ ] Dashboard.js - Add context prop ("my-favorites", "my-shortlists", etc.)
- [ ] SearchPage.js - Add context prop ("search-results")
- [ ] L3V3LMatches.js - Add context prop ("l3v3l-matches")
- [ ] Favorites.js - Add context prop ("my-favorites")
- [ ] Shortlist.js - Add context prop ("my-shortlists")
- [ ] Pass all required kebab menu handlers
- [ ] Verify state management (favorites, shortlist, exclusions)

### Phase 5: Testing
- [ ] Test all 5 themes (Cozy Light, Dark, Rose, Light Gray, Ultra Light Gray)
- [ ] Test mobile (320px, 375px, 414px widths)
- [ ] Test tablet (768px, 1024px)
- [ ] Test desktop (1280px, 1920px)
- [ ] Test touch interactions on mobile
- [ ] Test keyboard navigation (Tab, Enter, ESC)
- [ ] Test screen readers (accessibility)
- [ ] Verify no console errors
- [ ] Test all 8 page contexts
- [ ] Verify button states persist after navigation
- [ ] Test rapid clicking (no race conditions)

### Phase 6: Cross-Page Consistency
- [ ] Open Dashboard (/dashboard)
- [ ] Open Search (/search)
- [ ] Open L3V3L Matches (/l3v3l-matches)
- [ ] Open Favorites (/favorites)
- [ ] Open Shortlist (/shortlist)
- [ ] Verify kebab menu looks identical on all pages
- [ ] Verify bottom buttons show correct context actions
- [ ] Verify favorite/shortlist state syncs across pages
- [ ] Verify actions work identically on all pages

---

## 🚨 Critical Rules

### Before ANY Commit:
1. ✅ All CSS uses variables (grep for hardcoded colors)
2. ✅ No browser modals (grep for alert/confirm/prompt)
3. ✅ No !important (grep for !important)
4. ✅ Mobile tested (check 320px width)
5. ✅ All 5 themes tested (switch in preferences)
6. ✅ UserCard and SearchResultCard are identical
7. ✅ All 5 pages tested (Dashboard, Search, L3V3L, Favorites, Shortlist)
8. ✅ No console errors
9. ✅ Actions work and persist state

### If You Break ANY Rule:
1. Stop immediately
2. Document why exception is needed
3. Get user approval
4. Document in code comment

---

## 📁 Files to Create/Modify

### New Files:
- `/frontend/src/components/KebabMenu.js`
- `/frontend/src/components/KebabMenu.css`

### Files to Modify:
- `/frontend/src/components/UserCard.js`
- `/frontend/src/components/UserCard.css`
- `/frontend/src/components/SearchResultCard.js`
- `/frontend/src/components/SearchPage.css`
- `/frontend/src/components/Dashboard.js`
- `/frontend/src/components/SearchPage.js`
- `/frontend/src/components/L3V3LMatches.js`
- `/frontend/src/components/Favorites.js`
- `/frontend/src/components/Shortlist.js`

---

## 🔄 Testing Script

```bash
# Run this before marking feature complete

echo "🧪 Testing Kebab Menu Feature"
echo ""

# 1. Visual inspection
echo "1️⃣ Open these pages and verify kebab menu:"
echo "   - http://localhost:3000/dashboard"
echo "   - http://localhost:3000/search"
echo "   - http://localhost:3000/l3v3l-matches"
echo "   - http://localhost:3000/favorites"
echo "   - http://localhost:3000/shortlist"
echo ""

# 2. Theme testing
echo "2️⃣ Test all 5 themes:"
echo "   - Cozy Light"
echo "   - Dark"
echo "   - Rose"
echo "   - Light Gray"
echo "   - Ultra Light Gray"
echo ""

# 3. Mobile testing
echo "3️⃣ Test responsive (Chrome DevTools):"
echo "   - iPhone SE (375px)"
echo "   - iPhone 12 Pro (390px)"
echo "   - iPad (768px)"
echo "   - Desktop (1280px+)"
echo ""

# 4. Functionality testing
echo "4️⃣ Test all actions:"
echo "   - Click kebab menu → Opens dropdown"
echo "   - Click outside → Closes dropdown"
echo "   - Press ESC → Closes dropdown"
echo "   - Toggle favorite → Updates state"
echo "   - Toggle shortlist → Updates state"
echo "   - Remove action → Shows confirmation"
echo "   - Bottom buttons work correctly"
echo ""

# 5. Grep checks
echo "5️⃣ Running code quality checks..."
grep -r "alert\|confirm\|prompt" frontend/src/components/KebabMenu.js && echo "❌ Found browser modals!" || echo "✅ No browser modals"
grep -r "!important" frontend/src/components/KebabMenu.css && echo "⚠️  Found !important" || echo "✅ No !important"
grep -r "#[0-9a-fA-F]\{3,6\}" frontend/src/components/KebabMenu.css && echo "❌ Found hardcoded colors!" || echo "✅ All CSS uses variables"

echo ""
echo "✅ Testing complete! Review results above."
```

---

## 📚 Reference Implementation

**Kebab Menu Pattern:**
- Google Drive file actions menu
- Gmail message actions menu
- Slack message actions menu

**Key UX Principles:**
1. **Discoverability**: Kebab icon (⋮) is universally recognized
2. **Hierarchy**: Most important actions at top
3. **Grouping**: Related actions grouped with section headers
4. **Danger actions**: Separated and styled in red
5. **Context awareness**: Menu items change based on state
6. **Performance**: Click-outside detection using refs, not window listeners

---

## Success Criteria

Feature is complete when:
- ✅ KebabMenu component created and documented
- ✅ UserCard uses kebab menu with context-aware bottom actions
- ✅ SearchResultCard uses kebab menu with context-aware bottom actions
- ✅ All parent pages pass correct context prop
- ✅ Mobile UI works perfectly (touch targets, positioning, scrolling)
- ✅ All 5 themes look consistent and beautiful
- ✅ All 8 page contexts show correct bottom actions
- ✅ No hardcoded colors, no browser modals, no !important
- ✅ Actions work identically across all pages
- ✅ State persists across page navigation
- ✅ No console errors or warnings
- ✅ Code review passes all ground rules checks

---

**Implementation Start:** November 16, 2025  
**Target Completion:** Same day  
**Estimated Time:** 3-4 hours
