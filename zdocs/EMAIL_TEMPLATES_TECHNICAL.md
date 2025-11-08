# Email Templates - Technical Documentation

**For:** Developers, DevOps, System Architects  
**Last Updated:** November 7, 2025  
**Version:** 1.0  
**System:** ProfileData Matrimonial Platform

---

## 📋 Table of Contents

1. [System Architecture](#system-architecture)
2. [Database Schema](#database-schema)
3. [API Endpoints](#api-endpoints)
4. [Template Engine](#template-engine)
5. [Job Scheduler](#job-scheduler)
6. [Integration Guide](#integration-guide)
7. [Configuration](#configuration)
8. [Testing](#testing)
9. [Monitoring](#monitoring)
10. [Troubleshooting](#troubleshooting)

---

## 🏗️ System Architecture

### **High-Level Overview**

```
┌─────────────┐      ┌──────────────┐      ┌─────────────┐
│   Backend   │─────▶│ Notification │─────▶│  MongoDB    │
│   Routes    │      │   Service    │      │   Queue     │
└─────────────┘      └──────────────┘      └─────────────┘
                                                    │
                                                    ▼
                                            ┌──────────────┐
                                            │  Scheduler   │
                                            │  (Unified)   │
                                            └──────────────┘
                                                    │
                                                    ▼
                                            ┌──────────────┐
                                            │Email Notifier│
                                            │     Job      │
                                            └──────────────┘
                                                    │
                            ┌───────────────────────┼────────────────────┐
                            ▼                       ▼                    ▼
                    ┌──────────────┐       ┌──────────────┐    ┌──────────────┐
                    │   Template   │       │    SMTP      │    │ Notification │
                    │   Renderer   │       │   Server     │    │     Log      │
                    └──────────────┘       └──────────────┘    └──────────────┘
```

### **Component Responsibilities**

| Component | Responsibility | Technology |
|-----------|---------------|------------|
| **Backend Routes** | Create notifications from app events | FastAPI |
| **NotificationService** | Queue management, template rendering | Python/Motor |
| **MongoDB Collections** | Store templates, queue, logs | MongoDB |
| **Unified Scheduler** | Run jobs on schedule | APScheduler |
| **Email Notifier Job** | Process queue, send emails | SMTP/Python |
| **Template Renderer** | Replace variables in templates | String replacement |
| **SMTP Server** | Deliver emails | Gmail/SendGrid/etc |

---

## 🗄️ Database Schema

### **Collection: `notification_templates`**

Stores all email template definitions.

```javascript
{
  "_id": ObjectId("..."),
  "trigger": "mutual_favorite",           // Unique trigger identifier
  "channel": "email",                     // email, push, sms
  "category": "match",                    // match, engagement, security, etc.
  "subject": "💖 It's a match! {match.firstName}",
  "body": "<!DOCTYPE html>...",          // Full HTML template
  "priority": "high",                     // critical, high, medium, low
  "enabled": true,                        // Template active status
  "createdAt": ISODate("2025-11-07"),
  "updatedAt": ISODate("2025-11-07")
}
```

**Indexes:**
```javascript
db.notification_templates.createIndex({ "trigger": 1, "channel": 1 }, { unique: true })
db.notification_templates.createIndex({ "category": 1 })
db.notification_templates.createIndex({ "enabled": 1 })
```

### **Collection: `notification_queue`**

Stores pending notifications waiting to be sent.

```javascript
{
  "_id": ObjectId("..."),
  "trigger": "favorited",                 // Which template to use
  "channel": "email",                     // Delivery channel
  "recipient": {
    "username": "john_doe",
    "email": "john@example.com",
    "firstName": "John"
  },
  "data": {                               // Template variables
    "match": {
      "firstName": "Sarah",
      "age": "28",
      "location": "NYC"
    },
    "app": {
      "profileUrl": "https://...",
      "unsubscribeUrl": "https://..."
    }
  },
  "priority": "medium",
  "status": "pending",                    // pending, processing, sent, failed
  "attempts": 0,                          // Retry counter
  "scheduledFor": ISODate("2025-11-07"),  // When to send
  "createdAt": ISODate("2025-11-07"),
  "updatedAt": ISODate("2025-11-07"),
  "error": null                           // Error message if failed
}
```

**Indexes:**
```javascript
db.notification_queue.createIndex({ "status": 1, "scheduledFor": 1 })
db.notification_queue.createIndex({ "recipient.username": 1 })
db.notification_queue.createIndex({ "trigger": 1 })
db.notification_queue.createIndex({ "createdAt": 1 }, { expireAfterSeconds: 2592000 }) // 30 days TTL
```

### **Collection: `notification_log`**

Stores sent/failed notification history.

```javascript
{
  "_id": ObjectId("..."),
  "trigger": "favorited",
  "channel": "email",
  "recipient": {
    "username": "john_doe",
    "email": "john@example.com"
  },
  "status": "sent",                       // sent, failed
  "sentAt": ISODate("2025-11-07"),
  "attempts": 1,
  "error": null,
  "metadata": {
    "emailId": "msg-12345",
    "smtpResponse": "250 OK"
  }
}
```

**Indexes:**
```javascript
db.notification_log.createIndex({ "recipient.username": 1, "sentAt": -1 })
db.notification_log.createIndex({ "status": 1 })
db.notification_log.createIndex({ "trigger": 1 })
db.notification_log.createIndex({ "sentAt": 1 }, { expireAfterSeconds: 7776000 }) // 90 days TTL
```

---

## 🔌 API Endpoints

### **Email Templates API**

**Base URL:** `/api/users/email-templates`

#### **GET `/templates`**
Get all email templates with optional filtering.

**Auth:** Admin only (JWT required)

**Query Parameters:**
- `category` (optional): Filter by category

**Response:**
```json
{
  "templates": [
    {
      "_id": "...",
      "trigger": "mutual_favorite",
      "channel": "email",
      "category": "match",
      "subject": "💖 It's a match!",
      "body": "<!DOCTYPE html>...",
      "priority": "high",
      "enabled": true,
      "createdAt": "2025-11-07T00:00:00Z",
      "updatedAt": "2025-11-07T00:00:00Z"
    }
  ],
  "total": 20
}
```

#### **GET `/templates/{trigger}`**
Get specific template by trigger name.

**Auth:** Admin only

**Response:**
```json
{
  "_id": "...",
  "trigger": "favorited",
  "subject": "💝 {match.firstName} added you...",
  "body": "<!DOCTYPE html>...",
  ...
}
```

#### **GET `/templates/categories`**
Get list of template categories with counts.

**Auth:** Admin only

**Response:**
```json
{
  "categories": ["match", "engagement", "security", "messages", ...],
  "counts": {
    "match": 2,
    "engagement": 4,
    "security": 1,
    ...
  }
}
```

### **Notification Service API**

Located in `services/notification_service.py`

```python
from services.notification_service import NotificationService

service = NotificationService(db)

# Create notification
await service.create_notification(
    trigger="favorited",
    channel="email",
    recipient_username="john_doe",
    template_data={
        "match": {"firstName": "Sarah", "age": "28"},
        "app": {"profileUrl": "..."}
    },
    priority="medium",
    scheduled_for=None  # Send immediately
)

# Get pending notifications
notifications = await service.get_pending_notifications(
    channel="email",
    limit=100
)

# Mark as sent
await service.mark_as_sent(
    notification_id=ObjectId("..."),
    channel="email",
    success=True,
    error=None
)
```

---

## ⚙️ Template Engine

### **Variable Replacement System**

Templates use `{variable.name}` syntax for dynamic content.

**Example Template:**
```html
<p>Hi {recipient.firstName},</p>
<p>{match.firstName} added you to their favorites!</p>
<a href="{app.profileUrl}">View Profile</a>
```

**Template Data:**
```python
{
    "recipient": {
        "firstName": "John",
        "lastName": "Doe"
    },
    "match": {
        "firstName": "Sarah",
        "age": "28",
        "location": "NYC"
    },
    "app": {
        "profileUrl": "https://app.com/profile/sarah",
        "unsubscribeUrl": "https://app.com/unsubscribe"
    }
}
```

**Rendered Output:**
```html
<p>Hi John,</p>
<p>Sarah added you to their favorites!</p>
<a href="https://app.com/profile/sarah">View Profile</a>
```

### **Rendering Algorithm**

```python
def render_template(template: str, data: dict) -> str:
    """
    Replace {variable.name} placeholders with values from data dict.
    Supports nested dictionaries.
    """
    result = template
    
    for key, value in data.items():
        if isinstance(value, dict):
            # Handle nested objects: {match.firstName}
            for sub_key, sub_value in value.items():
                placeholder = f"{{{key}.{sub_key}}}"
                result = result.replace(placeholder, str(sub_value))
        else:
            # Handle simple variables: {username}
            placeholder = f"{{{key}}}"
            result = result.replace(placeholder, str(value))
    
    return result
```

### **Standard Template Variables**

All templates should support these variables:

```python
{
    "recipient": {
        "username": str,
        "firstName": str,
        "lastName": str,
        "email": str
    },
    "match": {
        "username": str,
        "firstName": str,
        "lastName": str,
        "age": str,
        "location": str,
        "profession": str,
        "matchScore": str  # Percentage
    },
    "contact": {
        "email": str,
        "phone": str
    },
    "login": {
        "location": str,
        "device": str,
        "timestamp": str,
        "ipAddress": str
    },
    "app": {
        "profileUrl": str,
        "conversationUrl": str,
        "dashboardUrl": str,
        "unsubscribeUrl": str,
        "preferencesUrl": str
    }
}
```

---

## 📅 Job Scheduler

### **Email Notifier Job**

**File:** `fastapi_backend/job_templates/email_notifier_template.py`

**Schedule:** Every 5 minutes (configurable)

**Configuration:**
```python
{
    "jobName": "Email Notifier",
    "templateType": "email_notifier",
    "schedule": {
        "type": "interval",
        "intervalMinutes": 5
    },
    "parameters": {
        "batchSize": 100,              # Process 100 emails per run
        "priority": ["critical", "high", "medium", "low"],
        "respectQuietHours": true,     # Honor user quiet hours
        "testMode": false,             # Send to test email if true
        "testEmail": null
    },
    "enabled": true
}
```

### **Job Execution Flow**

```python
# Pseudo-code for email_notifier job
async def execute_job():
    # 1. Fetch pending notifications
    notifications = await get_pending_notifications(
        channel="email",
        limit=100,
        statuses=["pending"]
    )
    
    if not notifications:
        return {"message": "No pending notifications"}
    
    for notification in notifications:
        try:
            # 2. Mark as processing
            await update_status(notification.id, "processing")
            
            # 3. Fetch template
            template = await get_template(
                trigger=notification.trigger,
                channel="email"
            )
            
            # 4. Render email
            subject = render_template(template.subject, notification.data)
            body = render_template(template.body, notification.data)
            
            # 5. Get recipient email
            user = await get_user(notification.recipient.username)
            email = user.email or user.contactEmail
            
            # 6. Send via SMTP
            await send_email(
                to=email,
                subject=subject,
                body=body
            )
            
            # 7. Mark as sent
            await mark_as_sent(notification.id)
            
            # 8. Log notification
            await log_notification(notification, status="sent")
            
        except Exception as e:
            # 9. Handle failure
            await mark_as_failed(notification.id, error=str(e))
            await log_notification(notification, status="failed", error=e)
```

### **Retry Logic**

```python
MAX_ATTEMPTS = 3
RETRY_DELAYS = [5, 15, 30]  # minutes

if notification.attempts < MAX_ATTEMPTS:
    # Retry with exponential backoff
    delay = RETRY_DELAYS[notification.attempts]
    notification.scheduledFor = now() + timedelta(minutes=delay)
    notification.attempts += 1
    notification.status = "pending"
else:
    # Max attempts reached, mark as failed
    notification.status = "failed"
    notification.error = "Max retry attempts reached"
```

---

## 🔗 Integration Guide

### **Step 1: Create Notification from Your Code**

When an event happens (user favorites someone, new message, etc.), create a notification:

```python
# Example: In routes.py or service layer
from services.notification_service import NotificationService

@router.post("/favorites/{target_username}")
async def add_to_favorites(
    target_username: str,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    # 1. Business logic - add to favorites
    await db.favorites.insert_one({
        "username": current_user["username"],
        "target": target_username,
        "createdAt": datetime.utcnow()
    })
    
    # 2. Create email notification
    service = NotificationService(db)
    await service.create_notification(
        trigger="favorited",  # Must match template trigger
        channel="email",
        recipient_username=target_username,
        template_data={
            "recipient": {
                "firstName": target_user["firstName"]
            },
            "match": {
                "firstName": current_user["firstName"],
                "age": str(current_user.get("age", "")),
                "location": current_user.get("location", "")
            },
            "app": {
                "profileUrl": f"{settings.frontend_url}/profile/{current_user['username']}",
                "favoriteBackUrl": f"{settings.frontend_url}/favorites",
                "unsubscribeUrl": f"{settings.frontend_url}/preferences"
            }
        },
        priority="medium"
    )
    
    return {"message": "Favorited and notification queued"}
```

### **Step 2: Add New Template (If Needed)**

```python
# Create new template in MongoDB
await db.notification_templates.insert_one({
    "trigger": "new_trigger_name",
    "channel": "email",
    "category": "engagement",
    "subject": "🎉 {recipient.firstName}, something happened!",
    "body": """
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; }
        .container { max-width: 600px; margin: 0 auto; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Hello {recipient.firstName}!</h1>
        <p>{match.firstName} did something cool.</p>
        <a href="{app.actionUrl}">Take Action</a>
    </div>
</body>
</html>
    """,
    "priority": "medium",
    "enabled": True,
    "createdAt": datetime.utcnow(),
    "updatedAt": datetime.utcnow()
})
```

### **Step 3: Test the Integration**

```python
# Test script
async def test_new_notification():
    service = NotificationService(db)
    
    # Create test notification
    await service.create_notification(
        trigger="new_trigger_name",
        channel="email",
        recipient_username="test_user",
        template_data={
            "recipient": {"firstName": "Test"},
            "match": {"firstName": "Demo"},
            "app": {"actionUrl": "https://..."}
        },
        priority="low"
    )
    
    print("Test notification created!")
    print("Check Event Queue Manager to see it")
    print("Email Notifier job will process it in ~5 minutes")
```

---

## ⚙️ Configuration

### **Environment Variables (.env.local)**

```bash
# SMTP Configuration (Required for email sending)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-specific-password
FROM_EMAIL=noreply@yourapp.com
FROM_NAME=YourApp

# Application URLs
FRONTEND_URL=https://yourapp.com
BACKEND_URL=https://api.yourapp.com

# MongoDB
MONGODB_URL=mongodb://localhost:27017
DATABASE_NAME=matrimonialDB

# Scheduler Settings
SCHEDULER_ENABLED=true
EMAIL_NOTIFIER_INTERVAL_MINUTES=5
```

### **SMTP Provider Configuration**

#### **Gmail**
```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=app-specific-password  # Not your Gmail password!
```

**Setup:**
1. Enable 2FA on Gmail account
2. Generate App Password: Google Account → Security → 2-Step Verification → App Passwords
3. Use app password in `SMTP_PASSWORD`

#### **SendGrid**
```bash
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASSWORD=your-sendgrid-api-key
```

#### **AWS SES**
```bash
SMTP_HOST=email-smtp.us-east-1.amazonaws.com
SMTP_PORT=587
SMTP_USER=your-ses-smtp-username
SMTP_PASSWORD=your-ses-smtp-password
```

---

## 🧪 Testing

### **Unit Testing Templates**

```python
# tests/test_notification_service.py
import pytest
from services.notification_service import NotificationService

@pytest.mark.asyncio
async def test_template_rendering():
    service = NotificationService(db)
    
    template = "Hi {recipient.firstName}, {match.firstName} likes you!"
    data = {
        "recipient": {"firstName": "John"},
        "match": {"firstName": "Sarah"}
    }
    
    result = service.render_template(template, data)
    assert result == "Hi John, Sarah likes you!"

@pytest.mark.asyncio
async def test_create_notification():
    service = NotificationService(db)
    
    notification_id = await service.create_notification(
        trigger="test_trigger",
        channel="email",
        recipient_username="test_user",
        template_data={"test": "data"}
    )
    
    assert notification_id is not None
    
    # Verify in database
    notif = await db.notification_queue.find_one({"_id": notification_id})
    assert notif["trigger"] == "test_trigger"
    assert notif["status"] == "pending"
```

### **Integration Testing**

```bash
# Create test notifications
cd fastapi_backend
python3 test_notification_templates.py

# Check queue
python3 test_notification_templates.py status

# Manually trigger email notifier job
python3 -c "
from job_templates.email_notifier_template import execute_job
import asyncio
asyncio.run(execute_job())
"
```

### **Manual Testing via UI**

1. **Event Queue Manager**
   - Admin → Notification Management
   - Create test notification manually
   - Monitor status changes

2. **Email Templates Preview**
   - Admin → Email Templates
   - Click any template to preview
   - Verify variable replacement

---

## 📊 Monitoring

### **Key Metrics to Track**

```python
# Email sending metrics
{
    "total_sent_24h": 1234,
    "failed_deliveries": 5,
    "average_send_time_ms": 450,
    "queue_size": 45,
    "oldest_queued_age_minutes": 12
}
```

### **Database Queries for Monitoring**

```javascript
// Check queue health
db.notification_queue.aggregate([
    {$match: {channel: "email"}},
    {$group: {
        _id: "$status",
        count: {$sum: 1}
    }}
])

// Failed notifications in last 24h
db.notification_log.find({
    status: "failed",
    sentAt: {$gte: new Date(Date.now() - 86400000)}
}).count()

// Average processing time
db.notification_log.aggregate([
    {$match: {status: "sent"}},
    {$group: {
        _id: null,
        avgTime: {$avg: {$subtract: ["$sentAt", "$createdAt"]}}
    }}
])
```

### **Health Check Endpoint**

```python
@router.get("/health/email-system")
async def email_system_health():
    queue_size = await db.notification_queue.count_documents({"status": "pending"})
    failed_24h = await db.notification_log.count_documents({
        "status": "failed",
        "sentAt": {"$gte": datetime.utcnow() - timedelta(days=1)}
    })
    
    health = "healthy"
    if queue_size > 1000:
        health = "warning"
    if failed_24h > 50:
        health = "degraded"
    
    return {
        "status": health,
        "queue_size": queue_size,
        "failed_24h": failed_24h,
        "smtp_configured": bool(settings.smtp_user)
    }
```

---

## 🔧 Troubleshooting

### **Common Issues**

#### **1. Emails Not Sending**

**Symptoms:**
- Notifications stuck in "queued" status
- No movement in Event Queue

**Diagnosis:**
```bash
# Check if scheduler is running
curl http://localhost:8000/api/scheduler/jobs | jq '.jobs[] | select(.templateType=="email_notifier")'

# Check SMTP configuration
python3 -c "from config import Settings; s=Settings(); print(f'SMTP User: {s.smtp_user}', f'Password Set: {bool(s.smtp_password)}')"

# Check logs
tail -f fastapi_backend/backend.log | grep -i email
```

**Solutions:**
- ✅ Verify SMTP credentials in `.env.local`
- ✅ Enable email_notifier job in scheduler
- ✅ Check SMTP server allows connections from your IP
- ✅ For Gmail, use app-specific password, not account password

#### **2. Template Variables Not Replacing**

**Symptoms:**
- Emails show `{recipient.firstName}` instead of actual name

**Diagnosis:**
```python
# Test template rendering
from services.notification_service import NotificationService
service = NotificationService(db)

template = "Hi {recipient.firstName}"
data = {"recipient": {"firstName": "John"}}
result = service.render_template(template, data)
print(f"Result: {result}")  # Should be "Hi John"
```

**Solutions:**
- ✅ Ensure data structure matches template variables
- ✅ Check for typos in variable names (case-sensitive!)
- ✅ Verify nested structure: `{parent.child}` requires `data["parent"]["child"]`

#### **3. SMTP Authentication Errors**

**Error:** `535 Authentication failed`

**Solutions:**
- ✅ **Gmail:** Enable "Less secure app access" or use app password
- ✅ **SendGrid:** Use `apikey` as username
- ✅ **AWS SES:** Verify email domain
- ✅ Check credentials are correct (no extra spaces!)

#### **4. High Queue Backlog**

**Symptoms:**
- Queue size > 500
- Old notifications not processing

**Diagnosis:**
```javascript
// Check oldest queued notification
db.notification_queue.find({status: "pending"}).sort({createdAt: 1}).limit(1)

// Count by status
db.notification_queue.aggregate([
    {$group: {_id: "$status", count: {$sum: 1}}}
])
```

**Solutions:**
- ✅ Increase `batchSize` in email_notifier job (default: 100)
- ✅ Decrease scheduler interval (run more frequently)
- ✅ Check for failed notifications blocking queue
- ✅ Scale SMTP sending rate

---

## 📚 Additional Resources

### **File Locations**

```
profiledata/
├── fastapi_backend/
│   ├── services/
│   │   └── notification_service.py          # Core notification logic
│   ├── job_templates/
│   │   └── email_notifier_template.py       # Email sending job
│   ├── routers/
│   │   └── email_templates.py               # Template API endpoints
│   ├── models/
│   │   └── notification_models.py           # Pydantic models
│   └── seed_email_templates.py              # Initial 5 templates
│
├── frontend/src/components/
│   ├── EmailTemplatePreview.js              # Admin UI for templates
│   ├── EventQueueManager.js                 # Queue management UI
│   └── NotificationManagement.js            # Unified notification UI
│
└── zdocs/
    ├── EMAIL_TEMPLATES_USER_GUIDE.md        # This file
    ├── EMAIL_TEMPLATES_TECHNICAL.md         # Technical docs
    └── EMAIL_TEMPLATES_TODO.md              # Implementation plan
```

### **Related Documentation**

- **Notification System:** `NOTIFICATION_SYSTEM.md`
- **Scheduler Documentation:** `UNIFIED_SCHEDULER.md`
- **MongoDB Schema:** `DATABASE_SCHEMA.md`
- **API Reference:** `API_DOCUMENTATION.md`

### **External Links**

- **SMTP RFC:** https://datatracker.ietf.org/doc/html/rfc5321
- **Email Best Practices:** https://www.emailonacid.com/blog/
- **HTML Email Guide:** https://templates.mailchimp.com/

---

## 🤝 Contributing

### **Adding a New Template**

1. **Design HTML template** (use existing as reference)
2. **Add to database** via seed script
3. **Update documentation** (this file + user guide)
4. **Create integration code** in relevant route
5. **Test end-to-end** with test script
6. **Submit PR** with screenshots

### **Code Style**

```python
# Follow PEP 8
# Use type hints
# Add docstrings
# Write tests

async def create_notification(
    trigger: str,
    channel: str,
    recipient_username: str,
    template_data: Dict[str, Any],
    priority: str = "medium"
) -> ObjectId:
    """
    Create a new notification in the queue.
    
    Args:
        trigger: Template trigger name
        channel: Delivery channel (email, push, sms)
        recipient_username: Username of recipient
        template_data: Data for template variables
        priority: Notification priority level
        
    Returns:
        ObjectId: ID of created notification
        
    Raises:
        ValueError: If trigger or channel invalid
    """
    pass
```

---

## 📞 Support

**Technical Issues:**
- GitHub Issues: https://github.com/yourorg/profiledata/issues
- Email: dev@yourapp.com

**Documentation Updates:**
- Submit PR to update this file
- Last updated: November 7, 2025

---

**Version History:**

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-11-07 | Initial technical documentation |

---

*This documentation is maintained by the ProfileData development team.*
