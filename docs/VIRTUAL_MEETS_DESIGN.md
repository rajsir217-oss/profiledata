# Virtual Meets — Design Document

**Version:** 1.0  
**Date:** March 29, 2026  
**Status:** DRAFT — Awaiting Approval  
**Author:** Cascade AI + Admin

---

## 1. Executive Summary

**Virtual Meets** is a new feature that extends the existing poll/RSVP system into a full match-making + virtual room workflow. When a poll becomes active and users RSVP "Yes," they gain access to an opposite-gender match list and can request 1:1 virtual rooms. For Zoom-call events, non-admin/moderator users must complete a $5 payment before accessing match features.

### Key Capabilities
- Opposite-gender match list generated from YES-RSVP users
- 1:1 virtual room request/accept/decline flow
- Event-day UI lockdown (read-only mode)
- Payment gate for Zoom-call event types ($5 default)
- New sidebar menu item: **"Virtual Meets"** (visible to all active users)

---

## 2. System Architecture

### 2.1 High-Level Flow

```
Poll Created (Admin) → Poll Active → Users RSVP "Yes"
                                          ↓
                              ┌───────────────────────┐
                              │  event_type check      │
                              └───────────────────────┘
                                    ↓              ↓
                             zoom-call          other
                                ↓                 ↓
                          Payment Gate      Direct Access
                          ($5 PayPal)
                                ↓                 ↓
                              ┌───────────────────────┐
                              │  Match List Generated   │
                              │  (opposite-gender YES   │
                              │   RSVP participants)    │
                              └───────────────────────┘
                                        ↓
                              Request 1:1 Virtual Room
                                        ↓
                              Accept / Decline
                                        ↓
                              Room Assigned (if accepted)
                                        ↓
                              Event Day → UI Lockdown
```

### 2.2 Component Map

```
BACKEND (FastAPI)
├── models/virtual_meet_models.py      ← Pydantic models
├── services/virtual_meet_service.py   ← Business logic
├── routers/virtual_meets.py           ← API endpoints
└── (existing) services/paypal_service.py  ← Reuse for payments

FRONTEND (React)
├── components/VirtualMeets.js         ← Main page component
├── components/VirtualMeets.css        ← Styles (theme-aware)
├── components/VirtualMeetPayment.js   ← Payment gate component
└── (existing) components/Sidebar.js   ← Add menu item

DATABASE (MongoDB)
├── virtual_meet_sessions              ← Per-poll session tracking
├── virtual_room_requests              ← 1:1 room requests
├── virtual_rooms                      ← Confirmed rooms
└── (existing) payments                ← Payment records
```

---

## 3. Database Schema

### 3.1 Collection: `virtual_meet_sessions`

Tracks per-poll, per-user session state (payment status, access status).

```json
{
  "_id": ObjectId,
  "poll_id": "string",               // Reference to polls collection
  "username": "string",              // The participant
  "gender": "string",               // Cached from user profile (Male/Female)
  "event_type": "string",           // "zoom-call", "in-person", "virtual", etc.
  "payment_status": "string",       // "not_required" | "pending" | "completed" | "refunded"
  "payment_amount": 5.00,           // Default $5.00
  "payment_id": "string|null",      // Reference to payments collection
  "paypal_order_id": "string|null", // PayPal order ID
  "access_unlocked": false,         // true after payment (or if exempt)
  "rsvp_response": "string",        // "yes" (only YES users get sessions)
  "match_list_generated": false,    // Whether match list has been built
  "created_at": "datetime",
  "updated_at": "datetime"
}
```

**Indexes:**
```javascript
db.virtual_meet_sessions.createIndex({ "poll_id": 1, "username": 1 }, { unique: true })
db.virtual_meet_sessions.createIndex({ "poll_id": 1, "gender": 1 })
db.virtual_meet_sessions.createIndex({ "poll_id": 1, "payment_status": 1 })
```

### 3.2 Collection: `virtual_room_requests`

Tracks 1:1 room requests between participants.

