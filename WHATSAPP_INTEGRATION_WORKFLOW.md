# WhatsApp Group Integration Workflow

## Overview

This document describes the complete WhatsApp group integration workflow for the ProfileData matrimonial platform. The integration adds WhatsApp community access as a benefit for approved members.

---

## Table of Contents

1. [Workflow Architecture](#workflow-architecture)
2. [Current Profile Activation Workflow](#current-profile-activation-workflow)
3. [WhatsApp Integration Design](#whatsapp-integration-design)
4. [Implementation Plan](#implementation-plan)
5. [User Deletion & WhatsApp Cleanup](#user-deletion--whatsapp-cleanup)
6. [Configuration](#configuration)
7. [API Endpoints](#api-endpoints)
8. [Frontend Components](#frontend-components)
9. [Testing Checklist](#testing-checklist)

---

## Workflow Architecture

### Design Principles

1. **Portal as Gatekeeper**: Only approved profiles see the WhatsApp link
2. **100% Meta-Compliant**: No auto-add, no API group management
3. **Free Solution**: Use WhatsApp invite links (no paid API)
4. **Safety**: Link visibility controlled by account status
5. **Audit Trail**: Log link clicks for analytics

### Workflow Diagram

```
Admin approves profile
  ↓
accountStatus = "active"
adminApprovalStatus = "approved"
adminApprovedAt = timestamp
  ↓
EventDispatcher dispatches USER_APPROVED
  ↓
Send activation email with WhatsApp link
  ↓
User clicks email link → joins WhatsApp group
  ↓
User logs into portal
  ↓
Profile page shows WhatsApp join button (if approved)
  ↓
User clicks button → opens WhatsApp invite link
  ↓
Log click event to activity logs
```

---

## Current Profile Activation Workflow

### Activation Flow

```
Admin approves user (auth/admin_routes.py)
  ↓
Set accountStatus = "active"
Set adminApprovalStatus = "approved"
Set adminApprovedAt = timestamp
  ↓
Check notification triggers (notification_config/notification_triggers.py)
  ↓
Dispatch USER_APPROVED event (EventDispatcher)
  ↓
Queue email notification
  ↓
Send activation email (status_approved template)
```

### Key Files

| File | Purpose |
|------|---------|
| `auth/admin_routes.py` (lines 367-372, 718-743) | Admin approval endpoint, event dispatch |
| `notification_config/notification_triggers.py` | Status change notification config |
| `services/event_dispatcher.py` | Event dispatching to notification queue |
| `services/email_verification_service.py` (lines 493-620) | Current activation email template |
| `frontend/src/components/Profile.js` | Profile UI component |
| `config.py` | Configuration settings |
| MongoDB `notification_templates` collection | Email template storage |

### Current Email Template

- **Subject**: "🎉 Your Profile is Now Activated!"
- **Content**: Activation confirmation, next steps, links to search/profile
- **Missing**: WhatsApp group join link

---

## WhatsApp Integration Design

### Email Template Update

The activation email will include a WhatsApp group join section:

```html
<h3>Join Our Community</h3>
<p>Connect with other approved members in our official WhatsApp group:</p>

<div class="whatsapp-cta">
  <a href="{whatsapp_group_link}" class="whatsapp-button">
    <span class="whatsapp-icon">🔗</span>
    Join WhatsApp Group
  </a>
</div>

<p style="font-size: 14px; color: #666; margin-top: 12px;">
  <em>Only approved members can join. Stay updated with community events and notifications.</em>
</p>
```

### Profile UI Update

The profile page will show a WhatsApp join button for approved members:

```javascript
{whatsappGroupLink && (
  <button
    className="action-button whatsapp-button"
    onClick={() => {
      // Log click event
      api.post('/api/activity-logs', {
        action: 'whatsapp_link_clicked',
        targetUsername: username
      });
      // Open WhatsApp link
      window.open(whatsappGroupLink, '_blank');
    }}
    title="Join our WhatsApp community"
  >
    🔗 WhatsApp
  </button>
)}
```

### Visibility Control

The WhatsApp link/button is only shown when:
- User's `accountStatus = "active"`
- User's `adminApprovalStatus = "approved"`
- `whatsapp_group_enabled = true` in config

---

## Implementation Plan

### Phase 1: Backend Configuration

#### 1.1 Add WhatsApp Configuration to `config.py`

```python
# WhatsApp Community Configuration
whatsapp_group_link: Optional[str] = None  # WhatsApp invite link
whatsapp_group_enabled: Optional[bool] = True  # Enable/disable feature
```

#### 1.2 Add to `.env` file

```bash
WHATSAPP_GROUP_LINK=https://chat.whatsapp.com/XXXXXXX
WHATSAPP_GROUP_ENABLED=true
```

#### 1.3 Add Backend Endpoint for WhatsApp Link

**File**: `routes.py` or `routers/config.py`

```python
@router.get("/config/whatsapp-link")
async def get_whatsapp_link(
    current_user: dict = Depends(get_current_user)
):
    """
    Get WhatsApp group link configuration
    Only returns link if user's profile is approved/active
    """
    db = get_database()
    user = await db.users.find_one({"username": current_user.get("username")})
    
    if not user or user.get("accountStatus") != "active":
        return {"enabled": False, "link": None}
    
    return {
        "enabled": settings.whatsapp_group_enabled,
        "link": settings.whatsapp_group_link if settings.whatsapp_group_enabled else None
    }
```

### Phase 2: Email Template Update

#### 2.1 Update `services/email_verification_service.py`

Add WhatsApp link to the email body:

```python
async def send_profile_activation_email(
    username: str,
    email: str,
    first_name: str = None,
    whatsapp_group_link: str = None
):
    subject = "🎉 Your Profile is Now Activated!"
    
    whatsapp_section = ""
    if whatsapp_group_link:
        whatsapp_section = f"""
        <h3>Join Our Community</h3>
        <p>Connect with other approved members in our official WhatsApp group:</p>
        
        <div class="whatsapp-cta">
          <a href="{whatsapp_group_link}" class="whatsapp-button">
            <span class="whatsapp-icon">🔗</span>
            Join WhatsApp Group
          </a>
        </div>
        
        <p style="font-size: 14px; color: #666; margin-top: 12px;">
          <em>Only approved members can join. Stay updated with community events and notifications.</em>
        </p>
        """
    
    # Include whatsapp_section in email body
```

#### 2.2 Update Event Dispatcher to Pass WhatsApp Link

**File**: `services/event_dispatcher.py`

```python
# When dispatching USER_APPROVED event, include WhatsApp link
metadata = metadata.get("metadata", {})
metadata["whatsapp_group_link"] = settings.whatsapp_group_link
```

### Phase 3: Frontend Profile UI Update

#### 3.1 Update `frontend/src/components/Profile.js`

Add state for WhatsApp link:

```javascript
const [whatsappGroupLink, setWhatsappGroupLink] = useState(null);
```

Fetch WhatsApp link from backend:

```javascript
useEffect(() => {
  if (user && user.accountStatus === 'active') {
    api.get('/api/config/whatsapp-link')
      .then(res => {
        if (res.data.enabled && res.data.link) {
          setWhatsappGroupLink(res.data.link);
        }
      })
      .catch(err => {
        logger.error('Error fetching WhatsApp link:', err);
      });
  }
}, [user]);
```

Add WhatsApp button in action buttons section:

```javascript
{whatsappGroupLink && (
  <button
    className="action-button whatsapp-button"
    onClick={() => {
      api.post('/api/activity-logs', {
        action: 'whatsapp_link_clicked',
        targetUsername: username
      });
      window.open(whatsappGroupLink, '_blank');
    }}
    title="Join our WhatsApp community"
  >
    🔗 WhatsApp
  </button>
)}
```

#### 3.2 Add CSS to `Profile.css`

```css
.whatsapp-button {
  background: linear-gradient(135deg, #25D366 0%, #128C7E 100%);
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.whatsapp-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(37, 211, 102, 0.4);
}
```

---

## User Deletion & WhatsApp Cleanup

### Problem

WhatsApp does NOT provide a free API to programmatically remove users from groups. Once a user joins via invite link, they remain in the group until manually removed by a group admin.

### Solution: Manual Removal Workflow

Since automated removal is not feasible without paid API, we provide admin tools for manual removal.

### Implementation

#### 1. WhatsApp Group Cleanup Admin Report

**File**: `routers/admin_reports.py` (lines 753-793)

```python
@router.get("/whatsapp-group-cleanup")
async def get_whatsapp_group_cleanup_report(
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """
    Get list of users who should be manually removed from WhatsApp group
    Includes deleted, banned, and suspended users
    """
    _check_admin_access(current_user)

    query = {
        "accountStatus": {"$in": ["deleted", "banned", "suspended"]}
    }

    users = await db.users.find(query).to_list(None)

    cleanup_list = []
    for user in users:
        cleanup_list.append({
            "username": user.get("username"),
            "firstName": user.get("firstName"),
            "lastName": user.get("lastName"),
            "contactNumber": user.get("contactNumber"),
            "accountStatus": user.get("accountStatus"),
            "adminApprovedAt": user.get("adminApprovedAt")
        })

    return {
        "success": True,
        "totalCount": len(cleanup_list),
        "data": cleanup_list
    }
```

#### 2. Deletion Event Logging

**File**: `auth/admin_routes.py` (lines 439-450)

```python
# Log deletion event for WhatsApp cleanup tracking
if action in ["ban", "suspend"]:
    await db.activity_logs.insert_one({
        "action": "user_deleted",
        "username": username,
        "adminUsername": current_user.get("username"),
        "accountStatus": update_data.get("accountStatus"),
        "reason": request.reason,
        "requiresWhatsappCleanup": True,
        "timestamp": datetime.utcnow()
    })
    logger.info(f"📱 Logged WhatsApp cleanup event for user '{username}' (action: {action})")
```

### Admin Workflow

```
User gets deleted/banned from portal
  ↓
System logs deletion event with requiresWhatsappCleanup flag
  ↓
Admin runs WhatsApp Group Cleanup report
  ↓
GET /api/admin/reports/whatsapp-group-cleanup
  ↓
Admin manually removes user from WhatsApp group
```

---

## Configuration

### Environment Variables

Add to `.env` file:

```bash
# WhatsApp Community Configuration
WHATSAPP_GROUP_LINK=https://chat.whatsapp.com/XXXXXXX
WHATSAPP_GROUP_ENABLED=true
```

### Settings Class

Add to `config.py`:

```python
# WhatsApp Community Configuration
whatsapp_group_link: Optional[str] = None  # WhatsApp invite link
whatsapp_group_enabled: Optional[bool] = True  # Enable/disable feature
```

---

## API Endpoints

### New Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/config/whatsapp-link` | GET | Get WhatsApp link for current user |
| `/api/admin/reports/whatsapp-group-cleanup` | GET | Get list of users to remove from WhatsApp group |
| `/api/activity-logs` | POST | Log WhatsApp link clicks |

### Endpoint Details

#### GET `/api/config/whatsapp-link`

**Response**:
```json
{
  "enabled": true,
  "link": "https://chat.whatsapp.com/XXXXXXX"
}
```

#### GET `/api/admin/reports/whatsapp-group-cleanup`

**Response**:
```json
{
  "success": true,
  "totalCount": 5,
  "data": [
    {
      "username": "john_doe",
      "firstName": "John",
      "lastName": "Doe",
      "contactNumber": "+1234567890",
      "accountStatus": "banned",
      "adminApprovedAt": "2025-01-15T10:30:00Z"
    }
  ]
}
```

#### POST `/api/activity-logs`

**Request**:
```json
{
  "action": "whatsapp_link_clicked",
  "targetUsername": "john_doe"
}
```

**Response**:
```json
{
  "success": true
}
```

---

## Frontend Components

### Profile Component Updates

**File**: `frontend/src/components/Profile.js`

**Changes**:
1. Add `whatsappGroupLink` state
2. Fetch WhatsApp link on mount (if user is active)
3. Render WhatsApp button in action buttons section
4. Log click events to activity logs

### CSS Updates

**File**: `frontend/src/components/Profile.css`

**Changes**:
1. Add `.whatsapp-button` styling
2. Add hover effects
3. Add responsive styles

---

## Testing Checklist

### Backend Testing

- [ ] Test `/api/config/whatsapp-link` endpoint with active user
- [ ] Test `/api/config/whatsapp-link` endpoint with inactive user
- [ ] Test `/api/admin/reports/whatsapp-group-cleanup` endpoint
- [ ] Verify deletion event logging when user is banned
- [ ] Verify deletion event logging when user is suspended
- [ ] Test activity logging for WhatsApp link clicks

### Frontend Testing

- [ ] Test WhatsApp button visibility for active user
- [ ] Test WhatsApp button hidden for inactive user
- [ ] Test WhatsApp button click opens link in new tab
- [ ] Test WhatsApp button click logs to activity logs
- [ ] Test WhatsApp button styling matches design
- [ ] Test responsive design on mobile

### Email Testing

- [ ] Test activation email includes WhatsApp link
- [ ] Test WhatsApp link is clickable in email
- [ ] Test email styling renders correctly
- [ ] Test email with WhatsApp disabled in config

### End-to-End Testing

- [ ] Complete flow: Admin approves → Email sent → User clicks email link → Joins group
- [ ] Complete flow: User logs in → Profile shows button → User clicks button → Joins group
- [ ] Complete flow: User deleted → Admin runs cleanup report → Admin removes from WhatsApp

---

## Safety & Compliance Guardrails

1. **Visibility Control**: Button only shows for `accountStatus = "active"` profiles
2. **No Auto-Add**: Uses WhatsApp invite links (manual join, no API automation)
3. **Audit Trail**: All link clicks logged to `activity_logs` collection
4. **Feature Toggle**: Can disable via `WHATSAPP_GROUP_ENABLED=false`
5. **Link Rotation**: Can update link anytime via `.env` without code changes
6. **Manual Cleanup**: Admin tools for removing deleted users from group

---

## Summary of Changes

| File | Change |
|------|--------|
| `config.py` | Add `whatsapp_group_link` and `whatsapp_group_enabled` settings |
| `.env` | Add WhatsApp configuration variables |
| `services/email_verification_service.py` | Update activation email template with WhatsApp link section |
| `services/event_dispatcher.py` | Pass WhatsApp link in event metadata |
| MongoDB `notification_templates` | Update `status_approved` template with WhatsApp section |
| `routes.py` | Add `/api/config/whatsapp-link` endpoint |
| `frontend/src/components/Profile.js` | Add WhatsApp button (approved profiles only) |
| `frontend/src/components/Profile.css` | Add WhatsApp button styling |
| `routers/admin_reports.py` | Add `/api/admin/reports/whatsapp-group-cleanup` endpoint |
| `auth/admin_routes.py` | Add deletion event logging for WhatsApp cleanup |

---

## Future Enhancements (Optional)

1. **WhatsApp Business API**: For automated group management (paid, complex)
2. **Link Rotation**: Periodic invite link rotation to prevent re-joining
3. **Admin UI**: Dedicated WhatsApp group management section in admin panel
4. **Analytics Dashboard**: Track WhatsApp link click rates and engagement
5. **Multiple Groups**: Region-specific or language-specific WhatsApp groups

---

## Document Version

**Version**: 1.0  
**Last Updated**: April 21, 2026  
**Author**: ProfileData Development Team
