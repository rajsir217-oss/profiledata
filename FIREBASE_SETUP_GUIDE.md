# Firebase Setup Guide - Push Notifications

**Project:** 13v31matchmsgs  
**Date:** October 27, 2025  
**Status:** Ready for configuration

---

## ✅ Step 1: Get Service Account JSON (Backend)

### In Firebase Console:

1. Go to **https://console.firebase.google.com**
2. Select project: **13v31matchmsgs**
3. Click **⚙️ Project Settings** (gear icon)
4. Go to **Service Accounts** tab
5. Click **Generate new private key**
6. Download the JSON file (keep it secure!)

### Example service account JSON structure:
```json
{
  "type": "service_account",
  "project_id": "13v31matchmsgs",
  "private_key_id": "abc123...",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQIB...\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-xxxxx@13v31matchmsgs.iam.gserviceaccount.com",
  "client_id": "123456789...",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/..."
}
```

---

## ✅ Step 2: Get VAPID Key (Frontend Web Push)

### In Firebase Console:

1. Still in **Project Settings**
2. Go to **Cloud Messaging** tab
3. Scroll down to **Web configuration**
4. Under **Web Push certificates**, click **Generate key pair**
5. Copy the generated VAPID key

---

## ✅ Step 3: Configure Backend (.env)

### Update `/fastapi_backend/.env` or `.env.production`:

```bash
# Firebase Push Notifications (FCM)
FIREBASE_PROJECT_ID=13v31matchmsgs
FIREBASE_PRIVATE_KEY_ID=abc123...  # From service account JSON
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@13v31matchmsgs.iam.gserviceaccount.com
FIREBASE_CLIENT_ID=123456789...  # From service account JSON
FIREBASE_CERT_URL=https://www.googleapis.com/robot/v1/metadata/x509/...  # From JSON
```

### ⚠️ Important Notes:
- **private_key**: Must include `\n` for newlines - keep the quotes!
- Store these as **Google Cloud Secrets** for production
- Never commit the service account JSON to git!

---

## ✅ Step 4: Configure Frontend (.env)

### Create `/frontend/.env.local`:

```bash
REACT_APP_API_URL=http://localhost:8000/api/users

# Firebase Configuration (already filled from your screenshot!)
REACT_APP_FIREBASE_API_KEY=AIzaSyBIAPoQzqKnp7XovCmock897kMDpWY8QeQ
REACT_APP_FIREBASE_AUTH_DOMAIN=13v31matchmsgs.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=13v31matchmsgs
REACT_APP_FIREBASE_STORAGE_BUCKET=13v31matchmsgs.firebasestorage.app
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=885095197155
REACT_APP_FIREBASE_APP_ID=1:885095197155:web:b24bd160c031e9097b18d6
REACT_APP_FIREBASE_MEASUREMENT_ID=G-GXYTLN1J8G
REACT_APP_FIREBASE_VAPID_KEY=YOUR_VAPID_KEY_FROM_STEP_2
```

### For Production (`/frontend/.env.production`):
```bash
REACT_APP_API_URL=https://matrimonial-backend-458052696267.us-central1.run.app/api/users

# Same Firebase config as above
REACT_APP_FIREBASE_API_KEY=AIzaSyBIAPoQzqKnp7XovCmock897kMDpWY8QeQ
REACT_APP_FIREBASE_AUTH_DOMAIN=13v31matchmsgs.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=13v31matchmsgs
REACT_APP_FIREBASE_STORAGE_BUCKET=13v31matchmsgs.firebasestorage.app
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=885095197155
REACT_APP_FIREBASE_APP_ID=1:885095197155:web:b24bd160c031e9097b18d6
REACT_APP_FIREBASE_MEASUREMENT_ID=G-GXYTLN1J8G
REACT_APP_FIREBASE_VAPID_KEY=YOUR_VAPID_KEY_FROM_STEP_2
```

---

## ✅ Step 5: Install Firebase SDKs

### Backend:
```bash
cd fastapi_backend
pip install firebase-admin
```

### Frontend:
```bash
cd frontend
npm install firebase
```

---

## ✅ Step 6: Enable Firebase Cloud Messaging

### In Firebase Console:

