# CLAUDE.md — ProfileData Project Context

> One-page context for AI assistants (Claude Code, Cascade, etc.) working on this repo.  
> Read this **before** writing any code.

**Last updated:** May 22, 2026  
**Repo:** `rajsir217-oss/profiledata`  
**Stack:** FastAPI (Python 3.12) + Motor + MongoDB + React + JWT auth

---

## 1. Critical mandatory rules

These are non-negotiable. Violations break production or get reverted.

### 1.1 No hardcoded localhost / ports / URLs (anywhere — Python *or* JS)

```python
# ❌ NEVER
url = "http://localhost:8000"
db = "mongodb://localhost:27017"

# ✅ ALWAYS
from config import Settings
settings = Settings()
url = settings.backend_url
```

```javascript
// ❌ NEVER
const API_URL = 'http://localhost:8000';

// ✅ ALWAYS
import { getBackendUrl } from './config/apiConfig';
const API_URL = getBackendUrl();
```

For GCloud deployment, always check `apiConfig.js` and set env vars (`backend_url`, `frontend_url`) properly. Always read `fastapi_backend/.env` first to discover env-var conventions.

### 1.2 Single auth system — JWT only

```python
# ✅ CORRECT — use everywhere
from auth.jwt_auth import get_current_user_dependency as get_current_user

@router.get("/endpoint")
async def endpoint(
    current_user: dict = Depends(get_current_user),  # returns dict
):
    username = current_user["username"]  # dict access
```

**❌ Never use:** `from auth import get_current_user` (legacy auth — deprecated)

### 1.3 No browser modals

```javascript
// ❌ NEVER
alert(); confirm(); prompt();

// ✅ ALWAYS
<Toast message="Saved!" type="success" />     // for feedback
// Custom modals with proper styling           // for confirmations
// 2-click delete pattern (DeleteButton)       // for destructive ops
```

### 1.4 No hardcoded styles or colors

```css
/* ✅ ALWAYS use CSS variables */
background: var(--primary-color);
color: var(--text-color);
padding: var(--spacing-md);
border-radius: var(--radius-md);
```

- Inline `style={{...}}` is being phased out (286 instances across 36 files — refactor as you touch them).
- Available themes: Cozy Light (default), Dark, Rose, Light Gray, Ultra Light Gray.

### 1.5 No `console.log` in production code

```javascript
// ❌ NEVER (259 occurrences exist — replace as you touch them)
console.log('Debug info:', data);

// ✅ ALWAYS
import logger from './utils/logger';
logger.debug('Debug info:', data);   // dev only
logger.info('User action:', action); // production-safe
logger.error('Error:', err);         // always logged
```

### 1.6 Never delete files immediately

```bash
# When replacing a file, rename the old one first:
mv OldComponent.js OldComponent.js.toberemoved
# Then create the new file. User will review .toberemoved files later.
```

### 1.7 Database field naming gotcha

DB stores PII in encrypted form under different field names than the React form:

```python
email = user.get("email") or user.get("contactEmail")
phone = user.get("phone") or user.get("contactNumber")
```

Always check both. PII fields are encrypted with `crypto_utils.PIIEncryption` — call `encryptor.decrypt_user_pii(user)` before reading.

---

## 2. Architecture map

### 2.1 Tech stack

| Layer | Tech |
|---|---|
| Backend | FastAPI + Python 3.12 |
| DB driver | Motor (async MongoDB) |
| DB | MongoDB (`matrimonialDB`) |
| Auth | JWT (HS256, 30 min expiry) |
| Frontend | React + React Router |
| Notifications | In-house queue/log/template system (operational) |
| Scheduler | Custom dynamic-job scheduler with job_templates |

### 2.2 Backend directory map

