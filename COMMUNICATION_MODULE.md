# 📱 Communication & Notification Module

**Branch:** `feature/communication-module`  
**Status:** Phase 1 Complete (Backend Core)  
**Created:** October 20, 2025

---

## 🎯 **Overview**

Comprehensive communication and notification system designed specifically for dating applications. Enables users to receive timely, personalized notifications about matches, messages, profile activity, and more through email, SMS, and push notifications.

---

## ✨ **Key Features**

### **1. Multi-Channel Delivery**
- ✅ **Email** - Rich HTML emails with images and styling
- ✅ **SMS** - Cost-optimized text messages
- ✅ **Push** - In-app and mobile push notifications (planned)

### **2. Smart Notification Management**
- ✅ **Quiet Hours** - Timezone-aware do-not-disturb periods
- ✅ **Rate Limiting** - Prevent notification spam
- ✅ **Priority System** - Critical alerts bypass quiet hours
- ✅ **Batching** - Group similar notifications
- ✅ **Cost Controls** - Daily SMS spending limits

### **3. Dynamic Templates**
- ✅ **Variable Substitution** - `{match.firstName}`, `{match.age}`, etc.
- ✅ **Conditional Logic** - `{% if matchScore >= 90 %}High match!{% endif %}`
- ✅ **A/B Testing** - Test different message variants
- ✅ **Character Optimization** - Smart SMS length management

### **4. Analytics & Tracking**
- ✅ **Engagement Metrics** - Open rates, click rates
- ✅ **Cost Tracking** - SMS expense monitoring
- ✅ **User Engagement Scoring** - Identify active vs. disengaged users
- ✅ **Campaign Performance** - Template effectiveness

---

## 📊 **Architecture**

```
┌─────────────────────────────────────────────────┐
│          Notification Triggers                   │
│  (Matches, Messages, Profile Views, PII, etc.)  │
└───────────────┬─────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────┐
│       Notification Service Layer                 │
│  - Queue Management                              │
│  - Template Rendering                            │
│  - User Preference Checking                      │
│  - Rate Limiting                                 │
└───────────────┬─────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────┐
│         Notification Queue                       │
│         (MongoDB Collection)                     │
└───────────────┬─────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────┐
│           Job Scheduler                          │
│  - Email Notifier Job (every 5min)              │
│  - SMS Notifier Job (every 10min)               │
└───────────────┬─────────────────────────────────┘
                │
    ┌───────────┴───────────┐
    ▼                       ▼
┌─────────┐          ┌─────────┐
│  SMTP   │          │ Twilio  │
│ Server  │          │   API   │
└─────────┘          └─────────┘
```

---

## 🗄️ **Database Collections**

### **1. notification_preferences**
User notification settings and preferences

```javascript
{
  username: "john_doe",
  channels: {
    new_match: ["email", "sms", "push"],
    new_message: ["sms", "push"],
    profile_view: ["push"]
  },
  frequency: {
    instant: ["new_match", "pii_request"],
    digest: {
      profile_view: "daily",
      new_message: "hourly"
    }
  },
  quietHours: {
    enabled: true,
    start: "22:00",
    end: "08:00",
    timezone: "America/Los_Angeles",
    exceptions: ["pii_request", "suspicious_login"]
  },
  rateLimit: {
    sms: { max: 5, period: "daily" },
    email: { max: 20, period: "daily" }
  },
  smsOptimization: {
    verifiedUsersOnly: true,
    minimumMatchScore: 80,
    priorityTriggersOnly: true
  },
  engagement: {
    emailOpenRate: 0.45,
    smsClickRate: 0.32,
    lastEngagement: "2025-10-20T10:30:00Z"
  }
}
```

### **2. notification_queue**
Pending notifications awaiting delivery

```javascript
{
  username: "jane_smith",
  trigger: "new_match",
  priority: "high",
  channels: ["email", "sms"],
  templateData: {
    recipient: {
      firstName: "Jane",
      username: "jane_smith"
    },
    match: {
      firstName: "Mike",
      username: "mike_jones",
      age: 32,
      location: "San Francisco, CA",
      matchScore: 92,
      profilePhotoUrl: "https://...",
      bio: "Love hiking and coffee..."
    },
    app: {
      profileUrl: "https://app.com/profile/mike_jones",
      chatUrl: "https://app.com/chat/mike_jones"
    }
  },
  status: "pending",  // pending, scheduled, sent, failed
  scheduledFor: null,  // or datetime for quiet hours
  attempts: 0,
  createdAt: "2025-10-20T12:00:00Z"
}
```

### **3. notification_log**
Sent notifications for analytics

