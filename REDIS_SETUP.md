# Redis Setup for Real-Time Features

This application uses Redis for real-time online/offline status tracking and messaging.

## Prerequisites

### Install Redis

**macOS (using Homebrew):**
```bash
brew install redis
```

**Ubuntu/Debian:**
```bash
sudo apt-get update
sudo apt-get install redis-server
```

**Windows:**
Download from: https://redis.io/download

## Starting Redis

### macOS:
```bash
# Start Redis server
brew services start redis

# Or run in foreground
redis-server
```

### Linux:
```bash
# Start Redis service
sudo systemctl start redis-server

# Enable on boot
sudo systemctl enable redis-server

# Check status
sudo systemctl status redis-server
```

### Verify Redis is Running:
```bash
redis-cli ping
# Should return: PONG
```

## Install Python Dependencies

```bash
cd fastapi_backend
pip install -r requirements.txt
```

## Configuration

Redis connection settings are in `redis_manager.py`:
- **Host:** localhost
- **Port:** 6379
- **DB:** 0

To change these, edit the `RedisManager.__init__()` method.

## Features

### 1. Online/Offline Status
- Automatic status tracking with TTL (5 minutes)
- Heartbeat system keeps users online
- Auto-cleanup of stale connections

### 2. Real-Time Messaging
- Message queues per user
- Unread message counts
- Typing indicators
- Pub/Sub for instant delivery

### 3. Scalability
- Works across multiple server instances
- Fast in-memory operations
- Atomic updates

## Testing Redis

### Check Online Users:
```bash
redis-cli
> SMEMBERS online_users
> GET online:username
```

### Check Messages:
```bash
> LRANGE messages:username 0 -1
> GET unread:username:from_user
```

### Monitor Real-Time:
```bash
redis-cli MONITOR
```

## Troubleshooting

### Redis Not Starting:
```bash
# Check if Redis is already running
ps aux | grep redis

# Kill existing process
pkill redis-server

# Start fresh
redis-server
```

### Connection Refused:
```bash
# Check Redis is listening
netstat -an | grep 6379

# Check Redis config
redis-cli CONFIG GET bind
```

### Clear All Data:
```bash
redis-cli FLUSHALL
```

## Production Considerations

1. **Persistence:** Enable RDB or AOF for data persistence
2. **Security:** Set password with `requirepass`
3. **Memory:** Configure `maxmemory` and eviction policy
4. **Monitoring:** Use Redis Sentinel or Cluster for HA
5. **Backup:** Regular RDB snapshots

## Redis Commands Reference

```bash
# List all keys
KEYS *

# Get all online users
SMEMBERS online_users

# Check if user is online
EXISTS online:username

# Get user's messages
LRANGE messages:username 0 -1

# Get unread count
GET unread:username:from_user

# Subscribe to channel
SUBSCRIBE messages:username

# Publish message
PUBLISH messages:username "test message"
```
