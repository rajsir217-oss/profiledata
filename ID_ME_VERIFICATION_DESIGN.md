# Registration & Identity Verification System — Design Document

**Last Updated:** April 10, 2026

---

## 1. Overview

This document describes the complete registration pipeline for L3V3L Matches.
Every new user must pass **one of two verification paths** before they can create a full profile:

| Path | Trigger | Verification Method |
|------|---------|---------------------|
| **A — Referral** | User provides a reference contact that admin validates | Admin manually verifies the referenced person is a known member |
| **B — ID.me** | Reference contact cannot be validated | ID.me OAuth identity verification (US Citizen / Green Card) |

Both paths converge into the same pipeline: **email invitation → profile creation → pending admin approval → active**.

---

## 2. Flow (matches flowchart)

```
  ┌─────────────────────┐
  │  "Register Profile"  │   (LandingPage.js → /register-interest)
  └─────────┬───────────┘
            ▼
  ┌─────────────────────────────────────────┐
  │  Interest Form (NEW — pre-registration) │
  │  • First & Last Name                     │
  │  • Email, Contact Phone                  │
  │  • Referred By:                          │
  │      – First & Last Name                 │
  │      – Contact Phone, Email              │
  └─────────┬───────────────────────────────┘
            ▼
  ┌─────────────────────────────────────────┐
  │  Admin Reviews Interest Request          │
  │  (Admin Contact / Interest Queue)        │
  │  Admin verifies the referenced contact   │
  └─────────┬───────────────────────────────┘
            ▼
      ┌──────────────┐
      │  Valid        │
      │  Reference?   │
      └──┬────────┬──┘
     Yes │        │ No
         ▼        ▼
         │   ┌─────────────────────┐
         │   │ Send ID.me          │
         │   │ Verification Link   │
         │   └────────┬────────────┘
         │            ▼
         │      ┌───────────┐
         │      │  ID.me    │
         │      │  Success? │
         │      └──┬─────┬──┘
         │     Yes │     │ No
         │         ▼     ▼
         │         │   ┌──────┐
         │         │   │ END  │ (Rejected — notify user)
         │         │   └──────┘
         ▼         ▼
  ┌──────────────────────────────────┐
  │  Send Email Invitation           │   ← EXISTING: InvitationService
  │  (prefill name, email, phone,    │     send_invitation_email()
  │   referrer info)                 │
  └─────────┬────────────────────────┘
            ▼
  ┌──────────────────────────────────┐
  │  User clicks link → /register    │   ← EXISTING: Register2.js
  │  Creates full profile            │     POST /register (with invitationToken)
  └─────────┬────────────────────────┘
            ▼
  ┌──────────────────────────────────┐
  │  Email Verification              │   ← EXISTING: EmailVerificationService
  │  → accountStatus =               │
  │    "pending_email_verification"  │
  └─────────┬────────────────────────┘
            ▼
  ┌──────────────────────────────────┐
  │  Pending Admin Approval          │   ← EXISTING: admin_routes.py
  │  → accountStatus =               │     adminApprovalStatus = "pending"
  │    "pending_admin_approval"      │
  └─────────┬────────────────────────┘
            ▼
      ┌──────────────┐
      │  Admin        │
      │  Approves?    │
      └──┬────────┬──┘
     Yes │        │ No
         ▼        ▼
  ┌──────────┐  ┌──────────────────┐
  │  ACTIVE   │  │  Inactive Status  │
  │  Profile  │  │  (suspended /     │
  └──────────┘  │   deactivated)    │
                └──────────────────┘
```

---

## 3. What Already Exists

### 3a. Invitation System (FULLY BUILT)
- **Models:** `models/invitation_models.py` — `InvitationCreate`, `InvitationDB`, `InvitationStatus`, `InvitationChannel`
- **Service:** `services/invitation_service.py` — `InvitationService` (create, list, archive, resend, stats)
- **Email:** `services/email_sender.py` — `send_invitation_email()` (HTML template, Resend + SMTP fallback)
- **Admin routes:** `routers/invitations.py` — full CRUD, bulk import, resend, stats
- **User routes:** `routers/user_invitations.py` — users can invite up to 10 friends
- **DB collection:** `invitations` — tracks token, email/SMS status, registration conversion

