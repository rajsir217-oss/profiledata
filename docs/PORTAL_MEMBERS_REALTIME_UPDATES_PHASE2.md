# Portal Members Real-Time Updates — Phase 2

## Scope

Phase 2 adds client and API resilience so Portal Members updates continue to appear during transient socket issues and immediately catch up after reconnect.

Implemented in this phase:
1. Message delta fetch with `after` cursor on messenger messages API.
2. Frontend reconnect catch-up using last known message id.
3. Frontend temporary polling fallback while socket is disconnected (Portal Members only).

---

## Design

## A) API delta fetch (`after`)

`GET /api/messenger/conversations/{conversationId}/messages`

New query behavior:
- `after=<messageId>` returns messages newer than the given message id.
- Sorted oldest → newest for append-friendly client merges.
- Uses existing payload shape (`messages`, `hasMore`, `cursor`).
- Portal first-page cache remains only for first-page reads (no `before`/`after`).

## B) Reconnect catch-up

When socket status transitions from disconnected → connected in Portal Members chat:
- Read latest local message id from store.
- If present, call delta API via `fetchMessagesAfter(conversationId, afterId)`.
- If not present, fetch first page as bootstrap.

## C) Disconnected fallback polling

When socket is disconnected and Portal Members chat is active:
- Start a short polling loop (12s interval).
- Poll with `after` when local messages exist; otherwise fetch first page.
- Stop polling automatically once socket reconnects or chat changes.

---

## Files Changed

- `fastapi_backend/services/messenger_service.py`
  - Added `after` cursor handling in `get_messages(...)`.
  - Added ascending sort for `after` mode.
  - Kept reverse only for `before`/initial mode.
  - Kept first-page cache disabled when `after` is used.

- `fastapi_backend/routers/messenger.py`
  - Added `after` query parameter to `list_messages` endpoint.
  - Passed `after` into service call.
  - Included `after` in debug timing logs.

- `messenger/src/stores/messengerStore.js`
  - Added `fetchMessagesAfter(conversationId, after)`.
  - Merge-append with de-dup by message id.
  - Returns `fetched` count for visibility.

- `messenger-web/src/screens/ChatScreen.js`
  - Added reconnect catch-up effect for Portal Members.
  - Added disconnected polling fallback effect for Portal Members.

---

## Validation

Recommended checks:
1. Keep Portal Members open; disable network briefly; re-enable.
2. Activate a profile while disconnected.
3. Confirm message appears after reconnect without manual refresh.
4. Keep chat open disconnected; confirm polling picks up new activation cards.
5. Confirm no duplicate messages after repeated reconnect cycles.