```json
{
  "_id": ObjectId,
  "poll_id": "string",
  "requester_username": "string",    // Who sent the request
  "target_username": "string",       // Who received it
  "status": "string",               // "pending" | "accepted" | "declined" | "expired" | "cancelled"
  "room_id": "string|null",         // Reference to virtual_rooms (set on accept)
  "requested_at": "datetime",
  "responded_at": "datetime|null",
  "response_note": "string|null"    // Optional note from target
}
```

**Indexes:**
```javascript
db.virtual_room_requests.createIndex({ "poll_id": 1, "requester_username": 1, "target_username": 1 }, { unique: true })
db.virtual_room_requests.createIndex({ "poll_id": 1, "target_username": 1, "status": 1 })
db.virtual_room_requests.createIndex({ "poll_id": 1, "status": 1 })
```

### 3.3 Collection: `virtual_rooms`

Confirmed 1:1 virtual rooms.

```json
{
  "_id": ObjectId,
  "poll_id": "string",
  "room_number": 1,                 // Auto-incremented per poll
  "user_a": "string",               // First participant (requester)
  "user_b": "string",               // Second participant (acceptor)
  "status": "string",               // "confirmed" | "active" | "completed" | "cancelled"
  "zoom_link": "string|null",       // Optional Zoom link (if admin provides)
  "notes": "string|null",
  "created_at": "datetime",
  "started_at": "datetime|null",
  "ended_at": "datetime|null"
}
```

**Indexes:**
```javascript
db.virtual_rooms.createIndex({ "poll_id": 1, "room_number": 1 }, { unique: true })
db.virtual_rooms.createIndex({ "poll_id": 1, "user_a": 1 })
db.virtual_rooms.createIndex({ "poll_id": 1, "user_b": 1 })
```

---

## 4. Backend API Design

### 4.1 Router: `/api/virtual-meets`

All endpoints require JWT authentication via `get_current_user`.

#### 4.1.1 GET `/api/virtual-meets/events`
**Purpose:** List all active polls the user RSVPed "Yes" to that have Virtual Meet capability.

**Response:**
```json
{
  "success": true,
  "events": [
    {
      "poll_id": "abc123",
      "title": "Sunday Zoom Meetup",
      "event_type": "zoom-call",
      "event_date": "2026-03-29T00:00:00",
      "event_time": "14:32",
      "event_timezone": "America/Los_Angeles",
      "status": "active",
      "payment_required": true,
      "payment_status": "pending",
      "access_unlocked": false,
      "match_count": 12,
      "room_count": 0,
      "pending_requests": 2,
      "is_locked": false
    }
  ]
}
```

#### 4.1.2 GET `/api/virtual-meets/{poll_id}/matches`
**Purpose:** Get opposite-gender match list for the user in a specific poll.

**Access Control:**
- User must have RSVPed "Yes"
- If `event_type == "zoom-call"` AND user is NOT admin/moderator → payment must be completed
- If event has started → return read-only flag

**Response:**
```json
{
  "success": true,
  "poll_id": "abc123",
  "is_locked": false,
  "matches": [
    {
      "username": "jane_doe",
      "full_name": "Jane Doe",
      "age": 28,
      "location": "San Francisco, CA",
      "profession": "Software Engineer",
      "profile_pic_url": "/api/profile-pic/jane_doe",
      "request_status": null
    },
    {
      "username": "mary_smith",
      "full_name": "Mary Smith",
      "age": 31,
      "location": "Los Angeles, CA",
      "profession": "Product Manager",
      "profile_pic_url": "/api/profile-pic/mary_smith",
      "request_status": "pending"
    }
  ],
  "my_requests_sent": ["mary_smith"],
  "my_requests_received": [
    {
      "from_username": "john_doe",
      "full_name": "John Doe",
      "request_id": "req123",
      "requested_at": "2026-03-29T10:00:00Z"
    }
  ]
}
```

#### 4.1.3 POST `/api/virtual-meets/{poll_id}/request-room`
**Purpose:** Send a 1:1 virtual room request to another participant.

**Request Body:**
```json
{
  "target_username": "jane_doe"
}
```

**Validation:**
- User must have access (payment completed if required)
- Event must NOT be locked (past start time)
- Cannot request self
- Cannot have existing pending/accepted request with same user
- Target must be opposite gender and RSVPed "Yes"