### 3b. Invitation-Only Registration Gate (FULLY BUILT)
- **Config:** `config.py` → `registration_open: bool = False` (currently invitation-only)
- **Gate:** `POST /register` checks `invitationToken` → validates against `db.invitations`
- **Status check:** `GET /registration-status` returns `registrationOpen` flag

### 3c. Admin Approval Pipeline (FULLY BUILT)
- **User model:** `models/user_models.py` → `AccountStatus`, `AdminApprovalStatus` enums
- **Registration defaults:** `adminApprovalStatus: "pending"`, `accountStatus: "pending_email_verification"`
- **Email verification:** `services/email_verification_service.py` → sets `accountStatus = "pending_admin_approval"`
- **Admin activation:** `auth/admin_routes.py` → `manage_user(action="activate")` → sets `adminApprovalStatus = "approved"`, `accountStatus = "active"`
- **Notifications:** `notification_config/notification_triggers.py` → triggers on `pending_admin_approval → active`

### 3d. Landing Page (EXISTS)
- **Component:** `LandingPage.js` → "Register Profile" button → navigates to `/verification`

---

## 4. What Needs to Be Built

### 4a. NEW — Interest / Pre-Registration Form

**Purpose:** Collect basic info + referral data BEFORE any verification or invitation.

**Frontend:** New page at `/register-interest` (replaces current `/verification` route)

```
┌──────────────────────────────────────────┐
│  📋 Register Your Interest                │
│                                           │
│  YOUR INFORMATION                         │
│  ┌─────────────┐ ┌─────────────┐         │
│  │ First Name   │ │ Last Name   │         │
│  └─────────────┘ └─────────────┘         │
│  ┌─────────────┐ ┌─────────────┐         │
│  │ Email        │ │ Phone       │         │
│  └─────────────┘ └─────────────┘         │
│                                           │
│  REFERRED BY (optional but recommended)   │
│  ┌─────────────┐ ┌─────────────┐         │
│  │ First Name   │ │ Last Name   │         │
│  └─────────────┘ └─────────────┘         │
│  ┌─────────────┐ ┌─────────────┐         │
│  │ Phone        │ │ Email       │         │
│  └─────────────┘ └─────────────┘         │
│                                           │
│  [ Submit Interest ]                      │
│                                           │
│  🛡️ Your data is secure and encrypted     │
└──────────────────────────────────────────┘
```

**Backend:** New endpoint + collection

```python
# POST /api/registration-interest
# Stores in `registration_interests` collection
{
    "firstName": str,
    "lastName": str,
    "email": str,
    "phone": str,
    "referredBy": {
        "firstName": str,
        "lastName": str,
        "phone": str,
        "email": str
    },
    "status": "pending_review",     # pending_review | reference_validated | idme_sent | idme_verified | idme_failed | invited | rejected
    "verificationPath": null,       # "referral" | "idme" (set by admin)
    "idmeVerified": false,
    "idmeUuid": null,
    "idmeVerifiedAt": null,
    "invitationId": null,           # links to invitations collection after invitation sent
    "reviewedBy": null,             # admin username
    "reviewedAt": null,
    "reviewNotes": null,
    "createdAt": datetime,
    "updatedAt": datetime
}
```

### 4b. NEW — Admin Interest Review Queue

**Purpose:** Admin reviews incoming interest requests, validates references, decides path.

**Frontend:** New admin page at `/admin/registration-interests`

- List of pending interest requests
- For each request, admin can:
  1. **Validate Reference** → mark as `reference_validated` → auto-send invitation
  2. **Send ID.me Verification** → mark as `idme_sent` → send ID.me link to user
  3. **Reject** → mark as `rejected` → notify user

**Backend:** New admin endpoints

```python
# GET  /api/registration-interest/admin/all        — list all interests (with filters)
# GET  /api/registration-interest/admin/pending     — pending review count (for badge)
# PUT  /api/registration-interest/{id}/validate     — admin validates reference → send invitation
# PUT  /api/registration-interest/{id}/send-idme    — admin triggers ID.me verification
# PUT  /api/registration-interest/{id}/reject       — admin rejects
```

### 4c. NEW — ID.me OAuth Integration

**Purpose:** Verify US Citizen / Green Card status when reference cannot be validated.

**Flow:**
1. Admin clicks "Send ID.me Verification" on an interest request
2. Backend sends email to user with ID.me verification link
3. User completes ID.me OAuth
4. Callback updates interest request → `idme_verified = true`
5. System auto-sends invitation email

