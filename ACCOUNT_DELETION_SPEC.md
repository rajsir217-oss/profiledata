# Account Deletion & Unsubscribe System - Technical Specification

## 📋 Overview

This document outlines the implementation of a comprehensive account deletion and unsubscribe system following industry best practices (GDPR, CCPA, and general data privacy regulations).

---

## 🎯 Key Features

### 1. Soft Delete with Grace Period
- **30-day grace period** before permanent deletion
- Account immediately becomes invisible to other users
- User can reactivate anytime during grace period
- All services paused (search, messaging, matching)

### 2. Email Notification Timeline
| Day | Event | Email Content |
|-----|-------|---------------|
| 0 | Deletion Requested | Confirmation + instructions to cancel |
| 7 | First Reminder | 23 days remaining to reactivate |
| 23 | Final Warning | 7 days remaining, download data reminder |
| 30 | Permanent Deletion | Account and data permanently deleted |

### 3. Data Export (GDPR Compliance)
- Download all personal data in JSON format
- Includes: profile, messages, matches, favorites, activity logs
- Available before and during grace period
- Automatic email with download link

### 4. Unsubscribe Options
- ✅ Marketing emails
- ✅ Match notifications
- ✅ Message alerts
- ✅ Activity updates
- ✅ All communications (except critical account emails)

---

## 🏗️ Architecture

### Database Schema Changes

#### Users Collection - New Fields
```javascript
{
  "deletionRequest": {
    "status": "pending_deletion" | "scheduled" | null,
    "requestedAt": ISODate,
    "scheduledDeletionDate": ISODate,  // requestedAt + 30 days
    "reason": String,                   // User's reason for leaving
    "dataExportUrl": String,            // Link to exported data
    "emailsSent": {
      "confirmation": Boolean,
      "day7Reminder": Boolean,
      "day23Warning": Boolean,
      "finalDeletion": Boolean
    }
  },
  "emailPreferences": {
    "marketing": Boolean,
    "matchNotifications": Boolean,
    "messageAlerts": Boolean,
    "activityUpdates": Boolean,
    "systemEmails": true  // Always true (account security)
  }
}
```

#### Deleted Users Archive Collection (Optional)
```javascript
{
  "originalUsername": String,
  "deletedAt": ISODate,
  "deletionReason": String,
  "accountAge": Number,              // Days from creation to deletion
  "activityStats": {
    "totalMatches": Number,
    "totalMessages": Number,
    "profileViews": Number
  }
}
```

---

## 🔌 Backend Implementation

### API Endpoints

#### 1. Request Account Deletion
```http
POST /api/users/account/request-deletion
Authorization: Bearer {token}
Content-Type: application/json

{
  "reason": "string",        // Optional: user's reason
  "downloadData": boolean    // Whether to generate data export
}

Response 200:
{
  "message": "Deletion scheduled for {date}",
  "scheduledDate": "2025-12-22T00:00:00Z",
  "daysRemaining": 30,
  "dataExportUrl": "https://..."  // If requested
}
```

#### 2. Cancel Deletion (Reactivate)
```http
POST /api/users/account/cancel-deletion
Authorization: Bearer {token}

Response 200:
{
  "message": "Account reactivated successfully",
  "status": "active"
}
```

#### 3. Download Data Export
```http
GET /api/users/account/export-data
Authorization: Bearer {token}

Response 200:
Content-Type: application/json
Content-Disposition: attachment; filename="account-data-{username}-{date}.json"

{
  "exportDate": "2025-11-22T...",
  "profile": { ... },
  "messages": [ ... ],
  "matches": [ ... ],
  "favorites": [ ... ],
  "activityLogs": [ ... ]
}
```

#### 4. Update Email Preferences (Unsubscribe)
```http
PUT /api/users/email-preferences
Authorization: Bearer {token}
Content-Type: application/json

{
  "marketing": false,
  "matchNotifications": false,
  "messageAlerts": true,
  "activityUpdates": false
}

Response 200:
{
  "message": "Preferences updated",
  "preferences": { ... }
}
```

#### 5. Unsubscribe via Email Link (No Auth Required)
```http
GET /api/users/unsubscribe/{token}?type=all|marketing|matches|messages

Response: Redirect to unsubscribe confirmation page
```

---

## 📧 Email Templates

### 1. Deletion Confirmation Email
**Subject:** Account Deletion Requested - You Have 30 Days to Change Your Mind

```
Hi {firstName},

We've received your request to delete your L3V3L account.

⚠️ IMPORTANT INFORMATION:

• Your account will be permanently deleted on {deletionDate}
• You have 30 days to reactivate if you change your mind
• During this period:
  - Your profile is hidden from all users
  - You cannot send or receive messages
  - All matchmaking is paused

REACTIVATE YOUR ACCOUNT:
Simply log back in at https://l3v3lmatches.com/login
or click: {reactivationLink}

DOWNLOAD YOUR DATA:
Before deletion, download all your data: {dataExportLink}

WHY WE'LL MISS YOU:
• {matchCount} potential matches
• {messageCount} conversations
• {daysActive} days of connections

Need help? Contact us: support@l3v3lmatches.com

Best regards,
The L3V3L Team
```

