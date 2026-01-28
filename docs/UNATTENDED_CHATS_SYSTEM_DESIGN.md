# Unattended Chats System - Design Document

**Version:** 1.1  
**Date:** January 27, 2026  
**Status:** Draft - Pending Review  
**Author:** System Design

---

## Implementation Phases Overview

| Phase | Focus | Status |
|-------|-------|--------|
| **Phase 1** | Force response to pending messages, graceful closure | 🎯 Current |
| **Phase 2** | Mutual exclusions, profile hiding, advanced blocking | 📋 Future |

---

## 1. Executive Summary

### Problem Statement
Members are complaining that other members are not responding to their chat messages/inquiries. This leads to:
- Poor user experience for message senders
- Perception that the platform is inactive
- Reduced engagement and potential member churn
- Frustration from "ghosting" behavior

### Proposed Solution
Implement a **Forced Chat Attention System** that:
1. Identifies unattended conversations on login
2. Displays modal requiring members to address pending messages before accessing other features
3. Provides graceful closure when members decline to connect
4. Tracks and rewards responsive behavior

---

## 2. System Goals

| Goal | Description | Success Metric |
|------|-------------|----------------|
| **Increase Response Rate** | Force members to acknowledge received messages | 80%+ messages get a response within 7 days |
| **Reduce Ghosting** | Provide closure to senders when excluded | 100% of exclusions trigger closure notification |
| **Improve UX** | Clear status on all conversations | No "waiting forever" scenarios |
| **Reward Good Behavior** | Incentivize quick responses | Response rate badges visible on profiles |
| **Maintain Privacy** | Never reveal exclusion/block explicitly | Neutral language in all notifications |

---

## 3. Core Concepts

### 3.1 What is an "Unattended Chat"?

A conversation is considered **unattended** when:
- ✅ I received a message from another member
- ✅ I have NOT replied to that message
- ✅ The message has been waiting for 24+ hours
- ✅ The sender has NOT excluded me
- ✅ I have NOT excluded the sender
- ✅ It's not a system/automated message

### 3.2 Conversation States

| State | Description | Visual Indicator |
|-------|-------------|------------------|
| **Active** | Ongoing conversation, both parties engaged | Normal chat |
| **Pending** | Message received, awaiting my response | Yellow dot |
| **Unattended** | Pending 24+ hours | Orange/Red badge |
| **Closed** | One party declined/excluded | Gray, "Ended" banner |
| **Archived** | Old conversation, no recent activity | Moved to archive |

### 3.3 Urgency Tiers

| Tier | Wait Time | Color | Behavior |
|------|-----------|-------|----------|
| **Critical** | 7+ days | 🔴 Red | MUST respond before accessing other features |
| **High** | 3-7 days | 🟠 Orange | Strong nudge, can dismiss once per session |
| **Medium** | 1-3 days | 🟡 Yellow | Gentle reminder, can skip |

---

## 4. User Flows

### 4.1 Login Flow with Unattended Chats

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER LOGS IN                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              SYSTEM: Check for unattended chats                 │
│                                                                 │
│  Query: conversations WHERE                                     │
│    - lastMessage.sender != currentUser                          │
│    - lastMessage.timestamp < (now - 24 hours)                   │
│    - myLastReply IS NULL OR myLastReply < lastMessage.timestamp │
│    - conversation.status != 'closed'                            │
│    - sender NOT IN my_exclusions                                │
│    - I am NOT IN sender's exclusions                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
              ┌───────────────┴───────────────┐
              │                               │
              ▼                               ▼