1. Go to **Build** → **Cloud Messaging**
2. Make sure **Cloud Messaging API** is enabled
3. If prompted, click **Enable** (it's free!)

---

## ✅ Step 7: Test Backend Firebase Connection

Create a test script to verify backend can connect:

```bash
cd fastapi_backend
python3 << 'EOF'
import os
os.environ['FIREBASE_PROJECT_ID'] = '13v31matchmsgs'
os.environ['FIREBASE_PRIVATE_KEY'] = 'YOUR_PRIVATE_KEY_HERE'
os.environ['FIREBASE_CLIENT_EMAIL'] = 'YOUR_CLIENT_EMAIL_HERE'

from services.push_service import PushNotificationService

push_service = PushNotificationService()
print("✅ Firebase initialized successfully!")
EOF
```

---

## ✅ Step 8: Deploy Backend with Firebase Credentials

### For Google Cloud Run:

```bash
# Set Firebase secrets in Google Secret Manager
gcloud secrets create firebase-private-key \
  --data-file=service-account.json \
  --replication-policy=automatic

# Update Cloud Run service with Firebase environment variables
gcloud run services update matrimonial-backend \
  --set-env-vars="FIREBASE_PROJECT_ID=13v31matchmsgs" \
  --set-env-vars="FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@13v31matchmsgs.iam.gserviceaccount.com" \
  --update-secrets="FIREBASE_PRIVATE_KEY=firebase-private-key:latest"
```

---

## ✅ Step 9: Create Push Notifier Job

### Via Dynamic Scheduler UI:

1. Go to `https://your-backend/dynamic-scheduler`
2. Click **Create New Job**
3. Select template: **push_notifier**
4. Configuration:
   ```json
   {
     "name": "Push Notification Sender",
     "template_type": "push_notifier",
     "schedule": {
       "type": "interval",
       "value": 30,
       "unit": "seconds"
     },
     "parameters": {
       "batch_size": 50,
       "retry_failed": true,
       "max_attempts": 3
     },
     "enabled": true
   }
   ```
5. Click **Create**

---

## ✅ Step 10: Test End-to-End

### 1. Test Device Registration:
```bash
# Frontend: User logs in, device token registered
# Check backend logs for:
# "✅ Subscribed to push notifications"
```

### 2. Test Notification Queue:
```bash
# Trigger any action (register, favorite, message)
# Check MongoDB notification_queue collection
# Should see pending notifications
```

### 3. Test Push Delivery:
```bash
# Wait 30 seconds for push_notifier job to run
# Check backend logs for:
# "✅ Push notifier complete - Sent: 1, Failed: 0"
# 
# User should receive browser notification!
```

### 4. Test Notification Endpoint:
```bash
curl -X POST http://localhost:8000/api/push-subscriptions/test \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"

# Should send test notification to all your devices
```

---

## 📊 Monitoring & Debugging

### Check Firebase Console:

1. **Usage Stats:** Build → Cloud Messaging → Usage
2. **Delivery Reports:** See success/failure rates
3. **Debug Logs:** Check for errors

### Check Backend Logs:

```bash
# Local
tail -f fastapi_backend/logs/app.log | grep "push\|notification"

# Google Cloud Run
gcloud run logs read matrimonial-backend \
  --project=profiledata-438623 \
  --format="table(timestamp,textPayload)" \
  --filter="textPayload:push OR textPayload:notification"
```

### Check MongoDB Collections:

```javascript
// notification_queue - Pending notifications
db.notification_queue.find({status: "pending"}).pretty()

// notification_log - Sent notifications
db.notification_log.find().sort({sentAt: -1}).limit(10).pretty()

// push_subscriptions - Registered devices
db.push_subscriptions.find({isActive: true}).pretty()
```

---

## 🔒 Security Best Practices

### ✅ Do's:
- ✅ Store service account JSON in Google Secret Manager
- ✅ Use environment variables for all Firebase config
- ✅ Restrict API keys in Firebase Console
- ✅ Enable App Check for production
- ✅ Validate device tokens before sending

### ❌ Don'ts:
- ❌ Never commit service account JSON to git
- ❌ Never expose Firebase private key in logs
- ❌ Never share VAPID key publicly
- ❌ Don't store tokens in localStorage (use IndexedDB)

---

## 🚨 Troubleshooting

### Issue 1: "Firebase not initialized"
**Solution:** Check environment variables are set correctly

### Issue 2: "Invalid device token"
**Solution:** Token expired - user needs to re-register device

### Issue 3: "Permission denied"
**Solution:** Check service account has FCM Admin permissions

### Issue 4: "CORS error in browser"
**Solution:** Add your domain to Firebase authorized domains

### Issue 5: "Notifications not received"
**Checklist:**
- [ ] Browser notification permission granted?
- [ ] Device token registered in database?
- [ ] Push notifier job is running?
- [ ] Notification in queue with status=pending?
- [ ] Firebase project ID correct?
- [ ] VAPID key matches Firebase console?

---

## ✅ Configuration Checklist

### Backend:
- [ ] Firebase Admin SDK installed (`pip install firebase-admin`)
- [ ] Service account JSON downloaded
- [ ] Environment variables set in `.env`
- [ ] Push service can initialize (test script passes)
- [ ] Push notifier job created and enabled

### Frontend:
- [ ] Firebase SDK installed (`npm install firebase`)
- [ ] Environment variables set in `.env.local`
- [ ] VAPID key added to config
- [ ] Service worker created (upcoming step)
- [ ] Push permission requested on login

### Firebase Console:
- [ ] Cloud Messaging API enabled
- [ ] VAPID key generated
- [ ] App registered for web
- [ ] Domain added to authorized domains (production)

---

## 📝 Next Steps

1. ✅ Get service account JSON
2. ✅ Get VAPID key
3. ✅ Configure backend .env
4. ✅ Configure frontend .env
5. ⏳ Install dependencies
6. ⏳ Test backend Firebase connection
7. ⏳ Create push notifier job
8. ⏳ Implement frontend service worker
9. ⏳ Test end-to-end notifications
10. ⏳ Deploy to production

---

**Firebase Project:** `13v31matchmsgs` ✅  
**Cost:** FREE (Unlimited notifications) ✅  
**Backend Integration:** COMPLETE ✅  
**Frontend Integration:** PENDING ⏳  

Ready to implement! 🚀
