# Kebab Menu - Visual Guide & Examples

**Created:** November 16, 2025  
**Feature:** Context-aware bottom actions with expandable kebab menu

---

## 🎨 Visual Design

### Kebab Menu Button (⋮)

**Location:** Top-right corner of every user card

```
┌─────────────────────────────────┐
│  User Card                    ⋮ │ ← Kebab button here
│                                  │
│  [User photo/bio]                │
│                                  │
│  Name, Age, Location            │
│                                  │
│  ┌────────────┬──────────────┐  │
│  │ 💬 Message │ 👁️ View     │  │ ← Context-aware
│  └────────────┴──────────────┘  │   bottom actions
└─────────────────────────────────┘
```

---

## 📱 Desktop View (>768px)

### Kebab Menu Dropdown

When you click the **⋮** button, a dropdown appears:

```
                            ┌──────────────────────────────┐
                            │ PROFILE                      │
                            │ 👁️ View Full Profile         │
                            ├──────────────────────────────┤
                            │ LISTS                        │
                            │ ⭐ Add to Favorites          │
                            │ 📋 Add to Shortlist          │
                            ├──────────────────────────────┤
                            │ REQUEST ACCESS               │
                            │ 🔒 Request Contact Info      │
                            │ 📧 Request Email             │
                            │ 📱 Request Phone Number      │
                            │ 📷 Request Photo Access      │
                            ├──────────────────────────────┤
                            │ ACTIONS                      │
                            │ 💬 Send Message              │
                            │ 🚫 Block User                │
                            │ 🚩 Report User               │
                            └──────────────────────────────┘
```

**Features:**
- ✅ Smooth fade-in animation
- ✅ Box shadow for depth
- ✅ Sections with dividers
- ✅ Hover effects (left border highlight)
- ✅ Click outside to close
- ✅ ESC key to close
- ✅ Report action in red (danger style)

---

## 📱 Mobile View (<768px)

### Bottom Sheet Pattern

On mobile, the kebab menu slides up from the bottom:

```
┌─────────────────────────────────┐
│                                  │
│  User Card Content               │
│                                  │
│  ┌────────────┬──────────────┐  │
│  │ 💬 Message │ 👁️ View     │  │
│  └────────────┴──────────────┘  │
└─────────────────────────────────┘
                ↓ Click ⋮
┌─────────────────────────────────┐
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │ ← Overlay
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│ ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓ │
│ ┃ PROFILE                     ┃ │ ← Bottom sheet
│ ┃ 👁️ View Full Profile        ┃ │   (slides up)
│ ┃ ─────────────────────────── ┃ │
│ ┃ LISTS                       ┃ │
│ ┃ ⭐ Add to Favorites         ┃ │
│ ┃ 📋 Add to Shortlist         ┃ │
│ ┃ ─────────────────────────── ┃ │
│ ┃ ACTIONS                     ┃ │
│ ┃ 💬 Send Message             ┃ │
│ ┃ 🚫 Block User               ┃ │
│ ┃ 🚩 Report User              ┃ │
│ ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛ │
└─────────────────────────────────┘
```

**Mobile Features:**
- ✅ Slide-up animation (0.3s)
- ✅ Rounded top corners
- ✅ Dark overlay behind
- ✅ Touch-friendly targets (56px height)
- ✅ Larger icons (20px vs 18px)
- ✅ Max height 70vh (scrollable)
- ✅ Swipe down to close (future enhancement)

---

## 🎯 Context-Aware Bottom Actions

### Dashboard: My Favorites

**Context:** `my-favorites`

```
┌─────────────────────────────────┐
│  Jane Smith, 28              ⋮  │
│                                  │
│  [Photo]                         │
│                                  │
│  📍 San Francisco                │
│  💼 Software Engineer            │
│                                  │
│  ┌────────────┬──────────────┐  │
│  │ 💬 Message │ 💔 Unfavorite│  │ ← Context: my-favorites
│  └────────────┴──────────────┘  │
└─────────────────────────────────┘
```

**Bottom Actions:**
- **Left:** 💬 Message (Primary - gradient)
- **Right:** 💔 Unfavorite (Warning - orange)

---

### Dashboard: My Shortlists

