# US Vedika — Public + Members Group Design & Workflow

**Status:** Draft v1
**Author:** Engineering
**Last updated:** 2026-05-05
**Related:** `L3V3L_MESSENGER_TECHNICAL_SPEC.md`, `routers/registration_interest.py`

---

## 1. Vision & Purpose

**US Vedika** is a special-purpose conversation that bridges the registered L3V3L Messenger member base with the **wider public** (parents, prospects, referrers, community contacts who are not yet members). It is the **only** conversation type that can include **non-members addressed by email**, and it is the funnel through which public conversations naturally convert into platform memberships.

### Key differences from a regular `group` conversation

| Aspect | Regular Group | **US Vedika (public-group)** |
|---|---|---|
| Participant identity | Registered members only (`username`) | Members **and** Public (`email`) |
| Message delivery (members) | In-app + push + (optionally) email | In-app + push + (optionally) email |
| Message delivery (public) | N/A | **Email only** (with reply-by-email link) |
| Conversion path | None | Built-in **Registration Interest** invitation |
| Permissions | Creator/admin manages members | Admin only; auto-includes all active members + invited public emails |
| Visibility | Participants only | Members see everyone; public sees their own email thread |

---

## 2. Data Model

### 2.1 Conversation document (extension)

`messenger_conversations` collection — new fields on a `type: "public_group"` document:

```jsonc
{
  "_id": ObjectId,
  "type": "public_group",                    // NEW value
  "groupName": "US Vedika",
  "groupAvatar": "🦋",
  "isPublicGroup": true,                     // NEW
  "createdBy": "admin",
  "createdAt": ISODate,
  "updatedAt": ISODate,
  "lastMessageAt": ISODate,
  "lastMessagePreview": "string",
  "participants": [
    { "username": "rajsir217", "joinedAt": ISODate, "role": "admin" },
    // ... all active members auto-added (same as Portal Members)
  ],
  "publicParticipants": [                    // NEW — non-members
    {
      "email": "guest@example.com",
      "displayName": "Guest User",           // optional, parsed from "Name <email>"
      "addedBy": "rajsir217",                // member who first messaged them
      "addedAt": ISODate,
      "status": "invited" | "interested" | "registered" | "opted_out",
      "lastEmailSentAt": ISODate,
      "registrationInterestId": ObjectId,   // link to registration_interests doc once submitted
      "convertedUsername": "guestuser123"   // populated after they become a member
    }
  ]
}
```

### 2.2 Message document (extension)

`messenger_messages` — additional optional fields:

```jsonc
{
  // ... standard fields
  "deliveryMode": "inapp" | "email" | "both",   // NEW — how this message was sent
  "emailRecipients": ["guest@example.com"],     // NEW — email addresses that received this message
  "emailMessageIds": ["<sendgrid-msg-id>"],     // NEW — for tracking opens/replies
  "publicReplyToken": "uuid",                   // NEW — opaque token for reply-by-email tracking
  "invitationOffered": true | false,            // NEW — was "Add Member" CTA included
  "senderType": "member" | "public_email"       // NEW — distinguishes inbound public replies
}
```

### 2.3 Public reply tokens (new collection)

`public_reply_tokens` — short-lived signed tokens that map a reply-by-email back to the conversation:

```jsonc
{
  "_id": ObjectId,
  "token": "uuid-v4",
  "conversationId": ObjectId,
  "publicEmail": "guest@example.com",
  "messageId": ObjectId,            // the message they're replying to (optional)
  "expiresAt": ISODate,             // 30 days
  "usedCount": 0,
  "createdAt": ISODate
}
```

### 2.4 Registration Interest linkage

The existing `registration_interests` collection (`@/Users/rajsiripuram02/opt/appsrc/profiledata/fastapi_backend/routers/registration_interest.py:1`) gets one new field:

```jsonc
{
  // ... existing fields
  "source": "us_vedika_invite",       // NEW — provenance
  "sourceConversationId": ObjectId,
  "invitedBy": "rajsir217"            // member who sent the invite
}
```

---

## 3. Frontend UX

### 3.1 Composing a message in US Vedika

When the user types in the message box, the parser detects mention syntax:

