# 📋 L3V3L Matrimony - Next Feature Tasks

**Created:** November 1, 2025  
**Status:** Active Development  
**Total Tasks:** 10

---

## 🚀 High Priority (Sprint 1)

### ✅ Task 9: Rename "Exclusion" to Less Offensive Term
**Status:** ✅ COMPLETED  
**Priority:** 🔥 High  
**Complexity:** 🟢 Very Easy  
**Actual Time:** 25 minutes  
**Completed:** November 1, 2025

**Implementation:**
- Find and replace "Exclusion" → "Not Interested" (user-facing only)
- Keep backend field names as `exclusions` (internal consistency)
- Update all frontend components
- Update UI text and labels

**Files Modified:**
- ✅ `frontend/src/components/Exclusions.js` - Page title, messages
- ✅ `frontend/src/components/Dashboard.js` - Section label and icon
- ✅ `frontend/src/components/Profile.js` - Button labels, tooltips, messages
- ✅ `frontend/src/components/SearchResultCard.js` - Button tooltips
- ✅ `frontend/src/components/SearchPage2.js` - Status messages

**Changes Made:**
- "My Exclusions" → "Not Interested" (with 🙈 icon)
- "Remove from Exclusions" → "Remove from Not Interested"
- "Exclude from Search" → "Mark as Not Interested"
- "Added to exclusions" → "Marked as not interested"
- "Excluded" button label → "Not Interested"
- Internal code/API endpoints unchanged

---

### ✅ Task 1: Show Last Logged In on Dashboard
**Status:** ✅ COMPLETED  
**Priority:** 🔥 High  
**Complexity:** 🟢 Easy  
**Actual Time:** 25 minutes  
**Completed:** November 2, 2025

**Implementation:**
- Backend already tracks `lastLoginAt` in `security.last_login_at` field
- Display on Dashboard: "Last login: 2 hours ago"
- Use relative time formatting utility

**Files Created:**
- ✅ `frontend/src/utils/timeFormatter.js` - Relative time utility (120 lines)

**Files Modified:**
- ✅ `frontend/src/components/Dashboard.js` - Fetch profile, display last login
- ✅ `frontend/src/components/Dashboard.css` - Theme-aware styling

**Features:**
- Displays below page header with 🕐 icon
- Relative time: "Just now", "2 hours ago", "Yesterday", "3 days ago", etc.
- Theme-aware styling with subtle hover effect
- Only shown to user viewing their own dashboard (privacy-first)
- Auto-updates on dashboard refresh

**Time Formats Supported:**
- < 1 minute: "Just now"
- < 1 hour: "X minutes ago"
- < 1 day: "X hours ago"
- < 1 week: "Yesterday" or "X days ago"
- < 1 month: "X weeks ago"
- < 1 year: "X months ago"
- ≥ 1 year: "X years ago"

---

### ✅ Task 3: Email Verification Screen After Registration
**Status:** ✅ COMPLETED  
**Priority:** 🔥 High  
**Complexity:** 🟢 Easy  
**Actual Time:** 35 minutes  
**Completed:** November 2, 2025

**Implementation:**
- Created `/verify-email-sent` page with beautiful UI
- Success checkmark animation with scale-in effect
- Resend email button with 60-second cooldown timer
- "Already Verified? Login" button
- Email masking for privacy (j***n@example.com)

**Files Created:**
- ✅ `frontend/src/components/EmailVerificationSent.js` (160 lines)
- ✅ `frontend/src/components/EmailVerificationSent.css` (280 lines)

**Files Modified:**
- ✅ `frontend/src/App.js` - Added /verify-email-sent route
- ✅ `frontend/src/components/Register2.js` - Redirect to verification page

**UI Features:**
- ✅ Animated success checkmark with gradient circle
- ✅ Email masking for privacy
- ✅ Three instruction items with icons:
  - 📧 Click link in email to verify
  - 📂 Check spam folder
  - ⏱️ Link expires in 24 hours
- ✅ Resend button with countdown (60s cooldown)
- ✅ Loading spinner while resending
- ✅ Success/error alerts (theme-aware)
- ✅ "Already Verified? Login" link
- ✅ Help text with support email
- ✅ Full-screen gradient background
- ✅ Mobile responsive design
- ✅ Smooth animations (slideInUp, scaleIn, checkmarkPop)
- ✅ Dark mode support

