# Theme Migration - Systematic CSS Fix

## ✅ COMPLETED FILES (11)

### **High Priority - User Facing**
1. ✅ **SearchPage.css** - Search results, headers, cards, pagination
2. ✅ **PIIRequestModal.css** - Request access modal
3. ✅ **Profile.css** - Profile sections, info boxes
4. ✅ **Dashboard.css** - User cards, stat cards
5. ✅ **Messages.css** - Messages container
6. ✅ **ChatWindow.css** - Chat interface
7. ✅ **MessageList.css** - Conversation sidebar
8. ✅ **MessagesDropdown.css** - Notification dropdown
9. ✅ **SaveSearchModal.css** - Save search dialog
10. ✅ **EditProfile.css** - Profile editing form
11. ✅ **MessageModal.css** - Message window

---

## 🔄 REMAINING FILES - Quick Fix Guide

### **Critical Remaining (4 files)**

#### **PIIManagement.css**
```css
/* Find & Replace: */
background: white → background: var(--card-background, white)
color: #333 → color: var(--text-color, #333)
color: #666 → color: var(--text-secondary, #666)
border: X solid #e0e0e0 → border: X solid var(--border-color, #e0e0e0)
```

**Lines to update:**
- `.view-toggle` (line 51)
- `.access-card` (line 214)
- `.request-card` (line 388)
- All text colors (#333, #666)

---

#### **AdminPage.css**
```css
/* Find & Replace: */
background: white → background: var(--card-background, white)
color: #666 → color: var(--text-secondary, #666)
```

**Lines to update:**
- `.modal-content` (line 162)
- `.admin-table` (line 239)
- `.pagination-container` (line 319)
- `.modal-content p` (line 189)
- `.pagination-info` (line 332)

---

#### **UserManagement.css**
```css
/* Find & Replace: */
background: #ffffff → background: var(--card-background, white)
```

**Lines to update:**
- `.action-reason-input` (line 380)
- `.action-modal-container` (line 515)
- `.action-reason-input:focus` (line 665)

---

#### **ProfilePreview.css**
```css
/* Find & Replace: */
background: white → background: var(--card-background, white)
color: #333 → color: var(--text-color, #333)
color: #555 → color: var(--text-secondary, #555)
color: #666 → color: var(--text-secondary, #666)
```

**Lines to update:**
- `.profile-preview-container` (line 17)
- `.onepager-details` (line 124)
- `.onepager-section` (line 152)
- `.footer-actions` (line 297)
- All text colors (11 instances)

---

### **Medium Priority (3 files)**

#### **ProfileCard.css**
```css
/* Only text colors: */
color: #333 → color: var(--text-color, #333)
color: #666 → color: var(--text-secondary, #666)
```

**Lines:** 82, 96, 105

---

#### **TopBar.css**
```css
/* Button hover states: */
.btn-logout:hover, .btn-login:hover, .btn-test-dashboard:hover {
  background: var(--surface-color, white);
}
```

**Line:** 246

---

#### **ChangeAdminPassword.css**
```css
.change-password-container .form-label {
  color: var(--text-color, #333);
}
.change-password-container h3 {
  color: var(--text-color, #333);
}
.visibility-toggle {
  background: var(--card-background, white);
}
```

**Lines:** 16, 154, 42

---

## 🎯 AUTOMATED FIX COMMANDS

For each remaining file, run these sed commands (Mac/Linux):

```bash
# PIIManagement.css
sed -i '' 's/background: white/background: var(--card-background, white)/g' frontend/src/components/PIIManagement.css
sed -i '' 's/color: #333/color: var(--text-color, #333)/g' frontend/src/components/PIIManagement.css
sed -i '' 's/color: #666/color: var(--text-secondary, #666)/g' frontend/src/components/PIIManagement.css
sed -i '' 's/border: \(.*\) solid #e0e0e0/border: \1 solid var(--border-color, #e0e0e0)/g' frontend/src/components/PIIManagement.css

# AdminPage.css
sed -i '' 's/background: white/background: var(--card-background, white)/g' frontend/src/components/AdminPage.css
sed -i '' 's/color: #666/color: var(--text-secondary, #666)/g' frontend/src/components/AdminPage.css

# UserManagement.css
sed -i '' 's/background: #ffffff/background: var(--card-background, white)/g' frontend/src/components/UserManagement.css

# ProfilePreview.css
sed -i '' 's/background: white/background: var(--card-background, white)/g' frontend/src/components/ProfilePreview.css
sed -i '' 's/color: #333/color: var(--text-color, #333)/g' frontend/src/components/ProfilePreview.css
sed -i '' 's/color: #555/color: var(--text-secondary, #555)/g' frontend/src/components/ProfilePreview.css
sed -i '' 's/color: #666/color: var(--text-secondary, #666)/g' frontend/src/components/ProfilePreview.css
```

---

## 📋 THEME VARIABLES REFERENCE

```css
/* Backgrounds */
--background-color    /* Page background */
--surface-color      /* Secondary surfaces */
--card-background    /* Cards, modals */

/* Text */
--text-color         /* Primary text (#333) */
--text-secondary     /* Secondary text (#666) */
--text-muted         /* Muted text (#999) */

/* Borders */
--border-color       /* All borders (#e0e0e0) */
--divider-color      /* Section dividers */

/* Interactive */
--primary-color      /* Primary actions */
--secondary-color    /* Secondary actions */
--hover-background   /* Hover states */
--selected-background /* Selected states */

/* Status */
--success-color
--danger-color
--warning-color
--info-color
```

---

## 🌈 THEME COLORS

| Theme | Card BG | Text | Secondary |
|-------|---------|------|-----------|
| **Cozy Light** | `#faf9ff` | `#374151` | `#6b7280` |
| **Cozy Night** | `#3a3450` | `#f3f4f6` | `#d1d5db` |
| **Cozy Rose** | `#fef6fb` | `#4a5568` | `#718096` |
| **Light Gray** | `#f9fafb` | `#1e293b` | `#64748b` |
| **Ultra Light Gray** | `#fdfeff` | `#0f172a` | `#475569` |

---

## ✅ VERIFICATION CHECKLIST

After fixing all files, verify:

1. [ ] Switch to Cozy Night theme - all text is visible
2. [ ] Switch to Cozy Light theme - backgrounds are tinted
3. [ ] Switch to Cozy Rose theme - pink tints visible
4. [ ] Open all modals - proper backgrounds
5. [ ] Check admin pages - theme-aware
6. [ ] Review profile pages - all themed
7. [ ] Test message components - themed
8. [ ] Check search page - fully themed

---

## 🎯 IMPACT

**Files Fixed:** 11 / 15 critical files (73%)
**Remaining:** 4 large files with detailed instructions above

**Estimated Time to Complete:** 10-15 minutes using sed commands or manual find/replace

---

## 📝 NOTES

- All files use CSS variables with fallbacks
- Print styles left unchanged (white background OK)
- Test dashboard can remain as-is (testing tool)
- Animations and utilities are theme-independent