```
Hi @raj_kumar — meet @{priya@example.com}, she's interested in matchmaking.
```

**Parser rules:**
- `@username` → resolves to a registered member (existing behavior).
- `@{email@domain}` → unresolved public email reference (new).
- `@{Name <email@domain>}` → public reference with display name (new).

After validation, the **send button is intercepted** when at least one `@{email}` token is present. Instead of immediately sending, a modal appears:

### 3.2 The "Public Recipient" modal

```
┌────────────────────────────────────────────────┐
│  📧  You're messaging non-members               │
│                                                │
│  This message will be delivered by email to:    │
│   • priya@example.com                           │
│                                                │
│  Choose how to send:                            │
│                                                │
│   ┌──────────────────────────────────────┐      │
│   │ ✉️  Send message + Invite to join    │      │
│   │   (recommended)                       │      │
│   │                                       │      │
│   │ Email includes a "Join L3V3L" button  │      │
│   │ that opens our Registration Interest  │      │
│   │ form. They can reply by email or      │      │
│   │ register to join the conversation.    │      │
│   └──────────────────────────────────────┘      │
│                                                │
│   ┌──────────────────────────────────────┐      │
│   │ 📨  Send message only                 │      │
│   │                                       │      │
│   │ Email only — no invitation link.      │      │
│   │ They can still reply by email.        │      │
│   └──────────────────────────────────────┘      │
│                                                │
│   [ Cancel ]                                    │
└────────────────────────────────────────────────┘
```

**Defaults:** First option ("Send + Invite") is the recommended primary CTA.

### 3.3 Inline rendering of public participants

In the chat thread, public-recipient messages render with a small badge:

```
[Avatar]  Raj Kumar                            2:34 PM
          Hi @raj_kumar — meet @{priya@example.com} ...
          📧 Sent via email to priya@example.com
          🎟️ Invitation included
```

If the public user **replies via email**, their reply appears in the thread as:

```
[✉️ Avatar]  priya@example.com (public)        3:01 PM
             Thanks! Tell me more about the platform.
             ↩️ Replied via email
```

If they later register, all historical messages are retroactively associated with their new `username`, and future messages are delivered in-app.

### 3.4 Member list in US Vedika

The right-side participant panel shows two sections:

```
MEMBERS (47)
  • [pic] Raj Kumar       (online)
  • [pic] Priya Sharma    (5m ago)
  ...

PUBLIC INVITEES (3)
  • priya@example.com     ⏳ invited
  • amit@example.com      💬 interested (2 replies)
  • neha@example.com      ✅ registered → @nehagupta042
```

---

## 4. Backend Workflow

### 4.1 Send-message endpoint (modified)

`POST /api/messenger/conversations/{id}/messages`

Request body now optionally includes:

```json
{
  "content": "Hi @raj_kumar — meet @{priya@example.com}",
  "publicRecipients": [
    {
      "email": "priya@example.com",
      "displayName": "Priya"
    }
  ],
  "deliveryMode": "both",          // "inapp" | "email" | "both"
  "includeInvitation": true         // attach Registration Interest CTA
}
```

**Server-side flow** when `publicRecipients.length > 0`:

```
1.  Verify conversation.type === "public_group"
       └─ else 403: "Public recipients only allowed in US Vedika"
2.  For each public recipient:
    a. Upsert into conversation.publicParticipants[]
       with status="invited", addedBy=sender
    b. Generate publicReplyToken (uuid, 30d TTL)
    c. Persist public_reply_tokens document
3.  Persist message in messenger_messages with:
       deliveryMode, emailRecipients, publicReplyToken, invitationOffered
4.  Emit socket event "messenger:new_message" to online members
       (existing flow)
5.  Enqueue email-send job per public recipient
       (uses existing notification_queue pattern)
6.  Return message with deliveryStatus: { inapp: "sent", email: "queued" }
```

### 4.2 Email payload

A new email template `us_vedika_message.html`:

