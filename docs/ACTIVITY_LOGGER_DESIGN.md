# User Activity Logger - Implementation Guide

## Overview
Comprehensive activity tracking system for the matrimonial platform with privacy-first design and admin-only access.

---

## 📊 Activity Types (50+ Events)

### Authentication (5 events)
- `USER_LOGIN` - User logged in
- `USER_LOGOUT` - User logged out  
- `SESSION_EXPIRED` - Token expired
- `PASSWORD_CHANGED` - Password updated
- `FAILED_LOGIN` - Failed login attempt

### Profile Activities (10 events)
- `PROFILE_VIEWED` - Viewed another profile
- `PROFILE_EDITED` - Updated own profile
- `PHOTO_UPLOADED` - Added photo
- `PHOTO_DELETED` - Removed photo
- `PROFILE_VISIBILITY_CHANGED` - Privacy updated
- `MATCHING_CRITERIA_UPDATED` - Criteria changed
- `BIO_UPDATED` - Bio/description changed
- `CONTACT_INFO_UPDATED` - Email/phone changed
- `EDUCATION_UPDATED` - Education info changed
- `OCCUPATION_UPDATED` - Occupation info changed

### Matching & Lists (8 events)
- `FAVORITE_ADDED` - Added to favorites
- `FAVORITE_REMOVED` - Removed from favorites
- `SHORTLIST_ADDED` - Added to shortlist
- `SHORTLIST_REMOVED` - Removed from shortlist
- `EXCLUSION_ADDED` - Added to exclusions
- `TOP_MATCHES_VIEWED` - Viewed matches
- `L3V3L_MATCHES_VIEWED` - Viewed AI matches
- `MATCH_SCORE_CALCULATED` - Compatibility scored

### Messaging (6 events)
- `MESSAGE_SENT` - Sent message
- `MESSAGE_READ` - Read message
- `CONVERSATION_STARTED` - New conversation
- `CONVERSATION_ARCHIVED` - Archived chat
- `MESSAGE_DELETED` - Deleted message
- `MESSAGES_PAGE_VIEWED` - Viewed messages list

### Search & Discovery (6 events)
- `SEARCH_PERFORMED` - Advanced search
- `SEARCH_SAVED` - Saved search criteria
- `SEARCH_DELETED` - Deleted saved search
- `FILTER_APPLIED` - Applied filter
- `SEARCH_RESULTS_VIEWED` - Viewed results
- `SORT_CHANGED` - Changed sorting

### PII & Access Control (8 events)
- `PII_REQUEST_SENT` - Requested contact info
- `PII_REQUEST_APPROVED` - Approved request
- `PII_REQUEST_DENIED` - Denied request
- `PII_ACCESS_REVOKED` - Revoked access
- `IMAGE_ACCESS_REQUESTED` - Requested images
- `IMAGE_ACCESS_GRANTED` - Granted image access
- `IMAGE_ACCESS_REVOKED` - Revoked image access
- `PII_VIEWED` - Viewed contact info

### Admin Actions (7 events)
- `USER_STATUS_CHANGED` - Changed status
- `USER_DELETED` - Deleted account
- `ROLE_CHANGED` - Modified role
- `TICKET_RESOLVED` - Resolved ticket
- `NOTIFICATION_SENT_MANUAL` - Manual notification
- `USER_SUSPENDED` - Suspended user
- `USER_BANNED` - Banned user

---

## 🏗️ Architecture

### Backend Components

**1. Activity Logger Service** (`services/activity_logger.py`)
- Centralized logging
- Async non-blocking
- Batch inserts
- Privacy filtering

**2. Activity Models** (`models/activity_models.py`)
- Pydantic models
- Enum definitions
- Validation rules

**3. Activity Routes** (`routers/activity_logs.py`)
- Admin-only endpoints
- Search & filtering
- Export functionality

**4. Middleware** (in `main.py`)
- Auto-log page visits
- Track request duration
- Extract user context

### Frontend Components

