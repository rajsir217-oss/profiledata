# 📧 Template & Event Queue Manager - Complete Guide

**Created:** October 21, 2025  
**Status:** Production Ready ✅

---

## 🎯 Overview

Two powerful admin tools for managing the notification system:

1. **Template Manager** - Create, edit, and manage email/SMS templates
2. **Event Queue Manager** - Monitor notification events and delivery status

---

## 📧 Template Manager

### **Access:**
```
http://localhost:3000/template-manager
```

**Navigation:** Sidebar → Admin Section → "📧 Template Manager"

### **Features:**

#### 1. **Template List View**
- Grid view of all notification templates
- Filter by category, channel, and search
- Visual status indicators (Active/Disabled)
- Template count display

#### 2. **Create/Edit Templates**
- Rich HTML editor for email body
- Subject line with variable support
- Template metadata (trigger, category, channel)
- Active/inactive toggle

#### 3. **Preview Templates**
- Live preview with sample data
- See exactly how emails will render
- Test variable replacement

#### 4. **Test Send**
- Send test notification to yourself
- Verify template rendering
- Check email delivery

#### 5. **Quick Actions**
- ✏️ **Edit** - Modify template
- 👁️ **Preview** - See rendered output
- 📤 **Test Send** - Send to your email
- ⏸️/▶️ **Enable/Disable** - Toggle status

---

### **Template Variables**

Use these in subject lines and body:

**Recipient:**
```
{recipient.firstName}
{recipient.username}
{recipient.age}
{recipient.location}
```

**Match/Sender:**
```
{match.firstName}
{match.age}
{match.matchScore}
{match.location}
{match.occupation}
```

**App URLs:**
```
{app.profileUrl}
{app.chatUrl}
{app.matchUrl}
{app.settingsUrl}
{app.unsubscribeUrl}
```

**Statistics:**
```
{stats.mutualMatches}
{stats.unreadMessages}
{stats.profileViews}
{stats.newMatches}
```

---

### **Creating a New Template**

**Step 1:** Click "➕ Create Template"

**Step 2:** Fill in details:
- **Trigger Name:** e.g., `new_match`, `profile_view`
- **Channel:** Email, SMS, or Push
- **Category:** Match, Activity, Messages, Privacy, Engagement

**Step 3:** Write subject line:
```
🎉 You have a new match, {recipient.firstName}!
```

**Step 4:** Write HTML body:
```html
<div style="font-family: Arial; max-width: 600px;">
  <h2>Hi {recipient.firstName}! 🎉</h2>
  <p>You matched with <strong>{match.firstName}</strong>, {match.age}.</p>
  <p>Match Score: <strong>{match.matchScore}%</strong></p>
  <a href="{app.matchUrl}" style="background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
    View Profile
  </a>
</div>
```

**Step 5:** Enable template and click "💾 Save Template"

---

### **Editing Existing Templates**

1. Find template in grid
2. Click ✏️ **Edit** button
3. Modify subject, body, or settings
4. Click "💾 Save Template"

**Note:** Cannot change trigger name after creation

---

### **Testing Templates**

**Method 1: Test Send Button**
1. Click 📤 **Test Send** on template card
2. Check your email inbox
3. Verify rendering and links

**Method 2: Preview**
1. Click 👁️ **Preview** button
2. See rendered output with sample data
3. Check variable replacement

**Method 3: Notification Tester**
1. Navigate to "Notification Tester"
2. Select trigger type
3. Fill in test data
4. Send test notification

---

## 📊 Event Queue Manager

### **Access:**
```
http://localhost:3000/event-queue-manager
```

**Navigation:** Sidebar → Admin Section → "📊 Event Queue"

### **Features:**

#### 1. **Real-Time Stats**
- **Queued** - Pending notifications
- **Processing** - Currently sending
- **Sent (24h)** - Successfully delivered
- **Failed (24h)** - Delivery failures

#### 2. **Tabs**
- **📥 Queue** - Pending/processing notifications
- **📜 Logs** - Sent notification history

