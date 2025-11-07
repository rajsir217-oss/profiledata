# 🎛️ Admin Saved Search Notifications Manager

## ✅ **Decision: Keep Option 1 (Single Recurring Job)**

**Chosen Approach:** Single recurring job that checks all saved searches  
**With Addition:** Admin UI to view, override, and disable user notifications

---

## 🎯 **Requirements**

### **Admin UI Must Provide:**

1. ✅ **View all saved searches** with active email notifications
2. ✅ **Override user preferences** (day, time, frequency)
3. ✅ **Disable/enable** notifications for specific searches
4. ✅ **Bulk operations** on multiple searches
5. ✅ **Analytics** dashboard for notification insights
6. ✅ **Test notifications** before scheduling
7. ✅ **Audit logs** of admin actions

---

## 📋 **Expanded Use Cases**

### **Use Case 1: Monitor Active Notifications** 👀
**Actor:** Admin  
**Goal:** See which users have email notifications enabled and their schedules

**Flow:**
1. Admin opens "Saved Search Notifications Manager"
2. System displays all saved searches with notifications enabled
3. Admin filters by status (Active/Disabled/Overridden)
4. Admin sees summary statistics

**Success Criteria:**
- All saved searches with notifications visible
- Can filter by user, status, search name
- Shows last sent, next scheduled time
- Displays user preferences vs admin overrides

---

### **Use Case 2: Override User Schedule** ⏰
**Actor:** Admin  
**Goal:** Change notification timing for load balancing or policy enforcement

**Scenario:** User set notifications for 2 AM. Admin wants all emails sent at 9 AM for server efficiency.

**Flow:**
1. Admin finds user's saved search
2. Clicks "Override Settings"
3. Modal shows:
   - User's current settings (Frequency: Daily, Time: 02:00)
   - Override options (checkboxes to enable overrides)
   - New time selector
   - New frequency selector
   - Reason textarea
4. Admin selects "Override time" → sets to 09:00 AM
5. Admin provides reason: "Server load management"
6. Clicks "Save Override"
7. System saves override to database
8. Recurring job respects admin override over user preference

**Database Structure:**
```javascript
{
  "_id": "search_id_123",
  "username": "john_doe",
  "name": "M|25-35|5'6-5'9|65|001",
  "notifications": {
    // User's original preferences
    "enabled": true,
    "frequency": "daily",
    "time": "02:00",
    "dayOfWeek": null
  },
  "adminOverride": {
    // Admin overrides (takes precedence)
    "enabled": true,
    "frequency": "daily",    // Can be different from user
    "time": "09:00",         // Overrides user's time
    "dayOfWeek": null,
    "reason": "Server load management",
    "overriddenBy": "admin",
    "overriddenAt": "2025-11-06T21:00:00Z"
  }
}
```

**Success Criteria:**
- Override saved successfully
- Job uses admin override instead of user preference
- Override is visible in UI
- Can be removed/edited later

---

### **Use Case 3: Disable Problematic Notifications** 🔕
**Actor:** Admin  
**Goal:** Stop spam or problematic notifications

**Scenario:** User's search is too broad (M|18-99|0-10'0|0|001) and generates 500+ matches daily, causing spam complaints.

**Flow:**
1. Admin identifies problematic search
2. Clicks "Disable"
3. Modal prompts for:
   - Reason (required): "Search too broad - generating spam"
   - ☐ Notify user via email
4. Admin submits
5. System sets `adminOverride.disabled = true`
6. Optional: Email sent to user explaining why
7. User CANNOT re-enable (admin lock)

**Database Structure:**
```javascript
{
  "adminOverride": {
    "disabled": true,
    "reason": "Search too broad - generating spam",
    "disabledBy": "admin",
    "disabledAt": "2025-11-06T21:05:00Z",
    "userNotified": true
  }
}
```

**Success Criteria:**
- Notifications immediately stopped
- User sees message: "Notifications disabled by admin"
- Admin can re-enable later
- Audit trail preserved

---

### **Use Case 4: Bulk Operations** 📦
**Actor:** Admin  
**Goal:** Apply changes to multiple searches at once

