# Messenger Rules

> Behavioral guardrails for the messenger system, including `fastapi_backend/routers/messenger.py`, `fastapi_backend/services/messenger_service.py`, `messenger-web/`, and mobile wrappers.
> See also `AGENTS.md` for architecture context.

---

## 1. Real-time message delivery

### 1.1 Socket.IO rooms

On socket connect, join a deterministic room keyed by the username:

```python
room = f"user:{username}"
enter_room(room)
```

When emitting events to a recipient, emit to `user:<recipient>` without gating on an in-memory `online_users` mapping. This works correctly in multi-instance Cloud Run only when the Socket.IO server uses a Redis client manager (`AsyncRedisManager`) for cross-instance room routing.

### 1.2 Frontend store subscription

`messenger-web/src/screens/ChatScreen.js` must subscribe to the Zustand `messengerStore` for incoming messages rather than relying only on local state and REST polling. Use `messengerStore.fetchMessages` for non-legacy conversations so socket updates appear instantly.

### 1.3 Message property name normalization

Different endpoints may return messages with camelCase or snake_case keys. The rendering layer must handle both:

```javascript
const sender = msg.fromUsername || msg.from_username;
const text   = msg.content || msg.message;
const time   = msg.createdAt || msg.timestamp;
```

---

## 2. Conversation model

### 2.1 Bot classification

Conversations can be flagged as system-bot conversations:

```python
ConversationCreate(isSystemBot=True, botName="L3V3L Agent", ...)
```

- The router passes these fields to the service.
- The service persists them and backfills metadata on reused direct conversations.

### 2.2 Classifying in the UI

In `messenger-web`, classify a conversation as an L3V3L Agent chat when:

```javascript
isSystemBot || participant.username === 'l3v3lagent'
```

Exclude bot rows from the "My Messages" and direct conversation lists.

---

## 3. Avatar URL normalization

Normalize avatar URLs before rendering:

```javascript
function getProfilePicUrl(url) {
  // Convert /uploads paths, bare filenames, and legacy URLs
  // into /api/users/media/{filename} plus a fresh token.
}
```

Backend `/api/users/profiles/bulk` should also return normalized media URLs for `images`, `profileImage`, and `imageVisibility`.

---

## 4. Message retention and cleanup

### 4.1 Scheduled deletion

Close and acknowledge endpoints set `messages.scheduledDeleteAt = datetime.utcnow() + 24h`.
- Collection: `messages`
- TTL index: `ttl_scheduledDeleteAt` on `{"scheduledDeleteAt": 1}` with `expireAfterSeconds=0`.

### 4.2 Read-time cleanup

`get_conversation` and `get_messages` must:
- Hide messages whose `scheduledDeleteAt` / `expireAt` is in the past.
- Opportunistically delete expired rows when encountered.
- Apply `messageRetentionHours` to filter legacy rows missing `expireAt`.

### 4.3 Exclusion immediate delete

Adding a user to exclusions (`POST /exclusions/{username}`) immediately hard-deletes all messages between the two users. This overrides the 24-hour grace period for the "Not Interested" flow.

---

## 5. Archive scope and auto-unarchive

- The messages archive feature is limited to **direct 1:1 conversations** only.
- Group and public group chats must be excluded from archive actions.
- If a new incoming message arrives for an archived 1:1 conversation, the conversation should auto-unarchive and re-enter the unattended/messages workflow.

## 5.1 Portal Members updated-card intros

In `fastapi_backend/services/event_dispatcher.py`, `profile_updated` events post a Portal Members profile-card intro with `systemTag='updated'` and `systemLabel='Updated'` via `_post_activation_intro_to_portal_members(intro_type='updated')`. `messenger-web/src/screens/ChatScreen.js` treats `systemTag='updated'` as a system intro badge message.

## 5.2 Public recipient invites

The public recipient flow in `fastapi_backend/routers/messenger.py` creates invitation records and queues notification emails. It must also send an immediate best-effort email using notification template rendering and `send_email`. On success, mark the queue item `SENT`; on failure, schedule a retry via `NotificationService.mark_as_sent(success=False)`. Only mark the invitation email status `SENT` when the immediate send succeeds.

---

## 6. Phone-number login (messenger-web)

### 6.1 Default login flow

The messenger-web login defaults to **Phone + SMS Code**.

1. User enters phone number.
2. If the phone matches exactly one account, send an OTP to that user.
3. If the phone matches multiple accounts, require account selection, then send OTP for the selected username.
4. User enters the code; verify and log in.

### 6.2 Error fallback

If phone flow errors repeat (3 consecutive send/verify/resend failures), automatically switch the UI to username/password login and show an explanatory message.

### 6.3 Error normalization

FastAPI/Pydantic may return `detail` arrays or objects. Always normalize API errors to plain strings before rendering them in React.

---

## 7. Real-time delivery and message properties

### 7.1 Socket.IO rooms

On socket connect, join a deterministic room keyed by the username:

```python
room = f"user:{username}"
enter_room(room)
```

When emitting events to a recipient, emit to `user:<recipient>` without gating on an in-memory `online_users` mapping. This works in multi-instance Cloud Run only when the Socket.IO server uses a Redis client manager (`AsyncRedisManager`) for cross-instance room routing.

### 7.2 Frontend store subscription

`messenger-web/src/screens/ChatScreen.js` must subscribe to the Zustand `messengerStore` for incoming messages rather than relying only on local state and REST polling. Use `messengerStore.fetchMessages` for non-legacy conversations so socket updates appear instantly.

### 7.3 Message property name normalization

Different endpoints may return messages with camelCase or snake_case keys. The rendering layer must handle both:

```javascript
const sender = msg.fromUsername || msg.from_username;
const text   = msg.content || msg.message;
const time   = msg.createdAt || msg.timestamp;
```

## 8. Mobile strategy

- App name: **L3V3L Matches Messenger**
- Package / bundle ID: `com.l3v3lmessenger` (reuse existing React Native ID).
- Current approach: evaluate Capacitor wrapping `messenger-web/` (webpack build -> `dist/`).
- Dev mode: `Capacitor server.url = http://10.0.2.2:3030` for live reload.
- Production mode: bundle static `dist/` inside the app.
- Backend reach from emulator: `adb reverse tcp:8000 tcp:8000` (set up in `deploy-mobile-msg.sh`).
- Capacitor and RN share the package ID, so the Capacitor app will overwrite the RN app on the emulator. Reinstall RN via `./deploy-mobile-msg.sh --a` if needed.
- Future iOS requires Xcode + CocoaPods. Defer until Capacitor proves out.