**Backend:** New router `routers/idme_verification.py`

```python
# GET  /auth/idme/initiate/{interest_id}   — generate ID.me OAuth URL, send to user via email
# GET  /auth/idme/callback                 — ID.me redirects here after verification
#                                            → updates interest, auto-sends invitation
```

**ID.me OAuth Parameters:**
```python
IDME_CLIENT_ID = settings.idme_client_id
IDME_CLIENT_SECRET = settings.idme_client_secret
IDME_AUTH_URL = "https://api.id.me/oauth/authorize"
IDME_TOKEN_URL = "https://api.id.me/oauth/token"
IDME_USERINFO_URL = "https://api.id.me/api/public/v3/userinfo"
IDME_REDIRECT_URI = f"{settings.backend_url}/auth/idme/callback"

# Scopes: openid, identity_verification
# Response includes: verified (bool), verification_type, uuid
```

### 4d. MODIFY — Landing Page Route

Change "Register Profile" button from `/verification` → `/register-interest`

```javascript
// LandingPage.js — change:
<button onClick={() => navigate('/verification')}>Register Profile</button>
// to:
<button onClick={() => navigate('/register-interest')}>Register Profile</button>
```

### 4e. MODIFY — App.js Routes

```javascript
// Add new route:
<Route path="/register-interest" element={<RegisterInterest />} />
// Admin route:
<Route path="/admin/registration-interests" element={<AdminRegistrationInterests />} />
```

---

## 5. Environment Variables (NEW)

```bash
# Add to .env
IDME_CLIENT_ID=your_client_id
IDME_CLIENT_SECRET=your_client_secret
IDME_REDIRECT_URI=https://l3v3lmatches.com/auth/idme/callback
```

```python
# Add to config.py Settings class
idme_client_id: Optional[str] = None
idme_client_secret: Optional[str] = None
idme_redirect_uri: Optional[str] = None
```

---

## 6. Database Changes

### New Collection: `registration_interests`
```javascript
{
    "_id": ObjectId,
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com",
    "phone": "+12025551234",
    "referredBy": {
        "firstName": "Jane",
        "lastName": "Smith",
        "phone": "+12025555678",
        "email": "jane@example.com"
    },
    "status": "pending_review",
    "verificationPath": null,       // "referral" | "idme"
    "idmeVerified": false,
    "idmeUuid": null,
    "idmeVerifiedAt": null,
    "invitationId": null,
    "reviewedBy": null,
    "reviewedAt": null,
    "reviewNotes": null,
    "createdAt": ISODate,
    "updatedAt": ISODate
}
```

### Existing Collections (no schema changes needed)
- `invitations` — already supports the invitation flow
- `users` — already has `adminApprovalStatus`, `accountStatus`, `invitedBy`

---

## 7. Security Considerations

1. **ID.me OAuth state parameter** — CSRF protection with random state stored in session/DB
2. **Rate limiting** — on interest submission endpoint (prevent spam)
3. **Email validation** — verify email format before storing interest
4. **Admin-only actions** — reference validation and ID.me trigger require admin auth
5. **Token expiry** — ID.me verification links expire after 7 days
6. **No PII logging** — do not log ID.me identity data in plain text

---

## 8. Implementation Order

| Phase | Task | Priority | Effort |
|-------|------|----------|--------|
| 1 | Interest form (frontend + backend endpoint + DB collection) | HIGH | 1-2 days |
| 2 | Admin interest review queue (frontend + backend endpoints) | HIGH | 1-2 days |
| 3 | Wire "Validate Reference" → auto-send invitation (uses existing InvitationService) | HIGH | 0.5 day |
| 4 | ID.me OAuth integration (backend router + callback) | HIGH | 1-2 days |
| 5 | ID.me verification email template | MEDIUM | 0.5 day |
| 6 | Wire ID.me callback → auto-send invitation | MEDIUM | 0.5 day |
| 7 | Update LandingPage route + App.js routes | LOW | 0.5 hr |
| 8 | Admin badge for pending interests (TopBar) | LOW | 0.5 hr |
| 9 | Verification badges — backend (set `badges.*` during registration based on invitation path) | HIGH | 0.5 day |
| 10 | Verification badges — Profile.js (display 🛡️ / 🤝 near username) | MEDIUM | 0.5 day |
| 11 | Verification badges — SearchPage.js (compact icons on result cards) | MEDIUM | 0.5 day |
| 12 | Verification badges — Admin views (UserManagement + Interest queue) | LOW | 0.5 day |
| 13 | Testing & QA | HIGH | 1 day |