#### 3. **Event Tracking**
Each event shows:
- **Recipient** - Username and email
- **Event Type** - Icon and trigger name
- **Triggered By** - Who caused the event
- **Channels** - Email, SMS, Push
- **Date/Time** - When queued/sent
- **Status** - Queued, Processing, Sent, Failed
- **Actions** - Delete or Retry

#### 4. **Filters**
- Search by username or trigger
- Filter by status
- Filter by channel
- Real-time result count

#### 5. **Actions**
- **🗑️ Delete** - Remove from queue
- **🔄 Retry** - Retry failed notifications
- **🔄 Refresh** - Reload data (auto-refreshes every 10s)

---

### **Event Format**

Each event record contains:

```
[Recipient] | [Event] | [Triggered By] | [DateTime] | [Status]
```

**Example:**
```
Raj | shortlist_added | Rama | 10/21/2025 15:05:05 | sent-success
```

---

### **Status Types**

| Status | Icon | Color | Meaning |
|--------|------|-------|---------|
| **queued** | ⏳ | Blue | Waiting to send |
| **processing** | ⚙️ | Yellow | Currently sending |
| **sent** | ✅ | Green | Successfully delivered |
| **success** | ✅ | Green | Delivery confirmed |
| **failed** | ❌ | Red | Delivery failed |
| **error** | ❌ | Red | System error |

---

### **Monitoring Workflow**

**1. Check Stats**
- Monitor queued count (should be low)
- Watch for failed notifications

**2. Review Queue**
- Check for stuck items (queued too long)
- Look for processing issues

**3. Inspect Logs**
- Verify successful deliveries
- Investigate failures

**4. Handle Failures**
- Click 🔄 **Retry** on failed items
- Check error messages
- Fix template or system issues

---

## 🔧 Setup & Configuration

### **1. Run Template Setup Script**

```bash
cd /Users/rajsiripuram02/opt/appsrc/profiledata
python3 setup_email_templates.py
```

This creates 11 default templates:
- New Match
- Mutual Favorite
- Shortlist Added
- Match Milestone
- Profile View
- Someone Favorited You
- New Message
- Message Read
- PII Request
- PII Access Granted
- Unread Messages

---

### **2. Configure SMTP (for Email)**

Add to `.env` or `config.py`:

```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
FROM_EMAIL=noreply@yourapp.com
FROM_NAME=Your App Name
```

---

### **3. Configure SMS (Optional)**

For SMS notifications via Twilio:

```bash
SMS_PROVIDER=twilio
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_FROM_PHONE=+1234567890
```

---

## 🎨 UI Components Created

### **Files Added:**

**Frontend:**
```
frontend/src/components/TemplateManager.js       (586 lines)
frontend/src/components/TemplateManager.css      (301 lines)
frontend/src/components/EventQueueManager.js     (350 lines)
frontend/src/components/EventQueueManager.css    (402 lines)
```

**Backend:**
```
fastapi_backend/routers/notifications.py         (+23 lines)
```

**Total:** ~1,662 lines of new code

---

## 📡 API Endpoints

### **Template Manager Uses:**

```bash
GET    /api/notifications/templates          # List all templates
POST   /api/notifications/templates          # Create new template
PUT    /api/notifications/templates/{id}     # Update template
DELETE /api/notifications/templates/{id}     # Delete template
POST   /api/notifications/send                # Send test notification
```

### **Event Queue Manager Uses:**

```bash
GET    /api/notifications/queue               # Get pending notifications
DELETE /api/notifications/queue/{id}          # Remove from queue
POST   /api/notifications/queue/{id}/retry    # Retry failed notification
GET    /api/notifications/logs                # Get sent notifications history
GET    /api/notifications/analytics           # Get statistics
```

---

## 🧪 Testing Guide

### **Test Template Creation**

1. Navigate to Template Manager
2. Click "➕ Create Template"
3. Fill in:
   - Trigger: `test_notification`
   - Channel: Email
   - Category: Custom
   - Subject: `Test - Hello {recipient.firstName}`
   - Body: Simple HTML with variables