**1. ActivityLogs Page** (`components/ActivityLogs.js`)
- Admin dashboard
- Search & filters
- Pagination
- Export buttons

**2. Activity Hook** (`hooks/useActivityLogger.js`)
- Client-side logging
- Debounced calls
- Queue management

---

## 💾 Data Model

```python
class ActivityLog(BaseModel):
    id: Optional[str] = Field(None, alias="_id")
    username: str
    action_type: ActivityType
    target_username: Optional[str] = None
    metadata: Dict[str, Any] = {}
    ip_address: Optional[str] = None  # Masked
    user_agent: Optional[str] = None
    page_url: Optional[str] = None
    referrer_url: Optional[str] = None
    session_id: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    duration_ms: Optional[int] = None
    pii_logged: bool = False
```

---

## 🔒 Privacy & Security

1. **IP Masking**: `192.168.1.123` → `192.168.1.0`
2. **PII Redaction**: Only store user IDs, not actual data
3. **Admin-only**: Logs visible only to admin role
4. **Encryption**: Sensitive metadata encrypted at rest
5. **Retention**: Auto-delete after 30 days (configurable)
6. **GDPR**: User can request deletion

---

## 📈 Storage & Performance

### MongoDB Collections
- `activity_logs` - Main logs (30-day TTL)
- `audit_logs` - Critical events (permanent)
- `activity_stats` - Aggregated metrics

### Indexes
```javascript
db.activity_logs.createIndex({ username: 1, timestamp: -1 })
db.activity_logs.createIndex({ action_type: 1, timestamp: -1 })
db.activity_logs.createIndex({ timestamp: 1 }, { expireAfterSeconds: 2592000 })
```

### Retention Policy
- LOGIN/LOGOUT: 90 days
- PROFILE_VIEWED: 30 days  
- ADMIN_ACTIONS: Permanent
- PII_REQUESTS: Permanent
- SEARCH: 7 days

---

## 🎨 Admin UI Features

### Page: `/admin/activity-logs`

**Search & Filters:**
- Username search
- Action type dropdown
- Date range picker
- Target user filter
- Session filter

**Data Table:**
- Timestamp
- Username (actor)
- Action (colored badge)
- Target user
- Metadata (expandable)
- IP address
- Duration (ms)

**Actions:**
- View details modal
- Export to CSV
- Export to JSON
- Delete selected
- Clear old logs

**Analytics:**
- Activity heatmap
- Top actions chart
- Most active users
- Action distribution pie

---

## 📝 Implementation Checklist

### Phase 1: Backend Core
- [ ] Create `models/activity_models.py`
- [ ] Create `services/activity_logger.py`
- [ ] Add MongoDB indexes
- [ ] Create `routers/activity_logs.py`
- [ ] Add middleware to `main.py`

### Phase 2: Event Integration
- [ ] Hook into Event Dispatcher
- [ ] Log authentication events
- [ ] Log profile actions
- [ ] Log messaging events

### Phase 3: Frontend
- [ ] Create `components/ActivityLogs.js`
- [ ] Create `hooks/useActivityLogger.js`
- [ ] Add route to `App.js`
- [ ] Add sidebar menu item

### Phase 4: Testing
- [ ] Unit tests for activity service
- [ ] Integration tests for logging
- [ ] Performance tests
- [ ] Privacy audit

---

## 🚀 Next Steps

1. Review this design document
2. Approve activity types to track
3. Implement Phase 1 (backend core)
4. Test with sample data
5. Build admin UI
6. Deploy and monitor

---

**Key Files to Create:**
1. `fastapi_backend/models/activity_models.py`
2. `fastapi_backend/services/activity_logger.py`
3. `fastapi_backend/routers/activity_logs.py`
4. `frontend/src/components/ActivityLogs.js`
5. `frontend/src/hooks/useActivityLogger.js`

**Integration Points:**
- Event Dispatcher (existing)
- Main.py middleware
- Protected routes
- Admin menu

---

END OF DOCUMENT
