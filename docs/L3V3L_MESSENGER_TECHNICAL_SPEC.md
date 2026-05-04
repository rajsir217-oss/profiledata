# L3V3L Messenger — Technical Specification
**Standalone Messaging Application**
**Version:** 1.0 Draft
**Date:** May 3, 2025
**Author:** Architecture Review

---

## 1. Executive Summary

Build a standalone WhatsApp-style messaging app ("L3V3L Messenger") that:
- Works as a separate mobile app (Android + iOS)
- Supports messaging **outside** the L3V3L MATCHES platform (external contacts via phone number)
- Reuses existing backend infrastructure where possible
- Maintains integration with the L3V3L MATCHES ecosystem

**Out of Scope (for now):** Voice/video calls, Stories/Status feature.

---

## 2. Current System Inventory

### 2.1 What We Have (Reusable)

| Asset | Location | Reuse Strategy |
|---|---|---|
| **MongoDB messages collection** | `db.messages` | Extend schema for media + external contacts |
| **Redis real-time layer** | `redis_manager.py` | Reuse presence, typing, message queuing |
| **Socket.IO WebSocket** | `websocket_manager.py` | Extend for mobile clients |
| **FCM Push Service** | `services/push_service.py` | Already supports FCM + APNs + WebPush |
| **Profanity Filter** | `profanity_filter.py` | Reuse for content moderation |
| **Event Dispatcher** | `services/event_dispatcher.py` | Extend with new message event types |
| **Block/Exclusion System** | `routes.py` (block-status endpoints) | Extend for external contacts |
| **JWT Auth** | `auth/jwt_auth.py` | Reuse, add device-based sessions |
| **Capacitor Android Shell** | `frontend/android/` | Reference for native integration patterns |
| **Email/SMS Services** | `services/email_sender.py`, `sms_sender.py` | Reuse for invite/verification flows |

### 2.2 What We Don't Have (Must Build)

| Feature | Priority | Complexity |
|---|---|---|
| External contact system (phone-based) | P0 | Medium |
| Media messages (image/doc/audio) | P0 | Medium |
| Delivery receipts (sent/delivered/read) | P0 | Low |
| React Native mobile app | P0 | High |
| Offline message sync | P1 | Medium |
| Group chats | P1 | High |
| End-to-end encryption | P2 | Very High |
| Message search (full-text) | P2 | Medium |

---

## 3. Architecture

### 3.1 High-Level Architecture

```
┌──────────────────────────────────────────────────────┐
│                    CLIENT LAYER                       │
├─────────────────┬──────────────────┬─────────────────┤
│  React Native   │  React Native    │  React Web      │
│  Android App    │  iOS App         │  (existing)     │
└────────┬────────┴────────┬─────────┴────────┬────────┘
         │                 │                  │
         ▼                 ▼                  ▼
┌──────────────────────────────────────────────────────┐
│                   API GATEWAY                         │
│              (Existing FastAPI Server)                │
├──────────────────────────────────────────────────────┤
│  /api/messenger/*    (NEW - messenger routes)        │
│  /api/messages/*     (EXISTING - L3V3L messaging)    │
│  /socket.io          (EXISTING - real-time)          │
└────────┬─────────────────────────────────────────────┘
         │
    ┌────┴────────────────────────────────────┐
    │           SERVICE LAYER                  │
    ├──────────┬──────────┬──────────┬────────┤
    │ Message  │ Contact  │ Media    │ Push   │
    │ Service  │ Service  │ Service  │ Service│
    │ (extend) │ (NEW)    │ (NEW)    │(exists)│
    └────┬─────┴────┬─────┴────┬─────┴───┬────┘
         │          │          │          │
    ┌────┴──────────┴──────────┴──────────┴────┐
    │           DATA LAYER                      │
    ├──────────┬──────────┬──────────┬─────────┤
    │ MongoDB  │  Redis   │  S3/GCS  │ FCM/   │
    │          │          │ (media)  │ APNs   │
    └──────────┴──────────┴──────────┴─────────┘
```

### 3.2 Decision: Monorepo or Separate Repo?

**Recommendation: New directory within existing monorepo**

