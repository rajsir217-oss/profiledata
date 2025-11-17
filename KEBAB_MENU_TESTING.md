# Kebab Menu Feature - Testing Checklist

**Test Date:** _______________  
**Tester:** _______________  
**Build:** `feature/kebab-menu-actions`  
**Commits:** cbf8d37, 506faab, db1e4f8

---

## 🎯 Testing Overview

**Total Test Cases:** 85  
**Estimated Time:** 2-3 hours  
**Priority:** High (User-facing feature)

---

## ✅ Pre-Test Setup

### 1. Environment Check
- [ ] Frontend running: http://localhost:3000
- [ ] Backend running: http://localhost:8000
- [ ] Logged in as test user
- [ ] Test data populated (favorites, shortlists, messages)
- [ ] Browser: Chrome/Firefox/Safari (latest)
- [ ] DevTools open (Console tab visible)

### 2. Test Data Preparation
- [ ] At least 3 users in "My Favorites"
- [ ] At least 3 users in "My Shortlists"
- [ ] At least 2 users in "Not Interested"
- [ ] At least 2 active messages
- [ ] At least 5 search results available

---

## 📱 Test Section 1: Desktop - Dashboard Page

**URL:** `/dashboard`  
**Device:** Desktop (1280px+)

### 1.1 My Favorites Section

#### Kebab Menu Functionality
- [ ] **KM-001:** Kebab button (⋮) visible in top-right of card
- [ ] **KM-002:** Clicking ⋮ opens menu
- [ ] **KM-003:** Menu appears below button (not off-screen)
- [ ] **KM-004:** Menu contains Profile section
- [ ] **KM-005:** Menu contains Lists section
- [ ] **KM-006:** Menu contains Actions section
- [ ] **KM-007:** "Remove from Favorites" shows ❌ icon (not ⭐)
- [ ] **KM-008:** Clicking menu item executes action
- [ ] **KM-009:** Menu closes after clicking item
- [ ] **KM-010:** Clicking outside menu closes it
- [ ] **KM-011:** Pressing ESC key closes menu
- [ ] **KM-012:** Clicking ⋮ again toggles menu (close)

#### Bottom Actions - Context Specific
- [ ] **BA-001:** Left button shows "💬 Message"
- [ ] **BA-002:** Right button shows "💔 Unfavorite"
- [ ] **BA-003:** Message button has purple gradient
- [ ] **BA-004:** Unfavorite button has orange/warning color
- [ ] **BA-005:** Clicking Message opens message modal
- [ ] **BA-006:** Clicking Unfavorite removes user from section
- [ ] **BA-007:** Buttons have hover effect (lift + shadow)
- [ ] **BA-008:** Button labels are clear and readable

#### Visual & Styling
- [ ] **VS-001:** Kebab button has light gray background
- [ ] **VS-002:** Kebab button border is subtle
- [ ] **VS-003:** Menu has rounded corners
- [ ] **VS-004:** Menu has shadow/depth effect
- [ ] **VS-005:** Section titles in menu are uppercase
- [ ] **VS-006:** Menu items have consistent spacing
- [ ] **VS-007:** Dividers between sections are visible
- [ ] **VS-008:** Bottom buttons are equal width

### 1.2 My Shortlists Section

- [ ] **SL-001:** Bottom left button: "💬 Message"
- [ ] **SL-002:** Bottom right button: "📤 Remove"
- [ ] **SL-003:** Remove button has info/blue color
- [ ] **SL-004:** Remove action works correctly
- [ ] **SL-005:** Kebab menu shows "Remove from Shortlist" with 📤

### 1.3 Not Interested Section

- [ ] **EX-001:** Bottom left button: "👁️ View"
- [ ] **EX-002:** Bottom right button: "✅ Unblock"
- [ ] **EX-003:** Unblock button has success/green color
- [ ] **EX-004:** View button navigates to profile
- [ ] **EX-005:** Unblock removes user from section
- [ ] **EX-006:** Kebab menu shows "Unblock User" with ✅

### 1.4 My Messages Section

- [ ] **MS-001:** Bottom left button: "💬 Open Chat"
- [ ] **MS-002:** Bottom right button: "🗑️ Delete"
- [ ] **MS-003:** Delete button has danger/red color
- [ ] **MS-004:** Open Chat navigates to messages
- [ ] **MS-005:** Kebab menu DOES NOT show "Send Message"
- [ ] **MS-006:** Delete confirmation works (if implemented)