```
Subject: {senderName} sent you a message on L3V3L Vedika

Hi {displayName or "there"},

{senderName} ({senderEmail}) shared a message with you in
US Vedika — L3V3L's community space:

────────────────────────────────────────
{messageContent}
────────────────────────────────────────

[ Reply by email ]   ← mailto: with reply token in subject
[ 🦋 Join L3V3L ]    ← link to /register-interest?source=us_vedika&token=...
                       (only if invitationOffered === true)

You're receiving this because {senderName} added you to the
US Vedika public group. To stop receiving these messages,
[unsubscribe here].
```

The unique reply-by-email address uses **plus-addressing** so SendGrid Inbound Parse can route it back:

```
us-vedika+{publicReplyToken}@inbound.l3v3l.com
```

### 4.3 Inbound email reply handler

`POST /api/messenger/inbound/email` — webhook endpoint for SendGrid Inbound Parse.

```
1.  Extract publicReplyToken from To: address (us-vedika+TOKEN@...)
2.  Look up token in public_reply_tokens
       └─ if expired/missing: silently drop or send "thread expired" reply
3.  Verify From: matches the publicParticipant.email
       └─ guards against spoofing
4.  Parse plain-text body (strip quoted history)
5.  Insert messenger_messages with:
       senderType="public_email"
       senderUsername=null
       senderEmail=<from>
       conversationId, content, deliveryMode="email"
6.  Update conversation.publicParticipants[].status = "interested"
7.  Emit socket event to online members
8.  Return 200 to SendGrid
```

### 4.4 Registration Interest funnel

When a public recipient clicks **🦋 Join L3V3L** in their email:

```
Email link: https://app.l3v3l.com/register-interest?
              source=us_vedika
              &cid={conversationId}
              &email={prefilledEmail}
              &token={publicReplyToken}

1.  Frontend pre-fills RegistrationInterestForm with email
2.  User completes & submits form
       POST /api/registration-interest
       (extra fields: source, sourceConversationId, invitedBy)
3.  registration_interests document created
4.  conversation.publicParticipants[].status = "interested"
       conversation.publicParticipants[].registrationInterestId = <new id>
5.  Notify admin (existing admin queue workflow)
6.  Email confirmation to prospect
```

When admin **approves** the registration interest and the user completes signup:

```
1.  User registration completes (existing flow)
2.  Background hook: link_us_vedika_history(newUsername, email)
    a. Find all conversations with publicParticipants.email = <email>
    b. For each:
        - Add user to participants[] with role="member"
        - Mark publicParticipants[].status = "registered"
        - Set publicParticipants[].convertedUsername = <newUsername>
    c. Update senderUsername on inbound email replies
       so they appear under their registered identity
3.  User opens messenger → sees full historical thread
```

---

## 5. New & Modified API Endpoints

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/messenger/us-vedika/group` | Get-or-create the singleton US Vedika group (admin-bootstrapped) |
| `POST` | `/api/messenger/conversations/{id}/messages` | **Modified** — accepts `publicRecipients[]`, `deliveryMode`, `includeInvitation` |
| `POST` | `/api/messenger/conversations/{id}/public-participants` | Admin: add/remove public emails directly |
| `POST` | `/api/messenger/inbound/email` | SendGrid Inbound Parse webhook |
| `POST` | `/api/registration-interest` | **Modified** — accepts `source=us_vedika`, `sourceConversationId`, `invitedBy` |
| `POST` | `/api/messenger/public/unsubscribe` | One-click unsubscribe via signed token |

---

## 6. Security & Abuse Controls

| Risk | Mitigation |
|---|---|
| Spam to arbitrary emails | Per-member rate limit: max **N invites per 24h** (configurable, default 10) |
| Bulk dump from a compromised member | Per-conversation rate limit: max **M new public emails per hour** |
| Phishing impersonation | All emails sent from `vedika@l3v3l.com`; sender's name shown but email envelope is platform-owned |
| Email spoofing on reply | DKIM/SPF check + From-address must equal `publicParticipants.email` |
| Token hijacking | `publicReplyToken` is 128-bit random, single-conversation scoped, 30-day expiry |
| GDPR / unsubscribe | Every email has unsubscribe link → sets `status="opted_out"`; opted_out emails are silently dropped |
| PII leakage | Public recipients only see the **single message** addressed to them, not full thread history (until they register) |
| Admin abuse | Only `admin` role can set `type: "public_group"`; only one US Vedika instance allowed |

---

## 7. State Machine — Public Participant Lifecycle

```
                  ┌─────────────┐
                  │  invited    │  ← member sends @{email}
                  └──────┬──────┘
                         │
         ┌───────────────┼───────────────┐
         │               │               │
         ▼               ▼               ▼
  ┌────────────┐  ┌────────────┐  ┌────────────┐
  │ interested │  │ opted_out  │  │  expired   │
  │ (replied)  │  │ (unsubbed) │  │ (no reply  │
  └──────┬─────┘  └────────────┘  │  in 90d)   │
         │                         └────────────┘
         ▼
  ┌────────────┐
  │ registered │  ← submitted Registration Interest
  └──────┬─────┘     and admin approved
         │
         ▼
  ┌────────────┐
  │   member   │  ← absorbed into participants[];
  │ (full)     │     publicParticipants entry archived
  └────────────┘
