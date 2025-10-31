# Email Tracking & Logo Implementation

**Date:** October 30, 2025  
**Status:** In Progress  
**Branch:** feature/email-workflow-event-queue

---

## 🎯 Goals

1. **Add Logo** - Include L3V3L logo in all email templates
2. **Track Email Opens** - Know when users open emails
3. **Track Link Clicks** - Know which links users click
4. **Analytics Dashboard** - View email engagement metrics

---

## 📊 How Email Tracking Works

### **1. Tracking Pixel (Email Opens)**

When email is opened, a 1x1 transparent image is loaded:

```html
<img src="https://yourdomain.com/api/email-tracking/pixel/{trackingId}" 
     width="1" height="1" style="display:none;" />
```

**Flow:**
1. User opens email
2. Email client loads image
3. Our server receives request for `/pixel/{trackingId}`
4. We log: "Email opened at {timestamp}"
5. Return transparent 1x1 PNG
6. Update database: `emailOpened: true`

### **2. Link Tracking (Clicks)**

All links in emails go through our tracking endpoint:

```html
<!-- Instead of: -->
<a href="https://l3v3l.com/profile/123">View Profile</a>

<!-- Use: -->
<a href="https://yourdomain.com/api/email-tracking/click/{trackingId}?url=https://l3v3l.com/profile/123&link_type=profile">
    View Profile
</a>
```

**Flow:**
1. User clicks link
2. Request goes to `/click/{trackingId}?url=...`
3. We log: "Link clicked: profile button"
4. Redirect user to actual destination
5. Update database: `emailClickCount++`

---

## 🗄️ Database Schema

### **New Collection: `email_analytics`**

```javascript
{
  _id: ObjectId("..."),
  tracking_id: "notification_queue_id",  // Links to notification_queue
  event_type: "open" | "click",          // Type of event
  timestamp: ISODate("2025-10-30..."),   // When it happened
  ip_address: "192.168.1.1",             // User's IP
  user_agent: "Mozilla/5.0...",          // Browser info
  
  // For click events only:
  link_type: "profile" | "chat" | "button" | "unsubscribe",
  destination_url: "https://..."
}
```

### **Updated: `notification_queue` Collection**

Added fields for tracking:

```javascript
{
  // ... existing fields ...
  
  // Email tracking fields (new):
  emailOpened: false,                    // Has email been opened?
  emailOpenedAt: null,                   // When was it first opened?
  emailOpenCount: 0,                     // How many times opened?
  emailClickCount: 0,                    // How many links clicked?
  emailClicks: [                         // Array of clicks
    {
      link_type: "profile",
      url: "https://...",
      timestamp: ISODate("...")
    }
  ]
}
```

---

## 📁 Files Created

### **1. `/fastapi_backend/routers/email_tracking.py`** ✅

**Endpoints:**

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/email-tracking/pixel/{tracking_id}` | GET | Track email open |
| `/api/email-tracking/click/{tracking_id}` | GET | Track link click & redirect |
| `/api/email-tracking/analytics/{tracking_id}` | GET | Get stats for one email |
| `/api/email-tracking/stats/summary` | GET | Get overall stats |

**Features:**
- Returns 1x1 transparent PNG for pixel
- Prevents duplicate open counting (same IP+UA)
- Logs all events to `email_analytics` collection
- Updates `notification_queue` with tracking data
- Handles redirects for click tracking

---

## 🎨 Logo Integration

### **Logo Files Found:**
- ✅ `frontend/public/logo192.png` (192x192)
- ✅ `frontend/public/logo512.png` (512x512)

### **Logo URL in Emails:**
```html
<img src="https://yourdomain.com/logo192.png" 
     alt="L3V3L Logo" 
     width="120" 
     style="display:block; margin: 0 auto;" />
```

**Note:** Logo needs to be accessible via public URL for email clients to load it.

---

## 🔧 Implementation Steps

### **Step 1: Register Email Tracking Router** ⏳

Add to `main.py`:

```python
# Add import (line ~26):
from routers.email_tracking import router as email_tracking_router

# Add router (line ~197):
app.include_router(email_tracking_router)  # Email tracking routes
```

### **Step 2: Update Email Templates** ⏳

For each template, add:

**A. Logo in Header:**
```html
<div class="header">
    <img src="{app.logoUrl}" alt="L3V3L" width="120" style="margin-bottom: 10px;" />
    <h1>🎉 Congratulations!</h1>
</div>
```

**B. Tracking Pixel in Footer:**
```html
<div class="footer">
    <p>Unsubscribe | Preferences</p>
    <!-- Tracking pixel -->
    <img src="{app.trackingPixelUrl}" width="1" height="1" style="display:none;" alt="" />
</div>
```

**C. Update Links to Use Tracking:**
```html
<!-- Before: -->
<a href="{app.profileUrl}" class="button">View Profile</a>

<!-- After: -->
<a href="{app.profileUrl_tracked}" class="button">View Profile</a>
```

### **Step 3: Update Email Notifier** ⏳

Modify `/job_templates/email_notifier_template.py` to inject tracking URLs:

```python
# Generate tracking ID (use notification _id)
tracking_id = str(notification["_id"])

# Build tracking URLs
template_data = {
    "app": {
        "logoUrl": f"{settings.backend_url}/logo192.png",
        "trackingPixelUrl": f"{settings.backend_url}/api/email-tracking/pixel/{tracking_id}",
        "profileUrl_tracked": f"{settings.backend_url}/api/email-tracking/click/{tracking_id}?url={profile_url}&link_type=profile",
        # ... other URLs with tracking
    }
}
```

### **Step 4: Copy Logo to Backend** ⏳

```bash
cp frontend/public/logo192.png fastapi_backend/uploads/logo.png
```

Or serve logo from frontend URL.

### **Step 5: Test Tracking** ⏳

```bash
# Send test email
python3 admin_tools/test_real_email.py