**Scenarios:**
1. **System Maintenance:** Disable all notifications temporarily
2. **Policy Change:** Move all 2 AM notifications to 9 AM
3. **User Offboarding:** Disable all searches for terminated user

**Flow:**
1. Admin filters searches (e.g., all for user "john_doe")
2. Selects checkboxes for multiple searches
3. Clicks "Bulk Actions" dropdown
4. Chooses action:
   - Disable Selected
   - Change Time for Selected
   - Delete Selected
5. Confirmation dialog shows:
   - Number of searches affected
   - Prompt for reason
6. Admin confirms
7. System applies to all selected

**Success Criteria:**
- Can select/deselect multiple searches
- Bulk operations complete in <5 seconds
- Confirmation required before execution
- All changes logged

---

### **Use Case 5: Debug Notification Issues** 🔍
**Actor:** Admin  
**Goal:** Troubleshoot why user isn't receiving emails

**Scenario:** User reports not receiving daily match notifications.

**Flow:**
1. Admin searches for user's saved searches
2. Clicks on specific search to view details
3. Views notification status panel:
   ```
   Status: ✅ Enabled
   Frequency: Daily @ 09:00 AM
   Last Sent: 3 days ago ❌ (Expected: daily)
   Last Attempt: Today @ 09:00 AM
   Error: Email bounce - invalid address (user@oldomain.com)
   ```
4. Admin clicks "View Full Logs"
5. Sees history:
   ```
   2025-11-06 09:00 - Attempted - Failed (bounce)
   2025-11-05 09:00 - Attempted - Failed (bounce)
   2025-11-04 09:00 - Sent successfully
   2025-11-03 09:00 - Sent successfully
   ```
6. Admin identifies issue: User changed email address
7. Admin updates user's email (or asks user to update)
8. Admin clicks "Retry Now" to send immediate test
9. Email sent successfully ✅

**Success Criteria:**
- Full notification history visible
- Error messages clear and actionable
- Can retry manually
- Can test before resuming schedule

---

### **Use Case 6: Analytics & Reporting** 📊
**Actor:** Admin  
**Goal:** Understand notification system usage and performance

**Dashboard Shows:**
```
┌────────────────────────────────────────────────┐
│ 📊 Notification Analytics                      │
├────────────────────────────────────────────────┤
│ ┌──────────┬──────────┬──────────┬──────────┐ │
│ │ Total    │ Emails   │ Emails   │ Success  │ │
│ │ Active   │ Today    │ This Week│ Rate     │ │
│ │ 123      │ 89       │ 432      │ 96.5%    │ │
│ └──────────┴──────────┴──────────┴──────────┘ │
│                                                │
│ By Frequency:                                  │
│ ████████████████████ Daily (98, 80%)           │
│ █████ Weekly (25, 20%)                         │
│                                                │
│ Peak Send Times:                               │
│ 09:00 AM: ████████████████████████ 45 emails  │
│ 10:00 AM: ████████████ 23 emails               │
│ 02:00 PM: ██████ 12 emails                     │
│                                                │
│ Top Users (by active searches):                │
│ 1. john_doe: 12 searches                       │
│ 2. jane_smith: 8 searches                      │
│ 3. mike_johnson: 6 searches                    │
│                                                │
│ Recent Errors:                                 │
│ • Email bounce: 4 (3.5%)                       │
│ • No matches found: 2 (1.7%)                   │
│ • Search error: 1 (0.9%)                       │
└────────────────────────────────────────────────┘
```

**Metrics Tracked:**
- Total active searches with notifications
- Emails sent (today, week, month, all-time)
- Success rate and error breakdown
- Distribution by frequency (daily vs weekly)
- Peak sending times
- Top users by notification count
- Average matches per email
- Bounce rate and reasons

**Success Criteria:**
- Real-time or near-real-time data
- Exportable to CSV/PDF
- Filterable by date range
- Trend graphs for key metrics

---

### **Use Case 7: Test Notifications** 🧪
**Actor:** Admin  
**Goal:** Verify notification works before affecting user

**Flow:**
1. Admin finds saved search
2. Clicks "Test Now"
3. Modal shows:
   ```
   This will run the search and send a test email immediately.
   
   Send to:
   ○ User (john_doe@email.com)
   ● Admin (admin@email.com)
   ○ Custom: [custom@email.com]
   
   [Cancel] [Send Test Email]
   ```
