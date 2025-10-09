# Real-Time Messaging Testing Guide

## Setup Complete ✅

### Backend Changes:
1. ✅ Redis integration for message storage
2. ✅ WebSocket manager updated to use Redis
3. ✅ Socket.IO properly mounted (`main:socket_app`)
4. ✅ Online status tracking with Redis

### Frontend Changes:
1. ✅ WebSocket connection enabled
2. ✅ Message ID generation added
3. ✅ Enhanced logging for debugging
4. ✅ Error handling improved

## Testing Steps

### 1. Verify Backend is Running
```bash
# Check if backend is running with Socket.IO
curl http://localhost:8000/health

# Check Redis is running
redis-cli ping  # Should return PONG
```

### 2. Open Browser Console (F12)

**Look for these logs when page loads:**
```
🔌 Connected to WebSocket server
👤 Registering user as online: admin
🔍 Socket ID: <some-id>
✅ Emitted user_online event
✅ Connection established: {sid: "..."}
```

**If you see connection errors:**
- Check backend is running with `./startb.sh`
- Verify it says "using socket_app" in startup
- Check port 8000 is not blocked

### 3. Test Real-Time Messaging

**Setup:**
1. Open **Browser 1** (Chrome) - Login as User A (e.g., "admin")
2. Open **Browser 2** (Firefox/Incognito) - Login as User B (e.g., "aarti")

**Test Flow:**
1. User A opens message modal to User B
2. User A types a message
3. **Check Console in Browser 1:**
   ```
   📤 Emitting send_message event: {id: "...", from: "admin", to: "aarti", ...}
   ```

4. **Check Console in Browser 2 (should see immediately):**
   ```
   💬 New message received via WebSocket: {from: "admin", message: "..."}
   📋 Message from: admin
   📋 Message content: test message
   📋 Triggering new_message event to listeners
   ```

5. **Message should appear in User B's chat window instantly**

### 4. Verify Online Status

**Check console:**
```
🟢 Loaded online users: ["admin", "aarti"]
```

**Check UI:**
- Green circle 🟢 next to online users
- White circle ⚪ next to offline users

### 5. Check Redis Data

```bash
redis-cli

# Check online users
> SMEMBERS online_users
1) "admin"
2) "aarti"

# Check if user is online
> GET online:admin
"2025-10-09T17:40:00.000000"

# Check messages (if any stored)
> LRANGE messages:aarti 0 -1

# Exit
> exit
```

## Troubleshooting

### Issue: "❌ Not connected to WebSocket"

**Solution:**
1. Check backend logs for Socket.IO initialization
2. Verify `startb.sh` uses `main:socket_app`
3. Check browser console for connection errors
4. Try hard refresh (Cmd+Shift+R)

### Issue: Messages not appearing in real-time

**Check:**
1. Both users are connected (check console logs)
2. WebSocket events are being emitted (check "📤 Emitting" logs)
3. Backend is receiving events (check backend logs)
4. Recipient is listening for events (check "💬 New message received" logs)

### Issue: Online status not working

**Check:**
1. Redis is running (`redis-cli ping`)
2. Backend connected to Redis (check startup logs)
3. Heartbeat is running (check "💓 Heartbeat sent" logs)
4. Online status service is initialized

## Expected Behavior

✅ **Messages appear instantly** (< 1 second delay)
✅ **Online indicators** show green for connected users
✅ **Typing indicators** work (if implemented)
✅ **Messages persist** in MongoDB
✅ **Offline messages** delivered when user comes online

## Architecture

```
User A Browser
    ↓ (send message)
Socket.IO Client
    ↓ (emit 'send_message')
Backend WebSocket Handler
    ↓ (store in Redis)
Redis Message Queue
    ↓ (if online)
Socket.IO Server
    ↓ (emit 'new_message')
User B Browser
    ↓ (receive & display)
Chat Window
```

## Performance Metrics

- **Message Delivery:** < 100ms
- **Online Status Update:** < 1 second
- **Heartbeat Interval:** 60 seconds
- **Redis TTL:** 5 minutes (auto-cleanup)

## Next Steps

1. Test with 2 browsers simultaneously
2. Verify messages appear instantly
3. Check online indicators
4. Test offline message delivery
5. Monitor Redis and MongoDB data