**Context:** `my-shortlists`

```
┌─────────────────────────────────┐
│  Mike Chen, 32               ⋮  │
│                                  │
│  [Photo]                         │
│                                  │
│  📍 Seattle                      │
│  💼 Product Manager              │
│                                  │
│  ┌────────────┬──────────────┐  │
│  │ 💬 Message │ 📤 Remove    │  │ ← Context: my-shortlists
│  └────────────┴──────────────┘  │
└─────────────────────────────────┘
```

**Bottom Actions:**
- **Left:** 💬 Message (Primary)
- **Right:** 📤 Remove (Info - blue)

---

### Dashboard: Not Interested

**Context:** `my-exclusions`

```
┌─────────────────────────────────┐
│  Alex Johnson, 29            ⋮  │
│                                  │
│  [Photo]                         │
│                                  │
│  📍 Austin                       │
│  💼 Designer                     │
│                                  │
│  ┌────────────┬──────────────┐  │
│  │ 👁️ View   │ ✅ Unblock   │  │ ← Context: my-exclusions
│  └────────────┴──────────────┘  │
└─────────────────────────────────┘
```

**Bottom Actions:**
- **Left:** 👁️ View (Secondary - gray)
- **Right:** ✅ Unblock (Success - green)

---

### Search Results

**Context:** `search-results`

```
┌─────────────────────────────────┐
│  Sarah Lee, 27               ⋮  │
│  🦋 92.5% L3V3L Match            │
│                                  │
│  [Photo]                         │
│                                  │
│  📍 New York                     │
│  💼 Marketing Manager            │
│                                  │
│  ┌────────────┬──────────────┐  │
│  │ 💬 Message │ 👁️ View     │  │ ← Context: search-results
│  └────────────┴──────────────┘  │
└─────────────────────────────────┘
```

**Bottom Actions:**
- **Left:** 💬 Message (Primary)
- **Right:** 👁️ View (Secondary)

---

### My Messages

**Context:** `my-messages`

```
┌─────────────────────────────────┐
│  Chris Park, 30              ⋮  │
│  💬 Last message: 2 hours ago    │
│                                  │
│  [Photo]                         │
│                                  │
│  📍 Los Angeles                  │
│  💼 Data Scientist               │
│                                  │
│  ┌────────────┬──────────────┐  │
│  │ 💬 Open    │ 🗑️ Delete   │  │ ← Context: my-messages
│  │    Chat    │              │  │
│  └────────────┴──────────────┘  │
└─────────────────────────────────┘
```

**Bottom Actions:**
- **Left:** 💬 Open Chat (Primary)
- **Right:** 🗑️ Delete (Danger - red)

---

## 🎨 Theme Adaptation

### Cozy Light Theme (Default)

```css
Kebab Button:
  Background: #ffffff (white)
  Border: #e5e7eb (light gray)
  Color: #6b7280 (gray text)
  
Kebab Menu:
  Background: #ffffff (white card)
  Shadow: 0 10px 40px rgba(0,0,0,0.15)
  Dividers: #f3f4f6 (very light gray)

Bottom Buttons:
  Primary: Purple gradient (#667eea → #764ba2)
  Secondary: Light gray with purple hover
  Success: Green (#10b981)
  Danger: Red (#ef4444)
  Warning: Orange (#f59e0b)
  Info: Blue (#6366f1)
```

### Dark Theme

```css
Kebab Button:
  Background: #1f2937 (dark gray)
  Border: #374151 (medium gray)
  Color: #9ca3af (light gray text)
  
Kebab Menu:
  Background: #1f2937 + 5% white overlay
  Shadow: 0 10px 40px rgba(0,0,0,0.5)
  Dividers: #374151 (medium gray)
  
Bottom Buttons:
  Same colors but against dark background
  All text: white
```

### Rose Theme

```css
Kebab Button:
  Background: var(--card-background)
  Border: var(--border-color) 
  Color: var(--text-secondary)
  Hover border: #e11d48 (rose)

Bottom Buttons:
  Primary: Rose gradient (#e11d48 → #9f1239)
  All colors adapted to rose theme
```

---

## ⚡ Interactions & Animations

### 1. Kebab Button Hover