┌─────────────────────────┐     ┌─────────────────────────────────┐
│  No unattended chats    │     │  Has unattended chats           │
│                         │     │                                 │
│  → Proceed to Dashboard │     │  → Show Unattended Chats Modal  │
└─────────────────────────┘     └─────────────────────────────────┘
                                              │
                                              ▼
                              ┌───────────────────────────────────┐
                              │     UNATTENDED CHATS MODAL        │
                              │                                   │
                              │  "You have X messages waiting     │
                              │   for your response"              │
                              │                                   │
                              │  [List of pending conversations]  │
                              │                                   │
                              │  For each conversation:           │
                              │  - Sender photo + name            │
                              │  - Message preview                │
                              │  - Wait time (e.g., "5 days ago") │
                              │  - Action buttons                 │
                              └───────────────────────────────────┘
                                              │
                                              ▼
                              ┌───────────────────────────────────┐
                              │         ACTION OPTIONS            │
                              │                                   │
                              │  [💬 Reply] - Opens conversation  │
                              │  [⚡ Quick Reply] - Send template │
                              │  [❌ Not Interested] - Decline    │
                              │  [⏰ Remind Later] - Snooze 24h   │
                              └───────────────────────────────────┘
                                              │
                                              ▼
                              ┌───────────────────────────────────┐
                              │  All critical chats addressed?    │
                              │                                   │
                              │  YES → Proceed to Dashboard       │
                              │  NO  → Stay on modal              │
                              └───────────────────────────────────┘
```

### 4.2 Decline Flow (Phase 1 - Graceful Closure)

```
┌─────────────────────────────────────────────────────────────────┐
│  User A sends message to User B                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  User B receives message, sees in "Unattended" modal            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
              ┌───────────────┴───────────────┐
              │                               │
              ▼                               ▼
┌─────────────────────────────┐     ┌─────────────────────────────────┐
│  User B clicks "Reply"      │     │  User B clicks "Not Interested" │
│                             │     │                                 │
│  → Normal conversation      │     │  → Trigger Graceful Closure     │
└─────────────────────────────┘     └─────────────────────────────────┘
                                              │
                                              ▼
                              ┌───────────────────────────────────┐
                              │       GRACEFUL CLOSURE            │
                              │       (PHASE 1 - SIMPLE)          │
                              │                                   │
                              │  1. Mark conversation as "closed" │
                              │                                   │
                              │  2. Send notification to User A:  │
                              │     "This member has indicated    │
                              │      they're not the right match. │
                              │      Don't worry - there are many │
                              │      great matches waiting for    │
                              │      you!"                        │
                              │                                   │
                              │  3. Update User A's conversation: │
                              │     - Show "Conversation Ended"   │
                              │     - Disable reply button        │
                              │     - Gray out conversation       │
                              │                                   │
                              │  ⚠️ Phase 1: NO exclusion list    │
                              │     changes. User A can still see │
                              │     User B in search.             │
                              └───────────────────────────────────┘
```

### 4.2.1 Phase 1 Limitations & Future Enhancements

| Phase 1 Behavior | Phase 2 Enhancement |
|------------------|---------------------|
| Conversation closed, no exclusion | Add mutual exclusion (hidden) |
| User A can still see User B in search | Hide profiles from each other |
| User A can start new conversation | Block new messages after decline |
| No tracking of who declined whom | Track decline history for analytics |

### 4.3 Sender's View (When Excluded)

```
┌─────────────────────────────────────────────────────────────────┐
│                    USER A's MESSAGE THREAD                      │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  💔 This conversation has ended                           │  │
│  │                                                           │  │
│  │  This member has indicated they're not the right match.   │  │
│  │  Don't worry - there are many great matches waiting for   │  │
│  │  you!                                                     │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  You: Hi! I noticed we have similar interests...         │  │
│  │       [Sent 5 days ago]                                   │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  [Reply disabled - Conversation ended]                    │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  [🗑️ Delete Conversation]  [📂 Archive]                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## 5. Feature Details

### 5.1 Unattended Chats Modal

**Trigger:** Shown immediately after successful login if unattended chats exist

