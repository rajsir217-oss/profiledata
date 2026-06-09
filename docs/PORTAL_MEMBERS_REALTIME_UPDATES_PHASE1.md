# Portal Members Real-Time Updates — Phase 1

## Scope

This document defines and records **Phase 1** changes to make Portal Members activation cards appear in real time without requiring manual refresh.

Phase 1 is intentionally backend-focused and low risk:
1. Use robust Socket.IO room fanout for activation intro messages.
2. Invalidate Portal Members first-page message cache after activation intro insert.

Out of scope for Phase 1:
- Reconnect delta-sync API
- Frontend fallback polling while socket disconnected
- Event outbox / durable queueing

---

## Problem Summary

When an account is activated, the backend posts a `profile_card` message to the `Portal Members` conversation. In some sessions the new card was visible only after manual refresh.

### Root causes identified

1. Activation fanout used `online_users` SID map from a single process.
   - If clients were connected via a different instance/session mapping, emit could be missed.
2. Activation path did not invalidate Portal first-page cache.
   - REST fetches could return cached first page briefly even after insert.

---

## Existing vs Phase 1 Flow

## Before
1. `_post_activation_intro_to_portal_members` inserts message.
2. Emits `messenger:new_message` only to users found in local `online_users` map.
3. No explicit `invalidate_portal_first_page_cache` call in activation path.

## After (Phase 1)
1. `_post_activation_intro_to_portal_members` inserts message.
2. Emits `messenger:new_message` to:
   - `conversation:{conversationId}` room (active viewers)
   - each `user:{username}` participant room (conversation list/unread updates)
3. Calls `invalidate_portal_first_page_cache(conversationId)`.

---

## Design Details

## A) Room-based fanout for activation intro

Use Socket.IO rooms rather than per-process online map:
- Conversation room handles users actively viewing Portal Members.
- User rooms handle users not currently in the conversation room but online.

This aligns activation fanout with existing messenger room model and works better across multi-instance deployments.

## B) Cache invalidation on activation writes

After activation intro insert and conversation update, invalidate all first-page Portal cache keys for the conversation.

This removes stale first-page windows for refresh/open API calls.

---

## Files in Phase 1

- `fastapi_backend/services/event_dispatcher.py`
  - Replace local `online_users`-gated emit with room fanout emits.
  - Add `messenger_service.invalidate_portal_first_page_cache(...)` call.

---

## Validation Plan

1. Syntax check:
   - `python3 -m py_compile fastapi_backend/services/event_dispatcher.py`
2. Functional smoke check:
   - Keep Portal Members open in one client.
   - Activate profile from admin flow.
   - Confirm activation card appears without refresh.
3. Multi-session check:
   - Keep conversation list open in second client (not inside Portal chat).
   - Confirm latest message preview updates via `user:{username}` room event.

---

## Rollout / Risk

- Change is additive and localized to activation-intro path.
- Message payload shape and event name remain unchanged (`messenger:new_message`).
- If room fanout fails, DB write still succeeds and clients can recover via API fetch.

---

## Next Phase Preview

Phase 2 will add reconnect catch-up (`after=<messageId>`) and optional fallback polling while socket is disconnected, reducing missed-event windows further.