**Response:**
```json
{
  "success": true,
  "request_id": "req456",
  "message": "Room request sent to Jane Doe"
}
```

**Side Effects:**
- Create notification in `notification_queue` for target user
- Send in-app notification via WebSocket

#### 4.1.4 POST `/api/virtual-meets/{poll_id}/respond-request`
**Purpose:** Accept or decline a room request.

**Request Body:**
```json
{
  "request_id": "req123",
  "action": "accept",
  "note": "Looking forward to it!"
}
```

**On Accept:**
1. Update request status to "accepted"
2. Create a virtual room with auto-incremented room number
3. Notify requester via notification queue + WebSocket
4. Return room details

**On Decline:**
1. Update request status to "declined"
2. Notify requester

**Response (accept):**
```json
{
  "success": true,
  "room": {
    "room_id": "room789",
    "room_number": 3,
    "partner": "john_doe",
    "partner_name": "John Doe",
    "status": "confirmed"
  }
}
```

#### 4.1.5 GET `/api/virtual-meets/{poll_id}/my-rooms`
**Purpose:** Get all confirmed rooms for the user in a poll.

**Response:**
```json
{
  "success": true,
  "rooms": [
    {
      "room_id": "room789",
      "room_number": 3,
      "partner_username": "jane_doe",
      "partner_name": "Jane Doe",
      "status": "confirmed",
      "zoom_link": null,
      "created_at": "2026-03-29T10:30:00Z"
    }
  ]
}
```

#### 4.1.6 POST `/api/virtual-meets/{poll_id}/pay`
**Purpose:** Initiate PayPal payment for Zoom-call events.

**Request Body:**
```json
{
  "payment_method": "paypal"
}
```

**Flow:**
1. Check `event_type == "zoom-call"` and user is not admin/moderator
2. Check if not already paid
3. Create PayPal order via existing `paypal_service.create_order(amount="5.00")`
4. Return order_id for frontend PayPal SDK

**Response:**
```json
{
  "success": true,
  "order_id": "PAYPAL_ORDER_123",
  "amount": "5.00"
}
```

#### 4.1.7 POST `/api/virtual-meets/{poll_id}/confirm-payment`
**Purpose:** Capture PayPal payment after user approval.

**Request Body:**
```json
{
  "order_id": "PAYPAL_ORDER_123"
}
```

**Flow:**
1. Capture via `paypal_service.capture_order(order_id)`
2. Update `virtual_meet_sessions.payment_status = "completed"`
3. Set `access_unlocked = true`
4. Log to `payments` collection

**Response:**
```json
{
  "success": true,
  "message": "Payment successful. Match list unlocked!",
  "access_unlocked": true
}
```

#### 4.1.8 GET `/api/virtual-meets/{poll_id}/admin/overview` (Admin only)
**Purpose:** Admin view of all sessions, requests, rooms for a poll.

**Response:**
```json
{
  "success": true,
  "total_participants": 24,
  "male_count": 12,
  "female_count": 12,
  "paid_count": 20,
  "unpaid_count": 4,
  "total_requests": 35,
  "accepted_requests": 18,
  "declined_requests": 5,
  "pending_requests": 12,
  "total_rooms": 18,
  "participants": [...],
  "rooms": [...]
}
```

---

## 5. Frontend Design

### 5.1 New Sidebar Menu Item

**Location:** After "Invite Friends" for regular users, visible to ALL active users.

```javascript
// In Sidebar.js buildMenuItems(), after "Invite Friends" item:
{
  icon: '🎥',
  label: 'Virtual Meets',
  subLabel: 'Match & connect',
  action: () => navigate('/virtual-meets'),
  disabled: !isActive
}
```

**Route:** `/virtual-meets` in `App.js`

### 5.2 Page Structure: VirtualMeets.js

