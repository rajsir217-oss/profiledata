# Hybrid Notification System - Future Architecture

**Created:** May 27, 2026  
**Status:** Future Option (Trigger when DAU > 1000 or login storms observed)  
**Purpose:** Balance between lazy on-demand and pre-computed roster approaches

---

## Overview

The hybrid approach combines lazy loading for expensive operations with scheduled jobs for lightweight operations. This provides better performance during peak usage while maintaining simplicity for most features.

---

## Architecture

### Decision Matrix

| Feature | Approach | Rationale |
|---------|----------|-----------|
| **Search Matches** | Lazy (on-demand) | Expensive query, only when user logs in |
| **Pending Messages** | Scheduled (5 days) | Lightweight query, can be pre-computed |
| **Tips** | Scheduled (daily) | Simple random selection, can be pre-computed |
| **Poll Expirations** | Lazy (on-demand) | Time-sensitive, needs real-time check |
| **Profile Card Weekly Post** | Scheduled (weekly) | Must run regardless of user login |

### Data Flow

```
Scheduled Jobs (Lightweight)
    ↓
Update notification_cache for:
  - pendingMessages (every 5 days)
  - tips (daily)
    ↓
User Login → GET /api/notifications/{username}
    ↓
Check Cache
    ↓
    ├─ Cache valid → Return cached data
    └─ Cache invalid or missing →
        ├─ Collect search matches (lazy)
        ├─ Collect poll expirations (lazy)
        ├─ Use cached pendingMessages if available
        ├─ Use cached tips if available
        └─ Cache for 24hrs → Return
```

---

## Scheduled Jobs

### Job 1: Pending Messages Updater
**Schedule:** Every 5 days (cron: `0 0 */5 * *`)

**Logic:**
```python
async def update_pending_messages_scheduled():
    # Only update for users who logged in last 30 days
    thirty_days_ago = datetime.utcnow() - timedelta(days=30)
    
    users = await db.user_preferences.find({
        "pendingMessages.enabled": True,
        "lastLogin": {"$gte": thirty_days_ago}
    }).to_list(None)
    
    for user in users:
        username = user["username"]
        
        # Collect pending messages
        data = await collect_pending_messages(db, username)
        
        # Update cache
        await db.notification_cache.update_one(
            {"username": username},
            {"$set": {
                "data.pendingMessages": data,
                "data.pendingMessagesLastUpdated": datetime.utcnow()
            }}
        )
```

### Job 2: Tips Updater
**Schedule:** Daily (cron: `0 8 * * *`)

**Logic:**
```python
async def update_tips_scheduled():
    thirty_days_ago = datetime.utcnow() - timedelta(days=30)
    
    users = await db.user_preferences.find({
        "tips.enabled": True,
        "lastLogin": {"$gte": thirty_days_ago}
    }).to_list(None)
    
    tips = [ ... ]  # Predefined tips
    
    for user in users:
        tip = random.choice(tips)
        
        await db.notification_cache.update_one(
            {"username": user["username"]},
            {"$set": {
                "data.tips": {"tip": tip},
                "data.tipsLastUpdated": datetime.utcnow()
            }}
        )
```

---

## Lazy Operations (On-Demand)

### Search Matches
- Triggered on login (cache miss)
- Expensive aggregation query
- Only for users who enabled preference
- Cached for 24hrs

### Poll Expirations
- Triggered on login (always fresh)
- Time-sensitive data
- Lightweight query
- Not cached (always fresh)

---

## Cache Structure

```javascript
{
  _id: ObjectId,
  username: "rajadmin",
  
  data: {
    // Pre-computed by scheduled jobs
    pendingMessages: {
      unreadCount: 8,
      pendingReplyCount: 5,
      lastUpdated: ISODate
    },
    
    tips: {
      tip: "Tip of the day...",
      lastUpdated: ISODate
    },
    
    // Lazy-loaded on login
    searchMatches: {
      searches: [ ... ],
      lastUpdated: ISODate
    },
    
    pollExpirations: {
      expiringPolls: [ ... ]
      // Not cached, always fresh
    }
  },
  
  createdAt: ISODate,
  expiresAt: ISODate,
  ttl: 86400
}
```