### 2. Day 7 Reminder
**Subject:** 23 Days Left - Your L3V3L Account Will Be Deleted

```
Hi {firstName},

Just a reminder that your account deletion is scheduled for {deletionDate}.

TIME REMAINING: 23 days

To keep your account:
{reactivationLink}

Download your data:
{dataExportLink}
```

### 3. Day 23 Final Warning
**Subject:** ⚠️ FINAL WARNING: 7 Days Until Permanent Deletion

```
Hi {firstName},

This is your final reminder. Your L3V3L account will be permanently 
deleted in 7 days on {deletionDate}.

⏰ LAST CHANCE TO:
• Reactivate your account: {reactivationLink}
• Download your data: {dataExportLink}

After {deletionDate}, all your data will be permanently removed and 
cannot be recovered.

If you're leaving due to an issue, please let us know:
{feedbackLink}
```

### 4. Permanent Deletion Confirmation
**Subject:** Your L3V3L Account Has Been Deleted

```
Hi {firstName},

Your L3V3L account has been permanently deleted as requested.

WHAT WAS DELETED:
✓ Profile and photos
✓ Messages and conversations
✓ Match history
✓ Favorites and shortlists
✓ Activity logs

This action is irreversible.

We're sorry to see you go. If you ever want to rejoin:
https://l3v3lmatches.com/register

Thank you for being part of L3V3L.

Best regards,
The L3V3L Team
```

---

## 🎨 Frontend Implementation

### 1. Account Deletion Section (Preferences Page)

```javascript
// Location: /preferences (Danger Zone section)

<div className="danger-zone">
  <h3>🗑️ Delete Account</h3>
  <div className="warning-box">
    <strong>⚠️ Warning: This action is permanent</strong>
    <p>Deleting your account will:</p>
    <ul>
      <li>Remove your profile from all searches</li>
      <li>Delete all your messages and matches</li>
      <li>Remove your photos and personal information</li>
      <li>Cancel your subscription (if any)</li>
    </ul>
    <p>You'll have 30 days to change your mind and reactivate.</p>
  </div>
  
  <button 
    className="btn btn-danger"
    onClick={openDeleteModal}
  >
    Delete My Account
  </button>
</div>
```

### 2. Deletion Confirmation Modal

```javascript
// Shows deletion flow with steps

<Modal>
  <h3>Are you sure you want to delete your account?</h3>
  
  <div className="deletion-checklist">
    <label>
      <input type="checkbox" />
      I understand my data will be deleted after 30 days
    </label>
    <label>
      <input type="checkbox" />
      I want to download my data before deletion
    </label>
  </div>
  
  <textarea 
    placeholder="Tell us why you're leaving (optional)"
    rows={4}
  />
  
  <div className="modal-actions">
    <button className="btn btn-secondary" onClick={close}>
      Cancel
    </button>
    <button 
      className="btn btn-danger" 
      onClick={confirmDeletion}
      disabled={!allChecked}
    >
      Yes, Delete My Account
    </button>
  </div>
</Modal>
```

### 3. Reactivation Page

```javascript
// Route: /reactivate-account
// Shows when user logs in during grace period

<div className="reactivation-page">
  <h1>Welcome Back!</h1>
  <p>Your account is scheduled for deletion on {deletionDate}</p>
  <p>Days remaining: {daysLeft}</p>
  
  <div className="reactivation-options">
    <button 
      className="btn btn-primary btn-lg"
      onClick={reactivateAccount}
    >
      Reactivate My Account
    </button>
    
    <button 
      className="btn btn-secondary"
      onClick={downloadData}
    >
      Download My Data
    </button>
  </div>
</div>
```

### 4. Email Preferences Section

```javascript
// Location: /preferences (Notifications section)

<div className="email-preferences">
  <h3>📧 Email Preferences</h3>
  
  <label className="preference-item">
    <input 
      type="checkbox" 
      checked={preferences.marketing}
      onChange={(e) => updatePref('marketing', e.target.checked)}
    />
    <div>
      <strong>Marketing Emails</strong>
      <span>Product updates, tips, and special offers</span>
    </div>
  </label>
  
  <label className="preference-item">
    <input 
      type="checkbox" 
      checked={preferences.matchNotifications}
      onChange={(e) => updatePref('matchNotifications', e.target.checked)}
    />
    <div>
      <strong>New Match Alerts</strong>
      <span>When you get a new match</span>
    </div>
  </label>
  
  <label className="preference-item">
    <input 
      type="checkbox" 
      checked={preferences.messageAlerts}
      onChange={(e) => updatePref('messageAlerts', e.target.checked)}
    />
    <div>
      <strong>Message Notifications</strong>
      <span>When someone messages you</span>
    </div>
  </label>
  
  <button className="btn btn-link text-danger" onClick={unsubscribeAll}>
    Unsubscribe from all emails
  </button>
</div>
```

---

## ⏰ Scheduled Jobs