### 1.5 Profile Views Section

- [ ] **PV-001:** Bottom left button: "💬 Message"
- [ ] **PV-002:** Bottom right button: "👁️ View"
- [ ] **PV-003:** Both buttons work correctly
- [ ] **PV-004:** Kebab menu shows all standard actions

### 1.6 State Management

- [ ] **ST-001:** Favoriting from menu adds star to icon
- [ ] **ST-002:** Unfavoriting from menu removes star
- [ ] **ST-003:** Shortlisting updates icon immediately
- [ ] **ST-004:** State persists after page refresh
- [ ] **ST-005:** Multiple cards can have menus open (no conflicts)

---

## 🔍 Test Section 2: Desktop - Search Page

**URL:** `/search`  
**Device:** Desktop (1280px+)

### 2.1 Search Results - Cards View

- [ ] **SR-001:** Kebab button visible on all result cards
- [ ] **SR-002:** Bottom left button: "💬 Message"
- [ ] **SR-003:** Bottom right button: "👁️ View"
- [ ] **SR-004:** L3V3L match score displays (if available)
- [ ] **SR-005:** Match score badge styled correctly

### 2.2 Kebab Menu - Search Context

- [ ] **SK-001:** Menu shows "Add to Favorites" (⭐)
- [ ] **SK-002:** Menu shows "Add to Shortlist" (📋)
- [ ] **SK-003:** Menu shows "Block User" (🚫)
- [ ] **SK-004:** Menu shows "Send Message" (💬)
- [ ] **SK-005:** Menu shows "Request Access" section
- [ ] **SK-006:** Clicking "Add to Favorites" works
- [ ] **SK-007:** Icon changes to ❌ after favoriting
- [ ] **SK-008:** Clicking "❌ Remove from Favorites" works
- [ ] **SK-009:** Request Access only shows if not granted

### 2.3 View Modes

#### Cards View
- [ ] **VM-001:** Kebab menu works in cards view
- [ ] **VM-002:** Bottom actions visible in cards view
- [ ] **VM-003:** Layout doesn't break with 2-5 cards per row

#### Rows View
- [ ] **VM-004:** Kebab menu works in rows view
- [ ] **VM-005:** Bottom actions visible in rows view (if applicable)
- [ ] **VM-006:** All actions accessible in compact mode

---

## 📱 Test Section 3: Mobile Responsive

**Devices to Test:**
- iPhone SE (375px)
- iPhone 12 (390px)
- iPad (768px)

### 3.1 iPhone SE (375px)

#### Kebab Menu
- [ ] **MB-001:** Kebab button is 48px × 48px
- [ ] **MB-002:** Button is easy to tap
- [ ] **MB-003:** Clicking opens bottom sheet (not dropdown)
- [ ] **MB-004:** Bottom sheet slides up from bottom
- [ ] **MB-005:** Dark overlay appears behind sheet
- [ ] **MB-006:** Sheet has rounded top corners
- [ ] **MB-007:** Sheet max height is 70vh
- [ ] **MB-008:** Sheet is scrollable if content exceeds height
- [ ] **MB-009:** Menu items are 56px tall (touch-friendly)
- [ ] **MB-010:** Icons are larger (20px)
- [ ] **MB-011:** Text is readable (16px+)
- [ ] **MB-012:** Tapping overlay closes menu
- [ ] **MB-013:** Tapping back button closes menu (if applicable)

#### Bottom Actions
- [ ] **BA-M01:** Buttons stack vertically
- [ ] **BA-M02:** Each button is full width
- [ ] **BA-M03:** Buttons are 48px+ tall
- [ ] **BA-M04:** Icon and label both visible
- [ ] **BA-M05:** No horizontal overflow
- [ ] **BA-M06:** Gap between buttons is adequate

#### Layout
- [ ] **LY-M01:** Card doesn't overflow horizontally
- [ ] **LY-M02:** Kebab button doesn't overlap content
- [ ] **LY-M03:** Bottom actions don't overlap photo
- [ ] **LY-M04:** All text is readable
- [ ] **LY-M05:** Touch targets don't overlap

### 3.2 iPhone 12 (390px)

- [ ] **MB-I12-01:** Everything works as in iPhone SE
- [ ] **MB-I12-02:** Slightly more breathing room
- [ ] **MB-I12-03:** No layout issues