```
/profiledata/
├── fastapi_backend/          ← Existing (extend with new routes)
│   ├── routers/
│   │   └── messenger.py      ← NEW: Messenger API routes
│   ├── services/
│   │   ├── messenger_service.py   ← NEW: Messenger business logic
│   │   ├── contact_service.py     ← NEW: External contact management
│   │   └── media_service.py       ← NEW: Media upload/download
│   └── models/
│       └── messenger_models.py    ← NEW: Pydantic models
├── frontend/                 ← Existing React web app
├── messenger/                ← NEW: React Native mobile app
│   ├── android/
│   ├── ios/
│   ├── src/
│   │   ├── screens/
│   │   ├── components/
│   │   ├── services/
│   │   ├── stores/
│   │   └── utils/
│   ├── package.json
│   └── app.json
└── docs/
    └── L3V3L_MESSENGER_TECHNICAL_SPEC.md  ← This file
```

**Why monorepo:**
- Shared backend — no API duplication
- Shared config (`.env`, `config.py`)
- Easier to keep messenger and platform users in sync

---

## 4. Database Schema

### 4.1 New Collections

#### `messenger_contacts`
External contacts (not in L3V3L MATCHES `users` collection).

```javascript
{
  _id: ObjectId,
  ownerUsername: "rajadmin",        // L3V3L user who added this contact
  phoneNumber: "+14155551234",      // E.164 format (encrypted)
  phoneHash: "sha256...",           // For matching without decryption
  displayName: "John Doe",         // Set by owner
  isRegistered: false,             // true if they've joined L3V3L Messenger
  registeredUsername: null,         // Their username if registered
  avatarUrl: null,
  createdAt: ISODate,
  updatedAt: ISODate
}
// Indexes: { ownerUsername: 1, phoneHash: 1 } unique
//          { phoneHash: 1 }  (for contact matching on signup)
```

#### `messenger_conversations`
Unified conversation model (1:1 and groups).

```javascript
{
  _id: ObjectId,
  type: "direct" | "group",
  participants: [
    { username: "rajadmin", role: "member", joinedAt: ISODate },
    { username: null, phoneHash: "sha256...", role: "member", joinedAt: ISODate }
  ],
  // Group-only fields
  groupName: null,
  groupAvatar: null,
  createdBy: "rajadmin",
  // Metadata
  lastMessageAt: ISODate,
  lastMessagePreview: "Hey, how are you?",
  createdAt: ISODate,
  updatedAt: ISODate
}
// Indexes: { "participants.username": 1 }
//          { "participants.phoneHash": 1 }
//          { lastMessageAt: -1 }
```

#### `messenger_messages`
Extended message model with media support and delivery receipts.

```javascript
{
  _id: ObjectId,
  conversationId: ObjectId,        // Reference to messenger_conversations
  senderUsername: "rajadmin",
  senderPhoneHash: null,           // For unregistered senders (future)
  // Content
  contentType: "text" | "image" | "video" | "audio" | "document" | "location",
  content: "Hello!",               // Text content or caption
  // Media (if contentType != "text")
  media: {
    url: "https://storage.example.com/...",
    thumbnailUrl: "https://storage.example.com/.../thumb",
    mimeType: "image/jpeg",
    fileSize: 245000,              // bytes
    fileName: "photo.jpg",
    width: 1024,                   // images/video
    height: 768,
    duration: null                 // audio/video in seconds
  },
  // Delivery receipts
  status: "sent" | "delivered" | "read",
  deliveredAt: ISODate | null,
  readAt: ISODate | null,
  readBy: [                        // For group chats
    { username: "user2", readAt: ISODate }
  ],
  // Metadata
  replyTo: ObjectId | null,        // Quote/reply to another message
  isForwarded: false,
  isDeleted: false,                // Soft delete ("This message was deleted")
  deletedAt: null,
  // Moderation
  moderationStatus: "clean" | "flagged" | "blocked",
  moderationDetails: null,
  // Timestamps
  createdAt: ISODate,
  updatedAt: ISODate
}
// Indexes: { conversationId: 1, createdAt: 1 }
//          { senderUsername: 1 }
//          { status: 1, conversationId: 1 }  (for delivery receipt updates)
```

#### `messenger_device_tokens`
FCM tokens for push notifications per device.

```javascript
{
  _id: ObjectId,
  username: "rajadmin",
  tokens: [
    {
      token: "fcm_token_abc...",
      platform: "android" | "ios" | "web",
      deviceName: "Samsung Galaxy S24",
      lastActive: ISODate,
      createdAt: ISODate
    }
  ],
  updatedAt: ISODate
}
// Index: { username: 1 } unique
```