**Modal Components:**
```
┌─────────────────────────────────────────────────────────────────┐
│  ╔═══════════════════════════════════════════════════════════╗  │
│  ║  💬 Messages Waiting for Your Response                    ║  │
│  ║                                                           ║  │
│  ║  You have 3 members waiting to hear from you.             ║  │
│  ║  Please respond to continue using the platform.           ║  │
│  ╠═══════════════════════════════════════════════════════════╣  │
│  ║                                                           ║  │
│  ║  🔴 CRITICAL (7+ days)                                    ║  │
│  ║  ┌─────────────────────────────────────────────────────┐  ║  │
│  ║  │ [Photo] Priya S.                      8 days ago   │  ║  │
│  ║  │ "Hi! I loved your profile and..."                  │  ║  │
│  ║  │ [💬 Reply] [⚡ Quick] [❌ Decline] [⏰ Later]       │  ║  │
│  ║  └─────────────────────────────────────────────────────┘  ║  │
│  ║                                                           ║  │
│  ║  🟠 HIGH (3-7 days)                                       ║  │
│  ║  ┌─────────────────────────────────────────────────────┐  ║  │
│  ║  │ [Photo] Rahul M.                      4 days ago   │  ║  │
│  ║  │ "Hello, I think we might be a good..."             │  ║  │
│  ║  │ [💬 Reply] [⚡ Quick] [❌ Decline] [⏰ Later]       │  ║  │
│  ║  └─────────────────────────────────────────────────────┘  ║  │
│  ║                                                           ║  │
│  ║  🟡 MEDIUM (1-3 days)                                     ║  │
│  ║  ┌─────────────────────────────────────────────────────┐  ║  │
│  ║  │ [Photo] Anita K.                      2 days ago   │  ║  │
│  ║  │ "Your hobbies section caught my..."                │  ║  │
│  ║  │ [💬 Reply] [⚡ Quick] [❌ Decline] [⏰ Later]       │  ║  │
│  ║  └─────────────────────────────────────────────────────┘  ║  │
│  ║                                                           ║  │
│  ╠═══════════════════════════════════════════════════════════╣  │
│  ║  ⚠️ You must address all CRITICAL messages to continue   ║  │
│  ║                                                           ║  │
│  ║  Progress: [████████░░] 2/3 addressed                     ║  │
│  ╚═══════════════════════════════════════════════════════════╝  │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 Quick Reply Templates

Pre-written responses for common scenarios:

| Template | Text |
|----------|------|
| **Interested** | "Thank you for reaching out! I've reviewed your profile and would like to know more about you. Let's connect!" |
| **Need Time** | "Thanks for your message! I'm currently reviewing profiles and will get back to you soon." |
| **Polite Decline** | "Thank you for your interest. After reviewing your profile, I don't think we're the right match. I wish you all the best in your search!" |
| **Custom** | [Opens text input for custom message] |

### 5.3 Snooze/Remind Later

- **Max Snoozes:** 2 per conversation
- **Snooze Duration:** 24 hours
- **After Max Snoozes:** Must respond or decline
- **Visual:** Shows "Snoozed until [date/time]" badge

### 5.4 Bypass Prevention

**Critical Messages (7+ days):**
- ❌ Cannot access Search
- ❌ Cannot access L3V3L Matches
- ❌ Cannot view other profiles
- ❌ Cannot send new messages
- ✅ Can only access Messages and Settings

**High/Medium Messages:**
- Can dismiss modal once per session
- Reminder shown on next login
- Gentle banner on dashboard

---

## 6. Response Rate System

### 6.1 Response Rate Calculation

```
Response Rate = (Conversations Responded / Total Conversations Received) × 100