**Total estimated effort: ~7-9 days**

---

## 9. Deployment Checklist

- [ ] Obtain ID.me sandbox credentials for testing
- [ ] Obtain ID.me production credentials
- [ ] Configure OAuth redirect URIs in ID.me dashboard
- [ ] Add environment variables to `.env` and GCloud
- [ ] Create `registration_interests` collection indexes
- [ ] Deploy backend changes
- [ ] Deploy frontend changes
- [ ] Test full flow: interest → admin review → invitation → registration → approval
- [ ] Test ID.me path: interest → ID.me → callback → invitation → registration → approval
- [ ] Monitor interest submission rates and conversion

---

## 10. Status Lifecycle

```
Interest:   pending_review → reference_validated → invited
                           → idme_sent → idme_verified → invited
                           → rejected

User:       (created via invitation)
            → pending_email_verification
            → pending_admin_approval
            → active (or suspended/deactivated)
```

---

## 11. Verification Badges (Gamification)

Every profile displays earned verification badges as trust signals. Badges are **permanent** once earned and visible to all users.

### Badge Types

| Badge | Emoji | Earned When | Stored Field |
|-------|-------|-------------|-------------|
| **ID Verified** | 🛡️ | User passed ID.me verification (US Citizen / Green Card) | `badges.idVerified` |
| **Community Verified** | 🤝 | User was referred by a validated member OR invited by an existing member | `badges.communityVerified` |

### How Badges Are Awarded

**ID Verified** — set automatically when:
- ID.me callback succeeds → interest record updated → `idmeVerified = true`
- When invitation is created from that interest, carry `verificationPath: "idme"` to the invitation
- When user registers with that invitation, set `badges.idVerified = true` on the user document

**Community Verified** — set automatically when:
- Admin validates the referenced contact → interest marked `reference_validated`
- When invitation is created, carry `verificationPath: "referral"` to the invitation
- When user registers with that invitation, set `badges.communityVerified = true`
- Also set when a user registers via a **member-sent invitation** (from `user_invitations`)

### Database Schema (User Document)

```javascript
// Add to users collection — new fields
{
  "badges": {
    "idVerified": false,          // true if passed ID.me
    "idVerifiedAt": null,         // timestamp
    "communityVerified": false,   // true if referred/invited by member
    "communityVerifiedAt": null,  // timestamp
    "referredBy": null,           // username or name of referrer
    "verificationPath": null      // "idme" | "referral" | "invitation"
  }
}
```

### Database Schema (Invitation Document — extend existing)

```javascript
// Add to invitations collection — new fields
{
  "verificationPath": null,       // "idme" | "referral" (carried from interest)
  "interestId": null              // links back to registration_interests._id
}
```

### Frontend Display

**Profile page** — badges shown near the user's name:

```
┌──────────────────────────────────────┐
│  John Doe  🛡️ ID Verified            │
│            🤝 Community Verified      │
│                                       │
│  28 • Male • New York                │
└──────────────────────────────────────┘
```

**Search results** — compact badge icons next to name:

```
John Doe 🛡️🤝    Jane Smith 🤝
```

**Badge tooltip on hover:**
- 🛡️ → "Identity verified via ID.me"
- 🤝 → "Referred by a verified community member"

### Implementation Changes

| File | Change |
|------|--------|
| `POST /register` (routes.py) | Read `verificationPath` from invitation, set `badges.*` on user doc |
| `Profile.js` | Display badge icons near username |
| `SearchPage.js` / search result cards | Show compact badge icons |
| `AdminRegistrationInterests` (new) | Show which path was used per interest |
| `UserManagement.js` (admin) | Show badge status in user detail view |

### Future Badge Ideas

| Badge | Trigger | Priority |
|-------|---------|----------|
| **Profile Complete** ✅ | All profile sections filled | Medium |
| **Photo Verified** 📸 | Admin verified photos are real | Medium |
| **Active Member** ⭐ | Logged in 30+ days in last 60 | Low |
| **Premium Member** 💎 | Has active premium subscription | Low |
| **Event Attendee** 🎉 | Attended a virtual meet event | Low |
