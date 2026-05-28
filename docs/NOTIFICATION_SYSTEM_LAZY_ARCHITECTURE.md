# Lazy On-Demand Notification System - Architecture

**Created:** May 27, 2026  
**Status:** Implemented  
**Decision:** Start simple, measure usage, optimize based on real data

---

## Overview

The lazy on-demand notification system provides user notifications triggered on login, with 24-hour caching to reduce backend load. Only logged-in users trigger data collection.

---

## Architecture

### Data Flow

```
User Login → GET /api/notifications/{username}
    ↓
Check Cache (notification_cache collection)
    ↓
    ├─ Valid cache (< 24hrs) → Return cached data immediately
    └─ No valid cache → Collect fresh data → Cache for 24hrs → Return
```

### Collections

#### 1. `user_preferences`
Stores user notification preferences.

```javascript
{
  _id: ObjectId,
  username: "rajadmin",
  
  newMatches: {
    enabled: true,
    fields: {
      name: true,
      age: true,
      height: true,
      location: true,
      education: true,
      profession: true
    },
    lookbackDays: 7
  },
  
  pendingMessages: { enabled: true },
  tips: { enabled: true },
  pollExpiration: { enabled: true },
  profileCardWeeklyPost: { enabled: true },
  
  createdAt: ISODate,
  updatedAt: ISODate
}
```

**Indexes:**
- `username` (unique)

#### 2. `notification_cache`
Stores cached notification data with 24-hour TTL.

```javascript
{
  _id: ObjectId,
  username: "rajadmin",
  
  data: {
    searchMatches: { ... },
    pendingMessages: { ... },
    tips: { ... },
    pollExpirations: { ... }
  },
  
  createdAt: ISODate,
  expiresAt: ISODate,  // TTL
  ttl: 86400  // 24 hours
}
```

**Indexes:**
- `username` (unique)
- `expiresAt` (TTL: 0 - auto-delete expired)

#### 3. `messenger_usage_telemetry`
Tracks messenger app usage for analytics.

```javascript
{
  _id: ObjectId,
  username: "rajadmin",
  action: "login",
  platform: "web",  // or "mobile", "ios", "android"
  timestamp: ISODate
}
```

**Indexes:**
- `username`, `timestamp` (compound)
- `timestamp` (TTL: 90 days)

---

## API Endpoints

### GET `/api/notifications/{username}`
Get notifications for user. Returns cached data if valid (< 24hrs), otherwise fetches fresh data.

**Response:**
```json
{
  "source": "cache" | "fresh",
  "data": {
    "searchMatches": { ... },
    "pendingMessages": { ... },
    "tips": { ... },
    "pollExpirations": { ... }
  },
  "cachedAt": ISODate,
  "expiresAt": ISODate
}
```

### POST `/api/notifications/track-login`
Track user login for analytics (DAU/MAU tracking).

**Request Body:**
```json
{
  "platform": "web"
}
```

### GET `/api/notifications/preferences`
Get user notification preferences.

### PUT `/api/notifications/preferences`
Update user notification preferences.

---

## Data Collection Functions

### collect_search_matches()
Collects new matches for saved searches based on user preferences (fields, lookback days).

### collect_pending_messages()
Collects pending message statistics (unread count, pending reply count).

### collect_tip()
Returns a random tip from predefined list.

### collect_poll_expirations()
Collects polls expiring in next 7 days.

### collect_notification_data()
Main orchestrator - collects data based on enabled preferences.

---

## Benefits

| Aspect | Benefit |
|--------|---------|
| **Server Load** | Only processes logged-in users |
| **Database Load** | Cached for 24hrs, reduces repeated queries |
| **User Experience** | Fast cached responses (100ms) |
| **Scalability** | Scales with actual usage, not total users |
| **Complexity** | Simple API, no scheduled jobs |
| **Data Freshness** | Always fresh on login (max 24hr stale) |

---

## Side Effects

### Potential Issues

1. **First Login Latency**: 2-5 seconds on first login (cache miss)
2. **Login Storm Risk**: Many users logging simultaneously could overload backend
3. **Stale Data**: Users won't see new matches until next login after 24hr expiry
4. **No Real-time Updates**: Must logout/login to refresh data
5. **Profile Card Weekly Post**: Doesn't fit lazy model (requires scheduled job)

### Mitigations

- Show loading spinner during data collection
- Add manual refresh button
- Reduce TTL to 12 hours if needed
- Monitor login patterns for storm risk

---

## Usage Analytics

### Telemetry Tracking

Every login is tracked in `messenger_usage_telemetry`:
- Username
- Platform (web/mobile/ios/android)
- Timestamp

### Metrics to Monitor

- **DAU** (Daily Active Users): Count unique usernames per day
- **MAU** (Monthly Active Users): Count unique usernames per month
- **Platform Distribution**: Breakdown by platform
- **Login Frequency**: Average logins per user
- **Peak Hours**: Time of day with most logins

### Decision Criteria for Hybrid Approach

Move to hybrid approach if:
- DAU > 1000 (high concurrent usage)
- Login storm patterns observed
- First login latency complaints increase
- Cache hit rate < 70% (users logging infrequently)

---

## Migration

Run migration to create collections:

```bash
cd /Users/rajsiripuram02/opt/appsrc/profiledata/fastapi_backend
python -m migrations.create_notification_collections
```

---

## Next Steps

1. ✅ Backend API implemented
2. ⏳ Messenger app login flow integration
3. ⏳ Notification preferences UI
4. ⏳ Monitor usage analytics
5. ⏳ Evaluate hybrid approach based on metrics
