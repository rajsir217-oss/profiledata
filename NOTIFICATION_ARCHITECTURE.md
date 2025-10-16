# SMS & Email Notification Architecture

## 📊 Current State
**Status:** No notification system exists
- ✅ WebSocket real-time messaging  
- ✅ SSE for updates
- ❌ No email sending
- ❌ No SMS capability

---

## 🏗️ Recommended Architecture

### **System Design**
```
Application Layer (Routes/Events)
           ↓
Notification Manager (Unified Interface)
           ↓
    ┌──────┴──────┐
Email Service   SMS Service
    ↓               ↓
SendGrid        Twilio
```

### **Provider Recommendations**
- **Email:** SendGrid (100 free/day) → AWS SES (scale)
- **SMS:** Twilio ($0.0075/SMS)
- **Queue:** Redis (simple) → Celery (production)

---

## 📧 Key Components

### **1. File Structure**
```
fastapi_backend/
├── notifications/
│   ├── __init__.py
│   ├── email_service.py
│   ├── sms_service.py
│   ├── notification_manager.py
│   ├── templates/          # HTML email templates
│   │   ├── welcome.html
│   │   ├── password_reset.html
│   │   ├── match_notification.html
│   │   └── message_alert.html
│   └── queue_worker.py
├── config.py               # Add notification settings
└── requirements.txt        # Add sendgrid, twilio
```

### **2. Config Updates**
```python
# config.py additions
class Settings(BaseSettings):
    # Email
    sendgrid_api_key: Optional[str] = None
    sender_email: str = "noreply@l3v3l.com"
    
    # SMS
    twilio_account_sid: Optional[str] = None
    twilio_auth_token: Optional[str] = None
    twilio_phone_number: Optional[str] = None
    
    # Toggles
    enable_email: bool = True
    enable_sms: bool = False  # Costs money
```

### **3. Dependencies**
```txt
sendgrid==6.11.0
twilio==9.0.0
jinja2==3.1.3
celery[redis]==5.3.6  # Optional, for queuing
```

---

## 🎯 Notification Types

### **Authentication**
- Welcome email on signup
- Email verification link
- Password reset
- 2FA codes (SMS)
- Login alerts

### **Matchmaking**
- New L3V3L match
- Profile views
- Added to favorites
- Shortlisted
- New message alerts

### **Status**
- Profile approved/rejected
- Account suspended
- Testimonial approved
- Subscription expiring

---

## 💻 Quick Implementation

### **Email Service (Minimal)**
```python
# notifications/email_service.py
import aiohttp
from config import settings

class EmailService:
    async def send(self, to: str, subject: str, html: str):
        payload = {
            "personalizations": [{"to": [{"email": to}]}],
            "from": {"email": settings.sender_email},
            "subject": subject,
            "content": [{"type": "text/html", "value": html}]
        }
        
        headers = {
            "Authorization": f"Bearer {settings.sendgrid_api_key}",
            "Content-Type": "application/json"
        }
        
        async with aiohttp.ClientSession() as session:
            async with session.post(
                "https://api.sendgrid.com/v3/mail/send",
                json=payload,
                headers=headers
            ) as response:
                return response.status == 202
    
    async def send_welcome(self, to: str, username: str):
        html = f"""
        <h1>Welcome to L3V3L, {username}!</h1>
        <p>Your matchmaking journey starts now.</p>
        <a href="{settings.frontend_url}/profile">Complete Your Profile</a>
        """
        return await self.send(to, "Welcome to L3V3L! 💑", html)
```

### **Usage in Routes**
```python
from notifications.email_service import EmailService

@router.post("/register")
async def register(user_data: UserCreate, db = Depends(get_database)):
    # Create user...
    
    # Send welcome email
    email_service = EmailService()
    await email_service.send_welcome(
        to=user_data.email,
        username=user_data.username
    )
    
    return {"message": "User created"}
```

---

## 🚀 Implementation Phases

### **Phase 1: Email (Week 1)**
1. Add SendGrid to requirements
2. Create email_service.py
3. Add welcome email on signup
4. Add password reset email
5. Create 3 HTML templates

### **Phase 2: Matchmaking (Week 2)**
6. New match notifications
7. Message alerts
8. Profile view notifications
9. User preferences API/UI

### **Phase 3: SMS (Week 3)**
10. Add Twilio integration
11. 2FA codes
12. Critical alerts only
13. Cost monitoring

### **Phase 4: Scale (Week 4)**
14. Add Redis queue
15. Batch notifications
16. Daily digests
17. Retry logic
18. Analytics dashboard

---

## 💰 Cost Estimates

### **SendGrid**
- Free: 100 emails/day
- Essentials: $15/mo (50K emails)
- Pro: $90/mo (100K+ emails)

### **Twilio SMS**
- $0.0075 per SMS
- $1/mo for phone number
- 1,000 SMS = $7.50

### **Recommendation**
- Start: SendGrid free (100/day)
- When hitting limits: Upgrade to Essentials
- SMS: Enable only for 2FA initially

---

## 🔐 Security & Privacy

### **Email Security**
- Use SPF/DKIM records
- Implement unsubscribe links
- Rate limit to prevent spam
- Validate email addresses

### **SMS Security**
- Verify phone numbers
- Rate limit OTP requests
- Store hashed tokens
- Expire codes after 10 min

### **GDPR Compliance**
- User preference center
- Clear opt-in/opt-out
- Data retention policies
- Export notification history

---

## 📊 User Preferences Schema

```javascript
{
  "username": "john123",
  "notification_preferences": {
    "email": {
      "enabled": true,
      "new_matches": true,
      "new_messages": true,
      "profile_views": false,
      "daily_digest": true,
      "marketing": false
    },
    "sms": {
      "enabled": false,
      "2fa": true,
      "login_alerts": true
    }
  }
}
```

---

## 🎨 Email Templates

### **Key Templates Needed**
1. **welcome.html** - Onboarding
2. **password_reset.html** - Security
3. **match_notification.html** - Engagement
4. **message_alert.html** - Real-time
5. **daily_digest.html** - Batch updates
6. **testimonial_approved.html** - Feedback
7. **account_status.html** - Moderation

---

## 📈 Monitoring & Analytics

### **Track These Metrics**
- Email delivery rate (>95%)
- Open rate (20-30% target)
- Click-through rate
- Bounce rate (<2%)
- Unsubscribe rate (<0.5%)
- SMS delivery rate (>98%)

### **Tools**
- SendGrid analytics dashboard
- Twilio insights
- Custom MongoDB tracking
- Grafana/Prometheus for alerting

---

## ✅ Next Steps

1. **This Week:** Review and approve architecture
2. **Week 1:** Implement basic email service
3. **Week 2:** Add core notifications (welcome, password reset)
4. **Week 3:** Expand to matchmaking notifications
5. **Week 4:** Add SMS for 2FA
6. **Week 5:** Production deployment

---

**Ready to implement? I can start with Phase 1 (Email Service) right now!** 🚀