Where:
- Responded = Sent at least one reply OR marked as "Not Interested"
- Received = Total unique conversations initiated by others
- Excludes = System messages, conversations I initiated
```

### 6.2 Response Time Tracking

| Metric | Description |
|--------|-------------|
| **Average Response Time** | Mean time between receiving message and first reply |
| **Response Rate** | Percentage of conversations with a response |
| **Active Responder** | 90%+ response rate, <48hr average response time |

### 6.3 Profile Badges

| Badge | Criteria | Display |
|-------|----------|---------|
| ⚡ **Quick Responder** | Avg response < 24 hours | Green badge on profile |
| ✓ **Active Member** | 80%+ response rate | Blue checkmark |
| 💬 **Highly Responsive** | 95%+ rate, <12hr avg | Gold badge |
| ⚠️ **Slow Responder** | <50% rate OR >7 day avg | Warning (visible to admins only) |

### 6.4 Search Ranking Impact

| Response Rate | Search Ranking Impact |
|---------------|----------------------|
| 90%+ | +20% visibility boost |
| 70-89% | Normal ranking |
| 50-69% | -10% visibility |
| <50% | -30% visibility |

---

## 7. Notification System

### 7.1 Notification Types

| Event | Recipient | Notification Text | Channel |
|-------|-----------|-------------------|---------|
| **New Message** | Receiver | "[Name] sent you a message" | Push, Email |
| **Unattended Reminder** | Receiver | "You have X messages waiting for your response" | Email (daily digest) |
| **Conversation Closed** | Sender | "This member is not available for new connections" | In-app, Push |
| **Response Received** | Sender | "[Name] replied to your message!" | Push, Email |
| **Snooze Expired** | Receiver | "Reminder: [Name] is still waiting for your response" | Push |

### 7.2 Notification Language Guidelines

**DO use (Explicit but Kind - Option 3):**
- "This member has indicated they're not the right match"
- "Don't worry - there are many great matches waiting for you!"
- "This conversation has ended"
- "This profile is not available"

**DON'T use:**
- "Blocked you"
- "Excluded you"
- "Rejected you"
- "Not interested in you"
- "Not available for new connections" (too vague)

---

## 8. Database Schema

### 8.1 New Collections

#### `conversation_status` Collection
```javascript
{
  "_id": ObjectId,
  "conversationId": ObjectId,  // Reference to messages collection
  "participants": ["user1", "user2"],
  "status": "active" | "pending" | "closed" | "archived",
  "closedBy": "user1" | null,
  "closedAt": ISODate | null,
  "closureReason": "declined" | "excluded" | "inactive" | null,
  "lastMessageAt": ISODate,
  "lastMessageBy": "user1",
  "user1LastReadAt": ISODate,
  "user2LastReadAt": ISODate,
  "user1LastReplyAt": ISODate | null,
  "user2LastReplyAt": ISODate | null,
  "snoozeCount": {
    "user1": 0,
    "user2": 0
  },
  "snoozedUntil": {
    "user1": ISODate | null,
    "user2": ISODate | null
  },
  "createdAt": ISODate,
  "updatedAt": ISODate
}
```

#### `response_metrics` Collection
```javascript
{
  "_id": ObjectId,
  "username": "user1",
  "totalConversationsReceived": 45,
  "totalConversationsResponded": 42,
  "responseRate": 93.3,
  "averageResponseTimeHours": 18.5,
  "lastCalculatedAt": ISODate,
  "badge": "quick_responder" | "active_member" | "highly_responsive" | null,
  "searchRankingModifier": 1.2,  // 1.0 = normal, 1.2 = +20%, 0.7 = -30%
  "history": [
    {
      "month": "2026-01",
      "responseRate": 95.0,
      "avgResponseTime": 12.3
    }
  ]
}
```

### 8.2 Modified Collections

#### `messages` Collection (Add fields)
```javascript
{
  // Existing fields...
  "conversationStatus": "active" | "pending" | "closed",
  "closedAt": ISODate | null,
  "closureNotificationSent": true | false
}
```

#### `users` Collection (Add fields)
```javascript
{
  // Existing fields...
  "responseMetrics": {
    "rate": 93.3,
    "avgTimeHours": 18.5,
    "badge": "quick_responder"
  }
}
```

### 8.3 Phase 1: Decline Handling (No Exclusion Lists)

```javascript
// When User B clicks "Not Interested" on User A's message:
async function handleDecline(declinerUsername, declinedUsername, conversationId) {
  // 1. Mark conversation as closed
  await db.conversation_status.updateOne(
    { conversationId: conversationId },
    { 
      $set: { 
        status: 'closed',
        closedBy: declinerUsername,
        closedAt: new Date(),
        closureReason: 'declined'
      } 
    },
    { upsert: true }
  );
  
  // 2. Send graceful closure notification to declined user
  await sendClosureNotification(declinedUsername, declinerUsername);
  
  // Phase 1: NO exclusion list changes
  // User A can still see User B in search
  // User A can start a new conversation (consider rate limiting)
}
```

### 8.4 Phase 2 (Future): Mutual Exclusion Schema

```javascript
// TO BE IMPLEMENTED IN PHASE 2
// exclusions collection enhancement
{
  "_id": ObjectId,
  "username": "userB",
  "excludedUsers": ["userC", "userD"],      // Users I explicitly excluded (visible in tab)
  "hiddenExclusions": ["userA"],            // Users who declined/excluded ME (NOT visible in tab)
  "updatedAt": ISODate
}

