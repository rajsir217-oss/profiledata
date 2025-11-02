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

### Task 3: Email Verification Screen After Registration
**Status:** ⏳ Pending  
**Priority:** 🔥 High  
**Complexity:** 🟢 Easy  
**Estimated Time:** 1 hour

**Implementation:**
- Create `/verify-email-sent` page
- Show success animation + instructions
- "Resend email" button with cooldown
- "OK" button → redirect to `/login`

**Files to Create:**
- `frontend/src/components/EmailVerificationSent.js`
- `frontend/src/components/EmailVerificationSent.css`

**Files to Modify:**
- `frontend/src/App.js` - Add route
- `frontend/src/components/Register2.js` - Redirect on success
- `fastapi_backend/routers/verification.py` - Add resend endpoint

**UI Elements:**
- ✅ Success checkmark animation
- 📧 "Verification email sent to [email]"
- ℹ️ "Check your inbox and spam folder"
- 🔄 Resend button (60s cooldown)
- 🔑 "Already verified? Login here"

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

### Task 6: Show Last Activity on Profile View
**Status:** ⏳ Pending  
**Priority:** 🟠 Medium  
**Complexity:** 🟢 Easy  
**Estimated Time:** 1 hour

**Implementation:**
- Track `lastActivityAt` field (update on login, profile view, message)
- Display generic activity ranges:
  - "Active today" (< 24 hours)
  - "Active 2 days ago" (2-7 days)
  - "Active 2 weeks ago" (7-30 days)
  - "Active over a month ago" (> 30 days)

**Files to Modify:**
- `fastapi_backend/routes.py` - Update lastActivityAt on actions
- `frontend/src/components/Profile.js` - Display indicator
- Create `frontend/src/utils/activityFormatter.js`

**UI Display:**
- 🟢 Active today (green)
- 🟡 Active this week (yellow)
- 🟠 Active 2 weeks ago (orange)
- ⚪ Active over a month ago (gray)

**Privacy:**
- Add user preference: "Show my activity status" (default: ON)

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

### **Sprint 1 (Week 1):** Quick Wins
- ✅ Task 9: Rename Exclusion (30 min)
- Task 1: Last Login Display (30 min)
- Task 3: Email Verification Screen (1 hour)
- **Total:** 2 hours

### **Sprint 2 (Week 1-2):** User Engagement
- Task 6: Last Activity Status (1 hour)
- Task 10: Profile Creator Badge (2 hours)
- Task 7: Profile Description Format (2 hours)
- **Total:** 5 hours

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
- ✅ Task 9 - Rename "Exclusion" to "Not Interested"
- ✅ Task 1 - Last Login Display

**Next Up:** Task 3 - Email Verification Screen  
**Branch:** dev  
**Last Updated:** November 2, 2025  
**Progress:** 2/10 tasks completed (20%)

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