#### `messenger_invites`
Track invitations sent to non-registered contacts.

```javascript
{
  _id: ObjectId,
  inviterUsername: "rajadmin",
  inviteePhone: "+14155551234",    // encrypted
  inviteePhoneHash: "sha256...",
  channel: "sms" | "whatsapp_link",
  status: "sent" | "accepted" | "expired",
  sentAt: ISODate,
  acceptedAt: ISODate | null,
  expiresAt: ISODate               // 7 days
}
```

### 4.2 Existing Collections (Extended)

#### `users` — Add fields
```javascript
{
  // ... existing fields ...
  messengerEnabled: true,          // Has activated messenger
  messengerPhoneHash: "sha256...", // For contact matching
  messengerLastSeen: ISODate,
  messengerPrivacy: {
    lastSeen: "everyone" | "contacts" | "nobody",
    profilePhoto: "everyone" | "contacts" | "nobody",
    readReceipts: true
  }
}
```

---

## 5. API Design

### 5.1 New Router: `/api/messenger/`

All endpoints require JWT authentication.

#### Contacts

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/contacts/sync` | Sync phone contacts → find registered users |
| `GET` | `/contacts` | List all contacts (registered + external) |
| `POST` | `/contacts/add` | Add a single contact by phone |
| `DELETE` | `/contacts/{contactId}` | Remove a contact |
| `POST` | `/contacts/invite` | Send SMS invite to unregistered contact |

#### Conversations

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/conversations` | List conversations (paginated, sorted by lastMessageAt) |
| `POST` | `/conversations` | Create new conversation (1:1 or group) |
| `GET` | `/conversations/{id}` | Get conversation details |
| `PUT` | `/conversations/{id}` | Update group name/avatar |
| `DELETE` | `/conversations/{id}` | Leave/delete conversation |
| `POST` | `/conversations/{id}/participants` | Add members to group |
| `DELETE` | `/conversations/{id}/participants/{username}` | Remove member from group |

#### Messages

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/conversations/{id}/messages` | Get messages (paginated, cursor-based) |
| `POST` | `/conversations/{id}/messages` | Send message (text or media) |
| `PUT` | `/messages/{id}/status` | Update delivery status (delivered/read) |
| `DELETE` | `/messages/{id}` | Soft-delete a message |
| `POST` | `/messages/{id}/forward` | Forward message to another conversation |

#### Media

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/media/upload` | Upload media file → returns URL |
| `GET` | `/media/{id}` | Download media (auth-gated) |
| `GET` | `/media/{id}/thumbnail` | Get thumbnail |

#### Device Management

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/devices/register` | Register FCM token for push |
| `DELETE` | `/devices/{token}` | Unregister device token |

---

## 6. Real-Time Layer

### 6.1 Socket.IO Events (Extend Existing)

#### Client → Server
| Event | Payload | Description |
|---|---|---|
| `messenger:send_message` | `{ conversationId, content, contentType, media? }` | Send a message |
| `messenger:typing` | `{ conversationId, isTyping }` | Typing indicator |
| `messenger:mark_delivered` | `{ messageIds[] }` | Mark messages as delivered |
| `messenger:mark_read` | `{ conversationId, messageId }` | Mark as read (up to messageId) |
| `messenger:online` | `{}` | Announce presence |

#### Server → Client
| Event | Payload | Description |
|---|---|---|
| `messenger:new_message` | `{ message, conversation }` | Incoming message |
| `messenger:message_status` | `{ messageId, status, timestamp }` | Delivery receipt update |
| `messenger:typing` | `{ conversationId, username, isTyping }` | Typing indicator |
| `messenger:presence` | `{ username, online, lastSeen }` | Contact presence update |

### 6.2 Redis Keys (New)

```
messenger:presence:{username}        → "online" (TTL 120s, heartbeat)
messenger:typing:{conversationId}:{username} → "1" (TTL 5s)
messenger:unread:{username}:{conversationId} → count
messenger:queue:{username}           → list of pending messages (for offline sync)
```

---

## 7. Media Handling

### 7.1 Storage

**Recommended: AWS S3 or Google Cloud Storage**

```
Bucket: l3v3l-messenger-media/
├── {username}/
│   ├── images/
│   │   ├── {uuid}.jpg
│   │   └── {uuid}_thumb.jpg
│   ├── documents/
│   │   └── {uuid}.pdf
│   └── audio/
│       └── {uuid}.ogg
```

### 7.2 Upload Flow

```
Mobile App                    Backend                      S3
    │                            │                          │
    ├── POST /media/upload ──────►                          │
    │   (multipart/form-data)    │                          │
    │                            ├── Validate (size, type) │
    │                            ├── Generate thumbnail ───►│
    │                            ├── Upload original ──────►│
    │                            │                          │
    │◄── { url, thumbnailUrl } ──┤                          │
    │                            │                          │
    ├── POST /messages ──────────►                          │
    │   (with media URLs)        │                          │