**Backend Integration:**
- ✅ Uses existing `/api/verification/resend-verification` endpoint
- ✅ Backend already sends verification email on registration
- ✅ Rate limiting: 60-second frontend cooldown

**User Flow:**
1. User completes registration on Register2 page
2. Backend sends verification email
3. User redirected to `/verify-email-sent` with email & username
4. User sees success animation and instructions
5. User can resend if needed (60s cooldown)
6. User clicks "Already Verified? Login" when ready

---

### Task 4: SEO Optimization
**Status:** ⏳ Pending  
**Priority:** 🔥 High (Growth)  
**Complexity:** 🟡 Medium-High  
**Estimated Time:** 4-6 hours

**Implementation:**

**Meta Tags:**
- Install `react-helmet-async`
- Add dynamic title/description per page
- Open Graph tags for social sharing
- Twitter Card tags
- Canonical URLs

**Technical SEO:**
- Create `robots.txt`
- Generate `sitemap.xml`
- Add structured data (JSON-LD)
- Optimize images (lazy loading, WebP)
- Improve Core Web Vitals

**Files to Create:**
- `frontend/public/robots.txt`
- `frontend/public/sitemap.xml`
- `frontend/src/utils/seo.js`
- `frontend/src/components/SEO.js` (Helmet wrapper)

**Files to Modify:**
- `frontend/public/index.html` - Base meta tags
- All page components - Add SEO component
- `frontend/src/components/LandingPage.js` - Semantic HTML

**Libraries:**
```bash
npm install react-helmet-async
```

**Considerations:**
- Privacy: Profile pages should NOT be indexed (noindex)
- Public pages: Landing, about, contact → indexable
- Server-side rendering for better SEO (future enhancement)

---

## ⚙️ Medium Priority (Sprint 2)

### ✅ Task 6: Show Last Activity on Profile View
**Status:** ✅ COMPLETED  
**Priority:** 🟠 Medium  
**Complexity:** 🟢 Easy  
**Actual Time:** 30 minutes  
**Completed:** November 2, 2025

**Implementation:**
- Backend already tracks `status.last_seen` field
- Display generic activity ranges with color-coded badges
- Only shown when viewing other users' profiles (privacy-first)
- Hover tooltip shows exact relative time

**Files Created:**
- ✅ `frontend/src/utils/activityFormatter.js` (175 lines) - Activity formatting utility

**Files Modified:**
- ✅ `frontend/src/components/Profile.js` - Added activity badge display
- ✅ `frontend/src/components/Profile.css` - Badge styling

