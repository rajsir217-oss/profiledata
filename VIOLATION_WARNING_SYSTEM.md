# Violation Warning System

## Overview
Progressive 3-strike warning system for chat profanity with visible banner in TopBar.

---

## ✅ Complete Implementation

### **Backend (`routes.py`)**

#### **New Endpoint: GET `/api/users/violations/{username}`**
Returns user's violation status and strike count.

**Response:**
```json
{
  "username": "user123",
  "violationCount": 1,
  "warningLevel": "warning",
  "warningMessage": "Strike 1 of 3: Warning issued...",
  "accountStatus": "active",
  "suspendedUntil": null
}
```

**Warning Levels:**
- `none` - No violations
- `warning` - Strike 1 (message blocked, warning issued)
- `suspended` - Strike 2 (7-day suspension, final warning)
- `banned` - Strike 3 (permanent ban)

---

### **Frontend (`TopBar.js`)**

#### **New Features:**
1. **Violation State** - Tracks user's current violation status
2. **API Integration** - Fetches violations on login
3. **Real-time Updates** - Listens for `violationUpdate` events
4. **Visual Banner** - Shows strike count and warning message

#### **Banner Display Logic:**
```javascript
{violations && violations.violationCount > 0 && (
  <div className={`violation-banner violation-${violations.warningLevel}`}>
    <span className="violation-icon">⚠️/⏸️/🚫</span>
    <span className="violation-message">{violations.warningMessage}</span>
    <span className="violation-count">{violations.violationCount}/3</span>
  </div>
)}
```

---

### **Frontend (`Messages.js`)**

#### **Event Trigger:**
When profanity is detected (400/403 error), dispatches `violationUpdate` event:
```javascript
if (err.response?.status === 400 || err.response?.status === 403) {
  window.dispatchEvent(new Event('violationUpdate'));
}
```

---

### **Styling (`TopBar.css`)**

#### **3 Warning Levels:**

**1. Warning (Yellow)** - Strike 1
```css
.violation-banner.violation-warning {
  background: linear-gradient(135deg, #ffc107 0%, #ffeb3b 100%);
  color: #664d03;
}
```

**2. Suspended (Orange/Red)** - Strike 2
```css
.violation-banner.violation-suspended {
  background: linear-gradient(135deg, #ff6b6b 0%, #ff8787 100%);
  color: white;
}
```

**3. Banned (Dark Red)** - Strike 3
```css
.violation-banner.violation-banned {
  background: linear-gradient(135deg, #dc2626 0%, #ef4444 100%);
  color: white;
}
```

---

## 🎯 User Experience Flow

### **Scenario: User Sends Profanity**

**Strike 1:**
1. User sends message with bad language
2. Backend blocks message, records violation
3. Returns 400 error with warning
4. Frontend shows error in chat
5. TopBar banner appears: **⚠️ Strike 1 of 3**
6. Message: "Warning issued. Please maintain professional communication."

**Strike 2:**
1. User sends another inappropriate message
2. Backend suspends account for 7 days
3. Returns 403 error
4. TopBar banner updates: **⏸️ Strike 2 of 3**
5. Message: "Account suspended for 7 days. Final warning before permanent ban."

**Strike 3:**
1. User sends third violation
2. Backend permanently bans account
3. TopBar banner shows: **🚫 Strike 3 - Banned**
4. User cannot send messages
5. Account requires admin intervention

---

## 📊 Database Structure

### **Collection: `content_violations`**
```javascript
{
  "username": "user123",
  "type": "message_profanity",
  "content": "original message text",
  "violations": ["profanity", "harassment"],
  "severity": "high",
  "recipient": "user456",
  "timestamp": "2025-10-15T01:30:00Z"
}
```

---

## 🎨 Visual Design

### **Banner Features:**
- ✅ Fixed position below TopBar
- ✅ Animated slide-down entrance
- ✅ Pulsing icon for attention
- ✅ Strike counter badge (X/3)
- ✅ Gradient backgrounds per severity
- ✅ Responsive mobile design
- ✅ Dark theme support
- ✅ Sidebar-aware positioning

### **Banner Position:**
- Normal: Full width at `top: 60px`
- With Sidebar: `left: 280px`, `width: calc(100% - 280px)`
- Mobile: Compressed text, smaller icons

---

## 🔄 Real-Time Updates

### **Event Flow:**
1. User sends profanity → Backend rejects
2. Messages.js catches error → Dispatches `violationUpdate`
3. TopBar.js listens → Calls `loadUserViolations()`
4. Banner updates immediately with new strike count

---

## 🛡️ Admin Features

### **Auto-Reset on Activation**
When admin activates a suspended/banned user:
- ✅ **All violations are automatically cleared**
- ✅ User gets a fresh start (0/3 strikes)
- ✅ Violation banner disappears
- ✅ User can message normally

### **Admin Capabilities:**
- View violation history per user
- See detailed violation logs in audit logs
- Activate/reactivate users (auto-clears violations)
- Override bans/suspensions
- Monitor content violations across platform

### **Implementation:**
```python
# In admin_routes.py - manage_user_account endpoint
if action == "activate":
    update_data["status.status"] = USER_STATUS["ACTIVE"]
    
    # Clear all violations
    await db.content_violations.delete_many({
        "username": username,
        "type": "message_profanity"
    })

# In admin_routes.py - update_user_status endpoint  
if request.status == 'active' and old_status_value in ['suspended', 'banned']:
    await db.content_violations.delete_many({
        "username": username,
        "type": "message_profanity"
    })
```

---

## 🚀 Testing

### **Test Strike 1:**
1. Login as test user
2. Send message: "fuck this"
3. See error in chat
4. Banner appears: ⚠️ Strike 1 of 3

### **Test Strike 2:**
1. Send another profanity
2. Account suspended
3. Banner updates: ⏸️ Strike 2 of 3

### **Test Strike 3:**
1. Send third violation
2. Account banned
3. Banner shows: 🚫 Strike 3

### **Test Admin Reset:**
1. Login as admin
2. Go to User Management
3. Find banned/suspended user
4. Click Actions → Activate
5. User's violations cleared
6. User can login again
7. No violation banner
8. User starts fresh at 0/3 strikes

---

## 📝 Future Enhancements

1. **Appeal System** - Allow users to appeal bans
2. **Violation Expiry** - Auto-clear strikes after 30 days of good behavior
3. **Warning Preview** - Show banner before first violation
4. **Detailed History** - User dashboard showing violation details
5. **Email Notifications** - Send email on each strike
6. **Temporary Mute** - Restrict messaging without full ban

---

## 🔧 Configuration

### **Adjust Strike Limits:**
Edit `routes.py` line 2208-2230:
```python
if violation_count >= 3:  # Change threshold
    # Ban user
elif violation_count >= 2:  # Change threshold
    # Suspend user
```

### **Adjust Suspension Duration:**
Line 2221:
```python
suspend_until = datetime.utcnow() + timedelta(days=7)  # Change days
```

---

## ✅ Checklist

- [x] Backend violation tracking
- [x] GET endpoint for violations
- [x] TopBar state management
- [x] Banner component
- [x] CSS styling (3 levels)
- [x] Real-time event updates
- [x] Error handling
- [x] Dark theme support
- [x] Mobile responsive
- [x] Sidebar compatibility
- [x] Testing documentation

---

## 🎉 Complete!

The violation warning system is now fully implemented with:
- Progressive 3-strike discipline
- Visual warning banner in TopBar
- Real-time updates
- Professional UX
- Admin oversight