```javascript
{
  username: "john_doe",
  trigger: "new_match",
  channel: "email",
  priority: "high",
  sentAt: "2025-10-20T12:05:00Z",
  deliveredAt: "2025-10-20T12:05:15Z",
  openedAt: "2025-10-20T12:30:00Z",
  clickedAt: "2025-10-20T12:31:00Z",
  cost: 0.0,  // $0 for email
  opened: true,
  clicked: true,
  subject: "🎯 Sarah (92% match) is interested in you!",
  preview: "Great news! Sarah, a 92% match from...",
  abTestId: "email_subject_v2",
  abTestVariant: "urgency"
}
```

### **4. notification_templates**
Template definitions

```javascript
{
  templateId: "new_match_email",
  trigger: "new_match",
  channel: "email",
  subject: "🎯 {match.firstName} ({match.matchScore}% match) is interested in you!",
  bodyTemplate: `
    Hi {recipient.firstName},
    
    Great news! {match.firstName}, a {match.matchScore}% match from {match.location}, 
    just added you to their favorites.
    
    {% if match.matchScore >= 90 %}
      This is a HIGH COMPATIBILITY match! 🔥
    {% endif %}
    
    About {match.firstName}:
    - Age: {match.age}
    - Location: {match.location}
    - Bio: {match.bio}
    
    [View Profile]({app.profileUrl})
  `,
  maxLength: null,  // No limit for email
  priority: "high",
  conditions: {
    onlyIfVerified: true,
    minimumScore: 70
  },
  active: true
}
```

---

## 📬 **Notification Triggers**

### **Match-Related**
| Trigger | Description | Default Channels | Priority |
|---------|-------------|------------------|----------|
| `new_match` | New L3V3L match found | Email, Push | High |
| `mutual_favorite` | Both users favorited each other | Email, SMS, Push | High |
| `shortlist_added` | Someone added you to shortlist | Push | Medium |
| `match_milestone` | Match anniversary (7 days, 1 month) | Email | Low |

### **Profile Activity**
| Trigger | Description | Default Channels | Priority |
|---------|-------------|------------------|----------|
| `profile_view` | Someone viewed your profile | Push | Low |
| `favorited` | Someone favorited you | Push | Medium |
| `profile_visibility_spike` | Unusual traffic to your profile | Email | Medium |
| `search_appearance` | Your profile in X search results | Email | Low |

### **Messaging**
| Trigger | Description | Default Channels | Priority |
|---------|-------------|------------------|----------|
| `new_message` | New message received | SMS, Push | High |
| `message_read` | Your message was read | Push | Low |
| `conversation_cold` | No reply in 3 days | Email | Low |

### **Privacy/PII**
| Trigger | Description | Default Channels | Priority |
|---------|-------------|------------------|----------|
| `pii_request` | PII access request received | Email, SMS | Critical |
| `pii_granted` | PII access granted | Email | High |
| `pii_denied` | PII access denied | Email | Medium |
| `pii_expiring` | PII access expiring in 24h | Email | High |
| `suspicious_login` | Unusual login detected | Email, SMS | Critical |

### **Engagement**
| Trigger | Description | Default Channels | Priority |
|---------|-------------|------------------|----------|
| `unread_messages` | You have X unread messages | Email | Medium |
| `new_users_matching` | New users match your criteria | Email | Low |
| `profile_incomplete` | Complete profile reminder | Email | Low |
| `upload_photos` | Add photos reminder | Email | Low |

---

## 🔌 **API Endpoints**

### **Preferences Management**

#### `GET /api/notifications/preferences`
Get user's notification preferences

**Response:**
```json
{
  "username": "john_doe",
  "channels": {...},
  "frequency": {...},
  "quietHours": {...}
}
```

#### `PUT /api/notifications/preferences`
Update notification preferences

**Request Body:**
```json
{
  "channels": {
    "new_match": ["email", "push"],
    "new_message": ["sms"]
  },
  "quietHours": {
    "enabled": true,
    "start": "22:00",
    "end": "08:00"
  }
}
```

#### `POST /api/notifications/preferences/reset`
Reset preferences to defaults

---

### **Queue Management**

#### `POST /api/notifications/send`
Queue a notification for delivery

**Request Body:**
```json
{
  "username": "jane_smith",
  "trigger": "new_match",
  "priority": "high",
  "channels": ["email", "sms"],
  "templateData": {
    "match": {
      "firstName": "Mike",
      "age": 32,
      "matchScore": 92
    }
  }
}
```

#### `GET /api/notifications/queue`
Get user's notification queue

**Query Parameters:**
- `status` - Filter by status (pending, scheduled, sent)
- `limit` - Max results (default: 50)

---

### **Analytics**

#### `GET /api/notifications/analytics`
Get personal notification analytics

**Query Parameters:**
- `trigger` - Filter by trigger type
- `channel` - Filter by channel
- `days` - Time period (default: 30)