// Search/matching logic would check BOTH lists:
// const isExcluded = excludedUsers.includes(target) || hiddenExclusions.includes(target);
```

**Phase 2 Key Feature:** Hidden exclusions - users who declined me are hidden from my search but DON'T appear in my visible exclusion tab.

---

## 9. API Endpoints

### 9.1 New Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/messages/unattended` | Get unattended conversations for current user |
| POST | `/api/messages/quick-reply` | Send quick reply template |
| POST | `/api/messages/decline` | Decline conversation (graceful closure) |
| POST | `/api/messages/snooze` | Snooze conversation reminder |
| GET | `/api/users/response-metrics` | Get user's response metrics |
| GET | `/api/users/{username}/response-badge` | Get user's response badge for profile |

### 9.2 Endpoint Details

#### GET `/api/messages/unattended`

**Response:**
```json
{
  "unattendedCount": 3,
  "criticalCount": 1,
  "highCount": 1,
  "mediumCount": 1,
  "mustAddress": true,
  "conversations": [
    {
      "conversationId": "abc123",
      "sender": {
        "username": "priya_s",
        "firstName": "Priya",
        "lastName": "S.",
        "profileImage": "url..."
      },
      "lastMessage": {
        "text": "Hi! I loved your profile and...",
        "sentAt": "2026-01-19T10:30:00Z",
        "waitingDays": 8
      },
      "urgency": "critical",
      "snoozeCount": 0,
      "canSnooze": true
    }
  ]
}
```

#### POST `/api/messages/decline`

**Request:**
```json
{
  "conversationId": "abc123",
  "reason": "not_interested"  // Optional, for analytics
}
```

**Response:**
```json
{
  "success": true,
  "message": "Conversation closed. The member has been notified.",
  "closureNotificationSent": true
}
```

---

## 10. Frontend Components

### 10.1 New Components

| Component | Location | Description |
|-----------|----------|-------------|
| `UnattendedChatsModal` | `/components/UnattendedChatsModal.js` | Main modal shown on login |
| `UnattendedChatCard` | `/components/UnattendedChatCard.js` | Individual chat card in modal |
| `QuickReplySelector` | `/components/QuickReplySelector.js` | Template selection dropdown |
| `ResponseBadge` | `/components/ResponseBadge.js` | Badge shown on profiles |
| `ConversationClosedBanner` | `/components/ConversationClosedBanner.js` | Banner in closed conversations |

### 10.2 Modified Components

| Component | Changes |
|-----------|---------|
| `App.js` | Add unattended check after login |
| `Messages.js` | Show closed conversation state |
| `MessageThread.js` | Disable reply for closed conversations |
| `Profile.js` | Show response badge |
| `SearchResultCard.js` | Show response badge |
| `UserCard.js` | Show response badge |

---

## 11. Implementation Phases

## PHASE 1 IMPLEMENTATION (Current Focus)

### Week 1-2: Core Unattended Chats
- [ ] Create `conversation_status` collection
- [ ] Implement `/api/messages/unattended` endpoint
- [ ] Build `UnattendedChatsModal` component
- [ ] Add login flow integration
- [ ] Implement reply action (opens conversation)

### Week 2-3: Decline & Closure
- [ ] Implement "Not Interested" → close conversation
- [ ] Create closure notification system
- [ ] Build `ConversationClosedBanner` component
- [ ] Update message thread UI for closed state
- [ ] **NO exclusion list changes in Phase 1**

