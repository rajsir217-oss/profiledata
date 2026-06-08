# Messenger-Web Performance Review
## Deep Architectural Analysis: Message Loading & Portal Members Group Chat

**Date:** October 26, 2025  
**Objective:** Significantly improve loading times for messages and Portal Members group chats  
**Scope:** Frontend (messenger-web React Native), Backend (FastAPI), Database (MongoDB), Caching (Redis)

---

## Phase 1: Performance + Scalability for 10 Concurrent Users

### Target Outcomes

- **P95 latency**
  - `/api/messenger/conversations`: < 200ms warm, < 600ms cold
  - `/api/messenger/portal-members-group`: < 200ms warm, < 1500ms cold
  - `/api/messenger/conversations/{id}/messages`: < 400ms warm, < 1200ms cold
- **Stability**
  - Avoid event-loop blocking patterns that cause tail latency spikes under small concurrency
  - Avoid “request amplification” (N+1 queries or per-item enrichment loops)

### Phase 1 Changes Implemented

#### Backend

- **Conversation list unread counts**
  - Replaced sequential unread-count calls with a single aggregation grouped by `conversationId`
  - Added MongoDB index: `unread_count_optimization`
- **Conversation list: remove Portal Members from hot path**
  - `/api/messenger/conversations` now excludes the `Portal Members` group by default and the client fetches it separately
- **Portal Members group endpoint payload reduction**
  - `/api/messenger/portal-members-group` returns a small summary object and omits the large `participants` array (returns `participantsCount` instead)
- **Conversation list: removed participant enrichment**
  - `/api/messenger/conversations` no longer enriches participant profiles (the UI doesn’t render them)
- **Participant enrichment gating**
  - `/api/messenger/conversations/{id}` skips participant enrichment for Portal Members and any group with > 50 participants
- **Redis caching**
  - Cached conversation list (short TTL)
  - Cached Portal Members group (short TTL)
  - Cached participant profiles (short TTL)

#### Frontend

- **Conversation list local caching**
  - localStorage cache (5 min TTL) + stale-while-revalidate fetch

### Additional Phase 1 Finding: Participant Enrichment N+1 (Now Addressed)

Even after unread-count fixes, the conversation list endpoint previously ran participant enrichment per conversation. For users with many conversations, this created unnecessary DB pressure and highly variable latency. This is especially costly when the Portal Members group is present, since it has hundreds of participants.

Phase 1 resolves this by:

- removing participant enrichment from `/api/messenger/conversations`
- excluding Portal Members from `/api/messenger/conversations`
- gating enrichment in `/api/messenger/conversations/{id}`

## Executive Summary

The messenger-web application has several critical performance bottlenecks that significantly impact message loading and Portal Members group chat performance. The primary issues are:

1. **N+1 Query Problem in Conversation List** - Sequential unread count queries for each conversation
2. **Portal Members Group Over-fetching** - Fetches all active users (600+) on every load
3. **Conversation list participant enrichment N+1** - Per-conversation participant enrichment creates many DB calls and is catastrophic for very large groups
4. **No Caching Layer** - No Redis caching for messages, conversations, or participant profiles
5. **Missing MongoDB Index** - No index for unread count queries
6. **Frontend No Caching** - No browser/local storage caching for conversation lists

**Estimated Impact:** These bottlenecks can cause 10-20 second load times for Portal Members group and 3-5 second delays for conversation lists.

**Phase 1 (10 concurrent users):** We focus on eliminating request-amplification (N+1 patterns) and removing the worst payloads (Portal Members) from hot paths. The goal is stable P95 latencies under small concurrent load without requiring multi-instance redesign.

---

## Current Architecture

### Data Flow
```
Frontend (React Native)
    ↓ HTTP/REST API
Backend (FastAPI)
    ↓ Motor (async MongoDB driver)
Database (MongoDB)
    ↓ Socket.IO (WebSocket)
Real-time Updates
```