```
Default State:
  ⋮  (gray, subtle)
  
Hover:
  ⋮  (purple, slight scale 1.05)
  Border glow effect
  
Active (menu open):
  ⋮  (purple, highlighted background)
  3px purple ring around button
```

### 2. Menu Open Animation

**Desktop:**
```css
@keyframes menuFadeIn {
  from: opacity 0, translateY(-10px), scale(0.95)
  to:   opacity 1, translateY(0), scale(1)
}
Duration: 0.2s
Easing: cubic-bezier(0.4, 0, 0.2, 1)
```

**Mobile:**
```css
@keyframes menuSlideUp {
  from: translateY(100%)
  to:   translateY(0)
}
Duration: 0.3s
Easing: cubic-bezier(0.4, 0, 0.2, 1)
```

### 3. Menu Item Hover

```
Before Hover:
  ┌──────────────────────────┐
  │ 💬 Send Message          │
  └──────────────────────────┘

On Hover:
  ┌──────────────────────────┐
█ │ 💬 Send Message          │ ← Purple left bar slides in
  └──────────────────────────┘
  Background lightens slightly
  Text turns purple
```

### 4. Bottom Button Hover

```
Default:
  ┌────────────┐
  │ 💬 Message │
  └────────────┘

Hover:
  ┌────────────┐
  │ 💬 Message │ ← Lift up 2px
  └────────────┘
  Shadow becomes stronger
  
Active (click):
  ┌────────────┐
  │ 💬 Message │ ← Scale down 0.98
  └────────────┘
```

---

## 🔍 Testing Checklist

### Desktop Testing (http://localhost:3000)

#### 1. Dashboard Page

**My Favorites Section:**
- [ ] Click ⋮ → Menu opens
- [ ] Hover items → Purple highlight + left bar
- [ ] Click outside → Menu closes
- [ ] Press ESC → Menu closes
- [ ] Bottom buttons show: "💬 Message" + "💔 Unfavorite"
- [ ] Click "Unfavorite" → Removes from favorites

**My Shortlists Section:**
- [ ] Bottom buttons show: "💬 Message" + "📤 Remove"
- [ ] Click "Remove" → Removes from shortlist

**Not Interested Section:**
- [ ] Bottom buttons show: "👁️ View" + "✅ Unblock"
- [ ] Click "Unblock" → Removes from exclusions

**My Messages Section:**
- [ ] Bottom buttons show: "💬 Open Chat" + "🗑️ Delete"
- [ ] Kebab menu does NOT show "Send Message" (context-aware)

#### 2. Search Page

**Search Results:**
- [ ] Cards show ⋮ button
- [ ] Bottom buttons: "💬 Message" + "👁️ View"
- [ ] Kebab menu has all options (favorite, shortlist, block, etc.)
- [ ] Toggle favorite → Star appears/disappears
- [ ] Toggle shortlist → Checkmark appears/disappears
- [ ] L3V3L match score displays if available

#### 3. Kebab Menu Contents

**Profile Section:**
- [ ] Shows "👁️ View Full Profile"
- [ ] Clicking navigates to profile page

**Lists Section:**
- [ ] Shows "⭐ Add to Favorites" (or "❌ Remove" if already favorited)
- [ ] Shows "📋 Add to Shortlist" (or "📤 Remove" if already shortlisted)
- [ ] Icons change based on state

**Request Access Section:**
- [ ] Only shows if access NOT granted
- [ ] Disappears after access granted
- [ ] Shows 4 options: Contact, Email, Phone, Photos

**Actions Section:**
- [ ] Shows "💬 Send Message" (except in my-messages context)
- [ ] Shows "🚫 Block User" (unless already blocked)
- [ ] Shows "🚩 Report User" in RED (danger style)

### Mobile Testing (DevTools → 375px width)

#### 1. iPhone 12 (390px)

- [ ] Kebab button is 48px × 48px (Android standard)
- [ ] Click ⋮ → Menu slides up from bottom
- [ ] Dark overlay appears behind menu
- [ ] Menu has rounded top corners
- [ ] Menu items are 56px tall (touch-friendly)
- [ ] Bottom buttons stack vertically
- [ ] Bottom buttons are full width
- [ ] Touch targets are comfortable