```

### 7.3 Limits

| Type | Max Size | Allowed Formats |
|---|---|---|
| Image | 10 MB | jpg, png, gif, webp, heic |
| Document | 25 MB | pdf, doc, docx, xls, xlsx, ppt, txt, csv |
| Audio | 10 MB | ogg, mp3, m4a, wav |

---

## 8. Push Notifications

### 8.1 Existing Infrastructure
Already have `push_service.py` with:
- ✅ FCM (Android + Web)
- ✅ APNs (iOS) via FCM
- ✅ Multicast (up to 500 tokens)
- ✅ Topic subscriptions

### 8.2 Notification Payloads

```javascript
// New message notification
{
  notification: {
    title: "Rajadmin S",
    body: "Hey, how are you?",        // or "📷 Photo" for media
    image: "https://...avatar.jpg"     // Sender avatar
  },
  data: {
    type: "new_message",
    conversationId: "abc123",
    senderUsername: "rajadmin",
    messageId: "msg456"
  },
  android: {
    priority: "high",
    notification: { channelId: "messages", sound: "default" }
  },
  apns: {
    payload: { aps: { sound: "default", badge: 5 } }
  }
}
```

### 8.3 Notification Types

| Type | When | Priority |
|---|---|---|
| `new_message` | New message received (user offline) | High |
| `group_invite` | Added to a group | Medium |
| `contact_joined` | A phone contact registered | Low |
| `message_reaction` | Someone reacted to your message | Low |

---

## 9. Mobile App (React Native)

### 9.1 Why React Native

- Reuses existing React/JavaScript team knowledge
- Single codebase for Android + iOS
- Mature ecosystem (navigation, storage, camera, push)
- Good Socket.IO support
- Can share API service layer patterns with web app

### 9.2 Tech Stack

| Concern | Library |
|---|---|
| **Framework** | React Native 0.76+ (New Architecture) |
| **Navigation** | React Navigation v7 |
| **State** | Zustand (lightweight, no boilerplate) |
| **Storage** | WatermelonDB (offline-first SQLite) |
| **HTTP** | Axios (same as web app) |
| **WebSocket** | socket.io-client (same as web app) |
| **Push** | @react-native-firebase/messaging |
| **Camera/Gallery** | react-native-image-picker |
| **File Handling** | react-native-document-picker, rn-fetch-blob |
| **Encryption** | react-native-quick-crypto (future E2EE) |
| **UI Components** | React Native Paper or NativeWind (Tailwind) |
| **Icons** | lucide-react-native |
| **Build** | EAS Build (Expo) or bare React Native CLI |

### 9.3 App Screens

```
├── Auth
│   ├── SplashScreen
│   ├── LoginScreen          (reuse existing JWT auth)
│   └── PhoneVerifyScreen    (verify phone for contact matching)
│
├── Main (Tab Navigator)
│   ├── Chats Tab
│   │   ├── ConversationListScreen
│   │   ├── ChatScreen
│   │   ├── ChatInfoScreen
│   │   └── MediaViewerScreen
│   │
│   ├── Contacts Tab
│   │   ├── ContactListScreen
│   │   ├── NewChatScreen
│   │   ├── NewGroupScreen
│   │   └── InviteContactScreen
│   │
│   └── Settings Tab
│       ├── SettingsScreen
│       ├── PrivacySettingsScreen
│       ├── NotificationSettingsScreen
│       └── ProfileScreen
```

### 9.4 Offline-First Architecture

```
┌─────────────────────────────────┐
│         React Native UI          │
├─────────────────────────────────┤
│         Zustand Store            │
│   (in-memory reactive state)     │
├─────────────────────────────────┤
│         Sync Engine              │
│  (manages online/offline queue)  │
├──────────┬──────────────────────┤
│ WatermelonDB │    API Client     │
│ (local SQLite) │  (Axios + Socket) │
└──────────────┴──────────────────┘
```

**Sync strategy:**
1. All messages written to local DB first (instant UI update)
2. Background sync sends pending messages when online
3. On reconnect, pull missed messages since last sync timestamp
4. Conflict resolution: server timestamp wins

---

## 10. Security

### 10.1 Authentication
- **JWT tokens** (existing) with device-specific sessions
- **Refresh tokens** for mobile (long-lived, stored securely in Keychain/Keystore)
- **Phone verification** via OTP for contact matching

### 10.2 Content Moderation
- **Profanity filter** (existing `profanity_filter.py`) applied on send
- **3-strike system** (existing) for violations
- **Spam detection** — rate limit messages per minute (e.g., max 30/min)
- **Report mechanism** — flag conversations/messages

### 10.3 Data Protection
- **PII encryption** at rest (existing `crypto_utils.py` for phone numbers)
- **Phone hashing** (SHA-256 with salt) for contact matching without exposing numbers
- **Media access** — signed URLs with TTL (no public access)
- **E2EE** (Phase 2) — Signal Protocol for message content encryption

### 10.4 Rate Limits

| Action | Limit |
|---|---|
| Send message | 30/min per user |
| Upload media | 10/min per user |
| Sync contacts | 1/5min per user |
| Send invite | 10/day per user |

---

## 11. Integration with L3V3L MATCHES

### 11.1 Shared Features
- **L3V3L MATCHES users** automatically appear as messenger contacts if they enable messenger
- **Existing conversations** from `/messages` can optionally migrate to messenger
- **Profile pictures** shared between platforms
- **Block/exclusion lists** synchronized

### 11.2 Separation
- Messenger contacts/conversations stored in **separate collections** (`messenger_*`)
- Messenger does **not** require a matrimonial profile — phone verification only
- External contacts (non-L3V3L users) can only use messenger, not the matching platform

### 11.3 Cross-Platform Navigation
- Deep links from messenger → L3V3L MATCHES profile
- "View Match Profile" button in chat header for L3V3L users
- Contribution prompts in messenger settings (reuse `ContributionPopup` logic)

---

## 12. Implementation Phases

### Phase 1: Foundation (Weeks 1–4)
**Goal: Basic 1:1 messaging with media on mobile**

| Task | Effort |
|---|---|
| Set up React Native project (Android + iOS) | 3 days |
| Auth screens (login, phone verify) | 3 days |
| Create `messenger.py` router + `messenger_service.py` | 3 days |
| `messenger_messages` collection + CRUD endpoints | 2 days |
| `messenger_conversations` collection + endpoints | 2 days |
| Extend Socket.IO for `messenger:*` events | 2 days |
| ConversationListScreen + ChatScreen | 5 days |
| Media upload service (S3) + endpoints | 3 days |
| Push notification integration (FCM) | 2 days |
| Delivery receipts (sent/delivered/read) | 2 days |
| **Subtotal** | **~27 days** |

### Phase 2: Contacts & Invites (Weeks 5–7)
**Goal: Add outside people, phone-based contact discovery**

| Task | Effort |
|---|---|
| `messenger_contacts` collection + sync endpoint | 3 days |
| Phone verification (OTP) flow | 2 days |
| Contact list UI + search | 3 days |
| Invite flow (SMS with deep link) | 3 days |
| Contact matching (phone hash lookup) | 2 days |
| New chat / new conversation flow | 2 days |
| **Subtotal** | **~15 days** |

### Phase 3: Groups & Polish (Weeks 8–10)
**Goal: Group chats, offline support, production readiness**

| Task | Effort |
|---|---|
| Group conversation CRUD | 3 days |
| Group chat UI (member list, admin actions) | 3 days |
| Offline-first with WatermelonDB | 5 days |
| Message sync engine | 3 days |
| Settings & privacy screens | 2 days |
| Testing, bug fixes, performance | 5 days |
| App Store / Play Store submission | 2 days |
| **Subtotal** | **~23 days** |

### Phase 4: Future (Post-Launch)
- End-to-end encryption (Signal Protocol)
- Message reactions (emoji)
- Full-text message search
- Message forwarding across conversations
- Link previews
- Location sharing
- Migration tool for existing L3V3L MATCHES conversations

---

## 13. Infrastructure Requirements

### 13.1 New Services Needed

| Service | Provider | Est. Monthly Cost |
|---|---|---|
| **Object Storage** (media) | AWS S3 / GCS | $5–50 (usage-based) |
| **CDN** (media delivery) | CloudFront / Cloud CDN | $5–20 |
| **SMS OTP** | SimpleTexting (existing) or Twilio Verify | $0.05/verification |
| **App Store Accounts** | Google Play ($25 once) + Apple ($99/yr) | ~$10/mo amortized |

### 13.2 Existing Infrastructure (No Changes)

| Service | Status |
|---|---|
| FastAPI backend on GCP | ✅ Already running |
| MongoDB Atlas | ✅ Already running |
| Redis | ✅ Already running |
| Firebase (FCM) | ✅ Already configured |
| Resend (email) | ✅ Already configured |
| SimpleTexting (SMS) | ✅ Already configured |

---

## 14. Key Technical Decisions Summary

| Decision | Choice | Reason |
|---|---|---|
| Mobile framework | **React Native** | Team knows React, shared patterns with web |
| State management | **Zustand** | Lightweight, no boilerplate, fast |
| Local DB | **WatermelonDB** | SQLite-based, reactive, great offline support |
| Media storage | **AWS S3** | Cheap, reliable, presigned URLs for auth |
| Real-time | **Socket.IO** (extend existing) | Already battle-tested in production |
| New repo? | **No** — monorepo subfolder | Shared backend, shared config |
| Separate API? | **No** — new router in existing FastAPI | Avoid duplication, shared auth/DB |
| Contact matching | **Phone hash (SHA-256)** | Privacy-preserving, no raw phone exchange |
| Message storage | **New collections** (`messenger_*`) | Clean separation from matrimonial messages |
| Delivery receipts | **Per-message status field** | Simple, works with offline sync |

---

## 15. Risk Assessment

| Risk | Impact | Mitigation |
|---|---|---|
| Scope creep (feature parity with WhatsApp) | High | Strict phase gates, MVP-first mindset |
| React Native performance on older devices | Medium | Test on low-end Android early, optimize list rendering |
| Media storage costs scaling | Medium | Implement auto-cleanup for old media, compression |
| App store rejection (iOS) | Medium | Follow Apple guidelines closely, no web-view wrapper |
| Offline sync complexity | High | Use proven library (WatermelonDB), extensive testing |
| SMS costs for invites/OTP | Low | Rate limit invites, use existing SimpleTexting |

---

## Appendix A: MongoDB Index Plan

```javascript
// messenger_contacts
db.messenger_contacts.createIndex({ ownerUsername: 1, phoneHash: 1 }, { unique: true })
db.messenger_contacts.createIndex({ phoneHash: 1 })