### Technology Stack
- **Frontend:** React Native (messenger-web)
  - ChatScreen.js - Message loading and display
  - ConversationListScreen.js - Conversation list with bulk profile enrichment
- **Backend:** FastAPI + Python 3.12
  - routers/messenger.py - API endpoints
  - services/messenger_service.py - Business logic
- **Database:** MongoDB
  - messenger_messages - Message documents
  - messenger_conversations - Conversation metadata
  - messenger_device_tokens - FCM push tokens
- **Real-time:** Socket.IO
  - websocket_manager.py - Typing indicators, delivery receipts
- **Caching:** Redis
  - redis_manager.py - Online status, message queues, typing indicators
  - notification_cache.py - User preferences, notification templates

---

## Critical Bottlenecks

### 1. N+1 Query Problem in Conversation List (HIGH PRIORITY)

**Location:** `fastapi_backend/services/messenger_service.py:90`

**Issue:**
```python
async def get_conversations(db, username, page=1, limit=50):
    query = {"participants.username": username}
    total = await db.messenger_conversations.count_documents(query)
    cursor = db.messenger_conversations.find(query).sort("lastMessageAt", -1).skip((page-1)*limit).limit(limit)
    conversations = await cursor.to_list(length=limit)
    
    # N+1 PROBLEM: Sequential unread count queries
    for conv in conversations:
        conv["unreadCount"] = await _unread_count(db, str(conv["_id"]), username)
```

**Impact:**
- For 50 conversations = 50 sequential `count_documents()` queries
- Each query: `count_documents({conversationId, senderUsername: {$ne}, status: {$ne: "read"}, isDeleted: false})`
- Estimated latency: 50 × 20-50ms = 1-2.5 seconds JUST for unread counts
- No index supports this query pattern

**Root Cause:**
- Loop calls `_unread_count()` synchronously
- No batch aggregation to compute all unread counts in one query
- Missing MongoDB index for the unread count query

### 2. Portal Members Group Over-fetching (HIGH PRIORITY)

**Location:** `fastapi_backend/routers/messenger.py:51-93`

**Issue:**
```python
@router.get("/portal-members-group")
async def get_or_create_portal_members_group(...):
    # Fetches ALL active users (could be 600+)
    active_users = await db.users.find({
        "accountStatus": "active"
    }, {"username": 1}).to_list(None)
    
    participant_usernames = [u["username"] for u in active_users]
    # Creates conversation with 600+ participants
    conv = await messenger_service.create_conversation(
        db,
        creator_username=username,
        participant_usernames=participant_usernames,  # 600+ usernames
        conv_type="group",
        group_name="Portal Members",
    )
```

**Impact:**
- Fetches 600+ user documents from MongoDB
- Creates conversation document with 600+ participant objects
- `_enrich_participants()` (already optimized to batch query) still fetches 600+ profiles
- Estimated latency: 2-5 seconds for participant fetch + enrichment
- Conversation document becomes very large (600+ participants array)

**Root Cause:**
- No pagination on active users query
- No caching of Portal Members group conversation
- Participant enrichment runs on every conversation load

### 3. No Caching Layer (HIGH PRIORITY)

**Current State (after Phase 1 implementation):**
- Redis caching added for:
  - conversation list (short TTL)
  - Portal Members group endpoint (short TTL)
  - participant profile enrichment (short TTL)
- Frontend localStorage caching added for conversation list (stale-while-revalidate)

**Impact:**
- Every message load hits MongoDB
- Every conversation list load hits MongoDB (with N+1 unread queries)
- Portal Members group hits MongoDB on every load
- No cache warming or pre-loading

### 4. Missing MongoDB Index for Unread Counts (MEDIUM PRIORITY)

**Current Indexes (from main.py:260-282):**
```python
# Good: Supports message list queries
await db.messenger_messages.create_index([("conversationId", 1), ("_id", -1)])

# Good: Supports conversation list queries
await db.messenger_conversations.create_index([("participants.username", 1), ("lastMessageAt", -1)])

# Added in Phase 1: Index for unread count aggregation
# Index: (conversationId, senderUsername, status, isDeleted)
```