4. Save template
5. Click 📤 **Test Send**
6. Check your email

---

### **Test Event Tracking**

1. Navigate to Event Queue Manager
2. Send a test notification (from Template Manager or Notification Tester)
3. Watch Queue tab - should see new item with "queued" status
4. Wait 10 seconds (auto-refresh)
5. Status should change to "processing" then "sent"
6. Switch to Logs tab
7. See completed notification with delivery details

---

## 🎯 Common Use Cases

### **Use Case 1: Update Welcome Email**

1. Go to Template Manager
2. Search for "new_match"
3. Click ✏️ Edit
4. Modify subject or body
5. Click 👁️ Preview to verify
6. Click 📤 Test Send
7. Save changes

---

### **Use Case 2: Debug Failed Notifications**

1. Go to Event Queue Manager
2. Check stats - look for failed count
3. Filter by Status: "failed"
4. Click on failed item to see error
5. Fix template or configuration issue
6. Click 🔄 Retry

---

### **Use Case 3: Create Seasonal Campaign**

1. Go to Template Manager
2. Click "➕ Create Template"
3. Trigger: `holiday_special`
4. Create festive email design
5. Enable template
6. Use Notification Tester to send to test users

---

## 🔒 Security & Permissions

- **Admin Only:** Both tools require admin authentication
- **Role-Based:** Regular users cannot access
- **Protected Routes:** Uses `ProtectedRoute` wrapper
- **JWT Auth:** All API calls include Bearer token

---

## 📊 Performance

- **Auto-Refresh:** Queue updates every 10 seconds
- **Pagination:** Logs support limit/skip parameters
- **Filtering:** Client-side for fast response
- **Caching:** Templates cached in component state

---

## 🐛 Troubleshooting

### **Templates Not Loading**

**Problem:** Empty template list

**Solution:**
1. Run `python3 setup_email_templates.py`
2. Check MongoDB connection
3. Verify auth token is valid

---

### **Test Email Not Received**

**Problem:** Test send succeeds but no email

**Solution:**
1. Check SMTP configuration
2. Verify email address in user profile
3. Check spam folder
4. Review notification logs for errors

---

### **Queue Items Stuck**

**Problem:** Items stay in "processing" status

**Solution:**
1. Check email/SMS job is running
2. Review job logs in Dynamic Scheduler
3. Verify SMTP/Twilio credentials
4. Restart notification jobs

---

## 🚀 Next Steps

**Potential Enhancements:**

1. **Rich Text Editor** - WYSIWYG editor for templates
2. **Template Versioning** - Track changes and rollback
3. **A/B Testing** - Test different subject lines
4. **Scheduled Campaigns** - Send bulk notifications
5. **SMS Templates** - Dedicated SMS editor
6. **Push Notifications** - Add push template support
7. **Analytics Dashboard** - Detailed delivery metrics
8. **Export Logs** - Download event history as CSV

---

## 📝 Summary

You now have:

✅ **Template Manager** - Full CRUD for notification templates  
✅ **Event Queue Manager** - Real-time event monitoring  
✅ **Preview & Testing** - Verify templates before sending  
✅ **Admin UI** - Easy-to-use interfaces  
✅ **API Endpoints** - Backend support for all operations  
✅ **Navigation** - Added to admin sidebar  

**All set up and ready to manage your notification system!** 🎉

---

## 📞 Quick Reference

| Task | Tool | Action |
|------|------|--------|
| Edit email template | Template Manager | Click ✏️ on template |
| Test notification | Template Manager | Click 📤 Test Send |
| Check delivery status | Event Queue Manager | View Queue or Logs tab |
| Retry failed notification | Event Queue Manager | Click 🔄 on failed item |
| Create new template | Template Manager | Click ➕ Create Template |
| Monitor system health | Event Queue Manager | Check Stats cards |

---

**Happy templating!** 📧✨
