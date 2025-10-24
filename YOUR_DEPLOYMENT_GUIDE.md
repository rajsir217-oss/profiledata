# 🚀 Your Cloud Run Deployment - Quick Reference

**Everything is ready!** Follow these steps to deploy your app to the internet.

---

## ✅ Your Cloud Services (Already Setup!)

### **MongoDB Atlas**
- ✅ Cluster: `mongocluster0.rebdf0h.mongodb.net`
- ✅ User: `rajl3v3l_db_user`
- ✅ Database: `matrimonialDB`

### **Redis Cloud**
- ✅ Endpoint: `redis-11872.c263.us-east-1-2.ec2.redns.redis-cloud.com:11872`
- ✅ Password: Already configured

---

## 🎯 Quick Deployment (3 Steps)

### **Step 1: Seed Your Cloud Database** (2 minutes)

This will create admin user, test users, templates, and scheduler jobs in your MongoDB Atlas:

```bash
./seed_database.sh
```

When prompted, enter your MongoDB password for user `rajl3v3l_db_user`.

**What gets created:**
- ✅ 1 Admin user (username: `admin`, password: `admin123`)
- ✅ 4 Test users (username: `testuser1-4`, password: `test123`)
- ✅ 6 Notification templates
- ✅ 5 Dynamic scheduler jobs

---

### **Step 2: Deploy to Google Cloud Run** (10 minutes)

```bash
./deploy_cloudrun.sh
```

**When prompted, use these values:**

**MongoDB URL:**
```
mongodb+srv://rajl3v3l_db_user:YOUR_PASSWORD@mongocluster0.rebdf0h.mongodb.net/matrimonialDB?retryWrites=true&w=majority&appName=MongoCluster0
```
*(Replace YOUR_PASSWORD with your actual password)*

**Redis URL:**
```
redis://default:2svzScwOza6YUFifjx32WIWqWHytrq12@redis-11872.c263.us-east-1-2.ec2.redns.redis-cloud.com:11872
```

**Secret Key:**
- Just press Enter to auto-generate

---

### **Step 3: Share with Friends!** 🎉

After deployment completes, you'll get a URL like:
```
https://matrimonial-frontend-xxxxx-uc.a.run.app
```

Share this with your friends and they can login with:
- **Admin:** username: `admin`, password: `admin123`
- **Test User:** username: `testuser1`, password: `test123`

---

## 📊 What Your Friends Can Test

### **Features to Try:**

1. **Registration & Login**
   - Create new accounts
   - Test different user roles

2. **Profile Management**
   - Upload photos
   - Edit profile information
   - Set matching preferences

3. **Matching System**
   - Browse search results
   - View L3V3L matches
   - Add to favorites/shortlist

4. **Messaging**
   - Send messages to matches
   - Real-time chat
   - Online/offline status

5. **PII Access**
   - Request contact information
   - Approve/deny requests

6. **Notifications**
   - Test email templates (if configured)
   - Weekly digest emails

7. **Admin Features** (login as admin)
   - User management
   - Role management
   - Dynamic scheduler
   - Notification templates
   - System configuration

---

## 🔧 Useful Commands

### **View Application Logs**

```bash
# Backend logs
gcloud run services logs tail matrimonial-backend --region us-central1

# Frontend logs
gcloud run services logs tail matrimonial-frontend --region us-central1

# Follow logs in real-time
gcloud run services logs tail matrimonial-backend --region us-central1 --follow
```

### **Update Your App**

Made changes to code? Redeploy:

```bash
./deploy_cloudrun.sh
```

*(Re-deployment takes ~5 minutes)*

### **Check Service Status**

```bash
# List all services
gcloud run services list --region us-central1

# Get service details
gcloud run services describe matrimonial-backend --region us-central1
```

### **Scale Up/Down**

```bash
# Increase max instances
gcloud run services update matrimonial-backend \
  --region us-central1 \
  --max-instances 20

# Set minimum instances (reduce cold starts)
gcloud run services update matrimonial-backend \
  --region us-central1 \
  --min-instances 2
```

---

## 💡 Tips for Testing

1. **Share the URL early** - Get feedback while developing

2. **Monitor logs** - Watch for errors in real-time:
   ```bash
   gcloud run services logs tail matrimonial-backend --region us-central1 --follow
   ```