**Impact:**
- Unread count queries perform collection scan
- Each unread count query takes 20-50ms instead of 1-5ms with index
- Multiplies the N+1 problem impact

### 5. Frontend No Caching (MEDIUM PRIORITY)

**Current State (after Phase 1 implementation):**
- ConversationListScreen.js: localStorage caching of conversation list (5 min TTL) with stale-while-revalidate
- ChatScreen.js: no message cache yet (Phase 2)

**Impact:**
- Perceived slow load times
- Unnecessary API calls
- Poor offline experience

---

## Existing Optimizations (Already Implemented)

The following optimizations have already been implemented and are working correctly:

1. **Participant Profile Batch Enrichment** - `_enrich_participants()` uses single `$in` query instead of N sequential queries
   - Location: `fastapi_backend/routers/messenger.py`
   - Impact: Reduced from 600 sequential queries to 1 batch query for Portal Members

2. **MongoDB Compound Indexes** - Proper indexes for message list and conversation list queries
   - messenger_messages: `(conversationId, _id desc)` - Optimizes cursor pagination
   - messenger_conversations: `(participants.username, lastMessageAt desc)` - Optimizes conversation list

3. **Decrypt-on-Read** - Legacy encrypted message content decrypted on read
   - Location: `fastapi_backend/routes.py`
   - Impact: Fixes encrypted text display issue

4. **Bulk Profile Fetch** - ConversationListScreen uses `/api/users/profiles/bulk` endpoint
   - Location: `messenger-web/src/screens/ConversationListScreen.js:231-250`
   - Impact: Reduced from N sequential profile fetches to 1 batch fetch

---

## Proposed Caching Strategy

### Multi-Layer Caching Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ Layer 1: Frontend Cache (React Native)                      │
│ - AsyncStorage for conversation list (5 min TTL)           │
│ - AsyncStorage for recent messages (2 min TTL)             │
│ - Stale-while-revalidate pattern                            │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Layer 2: Backend Response Cache (Redis)                     │
│ - Conversation list per user (30 sec TTL)                   │
│ - Unread counts per user (10 sec TTL)                       │
│ - Message pages per conversation (1 min TTL)                │
│ - Participant profiles (5 min TTL)                           │
│ - Portal Members group (5 min TTL)                          │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Layer 3: Database (MongoDB)                                 │
│ - Proper indexes for all query patterns                     │
│ - Query result caching via MongoDB internal cache            │
└─────────────────────────────────────────────────────────────┘
```

### Cache Key Strategy

```
conversation_list:{username}:{page} → 30 sec TTL
unread_counts:{username} → 10 sec TTL
messages_page:{conversation_id}:{before_cursor} → 1 min TTL
participant_profile:{username} → 5 min TTL
portal_members_group → 5 min TTL
```

### Cache Invalidation Strategy

- **Write-through cache:** Invalidate on message send, conversation update, participant change
- **Time-based TTL:** Automatic expiration for stale data
- **Manual invalidation:** Admin actions (clear chat, retention changes)

---

## Prioritized Action Items

### Priority 1: Critical (Implement First)

#### 1.1 Fix N+1 Query Problem in Conversation List
**File:** `fastapi_backend/services/messenger_service.py`

**Solution:** Use MongoDB aggregation to compute all unread counts in one query

```python
async def get_conversations(db, username, page=1, limit=50):
    query = {"participants.username": username}
    total = await db.messenger_conversations.count_documents(query)
    cursor = db.messenger_conversations.find(query).sort("lastMessageAt", -1).skip((page-1)*limit).limit(limit)
    conversations = await cursor.to_list(length=limit)
    
    # NEW: Batch compute unread counts using aggregation
    conv_ids = [str(c["_id"]) for c in conversations]
    if conv_ids:
        pipeline = [
            {"$match": {"conversationId": {"$in": [ObjectId(cid) for cid in conv_ids]}}},
            {"$match": {"senderUsername": {"$ne": username}, "status": {"$ne": "read"}, "isDeleted": False}},
            {"$group": {"_id": "$conversationId", "count": {"$sum": 1}}}
        ]
        unread_results = await db.messenger_messages.aggregate(pipeline).to_list(None)
        unread_by_conv = {str(r["_id"]): r["count"] for r in unread_results}
        
        for conv in conversations:
            conv["unreadCount"] = unread_by_conv.get(str(conv["_id"]), 0)
    
    return conversations, total