```
fastapi_backend/
├── auth/
│   ├── jwt_auth.py            ← PRIMARY AUTH (use this)
│   └── legacy_auth.py         ← DEPRECATED (do not use)
├── models/                     ← Pydantic models
├── services/                   ← Business logic
│   ├── messenger_service.py    ← Conversations + messages
│   ├── notification_service.py ← Notification queue
│   └── event_dispatcher.py     ← Cross-feature side effects
├── routers/                    ← Auxiliary route modules
│   ├── notifications.py
│   ├── verification.py         ← Email verification
│   ├── notes.py                ← Profile notes (90-day TTL)
│   └── activity_logs.py
├── job_templates/              ← Scheduler job classes
│   ├── email_notifier_template.py
│   ├── sms_notifier_template.py
│   └── saved_search_matches_notifier.py
├── migrations/                 ← DB migrations
├── routes.py                   ← Main routes (large file)
├── config.py                   ← Settings (USE FOR ALL CONFIG)
└── main.py                     ← Entry point
```

### 2.3 Frontend directory map

```
frontend/src/
├── components/                 ← React components
├── config/apiConfig.js         ← API URL config (USE THIS)
├── themes/themes.css           ← Theme variables
├── utils/logger.js             ← Logging utility
└── api.js                      ← Axios setup
```

### 2.4 API route prefixes

| Prefix | File |
|---|---|
| `/api/users/*` | `routes.py` |
| `/api/auth/*` | `auth_routes.py` |
| `/api/notifications/*` | `routers/notifications.py` |
| `/api/verification/*` | `routers/verification.py` |
| `/api/notes/*` | `routers/notes.py` |
| `/api/scheduler/*` | `routes_dynamic_scheduler.py` |
| `/api/activity-logs/*` | `routers/activity_logs.py` |

---

## 3. Key collections (MongoDB)

| Collection | What it stores |
|---|---|
| `users` | All user profiles (PII fields encrypted) |
| `messages` | Legacy 1:1 messages (used in many flows) |
| `messenger_conversations` | New conversation index for messenger UI |
| `messenger_messages` | New message store for messenger UI |
| `favorites` | `userUsername`/`favoriteUsername` pairs |
| `shortlists` | `userUsername`/`shortlistedUsername` pairs |
| `exclusions` | `userUsername`/`excludedUsername` pairs (with full relationship cleanup on add) |
| `profile_views` | View tracking with `viewCount`/`firstViewedAt`/`lastViewedAt` |
| `profile_notes` | Private user notes about profiles (90-day auto-purge) |
| `saved_searches` | User-saved search criteria + notification config |
| `pii_requests` | Contact-info request flow |
| `pii_access` | Granted contact-info visibility |
| `notification_queue` | Notifications waiting to send |
| `notification_log` | Sent/failed notifications |
| `notification_templates` | Email/SMS templates |
| `reconnect_requests` | "Please unblock me" requests |
| `blocked_message_attempts` | Excluded user's failed message attempts |
| `system_settings` | Admin toggles |

---

## 4. Notification system (fully operational, October 2025)

### Critical patterns

```python
# ✅ Use notification.id, NOT notification.dict().get("_id")
# Pydantic field-alias bug: dict() returns None for _id
notif_id = notification.id  # CORRECT

# ✅ MongoDB update with $set + $inc must be a single doc
update_doc = {
    "$set": {"status": "sent", "updatedAt": datetime.utcnow()},
    "$inc": {"attempts": 1}
}
```

### Status mapping (frontend)

```javascript
const statusMap = {
  'pending': 'queued',
  'sent':    'sent',
  'failed':  'failed'
};
```

### Architecture

- **Queue:** `notification_queue` (pending notifications)
- **Log:** `notification_log` (sent + failed history)
- **Templates:** `notification_templates`
- **Job templates:** `email_notifier_template.py`, `sms_notifier_template.py`
- **UI:** Event Queue Manager (admin-only)

---

## 5. Scheduler

- Only **dynamic** jobs (DB-driven, configurable from UI). No hardcoded cron.
- Job classes live in `fastapi_backend/job_templates/`.
- Each template has `validate_params()`, `get_schema()`, `execute()`.
- **Saved-search matches notifier** (`saved_search_matches_notifier.py`) runs daily/weekly per saved search and emails users when new matches join.

---

## 6. Active design work — Dashboard Mockup A

