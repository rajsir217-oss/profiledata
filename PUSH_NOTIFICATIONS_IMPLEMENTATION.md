# Push Notifications Implementation Plan

**Branch:** pushNotifications  
**Date:** October 27, 2025  
**Status:** Planning Phase

---

## 🎯 Objectives

Add push notification support for the following events:
1. ✅ **New Profile Created** - Welcome notification to new user
2. ✅ **Added to Shortlist** - Notify user when someone adds them to shortlist
3. ✅ **Added to Favorites** - Notify user when someone favorites them
4. ✅ **New Message** - Notify user of incoming messages

---

## 📊 Current State Analysis

### ✅ Already Implemented (Notification System)
- NotificationChannel enum has `PUSH` option
- NotificationTrigger enum has:
  - `SHORTLIST_ADDED` ✅
  - `FAVORITED` ✅
  - `NEW_MESSAGE` ✅
- NotificationService infrastructure exists
- Queue system in place (MongoDB collections)
- Email and SMS notifiers working

### ❌ Missing Components
1. **NEW_PROFILE_CREATED trigger** - Not in enum yet
2. **Push notification delivery mechanism** - No pusher template
3. **Device token storage** - No user device registration
4. **FCM/APNs integration** - No push provider setup
5. **Notification triggers** - Not integrated into endpoints
6. **Frontend service worker** - For web push

---

## 🏗️ Architecture Design

### Push Notification Flow
```
User Action (Register/Favorite/Shortlist/Message)
    ↓
Backend Endpoint (routes.py)
    ↓
Enqueue Notification (NotificationService)
    ↓
notification_queue collection (MongoDB)
    ↓
Push Notifier Job Template (polls queue every 30s)
    ↓
Firebase Cloud Messaging (FCM)
    ↓
User Device (Browser/Mobile)
```

### Technology Stack
- **Backend:** FastAPI + Python
- **Push Service:** Firebase Cloud Messaging (FCM)
  - Supports web, Android, iOS
  - Free tier: Unlimited notifications
  - Easy integration
- **Database:** MongoDB (store device tokens)
- **Job Scheduler:** Existing unified scheduler

---

## 📁 Files to Create/Modify

### Backend - New Files
```
/fastapi_backend/
  ├── services/
  │   └── push_service.py (NEW) - FCM integration
  ├── job_templates/
  │   └── push_notifier_template.py (NEW) - Push job template
  └── routers/
      └── push_subscriptions.py (NEW) - Device token management
```

### Backend - Modified Files
```
/fastapi_backend/
  ├── models/notification_models.py (MODIFY) - Add NEW_PROFILE_CREATED
  ├── routes.py (MODIFY) - Add triggers to endpoints
  ├── job_templates/registry.py (MODIFY) - Register push template
  └── main.py (MODIFY) - Add push subscription routes
```

### Frontend - New Files
```
/frontend/
  ├── public/
  │   ├── firebase-messaging-sw.js (NEW) - Service worker
  │   └── firebase-config.js (NEW) - Firebase config
  └── src/
      └── services/
          └── pushNotificationService.js (NEW) - FCM client
```

### Frontend - Modified Files
```
/frontend/src/
  ├── App.js (MODIFY) - Initialize push notifications
  ├── components/
  │   ├── Register.js (MODIFY) - Request permission on signup
  │   └── NotificationSettings.js (NEW) - Manage push prefs
```

### Configuration
```
/fastapi_backend/.env (ADD)
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY=your-private-key
FIREBASE_CLIENT_EMAIL=your-client-email

/frontend/.env (ADD)
REACT_APP_FIREBASE_API_KEY=your-api-key
REACT_APP_FIREBASE_PROJECT_ID=your-project-id
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
REACT_APP_FIREBASE_APP_ID=your-app-id
```

---

## 🔧 Implementation Steps

### Phase 1: Backend Infrastructure (60 min)

#### Step 1: Update Notification Models (5 min)
```python
# models/notification_models.py

class NotificationTrigger(str, Enum):
    # ... existing triggers
    NEW_PROFILE_CREATED = "new_profile_created"  # ADD THIS
```

#### Step 2: Create Push Service (20 min)
```python
# services/push_service.py

import firebase_admin
from firebase_admin import credentials, messaging
from typing import List, Dict, Any

class PushNotificationService:
    def __init__(self):
        # Initialize Firebase Admin SDK
        cred = credentials.Certificate({
            "type": "service_account",
            "project_id": os.getenv("FIREBASE_PROJECT_ID"),
            "private_key": os.getenv("FIREBASE_PRIVATE_KEY"),
            "client_email": os.getenv("FIREBASE_CLIENT_EMAIL")
        })
        firebase_admin.initialize_app(cred)
    
    async def send_push(
        self,
        device_tokens: List[str],
        title: str,
        body: str,
        data: Dict[str, Any] = None
    ):
        """Send push notification to devices"""
        message = messaging.MulticastMessage(
            tokens=device_tokens,
            notification=messaging.Notification(
                title=title,
                body=body
            ),
            data=data or {}
        )
        
        response = messaging.send_multicast(message)
        return response
```