```

**Expected Impact:** Reduce 50 sequential queries to 1 aggregation query (1-2.5s → 50-100ms)

---

#### 1.2 Add MongoDB Index for Unread Count Queries
**File:** `fastapi_backend/main.py`

**Solution:** Add compound index to support unread count aggregation

```python
# Add to index creation section (around line 282)
await db.messenger_messages.create_index(
    [("conversationId", 1), ("senderUsername", 1), ("status", 1), ("isDeleted", 1)],
    background=True,
    name="unread_count_optimization",
)
```

**Expected Impact:** Unread count aggregation 10-20x faster (collection scan → index seek)

---

#### 1.3 Implement Redis Caching for Conversation List
**File:** `fastapi_backend/services/messenger_service.py`

**Solution:** Cache conversation list per user with short TTL

```python
async def get_conversations(db, username, page=1, limit=50):
    from redis_manager import get_redis_manager
    redis = get_redis_manager()
    
    cache_key = f"conversation_list:{username}:{page}"
    cached = redis.redis_client.get(cache_key)
    if cached:
        return json.loads(cached)
    
    # ... existing logic ...
    
    # Cache result (30 sec TTL)
    redis.redis_client.setex(cache_key, 30, json.dumps({"conversations": conversations, "total": total}))
    return conversations, total
```

**Expected Impact:** Conversation list load time 10-20x faster for cache hits (1-2s → 50-100ms)

---

### Priority 2: High (Implement After Priority 1)

#### 2.1 Cache Portal Members Group
**File:** `fastapi_backend/routers/messenger.py`

**Solution:** Cache Portal Members group conversation document

```python
@router.get("/portal-members-group")
async def get_or_create_portal_members_group(...):
    from redis_manager import get_redis_manager
    redis = get_redis_manager()
    
    cache_key = "portal_members_group"
    cached = redis.redis_client.get(cache_key)
    if cached:
        return {"success": True, "conversation": json.loads(cached)}
    
    # ... existing logic ...
    
    # Cache result (5 min TTL)
    redis.redis_client.setex(cache_key, 300, json.dumps(existing))
    return {"success": True, "conversation": existing}
```

**Expected Impact:** Portal Members group load 10-20x faster for cache hits (2-5s → 100-200ms)

---

#### 2.2 Implement Frontend AsyncStorage Caching
**File:** `messenger-web/src/screens/ConversationListScreen.js`

**Solution (implemented):** Cache conversation list in localStorage with stale-while-revalidate

```javascript
// messenger-web runs in the browser via react-native-web; use localStorage.

