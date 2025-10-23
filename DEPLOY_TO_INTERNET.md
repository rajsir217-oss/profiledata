# 🌐 Deploy L3V3L to Internet - Quick Guide

**Goal:** Get your app online so friends can test it!

**Time:** 30 minutes  
**Cost:** FREE (using free tiers)

---

## 📋 Pre-Deployment Checklist

✅ Local Docker is working  
✅ Admin and test users created  
✅ Ready to share with friends  

---

## Step 1: Setup MongoDB Atlas (10 minutes)

### **Why?** You need a cloud database (can't use localhost anymore)

1. **Go to:** https://cloud.mongodb.com
2. **Sign up** (free account)
3. **Create cluster:**
   - Click "Build a Database"
   - Choose **FREE** tier (M0)
   - Select cloud provider: **Google Cloud** (same as Cloud Run)
   - Region: **us-central1** (Iowa)
   - Cluster name: `matrimonial-staging`
   - Click "Create"

4. **Create database user:**
   - Click "Database Access" (left menu)
   - Click "Add New Database User"
   - Username: `dbadmin`
   - Password: `SecurePassword123` (change this!)
   - Database User Privileges: **Read and write to any database**
   - Click "Add User"

5. **Whitelist all IPs** (for testing):
   - Click "Network Access" (left menu)
   - Click "Add IP Address"
   - Click "Allow Access from Anywhere" (0.0.0.0/0)
   - Click "Confirm"
   - **Note:** For production, use specific IPs

6. **Get connection string:**
   - Click "Database" (left menu)
   - Click "Connect" on your cluster
   - Click "Connect your application"
   - Copy the connection string:
   ```
   mongodb+srv://dbadmin:<password>@matrimonial-staging.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
   - Replace `<password>` with your actual password
   - Add database name:
   ```
   mongodb+srv://dbadmin:SecurePassword123@matrimonial-staging.xxxxx.mongodb.net/matrimonialDB?retryWrites=true&w=majority
   ```

7. **Save this connection string!** You'll need it for deployment.

---

## Step 2: Setup Redis Cloud (5 minutes)

### **Why?** For real-time features (WebSocket, online status)

1. **Go to:** https://redis.com/try-free
2. **Sign up** (free account)
3. **Create database:**
   - Click "New Database"
   - Free tier: **30MB** (enough for testing)
   - Cloud provider: **Google Cloud**
   - Region: **us-central1**
   - Database name: `matrimonial-redis`
   - Click "Activate"

4. **Get connection string:**
   - Click on your database name
   - Copy the **Public endpoint**:
   ```
   redis-12345.c123.us-central1-1.gcp.cloud.redislabs.com:12345
   ```
   - Get the password from "Security" tab
   - Format connection string:
   ```
   redis://default:your-password-here@redis-12345.c123.us-central1-1.gcp.cloud.redislabs.com:12345
   ```

5. **Save this connection string!** You'll need it for deployment.

---

## Step 3: Setup Google Cloud (5 minutes)

### **Install gcloud CLI** (if not installed)

```bash
# Mac
brew install google-cloud-sdk

# Or download from:
# https://cloud.google.com/sdk/docs/install
```

### **Login to Google Cloud**

```bash
gcloud auth login
```

This will open your browser - login with your Google account.

### **Create Project**

```bash
# Create a new project
gcloud projects create matrimonial-staging --name="L3V3L Matrimonial Staging"

# Set as active project
gcloud config set project matrimonial-staging

# Enable billing (required for Cloud Run)
# Go to: https://console.cloud.google.com/billing
# Link your project to a billing account (free tier available)
```

**✅ Google Cloud setup complete!**

---

## Step 4: Deploy to Cloud Run (10 minutes)

### **Option A: Automated Deployment (Recommended)**

Simply run the deployment script:

```bash
./deploy_cloudrun.sh
```

The script will:
1. Prompt for MongoDB and Redis URLs
2. Generate a secure secret key
3. Build both frontend and backend
4. Deploy to Google Cloud Run
5. Give you the live URL!

**Just follow the prompts!**

---

### **Option B: Manual Deployment**

If you prefer to do it manually:

#### **Deploy Backend**

```bash
cd fastapi_backend

gcloud run deploy matrimonial-backend \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --min-instances 1 \
  --max-instances 10 \
  --memory 512Mi \
  --timeout 300 \
  --set-env-vars="MONGODB_URL=mongodb+srv://...,REDIS_URL=redis://...,DATABASE_NAME=matrimonialDB,SECRET_KEY=your-secret-key,ENVIRONMENT=production" \
  --dockerfile Dockerfile.prod
```

Get backend URL:
```bash
gcloud run services describe matrimonial-backend --region us-central1 --format 'value(status.url)'
```

#### **Deploy Frontend**

```bash
cd ../frontend

