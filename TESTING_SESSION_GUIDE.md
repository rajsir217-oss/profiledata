# Live Testing Session - Kebab Menu Feature

**Session Started:** November 16, 2025 at 1:17pm  
**Test URL:** http://localhost:3000 or http://127.0.0.1:51504  
**Build:** feature/kebab-menu-actions (e020b6b)

---

## 🎯 Quick Start - 5 Minute Test

### Step 1: Open Dashboard (30 seconds)

**Action:** Navigate to http://localhost:3000/dashboard

**What to Look For:**
```
✓ Page loads without errors
✓ User cards display in grid/rows
✓ Each card has a ⋮ button in top-right corner
✓ Bottom of cards show 2 action buttons
```

**Visual Check:**
```
┌─────────────────────────────────┐
│  John Doe, 28                 ⋮ │ ← Look here!
│                                  │
│  [Profile Photo]                 │
│                                  │
│  📍 San Francisco                │
│  💼 Software Engineer            │
│                                  │
│  ┌────────────┬──────────────┐  │
│  │ 💬 Message │ 💔 Unfavorite│  │ ← And here!
│  └────────────┴──────────────┘  │
└─────────────────────────────────┘
```

---

### Step 2: Test "My Favorites" Section (1 minute)

**Action:** Scroll to "My Favorites" section

#### Test 2A: Kebab Menu
1. **Click the ⋮ button** on any card
2. **Expected:** Dropdown menu appears below button
3. **Check menu contains:**
   - Profile section: "👁️ View Full Profile"
   - Lists section: "❌ Remove from Favorites" (not ⭐)
   - Actions section: "💬 Send Message", "🚫 Block User", "🚩 Report User"

#### Test 2B: Menu Closing
1. **Press ESC key** → Menu should close
2. **Click ⋮ again** → Menu reopens
3. **Click outside menu** → Menu should close

#### Test 2C: Bottom Actions
1. **Check left button:** Should say "💬 Message" (purple gradient)
2. **Check right button:** Should say "💔 Unfavorite" (orange/warning)
3. **Hover over buttons:** Should lift up with shadow effect

**Screenshot Checkpoint 1:** Take a screenshot of the menu open

---

### Step 3: Test "My Shortlists" Section (1 minute)

**Action:** Scroll to "My Shortlists" section

**Check Bottom Actions Changed:**
- ✓ Left button: "💬 Message" (same)
- ✓ Right button: "📤 Remove" (DIFFERENT - should be blue/info color)

**This proves context-awareness is working!**

---

### Step 4: Test "Not Interested" Section (1 minute)

**Action:** Scroll to "Not Interested" section

**Check Bottom Actions Changed Again:**
- ✓ Left button: "👁️ View" (gray/secondary - DIFFERENT icon)
- ✓ Right button: "✅ Unblock" (green/success - DIFFERENT)

**Kebab Menu Check:**
- ✓ Should show "✅ Unblock User" instead of "🚫 Block User"

---

### Step 5: Test Search Page (1 minute)

**Action:** Navigate to /search and perform a search

**Check:**
1. ✓ Each result card has ⋮ button
2. ✓ Bottom buttons: "💬 Message" + "👁️ View"
3. ✓ Kebab menu has all standard options
4. ✓ L3V3L match score displays (if available)

**Test Toggle Favorite:**
1. Open kebab menu
2. Click "⭐ Add to Favorites"
3. **Expected:** Icon changes to "❌ Remove from Favorites"
4. Click it again
5. **Expected:** Icon changes back to "⭐ Add to Favorites"

---

### Step 6: Mobile Test (1 minute)

**Action:** Open DevTools (F12) → Toggle device toolbar → Select "iPhone 12"

**Mobile Checks:**
1. ✓ Kebab button is larger (48px - easier to tap)
2. ✓ Click ⋮ → Menu slides up from bottom (not dropdown!)
3. ✓ Dark overlay appears behind menu
4. ✓ Menu has rounded top corners
5. ✓ Menu items are tall and touch-friendly
6. ✓ Bottom buttons stack vertically (not side-by-side)
7. ✓ Each button is full width

**Visual Mobile:**
```
┌─────────────────────────────────┐
│ User Card                        │
│ ┌──────────────────────────────┐│
│ │ 💬 Message                   ││ ← Full width
│ └──────────────────────────────┘│
│ ┌──────────────────────────────┐│
│ │ 👁️ View                     ││ ← Full width
│ └──────────────────────────────┘│
└─────────────────────────────────┘

        Click ⋮ ↓

┌─────────────────────────────────┐
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│ ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓ │
│ ┃ Menu slides up from bottom  ┃ │
│ ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛ │
└─────────────────────────────────┘
```

---

## 🎨 Quick Theme Test (Optional - 2 minutes)

### Test Dark Theme

**Action:** 
1. Go to Settings/Profile
2. Find theme selector
3. Switch to "Dark" theme

**Check:**
- ✓ Kebab button still visible (lighter border)
- ✓ Menu has dark background
- ✓ All text is readable
- ✓ Bottom buttons have white text

### Test Rose Theme

**Action:** Switch to "Rose" theme

**Check:**
- ✓ Primary buttons use rose/pink gradient (not purple)
- ✓ Kebab button border turns rose on hover
- ✓ Everything adapts to rose color scheme

---

## ✅ Success Checklist

After completing the above tests, verify:

### Visual Elements
- [ ] ⋮ button appears on all user cards
- [ ] Kebab button is in top-right corner
- [ ] Bottom action buttons are at bottom of card
- [ ] Buttons have icons + text labels

### Functionality
- [ ] Clicking ⋮ opens menu
- [ ] ESC key closes menu
- [ ] Click outside closes menu
- [ ] Menu items are clickable
- [ ] Bottom actions work when clicked