const loadAllConversations = async () => {
  // Try to load from cache first
  const cached = window.localStorage.getItem('conversation_list');
  if (cached) {
    const { conversations, timestamp } = JSON.parse(cached);
    const age = Date.now() - timestamp;
    if (age < 5 * 60 * 1000) { // 5 min TTL
      setAllConversations(conversations);
    }
  }
  
  // Always fetch fresh data
  try {
    const api = useAuthStore.getState().getApi();
    // ... existing fetch logic ...
    setAllConversations(combined);
    
    // Cache result
    window.localStorage.setItem('conversation_list', JSON.stringify({
      conversations: combined,
      timestamp: Date.now(),
    }));
  } catch (e) {
    console.error('❌ Failed to load conversations:', e);
  }
};
```

**Expected Impact:** Perceived load time 5-10x faster (instant display from cache)

---

#### 2.3 Cache Participant Profiles
**File:** `fastapi_backend/routers/messenger.py`

**Solution:** Cache participant profiles in Redis

```python
async def _enrich_participants(db, conv, current_username):
    from redis_manager import get_redis_manager
    redis = get_redis_manager()
    
    participants = conv.get("participants", []) or []
    usernames = [p.get("username") for p in participants if p.get("username")]
    
    # Try to fetch from cache first
    cached_profiles = {}
    uncached_usernames = []
    for uname in usernames:
        cache_key = f"participant_profile:{uname}"
        cached = redis.redis_client.get(cache_key)
        if cached:
            cached_profiles[uname] = json.loads(cached)
        else:
            uncached_usernames.append(uname)
    
    # Fetch uncached profiles from DB
    if uncached_usernames:
        cursor = db.users.find(
            {"username": {"$in": uncached_usernames}},
            {"_id": 0, "username": 1, "firstName": 1, "lastName": 1, "images": 1, "profileImage": 1},
        )
        for user in await cursor.to_list(None):
            uname = user.get("username")
            if uname:
                cached_profiles[uname] = user
                # Cache for 5 min
                redis.redis_client.setex(f"participant_profile:{uname}", 300, json.dumps(user))
    
    # Enrich participants
    for p in participants:
        uname = p.get("username")
        if not uname:
            continue
        user = cached_profiles.get(uname)
        if not user:
            continue
        p["firstName"] = user.get("firstName", "")
        p["lastName"] = user.get("lastName", "")
        images = user.get("images", [])
        p["profileImage"] = images[0] if images else None
```

**Expected Impact:** Participant enrichment 5-10x faster for cache hits (600 DB queries → 0 for cached)

---

### Priority 3: Medium (Implement After Priority 2)

#### 3.1 Cache Message Pages
**File:** `fastapi_backend/services/messenger_service.py`

**Solution:** Cache message pages per conversation

```python
async def get_messages(db, conversation_id, username, limit=50, before=None):
    from redis_manager import get_redis_manager
    redis = get_redis_manager()
    
    cache_key = f"messages_page:{conversation_id}:{before or 'latest'}"
    cached = redis.redis_client.get(cache_key)
    if cached:
        return json.loads(cached)
    
    # ... existing logic ...
    
    # Cache result (1 min TTL)
    redis.redis_client.setex(cache_key, 60, json.dumps({"messages": messages, "total": total, "has_more": has_more}))
    return messages, total, has_more
```

**Expected Impact:** Message load 5-10x faster for cache hits (200-500ms → 20-50ms)

---

#### 3.2 Implement Cache Invalidation on Write Operations
**File:** `fastapi_backend/routers/messenger.py`

**Solution:** Invalidate relevant caches on message send, conversation update

```python
@router.post("/conversations/{conversation_id}/messages")
async def send_message(...):
    # ... existing send logic ...
    
    # Invalidate caches
    from redis_manager import get_redis_manager
    redis = get_redis_manager()
    
    # Invalidate conversation list cache for all participants
    for p in conv.get("participants", []):
        uname = p.get("username")
        if uname:
            pattern = f"conversation_list:{uname}:*"
            keys = redis.redis_client.keys(pattern)
            if keys:
                redis.redis_client.delete(*keys)
    
    # Invalidate message pages cache
    pattern = f"messages_page:{conversation_id}:*"
    keys = redis.redis_client.keys(pattern)
    if keys:
        redis.redis_client.delete(*keys)
    
    return {"success": True, "message": msg}
```

**Expected Impact:** Cache consistency, prevents stale data

---

#### 3.3 Optimize Portal Members Group Participant Loading
**File:** `fastapi_backend/routers/messenger.py`

**Solution:** Only load participant profiles on-demand (lazy loading)

```python
@router.get("/conversations/{conversation_id}")
async def get_conversation(conversation_id, current_user, db):
    conv = await messenger_service.get_conversation(db, conversation_id, current_user["username"])
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    # NEW: Only enrich participants for direct chats (not large groups)
    if conv.get("type") != "group" or len(conv.get("participants", [])) < 50:
        await _enrich_participants(db, conv, current_user["username"])
    
    return {"success": True, "conversation": conv}