# Check if tracking pixel loaded
mongosh matrimonialDB --eval "db.email_analytics.find().pretty()"

# View analytics
curl http://localhost:8000/api/email-tracking/analytics/{tracking_id}
```

---

## 📊 Analytics Endpoints

### **1. Individual Email Stats**
```bash
GET /api/email-tracking/analytics/{tracking_id}
```

**Response:**
```json
{
  "tracking_id": "...",
  "opened": true,
  "open_count": 3,
  "unique_opens": 2,
  "first_opened": "2025-10-30T10:15:00Z",
  "click_count": 1,
  "clicks": [
    {
      "link_type": "profile",
      "url": "https://...",
      "timestamp": "2025-10-30T10:16:00Z"
    }
  ],
  "engagement_rate": 33.3
}
```

### **2. Overall Summary**
```bash
GET /api/email-tracking/stats/summary?days=30
```

**Response:**
```json
{
  "period_days": 30,
  "total_emails_sent": 100,
  "total_opens": 75,
  "total_clicks": 25,
  "unique_emails_opened": 70,
  "open_rate": 75.0,
  "click_through_rate": 33.3,
  "engagement_rate": 25.0
}
```

---

## 📈 Expected Metrics

### **Industry Benchmarks:**

| Metric | Bad | Average | Good | Excellent |
|--------|-----|---------|------|-----------|
| Open Rate | <15% | 15-25% | 25-35% | >35% |
| Click-Through Rate | <2% | 2-5% | 5-10% | >10% |
| Engagement Rate | <5% | 5-10% | 10-20% | >20% |

### **Our Goals:**

- ✅ **Open Rate:** >25% (with emojis in subjects)
- ✅ **CTR:** >5% (with clear CTAs)
- ✅ **Engagement:** >10% (with tracking)

---

## 🔐 Privacy Considerations

### **1. Tracking Pixel Privacy**
- **What we track:** Email opened (yes/no), timestamp, IP, user agent
- **What we DON'T track:** Email content reading, time spent
- **Consent:** Mentioned in privacy policy

### **2. Link Tracking**
- **Transparent:** All links go through our domain
- **No PII in URLs:** Tracking ID is opaque
- **User can opt-out:** Unsubscribe stops all tracking

### **3. Data Retention**
- Keep analytics for 90 days
- Aggregate metrics kept forever
- Individual IP addresses anonymized after 30 days

### **4. Legal Compliance**
- ✅ **GDPR:** Right to data deletion
- ✅ **CAN-SPAM:** Unsubscribe link required
- ✅ **Privacy Policy:** Updated with tracking disclosure

---

## 🧪 Testing Checklist

- [ ] Email tracking router registered in main.py
- [ ] Logo added to all templates
- [ ] Tracking pixel added to all templates
- [ ] Links updated to use tracking
- [ ] Test email sent successfully
- [ ] Tracking pixel loads (check email_analytics)
- [ ] Link clicks tracked correctly
- [ ] Analytics endpoint returns data
- [ ] Summary stats calculated correctly
- [ ] Logo displays in Gmail
- [ ] Logo displays in Outlook
- [ ] Tracking works in multiple email clients

---

## 🎨 Updated Template Example

```html
<!DOCTYPE html>
<html>
<head>
    <style>
        /* ... existing styles ... */
    </style>
</head>
<body>
    <div class="container">
        <!-- LOGO ADDED -->
        <div class="logo-container" style="text-align: center; padding: 20px 0;">
            <img src="{app.logoUrl}" alt="L3V3L" width="120" />
        </div>
        
        <div class="header">
            <h1>🎉 Congratulations!</h1>
        </div>
        
        <div class="content">
            <p>Hi {recipient.firstName},</p>
            
            <!-- TRACKED LINK -->
            <center>
                <a href="{app.profileUrl_tracked}" class="button">
                    View Full Profile
                </a>
            </center>
        </div>
        
        <div class="footer">
            <p>
                <a href="{app.unsubscribeUrl_tracked}">Unsubscribe</a> | 
                <a href="{app.preferencesUrl_tracked}">Preferences</a>
            </p>
            <!-- TRACKING PIXEL -->
            <img src="{app.trackingPixelUrl}" width="1" height="1" style="display:none;" alt="" />
        </div>
    </div>
</body>
</html>
```

---

## 📝 Next Steps

1. ✅ **Create email_tracking.py router** - DONE
2. ⏳ **Register router in main.py** - TODO
3. ⏳ **Update email templates with logo** - TODO
4. ⏳ **Update email templates with tracking pixel** - TODO
5. ⏳ **Update email notifier to inject tracking URLs** - TODO
6. ⏳ **Test with real email** - TODO
7. ⏳ **Verify tracking works** - TODO
8. ⏳ **Create analytics dashboard UI** - TODO (future)

---

## 🚀 Future Enhancements

### **Phase 2:**
- 📊 Analytics dashboard in admin UI
- 📈 Charts showing open/click trends
- 🎯 A/B testing for subject lines
- 🔔 Alerts for low engagement

### **Phase 3:**
- 🤖 ML-based send time optimization
- 📱 Push notification if email not opened
- 🔄 Auto-resend to non-openers
- 📧 Personalized content based on click behavior

---

**Status:** Router created, awaiting integration  
**Estimated Time:** 1-2 hours for full implementation  
**Testing Required:** Send real emails and verify tracking