**Response:**
```json
{
  "totalSent": 150,
  "totalOpened": 67,
  "totalClicked": 23,
  "openRate": 44.67,
  "clickRate": 15.33,
  "totalCost": 11.25
}
```

#### `GET /api/notifications/analytics/global`
Get global analytics (admin only)

---

### **Tracking**

#### `GET /api/notifications/track/open/{log_id}`
Track email opened (embedded tracking pixel)

Returns 1x1 transparent GIF

#### `GET /api/notifications/track/click/{log_id}?redirect_url=...`
Track link clicked and redirect

---

### **Subscription Management**

#### `POST /api/notifications/unsubscribe`
Unsubscribe from all notifications

#### `POST /api/notifications/unsubscribe/{trigger}`
Unsubscribe from specific notification type

---

## 🛠️ **Job Templates**

### **1. Email Notifier**

**Schedule:** Every 5 minutes  
**Batch Size:** 100 notifications  
**Cost:** $0 (email is free)

**Parameters:**
```json
{
  "batchSize": 100,
  "priority": ["critical", "high", "medium", "low"],
  "respectQuietHours": true,
  "testMode": false,
  "testEmail": null
}
```

**Features:**
- HTML email with gradient header
- Embedded images
- Tracking pixels for open tracking
- Clickable links with tracking
- Unsubscribe footer
- Mobile-responsive design

**Environment Variables:**
```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
FROM_EMAIL=noreply@datingapp.com
FROM_NAME="L3V3L Dating"
APP_URL=https://app.datingsite.com
```

---

### **2. SMS Notifier**

**Schedule:** Every 10 minutes  
**Batch Size:** 50 notifications  
**Cost:** ~$0.0075 per SMS

**Parameters:**
```json
{
  "batchSize": 50,
  "costLimit": 100.00,
  "priorityOnly": true,
  "verifiedUsersOnly": true,
  "testMode": false,
  "testPhone": null
}
```

**Features:**
- Cost tracking and daily limits
- Character count optimization (160 char limit)
- URL shortening
- Priority filtering
- Match score filtering
- Verified users only option

**Environment Variables:**
```bash
SMS_PROVIDER=twilio
TWILIO_ACCOUNT_SID=your-account-sid
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_FROM_PHONE=+1234567890
```

**Cost Control:**
- Maximum 50 SMS per job run
- Daily cost limit (default: $100)
- Only send to verified users
- Minimum match score requirement
- Priority-based filtering

---

## 🎨 **Template Variables**

### **Recipient Info**
- `{recipient.firstName}` - John
- `{recipient.username}` - john_doe
- `{recipient.preferredName}` - Johnny

### **Match/Sender Info**
- `{match.firstName}` - Sarah
- `{match.username}` - sarah_smith
- `{match.age}` - 28
- `{match.location}` - San Francisco, CA
- `{match.profession}` - Software Engineer
- `{match.matchScore}` - 92
- `{match.profilePhotoUrl}` - https://...
- `{match.bio}` - Love hiking and coffee...

### **Context**
- `{event.type}` - new_match
- `{event.timestamp}` - 2025-10-20 12:00:00
- `{app.profileUrl}` - https://app.com/profile/sarah
- `{app.chatUrl}` - https://app.com/chat/sarah

### **Stats**
- `{stats.mutualMatches}` - 12
- `{stats.unreadMessages}` - 3
- `{stats.profileViews}` - 45

### **Conditional Logic**
```
{% if match.matchScore >= 90 %}
  This is a HIGH COMPATIBILITY match! 🔥
{% endif %}

{% if stats.mutualMatches > 5 %}
  You have {stats.mutualMatches} mutual connections!
{% endif %}
```

---

## 📈 **Usage Example**

### **Trigger a Notification from Code**

```python
from services.notification_service import NotificationService
from models.notification_models import (
    NotificationQueueCreate,
    NotificationTrigger,
    NotificationChannel,
    NotificationPriority
)

# When a new match is found
async def on_new_match(user1_username, user2_username, match_score):
    service = NotificationService(db)
    
    # Get user data
    user2 = await db.users.find_one({"username": user2_username})
    
    # Queue notification
    await service.enqueue_notification(
        NotificationQueueCreate(
            username=user1_username,
            trigger=NotificationTrigger.NEW_MATCH,
            priority=NotificationPriority.HIGH,
            channels=[NotificationChannel.EMAIL, NotificationChannel.SMS],
            templateData={
                "recipient": {
                    "firstName": user1.get("firstName"),
                    "username": user1_username
                },
                "match": {
                    "firstName": user2.get("firstName"),
                    "username": user2_username,
                    "age": user2.get("age"),
                    "location": f"{user2.get('city')}, {user2.get('state')}",
                    "matchScore": match_score,
                    "profilePhotoUrl": user2.get("profilePhoto"),
                    "bio": user2.get("bio")
                },
                "app": {
                    "profileUrl": f"https://app.com/profile/{user2_username}",
                    "chatUrl": f"https://app.com/chat/{user2_username}"
                }
            }
        )
    )
```