**Activity Ranges Implemented:**
- 🟢 **Active today** - < 1 day (Green #22c55e)
- 🟡 **Active this week** - 1-7 days (Yellow #eab308)
- 🟠 **Active 2 weeks ago** - 7-14 days (Orange #f97316)
- ⚪ **Active over a month ago** - > 14 days (Gray #9ca3af)

**Features:**
- ✅ Color-coded status indicators with emojis
- ✅ Badge positioned below user name on profile
- ✅ Hover tooltip with exact time (e.g., "2 hours ago", "3 days ago")
- ✅ Only visible when viewing others' profiles
- ✅ Theme-aware CSS styling
- ✅ Smooth hover animation (lift + shadow)
- ✅ Privacy-first: Never shown on own profile
- ✅ Responsive design

**Utility Functions:**
- `getActivityStatus()` - Returns activity object with label, color, icon
- `formatActivityStatus()` - Returns formatted string with emoji
- `getActivityColor()` - Returns hex color for status
- `getActivityBadgeProps()` - Returns props for badge component
- `isActiveToday()` - Boolean check for < 24 hours
- `getRelativeActivityTime()` - Precise relative time for tooltips

**Privacy:**
- Backend tracks activity on login/logout automatically
- Frontend only displays for other users' profiles
- No preference needed - always shown (non-intrusive)

---

### Task 10: Show Profile Creator Type in Messages
**Status:** ⏳ Pending  
**Priority:** 🟠 Medium  
**Complexity:** 🟢 Easy  
**Estimated Time:** 2 hours

**Implementation:**
- Add badge to message profile icon
- Show profile creator type: Myself, Parent, Sibling, Friend

**Icons:**
- ✋ "Myself"
- 👨‍👩 "Parent"
- 👫 "Sibling"
- 👥 "Friend"

**Files to Create:**
- `frontend/src/components/ProfileCreatorBadge.js`

**Files to Modify:**
- `frontend/src/components/MessageModal.js` - Add badge
- `frontend/src/components/Messages.js` - Show in conversation list
- `frontend/src/components/Profile.js` - Show on profile view

**Note:** `profileCreatedBy` field already exists in registration

---

### Task 5: Admin Invitation System with Badge
**Status:** ⏳ Pending  
**Priority:** 🟠 Medium  
**Complexity:** 🟡 Medium  
**Estimated Time:** 3-4 hours

**Implementation:**

**Backend:**
- New collection: `invitations`
- Add `invitedBy: "admin" | null` to user profile
- Add `verificationLevel: "standard" | "invited" | "verified"`
- Admin endpoint: `POST /api/admin/send-invitation`
- Email/SMS invitation templates

**Frontend:**
- Badge on profile cards: 🎫 "By Invite"
- Badge on profile view page
- Tooltip: "Personally invited by L3V3L on [date]"

**Files to Create:**
- `fastapi_backend/routers/invitations.py`
- `fastapi_backend/models/invitation_models.py`
- `frontend/src/components/InviteBadge.js`

**Files to Modify:**
- `fastapi_backend/models/user.py` - Add invitation fields
- `frontend/src/components/SearchResultCard.js` - Show badge
- `frontend/src/components/Profile.js` - Show badge
- `frontend/src/components/MessageModal.js` - Show badge

**Badge Options:**
- 🎫 "By Invite"
- ⭐ "Admin Verified"
- ✓ "Verified Profile"
- 👑 "Premium Invite"

**Considerations:**
- Track invitation metrics (sent, accepted, active)
- Prevent badge fraud/abuse
- Special privileges for invited users?

---

### Task 7: Modify Profile View to Generic Description Format
**Status:** ⏳ Pending  
**Priority:** 🟠 Medium  
**Complexity:** 🟢 Easy-Medium  
**Estimated Time:** 2 hours

**Implementation:**
- Transform structured profile data into narrative format
- Natural language descriptions

**Proposed Format:**

**"About [FirstName]"**
```
Sarah is a 28-year-old Software Engineer from San Francisco. 
She describes herself as: "Passionate about technology and travel."

Education: Master's in Computer Science from Stanford
Career: Senior Engineer at Tech Company
Family: Close-knit modern family with strong values
```

**"What [FirstName] is Looking For"**
```
Sarah is looking for someone who is: "Kind, ambitious, and shares similar values."

Preferred criteria:
• Education: Bachelor's or higher
• Profession: Technology, Business, or Healthcare
• Location: San Francisco Bay Area
• Religion: Open to all
```

**Files to Create:**
- `frontend/src/utils/profileFormatter.js`

**Files to Modify:**
- `frontend/src/components/Profile.js` - Restructure layout
- `frontend/src/components/Profile.css` - Update styles

**Considerations:**
- Handle missing fields gracefully
- Gender-appropriate pronouns (he/she/they)
- Fallback to structured view if data incomplete

---

## 📅 Low Priority (Sprint 3+)

### Task 2: Pause Function (Go MIA)
**Status:** ⏳ Pending  
**Priority:** 🔵 Low  
**Complexity:** 🟡 Medium  
**Estimated Time:** 2-3 hours

**Implementation:**
- Add `accountStatus` field: `"active" | "paused" | "deactivated"`
- When paused:
  - Hide from search results
  - Hide from L3V3L matches
  - Block viewing other profiles
  - Show "Account Paused" banner
  - Keep messages read-only

**Files to Modify:**
- `fastapi_backend/routes.py` - Filter paused users from search
- `fastapi_backend/routes_matches.py` - Exclude from L3V3L matches
- `frontend/src/components/UnifiedPreferences.js` - Add pause toggle
- `frontend/src/components/Dashboard.js` - Show pause banner

**Considerations:**
- ⚠️ Should existing matches persist?
- ⚠️ Should messages be accessible?
- ⚠️ Auto-unpause after X days?
- Database index on `accountStatus` for performance

**Privacy Implications:**
- Maintain PII access grants
- Keep favorites/shortlist but hide from others

---

### Task 8: Auto-Expire Favorites/Shortlist Preferences
**Status:** ⏳ Pending  
**Priority:** 🔵 Low  
**Complexity:** 🟡 Medium  
**Estimated Time:** 2 hours

**Implementation:**

**User Preferences:**
- "Auto-remove favorites after ____ days"
- "Auto-remove shortlist after ____ days"
- Options: 30, 60, 90 days, or Never

**Backend Scheduler Job:**
- Create `auto_expire_interactions.py`
- Run daily at midnight
- Delete favorites/shortlist where `createdAt + expiryDays < now`

**Files to Create:**
- `fastapi_backend/job_templates/auto_expire_interactions.py`

**Files to Modify:**
- `frontend/src/components/UnifiedPreferences.js` - Add settings
- `fastapi_backend/models/user.py` - Add preference fields

**Considerations:**
- Notification 3 days before expiry
- Option to extend expiry for specific users
- Export list before deletion
- Confirmation before first auto-deletion

---

## 📊 Summary

### By Priority:
- **🔥 High Priority:** 4 tasks (~7 hours)
- **🟠 Medium Priority:** 4 tasks (~9 hours)
- **🔵 Low Priority:** 2 tasks (~5 hours)

### By Complexity:
- **🟢 Easy:** 6 tasks
- **🟡 Medium:** 4 tasks

### Total Effort:
- **~21 hours** (3 days of focused work)

---

## 📅 Suggested Sprint Plan

### **✅ Sprint 1 (Week 1):** Quick Wins - COMPLETED!
- ✅ Task 9: Rename Exclusion (25 min)
- ✅ Task 1: Last Login Display (25 min)
- ✅ Task 3: Email Verification Screen (35 min)
- **Total:** 1.5 hours (under budget!)

### **Sprint 2 (Week 1-2):** User Engagement - IN PROGRESS
- ✅ Task 6: Last Activity Status (30 min)
- Task 10: Profile Creator Badge (2 hours)
- Task 7: Profile Description Format (2 hours)
- **Total:** 5 hours (0.5 hours done, 4.5 hours remaining)

### **Sprint 3 (Week 2):** Trust & Quality
- Task 5: Invitation System (3-4 hours)
- Task 4: SEO Optimization (4-6 hours)
- **Total:** 7-10 hours

### **Sprint 4 (Week 3+):** Nice-to-Have
- Task 2: Pause Function (2-3 hours)
- Task 8: Auto-Expire (2 hours)
- **Total:** 4-5 hours

---

## 🎯 Current Status

**Completed:** 
- ✅ Task 9 - Rename "Exclusion" to "Not Interested" (25 min)
- ✅ Task 1 - Last Login Display (25 min)
- ✅ Task 3 - Email Verification Screen (35 min)
- ✅ Task 6 - Last Activity Status (30 min)

**Sprint 1 Complete!** 🎉  
**Sprint 2: 1/4 tasks done!** 🚀

**Next Up:** Task 10 - Profile Creator Badge (2 hours) or Task 7 - Profile Description (2 hours)  
**Branch:** dev  
**Last Updated:** November 2, 2025  
**Progress:** 4/10 tasks completed (40%)  
**Time Spent:** ~2 hours total

---

## 📝 Notes

- All tasks reviewed and approved by user
- Prioritization based on impact, effort, and dependencies
- SEO optimization is critical for growth (high priority despite effort)
- Privacy considerations documented for each feature
- Database performance impacts noted where applicable

---

## 🔗 Related Documents

- `LANDING_PAGE_IMPLEMENTATION.md` - Landing page features
- `MFA_NOTIFICATION_BANNER.md` - MFA implementation
- `COMPREHENSIVE_CODE_AUDIT.md` - Code quality improvements
- `COMMUNICATION_MODULE.md` - Notification system
- `QUICK_CONTEXT_REFERENCE.mem` - Architecture overview
