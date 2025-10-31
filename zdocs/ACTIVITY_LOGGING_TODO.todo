# Activity Logging Implementation TODO

**Last Updated:** October 25, 2025  
**Current Status:** 15/54 activity types implemented (28%)

---

## ✅ Completed (15/54)

### Authentication (3/5)
- [x] User Login
- [x] User Logout  
- [x] Failed Login
- [ ] Session Expired
- [ ] Password Changed

### Profile Actions (2/10)
- [x] Profile Viewed
- [x] Profile Edited
- [ ] Photo Uploaded
- [ ] Photo Deleted
- [ ] Profile Visibility Changed
- [ ] Matching Criteria Updated
- [ ] Bio Updated
- [ ] Contact Info Updated
- [ ] Education Updated
- [ ] Occupation Updated

### Matching & Lists (5/8)
- [x] Favorite Added
- [x] Favorite Removed
- [x] Shortlist Added
- [x] Shortlist Removed
- [x] Exclusion Added
- [ ] Top Matches Viewed
- [ ] L3V3L Matches Viewed
- [ ] Match Score Calculated

### Messaging (2/6)
- [x] Message Sent
- [x] Message Read
- [ ] Conversation Started
- [ ] Conversation Archived
- [ ] Message Deleted
- [ ] Messages Page Viewed

### PII & Access Control (3/8)
- [x] PII Request Sent
- [x] PII Request Approved
- [x] PII Request Denied
- [ ] PII Access Revoked
- [ ] Image Access Requested
- [ ] Image Access Granted
- [ ] Image Access Revoked
- [ ] PII Viewed

### Search & Discovery (0/6)
- [ ] Search Performed
- [ ] Search Saved
- [ ] Search Deleted
- [ ] Filter Applied
- [ ] Search Results Viewed
- [ ] Sort Changed

### Admin Actions (0/7)
- [ ] User Status Changed
- [ ] User Deleted
- [ ] Role Changed
- [ ] Ticket Resolved
- [ ] Notification Sent Manual
- [ ] User Suspended
- [ ] User Banned

### System Events (0/4)
- [ ] Page Visited
- [ ] Error Occurred
- [ ] Feature Used
- [ ] Export Requested

---

## 📋 Implementation Phases

### **Phase 1: High Priority - User-Facing Actions** (16 items)
*These are visible user actions that provide immediate value for KPIs*

#### Profile Management (8)
- [ ] **Photo Uploaded** - `/profile/{username}` PUT endpoint (images field)
  - Location: `routes.py:530` (update_user_profile)
  - Add: Check if `images` list grew, log each new image
  
- [ ] **Photo Deleted** - `/profile/{username}` PUT endpoint (imagesToDelete)
  - Location: `routes.py:530` (update_user_profile)
  - Add: Parse `imagesToDelete`, log each deletion
  
- [ ] **Bio Updated** - `/profile/{username}` PUT endpoint (aboutMe/aboutYou)
  - Location: `routes.py:530` (update_user_profile)
  - Add: Check if bio fields changed, log separately from general profile edit
  
- [ ] **Contact Info Updated** - `/profile/{username}` PUT endpoint
  - Location: `routes.py:530` (update_user_profile)
  - Add: Check if contactEmail/contactNumber changed
  
- [ ] **Education Updated** - `/profile/{username}` PUT endpoint
  - Location: `routes.py:530` (update_user_profile)
  - Add: Check if educationHistory changed
  
- [ ] **Occupation Updated** - `/profile/{username}` PUT endpoint
  - Location: `routes.py:530` (update_user_profile)
  - Add: Check if workExperience changed
  
- [ ] **Matching Criteria Updated** - `/preferences` PUT endpoint
  - Location: `routes.py:908` (update_user_preferences)
  - Add: Activity logging when preferences updated
  
- [ ] **Profile Visibility Changed** - (Need to find endpoint)
  - Search for visibility toggle endpoint

#### Search & Discovery (6)
- [ ] **Search Performed** - `/search` GET endpoint
  - Location: `routes.py` (search endpoint)
  - Add: Log search with query params
  
- [ ] **Filter Applied** - `/search` GET endpoint
  - Same as search, log when filters present
  
- [ ] **Search Results Viewed** - Same as Search Performed
  
- [ ] **Sort Changed** - `/search` GET endpoint
  - Log when sort parameter present
  
- [ ] **Search Saved** - Find saved search endpoint
  - Location: Search for save search functionality
  
- [ ] **Search Deleted** - Find delete saved search endpoint

#### Matching Views (2)
- [ ] **Top Matches Viewed** - `/search?top_matches=true` or similar
  - Location: Search for top matches endpoint
  
- [ ] **L3V3L Matches Viewed** - `/l3v3l-matches` endpoint
  - Location: Search for L3V3L endpoint

---

### **Phase 2: Medium Priority - Messaging & Navigation** (5 items)

#### Messaging (3)
- [ ] **Conversation Started** - First message in conversation
  - Location: `routes.py:2138` (send_message)
  - Add: Check if first message between two users
  
- [ ] **Messages Page Viewed** - `/messages` page load
  - Location: Frontend - Messages component
  - Add: POST to activity log when page mounts
  