// messenger_conversations
db.messenger_conversations.createIndex({ "participants.username": 1 })
db.messenger_conversations.createIndex({ "participants.phoneHash": 1 })
db.messenger_conversations.createIndex({ lastMessageAt: -1 })

// messenger_messages
db.messenger_messages.createIndex({ conversationId: 1, createdAt: 1 })
db.messenger_messages.createIndex({ senderUsername: 1 })
db.messenger_messages.createIndex({ conversationId: 1, status: 1 })
db.messenger_messages.createIndex({ createdAt: 1 }, { expireAfterSeconds: 365 * 24 * 3600 }) // Optional: TTL 1 year

// messenger_device_tokens
db.messenger_device_tokens.createIndex({ username: 1 }, { unique: true })

// messenger_invites
db.messenger_invites.createIndex({ inviterUsername: 1 })
db.messenger_invites.createIndex({ inviteePhoneHash: 1 })
db.messenger_invites.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }) // Auto-delete expired
```

---

## Appendix B: Environment Variables (New)

```bash
# Media Storage (S3)
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_S3_BUCKET=l3v3l-messenger-media
AWS_S3_REGION=us-east-1
MEDIA_CDN_URL=https://media.l3v3lmatches.com

# Phone Verification
PHONE_HASH_SALT=<random-32-byte-hex>

# Messenger Config
MESSENGER_MAX_GROUP_SIZE=50
MESSENGER_MAX_MESSAGE_LENGTH=5000
MESSENGER_MAX_MEDIA_SIZE_MB=25
MESSENGER_INVITE_EXPIRY_DAYS=7
```
