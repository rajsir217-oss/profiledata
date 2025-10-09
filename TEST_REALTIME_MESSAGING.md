# Real-Time Messaging Test Plan

## Test Coverage

### Backend Tests

#### 1. Redis Manager Tests

**Test: `send_message` validation**
- ✅ Empty from_user → Returns False
- ✅ Empty to_user → Returns False
- ✅ Empty message → Returns False
- ✅ Message > 10000 chars → Returns False
- ✅ Valid message → Returns True, stores in Redis
- ✅ Message queue limited to 1000 messages
- ✅ TTL set to 30 days

**Test: `get_new_messages_since` validation**
- ✅ Empty username → Returns []
- ✅ Invalid limit (0, -1, 1001) → Uses default 50
- ✅ Non-existent queue → Returns []
- ✅ Invalid JSON in queue → Skips bad messages
- ✅ Invalid timestamp format → Ignores filter
- ✅ Valid timestamp → Returns only newer messages

**Test: Redis connection failure**
- ✅ Redis down → Returns False/empty array
- ✅ Logs error with stack trace

#### 2. Polling Endpoint Tests

**Test: `/messages/poll/{username}` validation**
- ✅ Invalid username (< 3 chars) → 400 Bad Request
- ✅ Non-existent user → 404 Not Found
- ✅ Invalid timestamp format → Ignores, returns all
- ✅ Invalid limit (< 1, > 100) → Uses default
- ✅ Valid request → 200 OK with messages
- ✅ No new messages → 200 OK with empty array
- ✅ Redis unavailable → 503 Service Unavailable

**Test: `/messages` send endpoint**
- ✅ Empty content → 400 Bad Request
- ✅ Content > 1000 chars → 400 Bad Request
- ✅ Non-existent recipient → 404 Not Found
- ✅ Valid message → 200 OK, stored in MongoDB + Redis
- ✅ Redis failure → Still stores in MongoDB

### Frontend Tests

#### 3. Message Polling Service Tests

**Test: `startPolling` validation**
- ✅ Null username → Error logged, no polling
- ✅ Empty string username → Error logged
- ✅ Username < 3 chars → Error logged
- ✅ Already polling same user → No duplicate polling
- ✅ Switch users → Stops old, starts new polling
- ✅ Valid username → Starts polling every 2 seconds

**Test: `pollMessages` error handling**
- ✅ Network timeout → Error logged, continues polling
- ✅ Server 500 error → Error logged, continues polling
- ✅ Invalid response format → Error logged, skips
- ✅ Invalid message structure → Warning logged, skips message
- ✅ Valid messages → Notifies all listeners

**Test: Listener management**
- ✅ Add listener → Increments count
- ✅ Remove listener → Decrements count
- ✅ Notify with no listeners → No errors
- ✅ Listener throws error → Other listeners still notified

#### 4. MessageModal Integration Tests

**Test: Message receiving**
- ✅ Opens modal → Subscribes to polling service
- ✅ Receives message from current chat → Adds to messages
- ✅ Receives message from other user → Ignores
- ✅ Closes modal → Unsubscribes from polling
- ✅ Invalid message structure → Logs warning, skips

**Test: Message sending**
- ✅ Empty message → Not sent
- ✅ Valid message → Sent via API, added to UI
- ✅ API error → Error logged, user notified

## Manual Test Scenarios

### Scenario 1: Basic Real-Time Messaging
1. User A logs in, opens chat with User B
2. User B logs in, opens chat with User A
3. User A sends "Hello"
4. **Expected:** Within 2 seconds, "Hello" appears in User B's chat
5. User B replies "Hi there"
6. **Expected:** Within 2 seconds, "Hi there" appears in User A's chat

### Scenario 2: Offline Message Delivery
1. User A logs in
2. User B is offline
3. User A sends message to User B
4. **Expected:** Message stored in Redis + MongoDB
5. User B logs in
6. **Expected:** Within 2 seconds, User B sees the message

### Scenario 3: Multiple Conversations
1. User A opens chat with User B
2. User A opens chat with User C (in another tab/window)
3. User B sends message
4. User C sends message
5. **Expected:** Both messages appear in respective chats

### Scenario 4: Network Interruption
1. User A and B chatting
2. Disconnect network for User A
3. User B sends message
4. Reconnect network for User A
5. **Expected:** Within 2 seconds, message appears

### Scenario 5: High Load
1. 10 users all sending messages simultaneously
2. **Expected:** All messages delivered within 2-4 seconds
3. **Expected:** No messages lost
4. **Expected:** Server remains responsive

### Scenario 6: Edge Cases
1. Send empty message → Rejected
2. Send 10,000 char message → Rejected
3. Send to non-existent user → Error shown
4. Rapid message sending (10 msgs/sec) → All delivered
5. Leave chat open for 1 hour → Still receives messages

## Performance Benchmarks

### Latency
- **Target:** < 2 seconds message delivery
- **Acceptable:** < 5 seconds under load
- **Measure:** Time from send to receive

### Server Load
- **Target:** < 100ms per poll request
- **Acceptable:** < 500ms under load
- **Measure:** Backend response time

### Memory Usage
- **Target:** < 100MB Redis memory per 1000 users
- **Acceptable:** < 500MB
- **Measure:** Redis INFO memory

### Network Usage
- **Target:** < 1KB per poll request
- **Acceptable:** < 5KB
- **Measure:** Network tab in browser

## Monitoring & Logging

### Backend Logs to Check
```
✅ Message sent: user1 → user2 (MongoDB + Redis)
📬 Polling: 'user1' - found 2 new messages since 2025-10-09...
❌ Redis error: Connection refused
⚠️ Invalid timestamp format: abc123, ignoring
```

### Frontend Console Logs to Check
```
🔄 Starting message polling for: admin
💬 Received 1 new messages
📢 Notifying listeners of new message from: user2
❌ Polling error 503: Message service temporarily unavailable
⚠️ Invalid message structure: {from: null}
```

### Redis Monitoring
```bash
# Check message queues
redis-cli LLEN messages:admin

# Check online users
redis-cli SMEMBERS online_users

# Monitor real-time
redis-cli MONITOR

# Check memory usage
redis-cli INFO memory
```

## Error Scenarios to Test

1. **Redis Down**
   - Start app with Redis stopped
   - Expected: Polling returns empty, logs error
   - Messages still stored in MongoDB

2. **MongoDB Down**
   - Stop MongoDB
   - Expected: Send message fails with 500
   - Polling still works (Redis only)

3. **Backend Down**
   - Stop backend
   - Expected: Polling logs "No response from server"
   - Continues trying every 2 seconds

4. **Malformed Data**
   - Corrupt Redis data
   - Expected: Skips bad messages, logs error
   - Other messages still delivered

5. **Concurrent Access**
   - Same user logged in 2 browsers
   - Expected: Both receive messages
   - No duplicate processing

## Regression Tests

After any code changes, verify:
- ✅ Messages still delivered within 2 seconds
- ✅ No console errors in normal operation
- ✅ Polling continues after errors
- ✅ Memory doesn't leak over time
- ✅ Redis queues don't grow unbounded
- ✅ Offline messages delivered on login

## Success Criteria

✅ **Functional:** All messages delivered reliably
✅ **Performance:** < 2 second latency
✅ **Reliability:** Handles errors gracefully
✅ **Scalability:** Works with 100+ concurrent users
✅ **Maintainability:** Clear logs for debugging
✅ **User Experience:** No visible errors to users