#### 2. iPhone SE (375px)

- [ ] Everything fits without horizontal scroll
- [ ] Text is readable
- [ ] Buttons are tappable

#### 3. iPad (768px)

- [ ] Uses desktop dropdown (not bottom sheet)
- [ ] Layout adapts to tablet size

### Theme Testing

Open Settings → Switch themes:

**Cozy Light:**
- [ ] Kebab button visible (white with gray border)
- [ ] Menu has subtle shadow
- [ ] Bottom buttons use purple gradient
- [ ] All text is readable

**Dark:**
- [ ] Kebab button visible (dark with lighter border)
- [ ] Menu has strong shadow (0.5 opacity)
- [ ] Bottom buttons contrast well
- [ ] White text on colored buttons

**Rose:**
- [ ] Primary buttons use rose gradient
- [ ] Kebab button border becomes rose on hover
- [ ] All elements adapt to rose theme

**Light Gray:**
- [ ] Subtle, professional appearance
- [ ] Good contrast

**Ultra Light Gray:**
- [ ] Very minimal, clean design
- [ ] Everything still visible

---

## 🎯 Expected Behavior

### Context Behavior Matrix

| Context | Left Button | Right Button | Kebab Message? |
|---------|-------------|--------------|----------------|
| my-messages | 💬 Open Chat | 🗑️ Delete | ❌ No |
| my-favorites | 💬 Message | 💔 Unfavorite | ✅ Yes |
| my-shortlists | 💬 Message | 📤 Remove | ✅ Yes |
| my-exclusions | 👁️ View | ✅ Unblock | ✅ Yes |
| search-results | 💬 Message | 👁️ View | ✅ Yes |
| l3v3l-matches | 💬 Message | 👁️ View | ✅ Yes |
| profile-views | 💬 Message | 👁️ View | ✅ Yes |
| pii-requests | ✅ Approve | ❌ Deny | ✅ Yes |

### State-Dependent Icons

| State | Favorite Icon | Shortlist Icon | Block Icon |
|-------|---------------|----------------|------------|
| Not added | ⭐ Add to Favorites | 📋 Add to Shortlist | 🚫 Block User |
| Added | ❌ Remove from Favorites | 📤 Remove from Shortlist | ✅ Unblock User |

---

## 🐛 Known Issues / Edge Cases

### Currently Expected:

1. **L3V3LMatches.js** - Not yet updated (still uses legacy actions)
2. **Favorites.js** - Not yet updated
3. **Shortlist.js** - Not yet updated

These will show old-style action buttons until updated.

### Handled Edge Cases:

✅ **Empty sections** - Renders correctly  
✅ **Long user names** - Text ellipsis applied  
✅ **Missing profile photos** - Shows bio instead  
✅ **Multiple rapid clicks** - Debounced properly  
✅ **Slow network** - Loading states work  
✅ **No internet** - Graceful error handling  

---

## 📸 Screenshot Guide

### Where to Look:

1. **Top-right of every user card** → Look for **⋮** button
2. **Bottom of every user card** → Context-aware action buttons
3. **Click ⋮** → Dropdown menu (desktop) or bottom sheet (mobile)
4. **Hover menu items** → Purple highlight effect
5. **Switch themes** → All colors adapt automatically

### Best Way to Test:

```bash
1. Open: http://localhost:3000
2. Login
3. Go to Dashboard
4. Look at "My Favorites" section
5. See the ⋮ button? Click it!
6. Bottom buttons should say "Message" + "Unfavorite"
```

---

## 🎉 Success Criteria

Feature is working correctly if you see:

- ✅ **⋮ button** appears on all user cards
- ✅ **Context-specific bottom buttons** (e.g., "Unfavorite" in Favorites)
- ✅ **Menu opens/closes** smoothly
- ✅ **ESC key** closes menu
- ✅ **Click outside** closes menu
- ✅ **Mobile bottom sheet** slides up from bottom
- ✅ **Theme colors** adapt properly
- ✅ **No console errors**
- ✅ **Actions work** (toggle favorite, remove, etc.)

---

**Last Updated:** November 16, 2025 at 1:15pm  
**Next:** Complete remaining pages (L3V3L, Favorites, Shortlist)
