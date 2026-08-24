---
description: Optimize the messenger-web Portal Members load path.
---

# Skill: Portal Members Performance Optimization

## Phase 1: Decouple and fast-path

### Frontend

In `messenger-web/src/screens/ConversationListScreen.js`:

- Fetch `/api/messenger/portal-members-group` independently on mount.
- Do not block it behind `loadAllConversations`.

### Backend

1. **Message list fast path**
   - `GET /api/messenger/conversations/{conversation_id}/messages` accepts `includeTotal` (default `false`).
   - `fastapi_backend/services/messenger_service.py:get_messages` skips `count_documents` unless `include_total=True`.
   - Returns `total` as `null` when omitted.

2. **Portal Members group retrieval**
   - Use projection-based reads.
   - Backfill `participantsCount` via aggregation when missing.
   - Use atomic `$inc` when auto-adding a participant.
   - Persist initial `participantsCount` on new group creation.

## Phase 2: Caching and instrumentation

### Debug timing

Add stage metrics under `debugTimings` gated by `settings.debug_mode` in both the service and router.

### Lazy public participant enrichment

In `get_messages`, only look up public participants when a page contains `publicEmailsSent`.

### Redis first-page cache

Targeted cache for Portal Members:
- Eligibility: `groupName == "Portal Members"`, no `before` cursor, `includeTotal == false`.
- Key: `portal_first_page_messages:{conversationId}:{username}:{limit}`
- TTL: 20 seconds

### Cache invalidation

- Invalidate on `send_message` router.
- Invalidate on `delete_message` service.

## Benchmarking

Use `fastapi_backend/scripts/portal_messages_benchmark.py`:

```bash
python3 fastapi_backend/scripts/portal_messages_benchmark.py
```

Supports local auto-token and remote token modes. Outputs average, p50, and p95 timings plus fast-vs-total delta.

## Documentation

Update `docs/PORTAL_MEMBERS_SLOW_LOAD_PHASE1.md` with each phase's implementation and validation notes.

## Verification

- Python compile check.
- Node syntax check for `messenger-web` changes.
- Benchmark before/after on representative data.