4. Admin selects recipient
5. Clicks "Send Test Email"
6. System:
   - Runs saved search immediately
   - Finds matches
   - Generates email
   - Sends to selected address
   - Shows preview of email sent
7. Admin verifies email received correctly

**Success Criteria:**
- Test doesn't affect user's schedule
- Email sent within 30 seconds
- Shows number of matches found
- Preview of email content
- Error handling if search fails

---

### **Use Case 8: Notification History Audit** 📜
**Actor:** Admin  
**Goal:** Track admin actions for compliance and troubleshooting

**Audit Log Shows:**
```
Date/Time          | Admin  | Action           | Search              | Reason
-------------------|--------|------------------|---------------------|-------------------
2025-11-06 14:32   | admin  | Disabled         | M|25-35|...| 001   | Too broad - spam
2025-11-06 10:15   | admin  | Override time    | F|28-40|...| 002   | Server load mgmt
2025-11-05 09:00   | admin  | Bulk disable (5) | Multiple searches   | System maintenance
2025-11-04 16:45   | admin  | Enabled          | M|30-45|...| 003   | Issue resolved
2025-11-04 11:20   | admin  | Test sent        | F|22-32|...| 004   | Debugging
```

**Features:**
- Sortable by date, admin, action type
- Filterable by admin, user, search
- Searchable
- Exportable to CSV
- Shows before/after values for overrides

**Success Criteria:**
- All admin actions logged
- Cannot be deleted or modified
- Accessible for compliance review
- Retention policy configurable

---

## 🏗️ **Architecture**

### **Backend API Endpoints**

```python
# Get all saved searches with notifications
GET /api/admin/saved-searches/with-notifications
Response: {
  "searches": [
    {
      "_id": "search_id",
      "username": "john_doe",
      "name": "M|25-35|...",
      "notifications": {...},
      "adminOverride": {...},
      "lastNotificationSent": "2025-11-06T09:00:00Z",
      "notificationHistory": [...]
    }
  ]
}

# Override notification settings
POST /api/admin/saved-searches/override
Body: {
  "searchId": "search_id",
  "username": "john_doe",
  "override": {
    "time": "09:00",
    "frequency": "daily",
    "reason": "Server load management"
  }
}

# Disable notifications
POST /api/admin/saved-searches/disable
Body: {
  "searchId": "search_id",
  "username": "john_doe",
  "reason": "Search too broad",
  "notifyUser": true
}

# Enable notifications
POST /api/admin/saved-searches/enable
Body: {
  "searchId": "search_id",
  "username": "john_doe"
}

# Bulk operations
POST /api/admin/saved-searches/bulk-disable
Body: {
  "searchIds": ["id1", "id2", "id3"],
  "reason": "System maintenance"
}

# Test notification
POST /api/admin/saved-searches/test
Body: {
  "searchId": "search_id",
  "testEmail": "admin@email.com"
}

# Get analytics
GET /api/admin/saved-searches/analytics
Response: {
  "totalActive": 123,
  "emailsSentToday": 89,
  "emailsSentWeek": 432,
  "successRate": 96.5,
  "byFrequency": {...},
  "peakTimes": [...],
  "topUsers": [...]
}

# Get audit log
GET /api/admin/saved-searches/audit-log
Response: {
  "logs": [
    {
      "timestamp": "...",
      "admin": "admin",
      "action": "disabled",
      "searchId": "...",
      "reason": "..."
    }
  ]
}
```

### **Job Logic Update**

```python
# saved_search_matches_notifier.py
async def should_send_notification(search):
    """
    Check if notification should be sent
    Priority: adminOverride > user notifications
    """
    # Check if disabled by admin
    if search.get('adminOverride', {}).get('disabled'):
        return False
    
    # Check if user disabled
    if not search.get('notifications', {}).get('enabled'):
        return False
    
    # Determine schedule to use (admin override takes precedence)
    if search.get('adminOverride') and not search['adminOverride'].get('disabled'):
        schedule = search['adminOverride']
    else:
        schedule = search['notifications']
    
    # Check if it's time to send based on schedule
    return is_notification_due(schedule)
```

