# Portal Members Slow-Load Review — Phase 1

## Scope

This document captures the deep-review findings for slow message load in the **Portal Members** topic (messenger-web) and the **Phase 1** implementation.

Phase 1 includes:
1. Frontend decoupled Portal Members bootstrap
2. Backend fast path for message fetch (`includeTotal=false` default)
3. Backend Portal Members lookup optimization with `participantsCount`

---

## Root Cause Summary

### 1) Frontend startup coupling delayed first Portal open
`ConversationListScreen` was loading Portal Members together with unrelated conversation/sidebar work (`Promise.allSettled` with legacy conversation + enrichment). This delayed auto-selection and initial chat render.

### 2) Message API always counted total before returning first page
`GET /api/messenger/conversations/{id}/messages` always performed `count_documents` in `get_messages()`, even when the UI only needed the first page and `hasMore`.

### 3) Portal group lookup fetched heavier doc shape than needed
`/api/messenger/portal-members-group` used a broad `find_one` and derived count from in-memory participants array (`len(participants)`), which is avoidable for large groups.

---

## Implemented Changes (Phase 1)

## A) Frontend: decouple Portal Members bootstrap

### File
- `messenger-web/src/screens/ConversationListScreen.js`

### Changes
- Portal group fetch is now kicked off independently on mount via `loadPortalMembersGroup()`.
- `loadAllConversations()` no longer waits on `/api/messenger/portal-members-group`.
- Existing auto-select logic remains intact and now receives Portal group state earlier.

### Why it helps
Portal chat can open as soon as its own lightweight group call returns, instead of waiting for legacy conversation loading + enrichment.

---

## B) Backend: add fast message-list path without total count

### Files
- `fastapi_backend/routers/messenger.py`
- `fastapi_backend/services/messenger_service.py`

### Changes
- Added query param on message list endpoint:
  - `includeTotal` (bool), default `false`
- Routed value to service:
  - `get_messages(..., include_total=False)`
- In service, `count_documents` now runs **only** when `include_total=True`.
- Existing paging behavior (`limit + 1` and `hasMore`) remains unchanged.

### Why it helps
For large conversations, `count_documents` is often the most expensive part of initial load. Skipping it by default reduces first-page latency.

---

## C) Backend: optimize Portal Members read path

### File
- `fastapi_backend/routers/messenger.py`

### Changes
- `/portal-members-group` existing-group lookup now uses projection (only needed fields).
- Introduced/standardized `participantsCount` usage for summary payload.
- On membership auto-add (`_ensure_portal_member`), now increments `participantsCount` atomically (`$inc`).
- If an older conversation document lacks `participantsCount`, endpoint backfills it using aggregation `$size` and persists it.
- On new Portal group creation, persists initial `participantsCount` once.

### Why it helps
Avoids pulling large participant arrays during routine reads and reduces per-request compute/serialization cost.

---

## Validation Performed

- Python syntax validation:
  - `python3 -m py_compile fastapi_backend/routers/messenger.py fastapi_backend/services/messenger_service.py`
- JS syntax validation:
  - `node --check messenger-web/src/screens/ConversationListScreen.js`

Both passed.

---

## Expected Impact

- Faster time-to-open for default Portal Members topic on app entry.
- Lower backend latency for first page of messages in large conversations.
- Lower read overhead for Portal group metadata endpoint.

---

## Quick Latency Measurement (Local)

### Method

- Environment: local backend (`BACKEND_URL=http://localhost:8000`) and local MongoDB.
- Target conversation: `Portal Members`.
- Auth: JWT generated with local security config key for an existing participant.
- Runs: 12 sequential requests per endpoint variant after a brief warm-up.

### Results

- `GET /api/messenger/conversations/{id}/messages?limit=50&includeTotal=false`
  - status: `200`
  - avg: `6.3 ms`
  - p50: `6.2 ms`
  - p95: `7.5 ms`

- `GET /api/messenger/conversations/{id}/messages?limit=50&includeTotal=true`
  - status: `200`
  - avg: `8.1 ms`
  - p50: `7.8 ms`
  - p95: `9.2 ms`

- `GET /api/messenger/portal-members-group`
  - status: `200`
  - avg: `6.4 ms`
  - p50: `6.4 ms`
  - p95: `7.1 ms`

### Signal

- Message-list p50 is about **20.6% faster** with `includeTotal=false` vs `includeTotal=true` on this local dataset.
- This directly validates the Phase 1 fast path decision to skip `count_documents` by default for initial message loads.

### Notes

- These are local measurements and primarily useful as a directional check.
- For production confidence, capture p50/p95 in staging/prod with representative data volume and concurrent traffic.

---

## Phase 2 Implementation (Completed)

### 1) Debug-only server timing instrumentation

- Added stage-level timing collection to message list flow.
- Instrumented stages include:
  - `participant_lookup_ms`, `count_ms`, `fetch_ms`, `retention_filter_ms`, `public_participants_lookup_ms`, `enrichment_ms`, `total_ms`
  - Router stages: `router_serialize_ms`, `router_total_ms`
- Enabled only when `settings.debug_mode` is true.
- Debug timings are returned as `debugTimings` in API response only in debug mode.

### 2) Conditional enrichment work

- Public participant enrichment is now lazy:
  - `publicParticipants` data is fetched only if the returned page contains messages with `publicEmailsSent`.
- This avoids unnecessary conversation lookups and enrichment mapping on standard message pages.

### 3) Targeted first-page cache for Portal Members

- Added Redis cache fast path for first-page Portal Members message loads:
  - Eligibility: group is `Portal Members`, `before` is absent, `includeTotal=false`
  - Cache key shape: `portal_first_page_messages:{conversationId}:{username}:{limit}`
  - TTL: `20s`
- Added invalidation hook:
  - On new message send (router path)
  - On soft delete (service path)

### 4) Repeatable benchmark harness

- Added script: `fastapi_backend/scripts/portal_messages_benchmark.py`
- Supports:
  - Local auto-token mode (reads from `fastapi_backend/.env`)
  - Remote mode via `--backend-url` + `--token`
  - Configurable runs and limit

Example usage:

```bash
python3 fastapi_backend/scripts/portal_messages_benchmark.py --runs 20 --limit 50
python3 fastapi_backend/scripts/portal_messages_benchmark.py --backend-url https://your-api --token "$ACCESS_TOKEN" --conversation-id "<id>"
```

### Validation (latest)

- Python compile check:
  - `python3 -m py_compile fastapi_backend/routers/messenger.py fastapi_backend/services/messenger_service.py fastapi_backend/scripts/portal_messages_benchmark.py`
- Benchmark smoke run:
  - `python3 fastapi_backend/scripts/portal_messages_benchmark.py --runs 4 --limit 50`
  - Output sample:
    - `includeTotal=false` p50: `6.51 ms`
    - `includeTotal=true` p50: `7.19 ms`
    - delta: `9.46%` faster at p50 for fast path

### Post-Phase-2 Baseline (Higher Confidence)

- Command:
  - `python3 fastapi_backend/scripts/portal_messages_benchmark.py --runs 30 --limit 50`
- Output:
  - `messages includeTotal=false`: avg `5.4 ms`, p50 `5.21 ms`, p95 `6.58 ms`
  - `messages includeTotal=true`: avg `7.84 ms`, p50 `7.5 ms`, p95 `9.58 ms`
  - `portal-members-group`: avg `5.52 ms`, p50 `5.42 ms`, p95 `6.15 ms`
  - p50 delta: **`30.53%` faster** when `includeTotal=false`