3. **Test different browsers** - Chrome, Edge, Safari, mobile

4. **Create multiple test accounts** - Simulate real interactions

5. **Test real-time features** - Open app in 2 browsers, send messages

6. **Check mobile responsiveness** - Open on phone

---

## 📊 Database Contents

After running `seed_database.sh`, your MongoDB Atlas has:

### **Users (5 total):**

| Username | Password | Role | Name | Location |
|----------|----------|------|------|----------|
| admin | admin123 | admin | Admin User | System |
| testuser1 | test123 | free_user | Sarah Johnson | Boston |
| testuser2 | test123 | free_user | Michael Chen | San Francisco |
| testuser3 | test123 | free_user | Emily Martinez | Austin |
| testuser4 | test123 | free_user | David Kumar | Seattle |

### **Notification Templates (6 total):**

1. new_match - "You have a new match!"
2. profile_view - "Someone viewed your profile!"
3. new_message - "New message from {match.firstName}"
4. pii_request - "PII Access Request"
5. pii_granted - "Access granted!"
6. weekly_digest - "Your Weekly L3V3L Match Summary"

### **Scheduler Jobs (5 total):**

1. Email Notifications (every 5 min)
2. SMS Notifications (every 10 min)
3. Database Cleanup (every hour)
4. Message Stats Sync (every 30 min)
5. Weekly Digest Emails (every Monday 9 AM)

---

## 🆘 Troubleshooting

### **Issue: "Can't connect to MongoDB"**

**Solution:**
- Check your password is correct
- Verify Network Access in MongoDB Atlas (should be 0.0.0.0/0)
- Make sure connection string includes database name: `/matrimonialDB?`

### **Issue: "Build failed"**

**Solution:**
```bash
# Test build locally first
cd fastapi_backend
docker build -f Dockerfile.prod -t test-backend .
```

### **Issue: "Service unavailable / 502 error"**

**Solution:**
```bash
# Check logs for errors
gcloud run services logs tail matrimonial-backend --region us-central1

# Common causes:
# - MongoDB connection failed
# - Redis connection failed
# - Environment variables incorrect
```

### **Issue: "Cold start is slow"**

**Solution:**
```bash
# Set minimum instances to keep service warm
gcloud run services update matrimonial-backend \
  --region us-central1 \
  --min-instances 1
```
*(This costs ~$8/month for 1 instance always running)*

---

## 💰 Cost Estimate

**Free Tier Limits:**
- Cloud Run: 2M requests/month FREE
- MongoDB Atlas: 512MB storage FREE
- Redis Cloud: 30MB FREE

**Expected costs for friend testing (<100 users, <10K requests/day):**
- **$0-5/month** (likely stays in free tier)

**After free tier:**
- Cloud Run: ~$0.00002 per request
- With min-instances=1: ~$8/month for always-on
- MongoDB Atlas: Still free (M0 cluster)
- Redis Cloud: Still free (30MB)

---

## 🔒 Security Notes

**For Testing (Current Setup):**
- ✅ MongoDB Network Access: 0.0.0.0/0 (allows all IPs)
- ✅ Cloud Run: Unauthenticated (public access)
- ✅ Default passwords (admin123, test123)

**For Production (Before Going Live):**
- ❌ Restrict MongoDB Network Access to Cloud Run IPs only
- ❌ Use strong, unique passwords
- ❌ Enable Cloud Run authentication if needed
- ❌ Setup custom domain with SSL
- ❌ Configure backup strategy
- ❌ Setup monitoring and alerts

---

## 📧 Share This Template with Friends

```
Hey! I built a matrimonial matching app and need your help testing it! 

🌐 URL: https://matrimonial-frontend-xxxxx-uc.a.run.app

🔐 Test Credentials:
Username: testuser1
Password: test123

✨ Features to Try:
- Create your profile
- Browse matches  
- Send messages (real-time chat!)
- Request contact info
- See L3V3L match scores

Let me know if you find any bugs or have suggestions! 
Thanks for helping test! 🙏
```

---

## 🎉 You're All Set!

**Ready to deploy?** 

1. Run `./seed_database.sh` 
2. Run `./deploy_cloudrun.sh`
3. Share the URL with friends!

**Questions?** Check logs or review `DEPLOY_TO_INTERNET.md` for detailed troubleshooting.

---

**Good luck with your deployment!** 🚀