### **Frontend Components**

```
/admin/
  └── SavedSearchNotificationManager.js
      ├── SearchList (main list view)
      ├── SearchCard (individual search display)
      ├── OverrideModal (override settings UI)
      ├── DisableModal (disable confirmation)
      ├── TestModal (test email UI)
      ├── AnalyticsDashboard (statistics panel)
      └── AuditLog (admin action history)
```

---

## 🎨 **UI Wireframes**

### **Main Screen:**
```
┌──────────────────────────────────────────────────────────────────┐
│ 📧 Saved Search Notifications Manager            [📊][🔄]        │
├──────────────────────────────────────────────────────────────────┤
│ Status: [Active Only ▼]  Search: [_______________] [🔍]         │
│ Selected: 0  [Bulk Actions ▼]                                    │
├──────────────────────────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────────────────────────┐ │
│ │ ☐ john_doe | M|25-35|5'6-5'9|65|001              [✏️ Edit]  │ │
│ │ 🟢 Active | Daily @ 09:00 AM                                │ │
│ │ Last: 2h ago | Next: Tomorrow 09:00                         │ │
│ │ ✅ Override: Time changed to 09:00 (was 02:00)              │ │
│ │ [🔕 Disable] [🧪 Test]                                       │ │
│ └──────────────────────────────────────────────────────────────┘ │
│ ┌──────────────────────────────────────────────────────────────┐ │
│ │ ☐ jane_smith | F|28-40|5'2-5'8|80|002            [✏️ Edit]  │ │
│ │ 🔴 Disabled by Admin                                         │ │
│ │ Reason: Search too broad - spam complaints                   │ │
│ │ [🔔 Enable] [🧪 Test]                                        │ │
│ └──────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ Showing 1-50 of 123 | [1][2][3]...[Next]                        │
└──────────────────────────────────────────────────────────────────┘
```

---

## 📊 **Benefits of This Design**

### **For Admins:**
1. ✅ **Full visibility** into all notification activity
2. ✅ **Fine-grained control** over each search
3. ✅ **Bulk operations** for efficiency
4. ✅ **Analytics** for insights
5. ✅ **Audit trail** for compliance

### **For System:**
1. ✅ **Load balancing** via time overrides
2. ✅ **Spam prevention** via disabling
3. ✅ **Resource optimization** via bulk control
4. ✅ **Simple architecture** (single job)
5. ✅ **Easy debugging** via logs and tests

### **For Users:**
1. ✅ **Transparency** if admin overrides
2. ✅ **Notification** if disabled
3. ✅ **Still have preferences** (visible even if overridden)
4. ✅ **Predictable** behavior

---

## 🚀 **Implementation Priority**

### **Phase 1: Core Viewing (Week 1)**
- [ ] Backend endpoint: GET saved searches with notifications
- [ ] Frontend: Main list view
- [ ] Frontend: Filters (status, user, search)
- [ ] Frontend: Search display with status

### **Phase 2: Override & Disable (Week 2)**
- [ ] Backend: Override endpoint
- [ ] Backend: Disable/enable endpoints
- [ ] Frontend: Override modal UI
- [ ] Frontend: Disable modal UI
- [ ] Job logic: Respect admin overrides

### **Phase 3: Bulk & Test (Week 3)**
- [ ] Backend: Bulk operations
- [ ] Backend: Test notification
- [ ] Frontend: Bulk selection UI
- [ ] Frontend: Test modal UI

### **Phase 4: Analytics & Audit (Week 4)**
- [ ] Backend: Analytics endpoint
- [ ] Backend: Audit log endpoint
- [ ] Frontend: Analytics dashboard
- [ ] Frontend: Audit log viewer

---

## ✅ **Success Metrics**

- Admin can view all active notifications: **100% visibility**
- Admin can override any notification: **100% control**
- All admin actions logged: **100% audit trail**
- Response time < 2s: **Fast performance**
- Zero notification spam incidents: **Quality**

---

**Status:** 📋 Design Complete, Ready for Implementation  
**Estimated Timeline:** 4 weeks  
**Complexity:** Medium  
**Impact:** High (Admin control + user experience)