#### Step 3: Create Device Token Storage (10 min)
```python
# routers/push_subscriptions.py

@router.post("/subscribe")
async def subscribe_to_push(
    token: str,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Register device token for push notifications"""
    await db.push_subscriptions.update_one(
        {
            "username": current_user["username"],
            "token": token
        },
        {
            "$set": {
                "username": current_user["username"],
                "token": token,
                "subscribedAt": datetime.utcnow(),
                "isActive": True
            }
        },
        upsert=True
    )
    return {"success": True, "message": "Subscribed to push notifications"}
```

#### Step 4: Create Push Notifier Template (20 min)
```python
# job_templates/push_notifier_template.py

class PushNotifierTemplate(BaseJobTemplate):
    def get_name(self) -> str:
        return "push_notifier"
    
    def get_description(self) -> str:
        return "Process push notification queue and send via FCM"
    
    async def execute(self, context: JobContext) -> Dict[str, Any]:
        """Send pending push notifications"""
        db = context.db
        push_service = PushNotificationService()
        
        # Get pending notifications
        pending = await db.notification_queue.find({
            "status": "pending",
            "channels": "push"
        }).limit(50).to_list(50)
        
        sent_count = 0
        failed_count = 0
        
        for notification in pending:
            try:
                # Get user device tokens
                tokens = await db.push_subscriptions.find({
                    "username": notification["username"],
                    "isActive": True
                }).to_list(10)
                
                device_tokens = [t["token"] for t in tokens]
                
                if not device_tokens:
                    continue
                
                # Send push notification
                await push_service.send_push(
                    device_tokens=device_tokens,
                    title=notification["title"],
                    body=notification["message"],
                    data=notification.get("templateData", {})
                )
                
                # Mark as sent
                await db.notification_queue.update_one(
                    {"_id": notification["_id"]},
                    {"$set": {"status": "sent", "sentAt": datetime.utcnow()}}
                )
                
                sent_count += 1
                
            except Exception as e:
                failed_count += 1
                logger.error(f"Failed to send push: {e}")
        
        return {
            "sent": sent_count,
            "failed": failed_count
        }
```

#### Step 5: Add Notification Triggers to Endpoints (5 min)
```python
# routes.py

# Add to registration endpoint
@router.post("/register")
async def register(user: UserCreate, db=Depends(get_database)):
    # ... existing registration code
    
    # NEW: Send welcome push notification
    from services.notification_service import NotificationService
    notification_service = NotificationService(db)
    
    await notification_service.enqueue_notification(
        NotificationQueueCreate(
            username=user.username,
            trigger=NotificationTrigger.NEW_PROFILE_CREATED,
            channels=[NotificationChannel.PUSH, NotificationChannel.EMAIL],
            templateData={
                "firstName": user.firstName,
                "username": user.username
            }
        )
    )
    
    return response

# Add to favorites endpoint
@router.post("/favorites")
async def add_to_favorites(
    target_username: str,
    username: str = Query(...),
    db=Depends(get_database)
):
    # ... existing favorites code
    
    # NEW: Notify target user
    notification_service = NotificationService(db)
    await notification_service.enqueue_notification(
        NotificationQueueCreate(
            username=target_username,  # Person being favorited
            trigger=NotificationTrigger.FAVORITED,
            channels=[NotificationChannel.PUSH],
            templateData={
                "favoriter": username,  # Person who favorited
                "favoritersName": current_user.get("firstName", username)
            }
        )
    )

# Similar for shortlist and messages
```

---

### Phase 2: Frontend Integration (45 min)

#### Step 1: Setup Firebase (10 min)
```javascript
// public/firebase-messaging-sw.js

importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "YOUR_API_KEY",
  projectId: "YOUR_PROJECT_ID",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/logo192.png'
  };
  
  self.registration.showNotification(notificationTitle, notificationOptions);
});
```

#### Step 2: Create Push Service (15 min)
```javascript
// src/services/pushNotificationService.js

import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import api from '../api';

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);

export const requestNotificationPermission = async () => {
  try {
    const permission = await Notification.requestPermission();
    
    if (permission === 'granted') {
      const token = await getToken(messaging, {
        vapidKey: 'YOUR_VAPID_KEY'
      });
      
      // Send token to backend
      await api.post('/push-subscriptions/subscribe', { token });
      
      return token;
    }
  } catch (error) {
    console.error('Error getting notification permission:', error);
  }
};

export const onMessageListener = () =>
  new Promise((resolve) => {
    onMessage(messaging, (payload) => {
      resolve(payload);
    });
  });
```

#### Step 3: Integrate into App (10 min)
```javascript
// src/App.js

import { requestNotificationPermission, onMessageListener } from './services/pushNotificationService';

function App() {
  useEffect(() => {
    const username = localStorage.getItem('username');
    
    if (username) {
      // Request permission on login
      requestNotificationPermission();
      
      // Listen for foreground notifications
      onMessageListener().then((payload) => {
        // Show toast notification
        toast.success(payload.notification.body);
      });
    }
  }, []);
  
  // ... rest of app
}
```