```

---

## 8. Admin Tooling

A new admin panel page **"US Vedika — Public Invitees"** exposes:

- Searchable list of all public participants across status states
- Filters: status, addedBy, addedAt range
- Bulk actions: resend invite, opt-out, manually link to a registered user
- Conversion funnel metrics:
  - Invites sent
  - Email opens / clicks (via SendGrid event webhook)
  - Replies received
  - Registration interests submitted
  - Conversions to member
- One-click "promote member" if a registered user matches an invitee email

---

## 9. Implementation Phases

### Phase 1 — MVP (1 week)
- DB schema additions (`type: "public_group"`, `publicParticipants`, tokens collection)
- US Vedika group bootstrap endpoint + admin auto-creation
- `@{email}` parser in messenger compose box
- Modal with two-option flow (send + invite / send only)
- Outbound email via existing notification template system
- Registration Interest form pre-fill via query params

### Phase 2 — Two-way email (1 week)
- SendGrid Inbound Parse setup + webhook handler
- Reply tokens & verification
- Inline rendering of public replies in chat thread

### Phase 3 — Conversion & history merge (3-4 days)
- Post-registration hook: `link_us_vedika_history`
- Backfill of pre-registration messages under new `username`
- Admin metrics panel

### Phase 4 — Abuse controls & polish (3-4 days)
- Rate limits, unsubscribe page, opt-out enforcement
- Admin approve/reject from invitee panel
- Email open/click tracking integration

---

## 10. Open Questions

1. **Singleton or multi-instance?** Is US Vedika strictly one global group, or can there be regional variants (e.g., "US Vedika - California")? *Recommendation: single global group for v1; regional later if needed.*
2. **Default member inclusion?** Are all `accountStatus="active"` users auto-added, or opt-in? *Recommendation: auto-add active users (matches Portal Members), with a per-user "Mute US Vedika" preference.*
3. **Message visibility to public on registration:** When an invitee converts, do they see the **entire** conversation history, or only messages where they were addressed? *Recommendation: only messages they were addressed in — protects member privacy.*
4. **Email throttling:** Per-recipient max-emails-per-day to avoid harassment? *Recommendation: max 3 emails per recipient per 24h.*
5. **Unsubscribe granularity:** All-of-L3V3L vs. just-US-Vedika? *Recommendation: just US Vedika (separate unsubscribe list).*

---

## 11. Out of Scope (for v1)

- Public-to-public messaging (public users can only reply to the member who messaged them)
- Rich attachments in email (text only; "View on web" link for media)
- Multiple public groups beyond US Vedika
- SMS as an alternate delivery channel (future: leverage existing `sms_verification_service.py`)

---

## 12. References

- `@/Users/rajsiripuram02/opt/appsrc/profiledata/docs/L3V3L_MESSENGER_TECHNICAL_SPEC.md` — Core messenger spec
- `@/Users/rajsiripuram02/opt/appsrc/profiledata/fastapi_backend/routers/registration_interest.py` — Registration interest endpoints
- `@/Users/rajsiripuram02/opt/appsrc/profiledata/fastapi_backend/routers/messenger.py` — Messenger router (Portal Members pattern to mirror)
- `@/Users/rajsiripuram02/opt/appsrc/profiledata/fastapi_backend/services/messenger_service.py` — Conversation/message service