```
┌─────────────────────────────────────────────────────────┐
│  🎥 Virtual Meets                                       │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │  📅 Sunday Zoom Meetup                           │   │
│  │  March 29, 2026 · 2:32 PM PT                    │   │
│  │  Status: Active · 12 matches available           │   │
│  │                                                   │   │
│  │  [💳 Pay $5.00 to Unlock]  ← Payment gate        │   │
│  │         OR                                        │   │
│  │  [View Matches →]          ← If paid/exempt       │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │  📅 Friday Virtual Game Night                    │   │
│  │  April 4, 2026 · 7:00 PM PT                     │   │
│  │  Status: Active · 8 matches available            │   │
│  │  [View Matches →]                                │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 5.3 Match List View (after clicking "View Matches")

```
┌─────────────────────────────────────────────────────────┐
│  ← Back   Sunday Zoom Meetup   ⏱️ Event in 2h 45m      │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  📥 Incoming Requests (2)                               │
│  ┌─────────────────────────────────────────────────┐   │
│  │  👤 John Doe · 30 · SF · Engineer               │   │
│  │  [✅ Accept] [❌ Decline]                        │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  🎯 Your Matches (12)                                   │
│  ┌─────────────────────────────────────────────────┐   │
│  │  👤 Jane Doe · 28 · SF · Engineer               │   │
│  │  [🎥 Request 1:1 Room]                           │   │
│  ├─────────────────────────────────────────────────┤   │
│  │  👤 Mary Smith · 31 · LA · PM                    │   │
│  │  [⏳ Request Pending]                  (gray)     │   │
│  ├─────────────────────────────────────────────────┤   │
│  │  👤 Sarah Johnson · 26 · NYC · Designer          │   │
│  │  [❌ Declined]                        (disabled)  │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  🏠 My Rooms (1)                                        │
│  ┌─────────────────────────────────────────────────┐   │
│  │  Room #3 · Partner: Lisa Chen                    │   │
│  │  Status: Confirmed ✅                             │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 5.4 Payment Gate (Zoom-call events)

```
┌─────────────────────────────────────────────────────────┐
│  🎥 Payment Required                                    │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  To participate in "Sunday Zoom Meetup", a $5.00        │
│  participation fee is required.                         │
│                                                         │
│  This covers:                                           │
│  ✓ Access to your match list                            │
│  ✓ Ability to send/receive room requests                │
│  ✓ 1:1 virtual room access on event day                 │
│                                                         │
│  Amount: $5.00                                          │
│                                                         │
│  ┌─────────────────────────────────────┐               │
│  │     [PayPal Checkout Button]         │               │
│  └─────────────────────────────────────┘               │
│                                                         │
│  [← Back to Dashboard]                                  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 5.5 Event-Day Lockdown State

When `now >= event_start_time`:
- All "Request 1:1 Room" buttons disabled
- Banner: "🔒 Event is in progress. Room requests are locked."
- Existing rooms remain visible
- Incoming pending requests auto-expire

### 5.6 CSS Requirements (Theme-Aware)

All styles must use CSS variables from `themes.css`:

```css
/* Example */
.virtual-meet-card {
  background: var(--card-background);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  color: var(--text-color);
}

.vm-match-item:hover {
  background: var(--hover-background);
}

.vm-payment-banner {
  background: linear-gradient(135deg, var(--primary-color) 0%, var(--secondary-color) 100%);
  color: white;
}

.vm-status-accepted { color: var(--success-color); }
.vm-status-declined { color: var(--danger-color); }
.vm-status-pending  { color: var(--warning-color); }
.vm-locked-banner   { background: var(--warning-color); }
```

**NO hardcoded colors. NO inline styles.**

---

## 6. Integration Points

### 6.1 Existing Systems Reused

| System | How Used | Files |
|--------|----------|-------|
| **Poll System** | Source of RSVP data, event details, active status | `poll_service.py`, `poll_models.py` |
| **PayPal Service** | Payment processing for Zoom-call events | `services/paypal_service.py` |
| **PayPal Routes** | Frontend SDK init (`/api/paypal/client-id`) | `routers/paypal_payments.py` |
| **Payments Collection** | Store payment records | `db.payments` |
| **User Profiles** | Gender, name, age, location, profession | `db.users` |
| **Notification Queue** | Send notifications for requests/responses | `notification_queue` collection |
| **WebSocket** | Real-time updates for requests | `socketService.js` |
| **Auth System** | JWT auth + role checking | `auth/jwt_auth.py` |
| **Sidebar** | New menu item | `Sidebar.js` |

### 6.2 New Poll Field: `event_type`

Add to poll models:

```python
# In poll_models.py
class EventType(str, Enum):
    IN_PERSON = "in-person"
    VIRTUAL = "virtual"
    ZOOM_CALL = "zoom-call"
    HYBRID = "hybrid"