#### Step 4: Add to Registration (10 min)
```javascript
// src/components/Register.js

import { requestNotificationPermission } from '../services/pushNotificationService';

const handleSubmit = async (e) => {
  // ... existing registration code
  
  // After successful registration
  if (response.data.success) {
    // Request push notification permission
    await requestNotificationPermission();
    
    navigate('/dashboard');
  }
};
```

---

### Phase 3: Notification Templates (30 min)

Create notification templates in MongoDB:

```javascript
// Template: New Profile Created
{
  "trigger": "new_profile_created",
  "channels": ["push", "email"],
  "templates": {
    "push": {
      "title": "Welcome to ProfileData! 👋",
      "body": "Hi {firstName}, your profile is ready! Start exploring matches now.",
      "data": {
        "action": "open_app",
        "screen": "/dashboard"
      }
    }
  }
}

// Template: Added to Favorites
{
  "trigger": "favorited",
  "channels": ["push"],
  "templates": {
    "push": {
      "title": "Someone likes you! ⭐",
      "body": "{favoritersName} added you to their favorites!",
      "data": {
        "action": "view_profile",
        "username": "{favoriter}"
      }
    }
  }
}

// Template: Added to Shortlist
{
  "trigger": "shortlist_added",
  "channels": ["push"],
  "templates": {
    "push": {
      "title": "You're on a shortlist! 📋",
      "body": "{shortlisterName} added you to their shortlist!",
      "data": {
        "action": "view_profile",
        "username": "{shortlister}"
      }
    }
  }
}

// Template: New Message
{
  "trigger": "new_message",
  "channels": ["push"],
  "templates": {
    "push": {
      "title": "New message from {senderName} 💬",
      "body": "{messagePreview}",
      "data": {
        "action": "open_chat",
        "username": "{sender}"
      }
    }
  }
}
```

---

## 🧪 Testing Plan

### Backend Testing
```python
# Test 1: Device token registration
POST /api/push-subscriptions/subscribe
{
  "token": "test-fcm-token-123"
}

# Test 2: Trigger new profile notification
POST /api/users/register
# Should create notification in queue

# Test 3: Run push notifier job
# Should send notification via FCM

# Test 4: Add to favorites
POST /api/favorites?username=testuser
# Should enqueue push notification for target user
```

### Frontend Testing
```
1. Open app in browser
2. Should see permission request popup
3. Accept notification permission
4. Token should be sent to backend
5. Trigger notification from another account
6. Should receive browser notification
```

---

## 📊 Database Schema

### push_subscriptions Collection
```javascript
{
  "_id": ObjectId("..."),
  "username": "john_doe",
  "token": "fcm-token-abcd1234...",
  "subscribedAt": ISODate("2025-10-27T10:30:00Z"),
  "isActive": true,
  "deviceInfo": {
    "browser": "Chrome",
    "os": "macOS",
    "userAgent": "Mozilla/5.0..."
  }
}
```

### Notification Queue (Enhanced)
```javascript
{
  "_id": ObjectId("..."),
  "username": "target_user",
  "trigger": "favorited",
  "channels": ["push"],
  "status": "pending",
  "title": "Someone likes you! ⭐",
  "message": "Jane Smith added you to their favorites!",
  "templateData": {
    "favoriter": "jane_smith",
    "favoritersName": "Jane Smith"
  },
  "createdAt": ISODate("2025-10-27T10:30:00Z"),
  "sentAt": null
}
```

---

## 🚀 Deployment Checklist

### Prerequisites
- [ ] Create Firebase project
- [ ] Generate Firebase service account key
- [ ] Get FCM VAPID key
- [ ] Add Firebase credentials to .env

### Backend
- [ ] Install firebase-admin: `pip install firebase-admin`
- [ ] Add environment variables
- [ ] Deploy push_notifier job template
- [ ] Create job in Dynamic Scheduler (runs every 30s)
- [ ] Test notification queue

### Frontend
- [ ] Install firebase: `npm install firebase`
- [ ] Add Firebase config to .env
- [ ] Deploy service worker
- [ ] Test browser notifications

### Database
- [ ] Create push_subscriptions collection
- [ ] Create indexes on username and token
- [ ] Insert notification templates

---

## 🎯 Success Metrics

- ✅ Users can subscribe to push notifications
- ✅ Notifications sent within 30 seconds of trigger
- ✅ 95%+ delivery rate
- ✅ Users can manage notification preferences
- ✅ No duplicate notifications
- ✅ Works on Chrome, Firefox, Safari, Edge

---

## 📝 Next Steps

1. **Setup Firebase Project** (15 min)
2. **Implement Backend** (60 min)
3. **Implement Frontend** (45 min)
4. **Test End-to-End** (30 min)
5. **Deploy to Production** (20 min)

**Total Estimated Time:** ~3 hours

---

Ready to start implementation! 🚀