### Week 3-4: Quick Replies & Snooze
- [ ] Build `QuickReplySelector` component
- [ ] Implement snooze functionality (max 2, 24hr each)
- [ ] Add snooze limits and expiration
- [ ] Create reminder notifications

### Week 4-5: Response Metrics
- [ ] Create `response_metrics` collection
- [ ] Build metrics calculation job (daily)
- [ ] Implement `ResponseBadge` component
- [ ] Add badges to profiles and cards
- [ ] Integrate with search ranking

### Week 5-6: Polish & Testing
- [ ] Mobile responsive design
- [ ] Accessibility audit
- [ ] Performance optimization
- [ ] User acceptance testing
- [ ] Bug fixes and refinements

---

## PHASE 2 IMPLEMENTATION (Future)

### Mutual Exclusion System
- [ ] Design hidden exclusion list (not visible in UI)
- [ ] Implement decline → hidden exclusion flow
- [ ] Hide declined users from search results
- [ ] Block new messages after decline
- [ ] Reconciliation flow (excluder can undo)

### Advanced Features
- [ ] Rate limiting for repeated messages
- [ ] Decline analytics and reporting
- [ ] Admin tools for managing exclusions

---

## 12. Edge Cases & Handling

| Scenario | Handling |
|----------|----------|
| User deletes account while conversation pending | Auto-close conversation, notify sender "Member no longer active" |
| User suspended/banned | Auto-close all conversations, generic closure message |
| Both users have unattended messages to each other | Show both in respective modals, either can respond first |
| User tries to message someone who excluded them | Phase 1: Allowed (new conversation). Phase 2: Block |
| User A messages User B again after decline | Phase 1: Creates new conversation. Phase 2: Rate limit or block |
| Conversation closed, user tries to access via direct URL | Show closed state, no reply option |
| User has 50+ unattended chats | Paginate modal, prioritize by urgency |
| Quick reply fails to send | Show error, allow retry or manual reply |
| User clears browser data mid-session | Re-check on next API call, re-show modal if needed |

---

## 13. Analytics & Monitoring

### 13.1 Metrics to Track

| Metric | Description | Target |
|--------|-------------|--------|
| **Response Rate (Platform)** | Overall % of messages getting responses | >80% |
| **Avg Response Time** | Platform-wide average | <48 hours |
| **Decline Rate** | % of conversations declined via modal | <30% |
| **Snooze Usage** | % of users using snooze feature | Monitor |
| **Bypass Attempts** | Users trying to skip modal | <5% |
| **Closure Notification Opens** | % of closure notifications read | >70% |

### 13.2 Admin Dashboard Additions

- Unattended chat statistics
- Response rate trends
- Top non-responders list
- Closure notification delivery rates

---

## 14. Privacy & Security

| Concern | Mitigation |
|---------|------------|
| Revealing exclusion explicitly | Use neutral language, never say "blocked" or "excluded" |
| Harassment via forced responses | "Not Interested" option always available |
| Gaming response metrics | Exclude self-initiated conversations from metrics |
| Data retention | Closed conversations archived after 30 days |
| GDPR compliance | Users can delete all conversation data |

---

## 15. Future Enhancements

1. **AI-Suggested Replies** - Use message context to suggest personalized responses
2. **Read Receipts** - Show when message was read (opt-in)
3. **Typing Indicators** - Real-time typing status
4. **Video Message Option** - Quick video response for premium users
5. **Mutual Interest Detection** - Auto-match if both parties respond positively
6. **Response Streaks** - Gamification for consistent responders

---

## 16. Open Questions

1. Should we allow users to opt-out of the forced modal? (Recommendation: No)
2. What's the minimum message length to count as a "response"? (Recommendation: 10 characters)
3. Should premium users have different rules? (Recommendation: Same rules, but more snoozes)
4. How long to keep closed conversations visible? (Recommendation: 30 days, then archive)

---

## 17. Approval & Sign-off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Product Owner | | | |
| Tech Lead | | | |
| UX Designer | | | |
| QA Lead | | | |

---

**Document History:**

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | Jan 27, 2026 | System Design | Initial draft |