```

**Expected Impact:** Portal Members group load 2-3x faster (skip 600 profile fetches)

---

## Expected Performance Improvements

### Before Optimizations
- Conversation list load: 3-5 seconds (50 sequential unread count queries)
- Portal Members group load: 10-20 seconds (600+ user fetch + enrichment)
- Message page load: 200-500ms (DB query + participant enrichment)

### After Priority 1 Optimizations
- Conversation list load: 100-200ms (batch aggregation + index)
- Portal Members group load: 2-5 seconds (still uncached but with better index)
- Message page load: 200-500ms (unchanged)

### After Priority 2 Optimizations
- Conversation list load: 50-100ms (Redis cache hit)
- Portal Members group load: 100-200ms (Redis cache hit)
- Message page load: 200-500ms (unchanged)

### After All Optimizations
- Conversation list load: 50-100ms (cache hit) or 100-200ms (cache miss)
- Portal Members group load: 100-200ms (cache hit) or 2-3 seconds (cache miss with lazy loading)
- Message page load: 20-50ms (cache hit) or 200-500ms (cache miss)

**Overall Improvement:** 10-100x faster load times depending on cache hit rate

---

## Implementation Timeline

### Week 1: Priority 1 (Critical)
- Day 1-2: Fix N+1 query problem with batch aggregation
- Day 3: Add MongoDB index for unread counts
- Day 4-5: Implement Redis caching for conversation list

### Week 2: Priority 2 (High)
- Day 1-2: Cache Portal Members group
- Day 3-4: Implement frontend AsyncStorage caching
- Day 5: Cache participant profiles

### Week 3: Priority 3 (Medium)
- Day 1-2: Cache message pages
- Day 3-4: Implement cache invalidation on writes
- Day 5: Optimize Portal Members lazy loading

### Week 4: Testing & Monitoring
- Performance testing with production-like load
- Cache hit rate monitoring
- Rollback plan preparation

---

## Monitoring & Metrics

### Key Metrics to Track
1. **Cache Hit Rate:** Target > 80% for conversation list, > 60% for message pages
2. **API Response Time:** P95 < 200ms for conversation list, < 500ms for messages
3. **Database Query Time:** P95 < 50ms per query
4. **Redis Memory Usage:** Monitor for cache eviction
5. **Error Rate:** Monitor for cache-related errors

### Monitoring Tools
- MongoDB query profiler for slow queries
- Redis INFO command for cache stats
- Application logging for cache hit/miss tracking
- APM (Application Performance Monitoring) for end-to-end latency

---

## Risks & Mitigations

### Risk 1: Cache Staleness
**Mitigation:** Short TTLs (30 sec - 5 min), write-through cache invalidation

### Risk 2: Redis Memory Exhaustion
**Mitigation:** Monitor memory usage, set maxmemory policy, use appropriate TTLs

### Risk 3: Cache Stampede (Thundering Herd)
**Mitigation:** Cache warming, lock-based single-flight pattern, short TTLs

### Risk 4: Increased Complexity
**Mitigation:** Clear cache invalidation logic, comprehensive logging, rollback plan

---

## Conclusion

The messenger-web application has significant performance bottlenecks that can be addressed through a multi-layer caching strategy and query optimization. The proposed changes will:

1. **Eliminate N+1 query problem** - Batch aggregation reduces 50 queries to 1
2. **Add proper caching layer** - Redis caching reduces DB load 10-100x
3. **Improve Portal Members performance** - Caching and lazy loading reduce load from 10-20s to 100-200ms
4. **Enhance user experience** - Frontend caching provides instant perceived load times

The prioritized action items provide a clear path to implementation with measurable performance improvements at each stage.