---

## Benefits

| Aspect | Lazy Only | Hybrid |
|--------|-----------|--------|
| **Server Load** | Spiky (login storms) | Balanced (scheduled + lazy) |
| **First Login Speed** | 2-5s (all data) | 1-2s (only expensive data) |
| **Data Freshness** | Max 24hr stale | Better (scheduled updates) |
| **Complexity** | Simple | Medium (2 scheduled jobs) |
| **Scalability** | Good | Better |

---

## Migration from Lazy to Hybrid

### Step 1: Add scheduled jobs
- Create `pending_messages_updater.py` job template
- Create `tips_updater.py` job template
- Register in `job_templates/registry.py`

### Step 2: Update cache structure
- Add `lastUpdated` fields to track update source
- Modify `collect_notification_data()` to use pre-computed data

### Step 3: Update API endpoint
```python
async def get_notifications(username: str):
    cache = await db.notification_cache.find_one({"username": username})
    
    if cache and cache["expiresAt"] > now:
        # Check if scheduled data is fresh
        if cache["data"].get("pendingMessagesLastUpdated"):
            # Use cached pending messages
            data["pendingMessages"] = cache["data"]["pendingMessages"]
        else:
            # Lazy load
            data["pendingMessages"] = await collect_pending_messages(username)
        
        # Always lazy load search matches
        data["searchMatches"] = await collect_search_matches(username, prefs)
        
        # Always fresh poll expirations
        data["pollExpirations"] = await collect_poll_expirations(username)
    else:
        # Full fresh load (current lazy behavior)
        data = await collect_notification_data(username, prefs)
```

---

## When to Switch

### Triggers

1. **DAU Threshold**: Daily Active Users > 1000
2. **Login Storms**: > 100 logins within 5-minute window
3. **Latency Complaints**: First login > 3s consistently
4. **Cache Hit Rate**: < 70% (infrequent logins)

### Monitoring Queries

```python
# DAU calculation
pipeline = [
    {
        "$match": {
            "timestamp": {"$gte": start_of_day, "$lt": end_of_day}
        }
    },
    {
        "$group": {
            "_id": "$username"
        }
    },
    {
        "$count": "dau"
    }
]
dau = await db.messenger_usage_telemetry.aggregate(pipeline).to_list(None)

# Cache hit rate
total_requests = await db.analytics.count_documents({"endpoint": "/notifications/{username}"})
cache_hits = await db.analytics.count_documents({
    "endpoint": "/notifications/{username}",
    "source": "cache"
})
hit_rate = (cache_hits / total_requests) * 100
```

---

## Rollback Plan

If hybrid approach causes issues:
1. Disable scheduled jobs in Dynamic Scheduler UI
2. Revert API endpoint to lazy-only version
3. Clear cache to force fresh loads
4. Monitor metrics for improvement

---

## Comparison Summary

| Metric | Lazy | Hybrid | Improvement |
|--------|------|--------|-------------|
| **First Login** | 2-5s | 1-2s | 50-60% faster |
| **Scheduled Jobs** | 0 | 2 | +2 jobs |
| **Server Load** | Spiky | Balanced | Smoother |
| **Complexity** | Low | Medium | +2 jobs |
| **Cache Hit Rate** | N/A | 80-90% | Better caching |

---

## Decision Checklist

Before switching to hybrid:

- [ ] DAU consistently > 1000 for 7 days
- [ ] Login storm patterns observed
- [ ] First login latency > 3s for 20%+ users
- [ ] Cache hit rate < 70%
- [ ] Scheduled job infrastructure ready
- [ ] Rollback plan tested
- [ ] Stakeholder approval

---

## Implementation Timeline

**Phase 1: Preparation** (1 week)
- Create job templates
- Update cache structure
- Write migration script

**Phase 2: Testing** (1 week)
- Test with staging environment
- Load testing with simulated traffic
- Monitor metrics

**Phase 3: Rollout** (1 day)
- Deploy to production
- Monitor closely for 24 hours
- Rollback if issues detected

**Phase 4: Optimization** (ongoing)
- Tune cache TTL
- Adjust job schedules
- Monitor and iterate