---

## 🔐 **Security & Privacy**

### **PII Protection**
- Never include sensitive info in email/SMS previews
- Use placeholder images, not actual photos
- Show first name only, not full name
- Hide exact addresses (show city only)

### **Consent Management**
- ✅ Explicit opt-in required
- ✅ Double opt-in for email/phone verification
- ✅ One-click unsubscribe
- ✅ GDPR compliant

### **Rate Limiting**
- Prevent notification spam
- Configurable per channel
- Per-user limits

---

## ✅ **Testing**

### **Test Mode**
Both email and SMS jobs support test mode:

```json
{
  "testMode": true,
  "testEmail": "test@example.com",
  "testPhone": "+15555555555"
}
```

In test mode:
- Notifications sent to test email/phone only
- No cost tracking
- Normal queue processing

### **Manual Testing**
```bash
# 1. Create test notification
curl -X POST http://localhost:8000/api/notifications/send \
  -H "Content-Type: application/json" \
  -d '{
    "username": "test_user",
    "trigger": "new_match",
    "channels": ["email"],
    "templateData": {...}
  }'

# 2. Run email notifier job manually
# (via Dynamic Scheduler UI or API)

# 3. Check logs
curl http://localhost:8000/api/notifications/analytics?days=1
```

---

## 📝 **TODO - Next Phases**

### **Phase 2: Frontend UI** ⏳
- [ ] Notification preferences page component
- [ ] Toggle switches for each trigger type
- [ ] Quiet hours time picker
- [ ] Channel selection checkboxes
- [ ] SMS optimization settings
- [ ] Notification history view
- [ ] Analytics dashboard

### **Phase 3: Integration** ⏳
- [ ] Integrate with L3V3L matching system
- [ ] Integrate with messaging system
- [ ] Integrate with PII access system
- [ ] Integrate with profile view tracking
- [ ] Add notification menu to sidebar

### **Phase 4: Advanced Features** ⏳
- [ ] Push notification support (FCM)
- [ ] In-app notification bell
- [ ] Real-time notification feed
- [ ] Notification sound preferences
- [ ] Custom notification sounds
- [ ] Rich push notifications with images

### **Phase 5: Intelligence** ⏳
- [ ] ML-based send time optimization
- [ ] Smart frequency adjustment
- [ ] Engagement prediction
- [ ] Auto-unsubscribe disengaged users
- [ ] Personalized template selection

---

## 🚀 **Deployment**

### **1. Environment Setup**
```bash
# Email (SMTP)
export SMTP_HOST="smtp.gmail.com"
export SMTP_PORT="587"
export SMTP_USER="your-email@gmail.com"
export SMTP_PASSWORD="your-app-password"
export FROM_EMAIL="noreply@datingapp.com"
export FROM_NAME="L3V3L Dating"

# SMS (Twilio)
export SMS_PROVIDER="twilio"
export TWILIO_ACCOUNT_SID="your-account-sid"
export TWILIO_AUTH_TOKEN="your-auth-token"
export TWILIO_FROM_PHONE="+1234567890"

# App URLs
export APP_URL="https://app.datingsite.com"
```

### **2. Database Indexes**
```javascript
// notification_queue
db.notification_queue.createIndex({ "username": 1, "status": 1 });
db.notification_queue.createIndex({ "scheduledFor": 1 });
db.notification_queue.createIndex({ "createdAt": 1 });

// notification_log
db.notification_log.createIndex({ "username": 1, "createdAt": -1 });
db.notification_log.createIndex({ "trigger": 1, "channel": 1 });
db.notification_log.createIndex({ "createdAt": -1 });

// notification_preferences
db.notification_preferences.createIndex({ "username": 1 }, { unique: true });
```

### **3. Register Job Templates**
Update `job_templates/registry.py`:
```python
from job_templates.email_notifier import JOB_INFO as EMAIL_NOTIFIER_INFO
from job_templates.sms_notifier import JOB_INFO as SMS_NOTIFIER_INFO

JOB_TEMPLATES = {
    # ... existing templates
    "email_notifier": EMAIL_NOTIFIER_INFO,
    "sms_notifier": SMS_NOTIFIER_INFO
}
```

### **4. Create Scheduled Jobs**
Via Dynamic Scheduler UI:
1. Create "Email Notifier" job (runs every 5 minutes)
2. Create "SMS Notifier" job (runs every 10 minutes)

---

## 📞 **Support**

For questions or issues:
- Check logs: `notification_log` collection
- View queue: `GET /api/notifications/queue`
- Analytics: `GET /api/notifications/analytics/global`

---

**Built with ❤️ for better dating app communication**
