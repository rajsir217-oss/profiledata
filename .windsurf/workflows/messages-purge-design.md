---
description: Message purge workflow design (implemented behavior)
---

# Message Purge Workflow (Current Implementation)

## Purpose

Document how message cleanup currently works for direct user conversations across backend and frontend paths.

## Implemented Purge Modes

1. **Scheduled purge (24-hour grace period)**
   - Triggered by:
     - `POST /messages/conversation/{other_username}/close`
     - `POST /messages/conversation/{other_username}/acknowledge`
   - Behavior:
     - Sets `messages.scheduledDeleteAt = datetime.utcnow() + 24h` for both chat directions.
     - Returns `messagesScheduled` count in API response.

2. **Immediate purge (no grace period)**
   - Triggered by:
     - `POST /exclusions/{target_username}`
   - Behavior:
     - Immediately hard-deletes all messages between the two users with `delete_many`.

## Storage and Deletion Mechanism

- Collection: `messages`
- Field used for delayed cleanup: `scheduledDeleteAt`
- Auto-delete mechanism: MongoDB TTL index
  - Index name: `ttl_scheduledDeleteAt`
  - Definition: `{"scheduledDeleteAt": 1}` with `expireAfterSeconds=0`
  - Effect: messages are deleted automatically after `scheduledDeleteAt` passes.

## Frontend Trigger Flows

### Flow A: Close Conversation only (24-hour grace)
1. User closes conversation.
2. Frontend calls `handleCloseConversation(username)`.
3. Backend `/messages/conversation/{username}/close` sets `scheduledDeleteAt`.
4. Messages remain visible until TTL removal.

### Flow B: Stay in Touch / Acknowledge (24-hour grace)
1. User acknowledges conversation.
2. Frontend calls `/messages/conversation/{username}/acknowledge`.
3. Backend sets `scheduledDeleteAt`.
4. Messages remain visible until TTL removal.

### Flow C: Not Interested + Exclusion (immediate delete)
1. Frontend sends decline message.
2. Frontend closes conversation.
3. Frontend adds target to exclusions.
4. Exclusions endpoint immediately deletes conversation messages.

## Important Implementation Note

Even though close/acknowledge now use a 24-hour grace period, current **Not Interested** flows still call `/exclusions/{username}` after close. That exclusions call performs immediate deletion and overrides the grace behavior for that path.

## Backend Files Involved

- `fastapi_backend/main.py`
  - Creates TTL index on `messages.scheduledDeleteAt`.
- `fastapi_backend/routes.py`
  - `close_conversation` schedules deletion (+24h).
  - `acknowledge_conversation` schedules deletion (+24h).
  - `add_to_exclusions` immediately deletes messages.

## Frontend Files Involved

- `frontend/src/components/Messages.js`
  - `handleCloseConversation`
  - `handleQuickResponse` (`not_interested` path calls exclusions)
- `frontend/src/components/ChatWindow.js`
  - `handleNotInterested` (close + exclusions)

## Verification Checklist

1. Confirm TTL index exists:
   - `db.messages.getIndexes()`
   - Check for `ttl_scheduledDeleteAt` with `expireAfterSeconds: 0`.
2. Close a conversation without exclusion:
   - Verify messages have `scheduledDeleteAt` ~24h ahead.
   - Verify messages still visible before TTL expiry.
3. Trigger exclusion:
   - Verify messages are deleted immediately.
4. Confirm API responses:
   - `close` and `acknowledge` return `messagesScheduled`.

## Optional Next Design Step (If Needed)

If product requirement is "Not Interested should also keep messages for 24 hours", then exclusion cleanup must be split from exclusion policy (e.g., add exclusion immediately but defer message deletion to scheduled purge).