**Status:** Mockup finalized, ready for implementation.  
**Mockup file:** `docs/dashboard-mockups/A-action-first.html`  
**Memory ID:** `98ed1f05-a66d-4ba8-8212-256b0c3e30d1`

### 6.1 Hypothesis

Users open the dashboard intending to *do* something — search, reply, approve a request. Optimize for action-completion, not stat-browsing.

### 6.2 Hero pattern (decided)

- **No search bar** in the dashboard hero — search lives at `/search` only.
- Hero shows a single profile card: **"newest match in [saved search name]"**.
- Logic: top-1 of user's default saved search, sorted by `joinedAt`/`createdAt` desc.
- Inline actions: View profile / Favorite / Send message / Skip (show next newest).

### 6.3 Fallback chain (decided)

When the current saved search has no new joiners since user's last view:

1. Try next-most-recent saved search (by `lastRunAt` / `createdAt` desc).
2. Continue down the list.
3. Only if **all** saved searches are exhausted → empty state.

The hero subtitle dynamically reflects which saved search produced the current pick.

### 6.4 Implementation: zero new backend endpoints

The existing `/search` endpoint (`routes.py:5084`) already supports:

```
GET /api/search
  ?<all the filter criteria>
  &sortBy=newest
  &sortOrder=desc
  &page=N
  &limit=1
```

This is exactly what the hero needs.

```
1. GET /api/{username}/saved-searches
   → list all saved searches, identify isDefault:true,
     sort the rest by createdAt desc
2. For each saved search in order:
     GET /api/search?<criteria>&sortBy=newest&sortOrder=desc&limit=1&page=1
     if results.length > 0 → render hero
     else → continue
3. If all empty → empty state

Skip → call same endpoint with page=2, 3, ...
```

### 6.5 Endpoint mapping (all features → existing APIs)

| Mockup A piece | Endpoint |
|---|---|
| Hero newest-match | `GET /api/search` (`routes.py:5084`) |
| Saved searches list | `GET /api/{username}/saved-searches` (`routes.py:5845`) |
| Chip "new" counts | `GET /api/search?daysBack=N&limit=1` per search |
| Action: Contact requests | Existing PII requests endpoint |
| Action: Reply to messages | `messenger_service.get_conversations()` |
| Action: Favorited you | `GET /api/their-favorites/{username}` (`routes.py:9495`) |
| Action: Who viewed you | `GET /api/views/{username}` (`routes.py:9433`) |
| Action: Run saved search | `GET /api/search` (existing) |
| Action: Follow up on chats | Derive client-side from conversations list. Verify `lastMessageBy` field is in response — if missing, 5-line addition to `messenger_service.get_conversations()`, NOT a new endpoint. |
| Stat tile: Profile views | `GET /api/views/{username}` (count) |
| Stat tile: Conversations | `messenger_service.get_conversations()` (total) |
| Stat tile: My favorites | Existing favorites endpoint |
| Stat tile: Saved searches | `GET /api/{username}/saved-searches` (count) |
| Stat tile: Short lists | `GET /api/shortlist/{username}` (`routes.py:6713`) |
| Stat tile: My notes | `GET /api/notes` (`routers/notes.py`) |
| Stat tile: Exclusions | `GET /api/exclusions/{username}` (`routes.py:7317`) |
| Recent conversations | `messenger_service.get_conversations()` |
| Notification drawer | Existing notification system |

### 6.6 Active polls widget (side rail) — uses **existing** polls infrastructure

The "Active polls" side-rail card wires to the existing polls feature. **Zero new backend work.**

**Existing infrastructure (do not duplicate):**

| Piece | Where it lives |
|---|---|
| Backend router | `fastapi_backend/routers/polls.py` |
| Backend service | `fastapi_backend/services/poll_service.py` |
| Backend models | `fastapi_backend/models/poll_models.py` (`PollType`: rsvp/single_choice/multiple_choice/open_text; `PollStatus`: draft/active/closed/archived; `EventType`: in-person/virtual/zoom-call/hybrid) |
| Collections | `polls`, `poll_responses` |
| Existing widget | `frontend/src/components/PollWidget.js` — already supports inline + modal modes, prev/next navigation, countdown timers, auto-popup, paid Virtual-Meet RSVP flow via PayPal/Clover |
| Admin UI | `frontend/src/components/PollManagement.js` and `AnnouncementManagement.js` (Polls tab at `/announcement-management`) |