# Add to PollCreate, PollUpdate, Poll:
event_type: Optional[EventType] = None
```

This field determines whether payment is required.

### 6.3 Session Generation Trigger

When a poll becomes active OR when a user RSVPs "Yes":
1. Check if `virtual_meet_session` exists for this poll+user
2. If not, create one with:
   - `gender` from user profile
   - `payment_status`: `"not_required"` if event_type != zoom-call OR user is admin/mod
   - `payment_status`: `"pending"` if zoom-call + regular user
   - `access_unlocked`: accordingly

This can happen:
- **Eagerly:** When poll status changes to "active" → bulk create for all YES respondents
- **Lazily:** When user navigates to Virtual Meets → create on first access

**Recommendation:** Lazy creation (simpler, handles late RSVPs).

---

## 7. Security & Access Control

### 7.1 Authorization Matrix

| Action | Regular User (Paid) | Regular User (Unpaid) | Admin | Moderator |
|--------|--------------------|-----------------------|-------|-----------|
| View events list | ✅ | ✅ | ✅ | ✅ |
| View match list (non-zoom) | ✅ | ✅ | ✅ | ✅ |
| View match list (zoom-call) | ✅ | ❌ (payment gate) | ✅ | ✅ |
| Send room request | ✅ | ❌ | ✅ | ✅ |
| Respond to request | ✅ | ❌ | ✅ | ✅ |
| View rooms | ✅ | ❌ | ✅ | ✅ |
| Admin overview | ❌ | ❌ | ✅ | ❌ |

### 7.2 Validation Rules

1. **Gender check:** Room requests only between opposite genders
2. **RSVP check:** Both users must have RSVPed "Yes" to the same poll
3. **Payment check:** For zoom-call events, non-exempt users must have paid
4. **Lockdown check:** No new requests after event start time
5. **Duplicate check:** Cannot send request to same user twice per poll
6. **Self-request check:** Cannot request yourself

### 7.3 Data Privacy

- Profile data returned in match list is limited to: name, age, location, profession, profile pic
- No PII (email, phone) exposed through match list
- Contact details only shared if users have existing PII access grants

---

## 8. Notification Integration

### 8.1 Notification Events

| Event | Recipient | Channel | Template |
|-------|-----------|---------|----------|
| Room request received | Target user | In-app + Email | `virtual_meet_request` |
| Room request accepted | Requester | In-app + Email | `virtual_meet_accepted` |
| Room request declined | Requester | In-app only | `virtual_meet_declined` |
| Payment confirmed | Payer | In-app + Email | `virtual_meet_payment` |
| Event lockdown | All participants | In-app | `virtual_meet_locked` |

### 8.2 WebSocket Events

```javascript
// New socket events
'virtual_meet:request_received'  → { poll_id, from_username, from_name }
'virtual_meet:request_accepted'  → { poll_id, by_username, room_number }
'virtual_meet:request_declined'  → { poll_id, by_username }
'virtual_meet:event_locked'      → { poll_id }
```

---

## 9. Implementation Plan (Phased)

### Phase 1: Core Backend (Estimated: 3-4 days)
1. Add `event_type` field to poll models + service + frontend forms
2. Create `virtual_meet_models.py` with all Pydantic models
3. Create `virtual_meet_service.py` with core business logic
4. Create `routers/virtual_meets.py` with all API endpoints
5. Create MongoDB indexes

### Phase 2: Frontend — Events List + Payment Gate (Estimated: 2-3 days)
1. Add sidebar menu item (Sidebar.js)
2. Add route in App.js
3. Build `VirtualMeets.js` — events list view
4. Build `VirtualMeetPayment.js` — PayPal payment gate
5. Theme-aware CSS

### Phase 3: Frontend — Match List + Room Flow (Estimated: 3-4 days)
1. Match list view with profile cards
2. Request/Accept/Decline UI with toast notifications
3. "My Rooms" section
4. WebSocket integration for real-time updates
5. Event lockdown UI state

### Phase 4: Admin View + Polish (Estimated: 1-2 days)
1. Admin overview panel (participant counts, room stats)
2. Add "Event Type" selector to PollManagement.js create/edit forms
3. Notification templates
4. Testing

### Phase 5: Testing (Estimated: 2 days)
1. Backend unit tests (`tests/test_virtual_meets.py`)
2. Frontend component tests (`VirtualMeets.test.js`)
3. Integration tests (full flow: RSVP → Pay → Match → Request → Accept → Room)
4. Edge cases: lockdown timing, payment failures, duplicate requests

**Total Estimated Effort: 11-15 days**

---

## 10. Open Questions

| # | Question | Options | Decision |
|---|----------|---------|----------|
| 1 | Should the match list show L3V3L compatibility scores? | Yes (richer) / No (simpler) | **NO** — Keep it simple, no scores |
| 2 | Should there be a limit on room requests per user per event? | Unlimited / Max 3-5 | **UNLIMITED** — No cap on requests |
| 3 | Should admin be able to set custom payment amounts per event? | Yes / No (always $5) | **YES** — Admin sets amount per event (default $5) |
| 4 | Should rooms auto-expire if not used on event day? | Yes / No | **YES** — Auto-expire unused rooms |
| 5 | What happens if a user changes their RSVP from Yes to No? | Cancel all requests / Keep them | **CANCEL ALL** — Cancel all pending/confirmed requests |
| 6 | Should there be a chat feature within virtual rooms? | Yes (Phase 2) / No | **NO** — No in-room chat |
| 7 | Should payment support Clover in addition to PayPal? | Yes / PayPal only | **YES** — Support both PayPal + Clover |
| 8 | Should admin be able to manually pair users? | Yes / No | **YES** — Admin can force-pair users |
| 9 | How to handle gender: only M/F or also non-binary? | Strict M/F / Flexible | **STRICT M/F** — Male/Female only |
| 10 | Should users see who requested them before accepting? | Full profile / Name only | **FULL PROFILE** — Show name, age, location, profession, photo |

---

## 11. Files to Create / Modify

### New Files
| File | Purpose |
|------|---------|
| `fastapi_backend/models/virtual_meet_models.py` | Pydantic models |
| `fastapi_backend/services/virtual_meet_service.py` | Business logic |
| `fastapi_backend/routers/virtual_meets.py` | API endpoints |
| `frontend/src/components/VirtualMeets.js` | Main page |
| `frontend/src/components/VirtualMeets.css` | Theme-aware styles |
| `frontend/src/components/VirtualMeetPayment.js` | Payment gate |
| `fastapi_backend/tests/test_virtual_meets.py` | Backend tests |

### Modified Files
| File | Change |
|------|--------|
| `fastapi_backend/models/poll_models.py` | Add `event_type` field |
| `fastapi_backend/services/poll_service.py` | Store `event_type` |
| `fastapi_backend/main.py` | Register virtual_meets router |
| `frontend/src/App.js` | Add `/virtual-meets` route |
| `frontend/src/components/Sidebar.js` | Add menu item |
| `frontend/src/components/PollManagement.js` | Add event_type selector |
| `frontend/src/components/PollWidget.js` | Link to Virtual Meets |

---

## 12. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Gender data missing/incorrect in user profiles | Medium | High | Validate on session creation, skip users without gender |
| PayPal service unavailable | Low | Medium | Show error toast, allow retry, don't block non-zoom events |
| Race condition on room request acceptance | Low | Medium | Use MongoDB atomic operations (findOneAndUpdate) |
| Event lockdown timing edge cases (timezone issues) | Medium | Medium | Reuse existing poll timezone logic (already fixed) |
| User gaming system (multiple accounts) | Low | Low | Existing account verification system mitigates |

---

## 13. Approval

- [ ] Product Owner review
- [ ] Technical review
- [ ] Security review
- [ ] UX review

**Once approved, implementation begins with Phase 1.**