### 1. Send Reminder Emails

```python
# Job: daily at 9:00 AM
# File: job_templates/deletion_reminder_emails.py

async def send_deletion_reminders():
    """Send reminder emails to users with pending deletions"""
    
    # Get all users with pending deletions
    users_pending_deletion = await db.users.find({
        "deletionRequest.status": "pending_deletion"
    }).to_list(1000)
    
    for user in users_pending_deletion:
        days_remaining = calculate_days_remaining(user)
        
        # Day 7 reminder
        if days_remaining == 23 and not user['deletionRequest']['emailsSent']['day7Reminder']:
            await send_day7_reminder(user)
            await mark_email_sent(user['username'], 'day7Reminder')
        
        # Day 23 final warning
        elif days_remaining == 7 and not user['deletionRequest']['emailsSent']['day23Warning']:
            await send_day23_warning(user)
            await mark_email_sent(user['username'], 'day23Warning')
```

### 2. Execute Permanent Deletions

```python
# Job: daily at 2:00 AM
# File: job_templates/permanent_deletion_job.py

async def execute_permanent_deletions():
    """Permanently delete accounts after grace period"""
    
    now = datetime.utcnow()
    
    # Find users whose deletion date has passed
    users_to_delete = await db.users.find({
        "deletionRequest.scheduledDeletionDate": {"$lte": now}
    }).to_list(1000)
    
    for user in users_to_delete:
        try:
            # Archive stats (optional)
            await archive_user_stats(user)
            
            # Permanent deletion (cascade delete)
            await delete_user_completely(user['username'])
            
            # Send final confirmation email
            await send_deletion_confirmation_email(user)
            
            logger.info(f"✅ Permanently deleted user: {user['username']}")
            
        except Exception as e:
            logger.error(f"❌ Failed to delete {user['username']}: {e}")
```

---

## 🔒 Security & Privacy Considerations

### 1. Data Retention
- **During Grace Period:** All data retained, account hidden
- **After 30 Days:** Complete data deletion (GDPR compliance)
- **Backups:** Purged from all backups within 90 days

### 2. Anonymization Options
For analytics purposes, optionally keep anonymized data:
- No PII (name, email, phone)
- Aggregated usage stats only
- Cannot be linked back to user

### 3. Right to be Forgotten (GDPR)
- Immediate deletion option (skip grace period) upon request
- Contact support@l3v3lmatches.com
- Manually verified and executed within 48 hours

### 4. Legal Requirements
- Log all deletion requests with timestamps
- Maintain deletion completion records for compliance
- Respect opt-outs in all email systems

---

## 📊 Analytics & Monitoring

### Metrics to Track
- Deletion request rate (daily/monthly)
- Reactivation rate (% who return during grace period)
- Top reasons for leaving
- Average time to reactivation
- Data export download rate

### Dashboard Alerts
- Spike in deletion requests (>10% increase)
- Low reactivation rate (<20%)
- Failed permanent deletions

---

## 🧪 Testing Checklist

### Functional Tests
- [ ] Request deletion creates proper database entry
- [ ] Account becomes invisible immediately
- [ ] Reminder emails sent at correct intervals
- [ ] Data export generates complete file
- [ ] Reactivation restores full account access
- [ ] Permanent deletion removes all data
- [ ] Email preferences persist correctly
- [ ] Unsubscribe links work without login

### Edge Cases
- [ ] Delete during active subscription
- [ ] Delete with pending messages
- [ ] Delete with pending match requests
- [ ] Reactivate on day 30 (last minute)
- [ ] Multiple deletion requests
- [ ] Delete + recreate same username

### Email Deliverability
- [ ] All emails reach inbox (not spam)
- [ ] Unsubscribe links work in all email clients
- [ ] Templates render correctly on mobile

---

## 📝 Implementation Priority

### Phase 1: Core Deletion (Week 1)
1. Database schema updates
2. Request deletion endpoint
3. Cancel deletion endpoint
4. Basic email notifications

### Phase 2: Grace Period Management (Week 2)
1. Scheduled jobs for reminders
2. Permanent deletion job
3. Reactivation page
4. Data export functionality

### Phase 3: Email Preferences (Week 3)
1. Unsubscribe system
2. Email preference UI
3. Preference management endpoints
4. Email template system

### Phase 4: Polish & Testing (Week 4)
1. Comprehensive testing
2. Analytics dashboard
3. Admin tools for manual deletions
4. Documentation updates

---

## 🔗 Related Documentation

- [Privacy Policy] - User rights section
- [Terms of Service] - Account termination clause
- [GDPR Compliance Guide] - Data deletion procedures
- [Email Template Guidelines] - Branding and tone

---

## 📞 Support

For questions or issues:
- Engineering: dev@l3v3lmatches.com
- Legal/Compliance: legal@l3v3lmatches.com
- User Support: support@l3v3lmatches.com

---

**Document Version:** 1.0  
**Last Updated:** 2025-11-22  
**Owner:** Engineering Team  
**Status:** 📝 Specification (Not Yet Implemented)