**API endpoints (existing — use as-is):**
- `GET /api/polls/active` → returns active polls with per-user `user_has_responded` flag and full `user_response` object
- `GET /api/polls/{poll_id}` → single poll detail
- `POST /api/polls/{poll_id}/respond` → submit response
- `PUT /api/polls/{poll_id}/respond` → update response
- `POST /api/polls/{poll_id}/pay-and-respond` → paid RSVP for Virtual Meets

**UX pattern in dashboardv2:**
- Header: `📣 Active polls` with a count badge (total active polls)
- One poll visible at a time (no accordions)
- Footer navigator: `◀ Poll N of M ▶` with prev/next buttons (already implemented in `PollWidget` modal mode)
- Voting auto-advances to next unanswered poll
- Per-poll meta line shows `Time remaining: Xd Xh Xm` countdown (already implemented)

**Implementation:** thin side-rail wrapper around existing `PollWidget`, OR a new compact `ActivePollsCard.jsx` that calls `/api/polls/active` directly with side-rail styling. **Do not duplicate poll state/voting/payment logic — those are already correct in `PollWidget.js`.**

### 6.7 Open product calls (decide before Phase 3 rollout)

1. **L3V3L score visibility on hero** — currently shown as `💎 92% match`. If L3V3L is premium-gated on `/search`, exposing it free on the hero is inconsistent.
2. **"Who viewed you" identity** — currently `/api/views/{username}` returns viewer profiles to anyone. Many platforms gate viewer identity behind premium for both privacy and revenue.
3. **Cold-start UX** — for users with < 3 saved searches, derive defaults from their profile preferences (mirror `/search` bootstrap logic)?

### 6.8 Recommended rollout

| Phase | What | Risk |
|---|---|---|
| 1 | Stat tiles + action cards 1-5 + recent conversations + notification drawer + side rail. Keep existing search bar in hero temporarily. | 🟢 Low |
| 2 | "Follow up on chats" + saved-search new-counts + (optional) `/api/dashboard/summary` aggregator | 🟡 Medium |
| 3 | Newest-match hero + remove search bar. Feature-flag → 5% → 25% → 100% with engagement metrics. Kill-switch to revert search bar. | 🔴 Behavioral bet |

---

## 7. Common commands

```bash
# Backend
cd fastapi_backend && python main.py

# Frontend
cd frontend && npm start

# Restore prod backup to local (workflow exists)
# /restore-to-dev
```

---

## 8. Bug-fixing discipline

- **Root cause first.** Read upstream code before patching downstream symptoms.
- **Minimal fixes preferred** — single-line over multi-line when sufficient.
- **Tests before major impl.** Never delete or weaken tests without explicit approval.
- **Specialized codebases:** verify the bug location carefully — easy to fix in the wrong place.

---

## 9. Code-style guardrails (when in doubt)

- Don't add or remove comments unless asked.
- Imports always at the top of the file.
- Edits scoped and focused — large refactors require explicit user approval.
- Prefer `multi_edit` for several small changes to one file over many `edit` calls.

---

## 10. Quick reference — when working on...

| Task | Read first |
|---|---|
| Auth-related changes | `fastapi_backend/auth/jwt_auth.py` |
| Notification flows | `fastapi_backend/services/notification_service.py`, `routers/notifications.py` |
| Scheduler jobs | `fastapi_backend/job_templates/` and the dynamic-scheduler routes |
| Saved searches / search | `fastapi_backend/routes.py:5084` (search) and `:5845` (saved searches) |
| Dashboard work | `docs/dashboard-mockups/A-action-first.html` + section 6 above |
| Messenger / conversations | `fastapi_backend/services/messenger_service.py` |
| PII encryption | `fastapi_backend/crypto_utils.py` |

---

*This file is the source of truth for high-level project context. Update it when major architectural decisions are made — don't let it drift.*