### 3.3 iPad (768px)

- [ ] **TB-001:** Uses desktop dropdown (NOT bottom sheet)
- [ ] **TB-002:** Kebab button is 44px (desktop size)
- [ ] **TB-003:** Bottom actions are horizontal (2 columns)
- [ ] **TB-004:** Layout is tablet-optimized

---

## 🎨 Test Section 4: Theme Compatibility

**Test in each theme:** Cozy Light, Dark, Rose, Light Gray, Ultra Light Gray

### 4.1 Cozy Light (Default)

- [ ] **TH-L01:** Kebab button visible (white bg, gray border)
- [ ] **TH-L02:** Menu has white background
- [ ] **TH-L03:** Menu shadow is subtle
- [ ] **TH-L04:** Bottom buttons use purple gradient
- [ ] **TH-L05:** All text is readable (good contrast)
- [ ] **TH-L06:** Hover states work correctly

### 4.2 Dark Theme

- [ ] **TH-D01:** Kebab button visible (dark bg, lighter border)
- [ ] **TH-D02:** Menu has dark background
- [ ] **TH-D03:** Menu shadow is stronger (50% opacity)
- [ ] **TH-D04:** Button text is white
- [ ] **TH-D05:** Good contrast on all elements
- [ ] **TH-D06:** No color bleeding

### 4.3 Rose Theme

- [ ] **TH-R01:** Primary buttons use rose gradient
- [ ] **TH-R02:** Kebab button border turns rose on hover
- [ ] **TH-R03:** All elements adapt to rose palette
- [ ] **TH-R04:** No purple showing (all theme colors)

### 4.4 Light Gray Theme

- [ ] **TH-LG01:** Subtle, professional appearance
- [ ] **TH-LG02:** Good contrast maintained
- [ ] **TH-LG03:** Elements clearly distinguishable

### 4.5 Ultra Light Gray Theme

- [ ] **TH-ULG01:** Very minimal, clean design
- [ ] **TH-ULG02:** Kebab button still visible
- [ ] **TH-ULG03:** Bottom buttons stand out enough

---

## ⚡ Test Section 5: Interactions & Animations

### 5.1 Menu Animations

#### Desktop
- [ ] **AN-D01:** Menu fades in smoothly (0.2s)
- [ ] **AN-D02:** Menu slides down slightly while fading
- [ ] **AN-D03:** Menu scales from 95% to 100%
- [ ] **AN-D04:** Animation is smooth (no jank)
- [ ] **AN-D05:** No flash of unstyled content

#### Mobile
- [ ] **AN-M01:** Bottom sheet slides up (0.3s)
- [ ] **AN-M02:** Overlay fades in with sheet
- [ ] **AN-M03:** Animation is smooth on 60fps devices
- [ ] **AN-M04:** No lag on older devices

### 5.2 Hover Effects

- [ ] **HV-001:** Kebab button scales to 1.05 on hover
- [ ] **HV-002:** Kebab button border glows on hover
- [ ] **HV-003:** Menu items show left purple bar on hover
- [ ] **HV-004:** Menu items background lightens on hover
- [ ] **HV-005:** Menu items text turns purple on hover
- [ ] **HV-006:** Bottom buttons lift 2px on hover
- [ ] **HV-007:** Bottom buttons shadow increases on hover
- [ ] **HV-008:** Transitions are smooth (0.2s)

### 5.3 Active States

- [ ] **AC-001:** Kebab button shows active state when menu open
- [ ] **AC-002:** Active state has purple ring (3px)
- [ ] **AC-003:** Clicking button scales to 0.95
- [ ] **AC-004:** Active state clears when menu closes

---

## 🧪 Test Section 6: Edge Cases & Error Handling

### 6.1 Data Edge Cases

- [ ] **EC-001:** Card with no photo shows bio correctly
- [ ] **EC-002:** User with long name truncates properly
- [ ] **EC-003:** User with no bio shows placeholder
- [ ] **EC-004:** Missing age shows "N/A" or calculates
- [ ] **EC-005:** Missing location handled gracefully
- [ ] **EC-006:** Empty sections show "No items" message

### 6.2 Network Issues

- [ ] **NW-001:** Slow API response shows loading state
- [ ] **NW-002:** Failed action shows error toast
- [ ] **NW-003:** Retry mechanism works
- [ ] **NW-004:** Offline mode shows appropriate message
- [ ] **NW-005:** Connection restored recovers gracefully