gcloud run deploy matrimonial-frontend \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --min-instances 1 \
  --max-instances 5 \
  --memory 256Mi \
  --set-env-vars="REACT_APP_API_URL=https://matrimonial-backend-xxx.run.app/api/users,REACT_APP_SOCKET_URL=https://matrimonial-backend-xxx.run.app" \
  --dockerfile Dockerfile.prod
```

---

## Step 5: Copy Test Users to Cloud MongoDB

Your cloud MongoDB is empty! Copy users from local:

```bash
# Export from local Docker MongoDB
docker compose -f docker-compose.local.yml exec mongodb mongoexport \
  --db=matrimonialDB \
  --collection=users \
  --out=/tmp/users.json

docker cp matrimonial-dev-db:/tmp/users.json ./users_backup.json

# Import to MongoDB Atlas
mongoimport --uri="mongodb+srv://dbadmin:password@cluster.mongodb.net/matrimonialDB" \
  --collection=users \
  --file=./users_backup.json \
  --jsonArray
```

**Or** manually create admin user in cloud MongoDB:

```bash
# Connect to Atlas
mongosh "mongodb+srv://cluster.mongodb.net/matrimonialDB" --username dbadmin

# Create admin user
db.users.insertOne({
  username: "admin",
  password: "$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LeN.B3NdKU4EuWx8u",
  email: "admin@localhost",
  contactEmail: "admin@localhost",
  role_name: "admin",
  status: {status: "active"},
  firstName: "Admin",
  lastName: "User",
  createdAt: new Date(),
  themePreference: "light-blue"
})
```

Password: `admin123`

---

## 🎉 You're Live!

Your app should now be accessible at:
```
https://matrimonial-frontend-xxxxx-uc.a.run.app
```

### **Share with friends:**

```
🎉 Hey! Try my new matrimonial app:
👉 https://matrimonial-frontend-xxxxx-uc.a.run.app

Login with:
Username: admin
Password: admin123

Let me know what you think!
```

---

## 🔧 Common Issues & Solutions

### **Issue 1: "Build failed"**

**Solution:** Check Dockerfile syntax
```bash
# Test build locally first
docker build -f fastapi_backend/Dockerfile.prod -t test-backend ./fastapi_backend
```

### **Issue 2: "Service unavailable"**

**Solution:** Check logs
```bash
gcloud run services logs tail matrimonial-backend --region us-central1
```

### **Issue 3: "Can't connect to MongoDB"**

**Solution:** 
- Verify connection string
- Check Network Access whitelist in MongoDB Atlas
- Ensure password is URL-encoded if it contains special characters

### **Issue 4: "Frontend can't reach backend"**

**Solution:**
- Check REACT_APP_API_URL environment variable
- Should point to backend Cloud Run URL
- Redeploy frontend with correct URL

---

## 📊 Monitor Your App

### **View logs:**

```bash
# Backend logs
gcloud run services logs tail matrimonial-backend --region us-central1

# Frontend logs  
gcloud run services logs tail matrimonial-frontend --region us-central1
```

### **Check metrics:**

Visit Google Cloud Console:
https://console.cloud.google.com/run

---

## 💰 Cost Estimate

**Free Tier Limits:**
- Cloud Run: 2M requests/month FREE
- MongoDB Atlas: 512MB storage FREE
- Redis Cloud: 30MB FREE

**Expected costs for testing (< 100 users):**
- **$0-5/month** (likely $0 with free tiers)

**After free tier:**
- Cloud Run: ~$0.00002 per request
- MongoDB: $9/month for basic tier
- Redis: $5/month for 30MB

---

## 🔄 Update Your App

Made changes? Redeploy:

```bash
# Option 1: Run deployment script again
./deploy_cloudrun.sh

# Option 2: Deploy manually
cd fastapi_backend
gcloud run deploy matrimonial-backend --source . --region us-central1

cd ../frontend
gcloud run deploy matrimonial-frontend --source . --region us-central1
```

---

## 🗑️ Delete Everything (when done testing)

```bash
# Delete Cloud Run services
gcloud run services delete matrimonial-backend --region us-central1
gcloud run services delete matrimonial-frontend --region us-central1

# Delete MongoDB Atlas cluster (via web UI)
# Delete Redis Cloud database (via web UI)
```

---

## ✅ Checklist

- [ ] MongoDB Atlas cluster created
- [ ] Redis Cloud database created
- [ ] Google Cloud project created
- [ ] Backend deployed to Cloud Run
- [ ] Frontend deployed to Cloud Run
- [ ] Test users copied to cloud MongoDB
- [ ] App accessible via internet
- [ ] Friends can login and test!

---

**Need help?** Check the logs or contact support!

**Ready for real production?** See `KUBERNETES_DEPLOYMENT.md` for scalable setup.