### Context Awareness
- [ ] "My Favorites" shows "💔 Unfavorite"
- [ ] "My Shortlists" shows "📤 Remove"
- [ ] "Not Interested" shows "✅ Unblock"
- [ ] Search shows "👁️ View"

### Mobile Responsive
- [ ] Mobile menu slides from bottom (not dropdown)
- [ ] Bottom buttons stack vertically
- [ ] Touch targets are large enough
- [ ] No horizontal scrolling

### No Errors
- [ ] Console has no red errors
- [ ] No React warnings
- [ ] Page doesn't crash
- [ ] Actions complete successfully

---

## 🐛 Common Issues to Watch For

### Issue 1: Menu Appears Off-Screen
**Symptom:** Menu opens but you can't see it  
**Cause:** Z-index or positioning issue  
**Check:** Inspect element, look for `position: absolute` and `z-index: 100`

### Issue 2: Bottom Buttons Not Context-Aware
**Symptom:** All sections show same "Message" + "View" buttons  
**Cause:** Context prop not passed correctly  
**Check:** Open React DevTools, inspect UserCard props for `context` value

### Issue 3: Kebab Button Not Visible
**Symptom:** Can't see ⋮ button  
**Cause:** Color contrast issue in current theme  
**Check:** Try switching themes, inspect button's `background` and `border` CSS

### Issue 4: Mobile Menu Doesn't Slide Up
**Symptom:** Desktop dropdown shows on mobile instead of bottom sheet  
**Cause:** Media query not triggering  
**Check:** Resize window below 768px, check `.kebab-menu-mobile` class

### Issue 5: Icons Don't Change
**Symptom:** Clicking "Add to Favorites" doesn't change icon to "Remove"  
**Cause:** State not updating properly  
**Check:** Check browser console for errors, verify API call succeeds

---

## 📊 Testing Results Template

### Quick Results Log

**Test Date:** _______________  
**Tester:** _______________

| Test | Status | Notes |
|------|--------|-------|
| Dashboard - Kebab Menu | ⬜ | |
| Dashboard - Bottom Actions | ⬜ | |
| Dashboard - Context Switch | ⬜ | |
| Search - Kebab Menu | ⬜ | |
| Search - Toggle Actions | ⬜ | |
| Mobile - Bottom Sheet | ⬜ | |
| Mobile - Button Stacking | ⬜ | |
| Dark Theme | ⬜ | |
| Rose Theme | ⬜ | |
| Console Clean | ⬜ | |

**Legend:** ✅ Pass | ❌ Fail | ⚠️ Issue | ⬜ Not Tested

### Issues Found

1. **Issue:** ________________________________________________
   **Severity:** 🔴 Critical | 🟡 Medium | 🟢 Minor
   **Steps to Reproduce:** _____________________________________
   **Expected:** _______________________________________________
   **Actual:** _________________________________________________

2. **Issue:** ________________________________________________
   **Severity:** 🔴 Critical | 🟡 Medium | 🟢 Minor
   **Steps to Reproduce:** _____________________________________
   **Expected:** _______________________________________________
   **Actual:** _________________________________________________

---

## 🎬 What to Screenshot

Take screenshots of these for documentation:

1. **Dashboard - My Favorites with menu open**
   - Shows ⋮ button location
   - Shows dropdown menu structure
   - Shows context-specific bottom actions

2. **Dashboard - My Shortlists**
   - Shows different bottom actions (📤 Remove)

3. **Search Results with menu open**
   - Shows kebab menu in search context
   - Shows L3V3L match score

4. **Mobile view (375px)**
   - Shows bottom sheet menu
   - Shows stacked bottom buttons

5. **Dark theme**
   - Proves theme adaptation works

---

## ⏱️ Time Tracking

| Phase | Estimated | Actual | Notes |
|-------|-----------|--------|-------|
| Dashboard Test | 2 min | ___ | |
| Search Test | 1 min | ___ | |
| Mobile Test | 1 min | ___ | |
| Theme Test | 1 min | ___ | |
| Total | 5 min | ___ | |

---

## 🚀 Next Actions Based on Results

### If All Tests Pass ✅
1. Mark feature as "Ready for Merge"
2. Update remaining 3 pages (L3V3L, Favorites, Shortlist)
3. Create pull request with documentation

### If Minor Issues Found ⚠️
1. Document issues in GitHub issues
2. Prioritize fixes (cosmetic can wait)
3. Retest after fixes

### If Critical Issues Found 🔴
1. Stop testing
2. Debug and fix immediately
3. Restart testing from Step 1

---

## 💡 Pro Testing Tips

1. **Use Two Browsers Side-by-Side**
   - Left: Desktop view (1280px)
   - Right: Mobile view (375px)
   - Compare behavior simultaneously

2. **Record a Quick Video**
   - Use built-in screen recording
   - Capture interactions
   - Helpful for bug reports

3. **Check Network Tab**
   - Open DevTools → Network
   - Watch for 404s or 500s
   - Verify API calls succeed

4. **Use React DevTools**
   - Install React DevTools extension
   - Inspect component props
   - Verify state changes

5. **Test with Different Users**
   - User with favorites
   - User with empty lists
   - New user with no data

---

## 📝 Post-Testing Notes

**Overall Impression:** ___________________________________________

**Strengths:** ___________________________________________________

**Improvements Needed:** _________________________________________

**Merge Recommendation:** 
- [ ] Merge now (all tests pass)
- [ ] Merge after minor fixes
- [ ] Hold (critical issues found)

---

**Testing Session Log**

**Started:** ___:___ PM  
**Completed:** ___:___ PM  
**Duration:** ___ minutes  
**Result:** ✅ Pass | ⚠️ Needs Work | ❌ Fail

---

**Next Session:** _________________________________________________