### 6.3 User Actions

- [ ] **UA-001:** Rapid clicking doesn't cause duplicate actions
- [ ] **UA-002:** Clicking multiple menus closes previous one
- [ ] **UA-003:** Scrolling page with menu open works
- [ ] **UA-004:** Resizing window repositions menu correctly
- [ ] **UA-005:** Switching tabs maintains state

### 6.4 State Synchronization

- [ ] **SS-001:** Favoriting in Dashboard reflects in Search
- [ ] **SS-002:** Removing from Shortlist updates all views
- [ ] **SS-003:** Blocking user updates everywhere
- [ ] **SS-004:** State persists after navigation
- [ ] **SS-005:** Multiple browser tabs stay in sync

---

## 🔧 Test Section 7: Accessibility

### 7.1 Keyboard Navigation

- [ ] **KB-001:** Tab key highlights kebab button
- [ ] **KB-002:** Enter/Space opens menu
- [ ] **KB-003:** Arrow keys navigate menu items
- [ ] **KB-004:** Enter activates highlighted item
- [ ] **KB-005:** ESC closes menu
- [ ] **KB-006:** Tab exits menu and continues to next element
- [ ] **KB-007:** Bottom buttons are keyboard accessible

### 7.2 Screen Reader Support

- [ ] **SR-001:** Kebab button has aria-label
- [ ] **SR-002:** Kebab button has aria-expanded state
- [ ] **SR-003:** Menu has aria-haspopup attribute
- [ ] **SR-004:** Menu items are announced clearly
- [ ] **SR-005:** Bottom buttons have proper labels
- [ ] **SR-006:** State changes are announced

### 7.3 Visual Accessibility

- [ ] **VA-001:** Focus indicator visible (2px outline)
- [ ] **VA-002:** Contrast ratio > 4.5:1 for text
- [ ] **VA-003:** Color is not the only indicator
- [ ] **VA-004:** Icons have text labels
- [ ] **VA-005:** Hover states have sufficient contrast

---

## 🐛 Test Section 8: Console & Performance

### 8.1 Console Checks

- [ ] **CN-001:** No JavaScript errors
- [ ] **CN-002:** No React warnings
- [ ] **CN-003:** No 404 network requests
- [ ] **CN-004:** No CORS errors
- [ ] **CN-005:** No deprecation warnings

### 8.2 Performance

- [ ] **PF-001:** Menu opens in < 300ms
- [ ] **PF-002:** Bottom actions render in < 100ms
- [ ] **PF-003:** Hover effects are smooth (60fps)
- [ ] **PF-004:** No layout thrashing
- [ ] **PF-005:** No memory leaks (check DevTools)
- [ ] **PF-006:** Page load time not impacted

### 8.3 Network

- [ ] **NT-001:** Minimal API calls
- [ ] **NT-002:** Actions send correct data
- [ ] **NT-003:** Responses are handled properly
- [ ] **NT-004:** Error responses show user-friendly messages

---

## 📊 Test Results Summary

### Statistics

**Total Tests:** 85  
**Passed:** _____  
**Failed:** _____  
**Skipped:** _____  
**Pass Rate:** _____%

### Critical Issues

| ID | Description | Severity | Status |
|----|-------------|----------|--------|
|    |             |          |        |
|    |             |          |        |
|    |             |          |        |

### Minor Issues

| ID | Description | Severity | Status |
|----|-------------|----------|--------|
|    |             |          |        |
|    |             |          |        |

### Browser Compatibility

| Browser | Version | Status | Notes |
|---------|---------|--------|-------|
| Chrome  |         | [ ]    |       |
| Firefox |         | [ ]    |       |
| Safari  |         | [ ]    |       |
| Edge    |         | [ ]    |       |

---

## ✅ Sign-Off

### Tester Certification

I certify that I have completed the above tests to the best of my ability and documented all findings.

**Signature:** _____________________  
**Date:** _____________________

### Developer Notes

**Known Issues:**
- [ ] L3V3LMatches.js not yet updated (expected)
- [ ] Favorites.js not yet updated (expected)
- [ ] Shortlist.js not yet updated (expected)

**Additional Comments:**


---

**Testing Completed:** ___/___/______  
**Build Version:** feature/kebab-menu-actions (db1e4f8)  
**Next Steps:** Complete remaining pages, fix any issues found