- [ ] **Conversation Archived** - Archive conversation feature
  - Location: Search for archive functionality

#### Navigation (2)
- [ ] **Page Visited** - Track page views
  - Location: Frontend - useEffect in route components
  - Add: Generic page view tracking
  
- [ ] **Feature Used** - Track feature engagement
  - Location: Various - when users interact with features
  - Add: Generic feature tracking

---

### **Phase 3: Lower Priority - Admin & System** (18 items)

#### Authentication (2)
- [ ] **Session Expired** - When token expires
  - Location: `auth/jwt_auth.py` or frontend interceptor
  - Add: Log when 401 due to expiration
  
- [ ] **Password Changed** - Password update endpoint
  - Location: Search for password change endpoint

#### PII & Access (4)
- [ ] **PII Access Revoked** - Revoke PII access endpoint
  - Location: Search for revoke PII endpoint
  
- [ ] **Image Access Requested** - Image unlock request
  - Location: Search for image access endpoints
  
- [ ] **Image Access Granted** - Approve image access
  
- [ ] **Image Access Revoked** - Revoke image access
  
- [ ] **PII Viewed** - When PII data is accessed
  - Location: Wherever PII is unmasked

#### Admin Actions (7)
- [ ] **User Status Changed** - Admin changes user status
  - Location: Admin routes
  
- [ ] **User Deleted** - Admin deletes user
  
- [ ] **Role Changed** - Admin changes user role
  
- [ ] **Ticket Resolved** - Support ticket resolution
  - Location: `routes.py:4656` (update_ticket_status)
  
- [ ] **Notification Sent Manual** - Manual notification send
  
- [ ] **User Suspended** - Admin suspends user
  
- [ ] **User Banned** - Admin bans user

#### System Events (4)
- [ ] **Error Occurred** - Log application errors
  - Location: Error handlers, try/catch blocks
  
- [ ] **Export Requested** - Data export requests
  - Location: Export endpoints
  
- [ ] **Message Deleted** - Delete message feature
  - Location: Search for delete message endpoint
  
- [ ] **Match Score Calculated** - L3V3L matching
  - Location: Matching algorithm execution

---

## 🛠️ Implementation Pattern

For each activity type, follow this pattern:

```python
# In the relevant endpoint
try:
    from services.activity_logger import get_activity_logger
    from models.activity_models import ActivityType
    activity_logger = get_activity_logger()
    await activity_logger.log_activity(
        username=username,
        action_type=ActivityType.ACTION_NAME,
        target_username=target_username,  # if applicable
        metadata={"relevant": "data"},
        ip_address=request.client.host if request.client else None
    )
except Exception as log_err:
    logger.warning(f"⚠️ Failed to log activity: {log_err}")
```

### For Event-Driven Activities:
If the activity already has an event dispatcher call, the activity is logged automatically through `event_dispatcher.py` mapping.

---

## 📊 Priority Scoring

**High Priority (Phase 1):** User actions that drive engagement metrics
- Photo management (retention indicator)
- Search behavior (feature usage)
- Matching views (core feature)

**Medium Priority (Phase 2):** Communication and navigation tracking
- Messaging patterns (engagement)
- Page views (usage patterns)

**Low Priority (Phase 3):** Admin actions and system events
- Admin operations (audit trail)
- System events (debugging)

---

## 🎯 Quick Wins (Easy Implementations)

These can be done quickly because the endpoints are already instrumented:

1. **Matching Criteria Updated** - Just add logging to preferences endpoint
2. **Search Performed** - Add logging to existing search endpoint
3. **Top/L3V3L Matches Viewed** - Add logging to match endpoints
4. **Conversation Started** - Check message count in send_message
5. **Ticket Resolved** - Add to existing ticket status endpoint

---

## 📝 Notes

- **IP Address:** All new activities should capture IP via `request.client.host`
- **Request Object:** Add `request: Request` parameter to endpoints that don't have it
- **Metadata:** Include relevant context (e.g., search query, fields changed, etc.)
- **Error Handling:** Wrap activity logging in try/catch - never block main operation
- **Event Dispatcher:** Check if activity is already mapped in `event_dispatcher.py`

---

## 🔍 Code Locations Reference

**Main Routes:** `/fastapi_backend/routes.py`  
**Auth Routes:** `/fastapi_backend/auth/auth_routes.py`  
**Activity Logger:** `/fastapi_backend/services/activity_logger.py`  
**Activity Models:** `/fastapi_backend/models/activity_models.py`  
**Event Dispatcher:** `/fastapi_backend/services/event_dispatcher.py`

---

## ✅ Completion Checklist

After implementing each activity type:

- [ ] Add activity logging in relevant endpoint
- [ ] Add `request: Request` parameter if missing
- [ ] Capture IP address
- [ ] Include meaningful metadata
- [ ] Test by triggering the action
- [ ] Verify it appears in Activity Logs UI
- [ ] Update this document

---

**Target:** 100% implementation (54/54 activity types)  
**Current:** 28% complete (15/54)  
**Phase 1 Goal:** 59% complete (32/54)  
**Phase 2 Goal:** 68% complete (37/54)  
**Phase 3 Goal:** 100% complete (54/54)
