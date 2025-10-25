# 🚀 Google Cloud Deployment Guide
**Complete deployment of Backend, Frontend, and MongoDB to Google Cloud**

---

## 📋 **What Gets Deployed:**

1. **Backend (FastAPI)** → Cloud Run
2. **Frontend (React)** → Cloud Run
3. **MongoDB** → MongoDB Atlas (Free Tier)
4. **Redis** → Cloud Memorystore or Redis Cloud (Free Tier)
5. **Images/Files** → Cloud Storage

---

## 🎯 **Phase 1: Export Local MongoDB Data**

### **Step 1: Run Export Script**

```bash
cd /Users/rajsiripuram02/opt/appsrc/profiledata

# Make script executable
chmod +x export_mongodb.sh

# Run export
./export_mongodb.sh
```

**This creates:** `mongodb_backup_YYYYMMDD_HHMMSS.tar.gz`

**What's included:**
- All collections (users, messages, favorites, etc.)
- All indexes
- All data

---

## 🗄️ **Phase 2: Set Up Cloud MongoDB**

### **Option A: MongoDB Atlas (Recommended - FREE)**

**Why MongoDB Atlas?**
- ✅ Free tier (512 MB)
- ✅ Automatic backups
- ✅ Easy scaling
- ✅ Global availability
- ✅ Built-in monitoring

**Steps:**

1. **Go to MongoDB Atlas:**
   ```
   https://www.mongodb.com/cloud/atlas/register
   ```

2. **Create Free Cluster:**
   - Click "Build a Database"
   - Choose **FREE** tier (M0 Sandbox)
   - Select region: **us-central1** (same as Cloud Run)
   - Cluster name: `matrimonial-cluster`

3. **Configure Security:**
   
   **Database Access:**
   - Click "Database Access"
   - Add New Database User
   - Username: `matrimonial_app`
   - Password: Generate secure password (save it!)
   - Database User Privileges: `readWriteAnyDatabase`

   **Network Access:**
   - Click "Network Access"
   - Add IP Address
   - For testing: **Allow Access from Anywhere** (`0.0.0.0/0`)
   - For production: Add specific Cloud Run IP ranges

4. **Get Connection String:**
   - Click "Connect"
   - Choose "Connect your application"
   - Copy connection string:
   ```
   mongodb+srv://matrimonial_app:<password>@matrimonial-cluster.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
   - Replace `<password>` with your actual password

5. **Import Your Data:**
   
   **Option 1: Using mongorestore (Local):**
   ```bash
   # Extract backup
   tar -xzf mongodb_backup_*.tar.gz
   cd mongodb_backup_*
   
   # Import to Atlas
   mongorestore \
     --uri="mongodb+srv://matrimonial_app:YOUR_PASSWORD@matrimonial-cluster.xxxxx.mongodb.net/" \
     --db matrimonialDB \
     matrimonialDB/
   ```

   **Option 2: Using MongoDB Compass (GUI):**
   - Download MongoDB Compass
   - Connect using connection string
   - Import each collection manually

6. **Verify Import:**
   ```bash
   # Check collections
   mongosh "mongodb+srv://matrimonial_app:YOUR_PASSWORD@matrimonial-cluster.xxxxx.mongodb.net/matrimonialDB"
   
   # In mongosh:
   show collections
   db.users.countDocuments()
   db.messages.countDocuments()
   ```

### **Option B: Google Cloud SQL (Not Recommended for MongoDB)**

MongoDB works best on MongoDB Atlas. Google Cloud SQL doesn't support MongoDB natively.

---

## 🔴 **Phase 3: Set Up Cloud Redis**

### **Option A: Redis Cloud (Recommended - FREE)**

1. **Go to Redis Cloud:**
   ```
   https://redis.io/cloud/
   ```

2. **Create Free Database:**
   - Sign up for free account
   - Create new subscription (Free 30 MB)
   - Region: **GCP us-central1**
   - Database name: `matrimonial-redis`

3. **Get Connection Details:**
   ```
   redis://default:YOUR_PASSWORD@redis-xxxxx.cloud.redislabs.com:12345
   ```

### **Option B: Google Cloud Memorystore**

**Cost:** ~$50/month (no free tier)

```bash
# Create Redis instance
gcloud redis instances create matrimonial-redis \
  --size=1 \
  --region=us-central1 \
  --tier=basic
```

---

## ☁️ **Phase 4: Google Cloud Setup**

### **1. Install Google Cloud SDK**

```bash
# Install (if not already installed)
curl https://sdk.cloud.google.com | bash

# Initialize
gcloud init

# Login
gcloud auth login
```

### **2. Create GCP Project**

```bash
# Create project
gcloud projects create matrimonial-prod --name="Matrimonial App"

# Set as active project
gcloud config set project matrimonial-prod

# Enable billing (required for Cloud Run)
# Go to: https://console.cloud.google.com/billing
```

### **3. Enable Required APIs**

```bash
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  containerregistry.googleapis.com \
  storage-api.googleapis.com \
  secretmanager.googleapis.com
```

### **4. Create Service Account for GitHub Actions**

```bash
# Create service account
gcloud iam service-accounts create github-actions-deployer \
  --display-name="GitHub Actions Deployer"

# Grant necessary roles
gcloud projects add-iam-policy-binding matrimonial-prod \
  --member="serviceAccount:github-actions-deployer@matrimonial-prod.iam.gserviceaccount.com" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding matrimonial-prod \
  --member="serviceAccount:github-actions-deployer@matrimonial-prod.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"

gcloud projects add-iam-policy-binding matrimonial-prod \
  --member="serviceAccount:github-actions-deployer@matrimonial-prod.iam.gserviceaccount.com" \
  --role="roles/storage.admin"

# Create JSON key
gcloud iam service-accounts keys create gcp-key.json \
  --iam-account=github-actions-deployer@matrimonial-prod.iam.gserviceaccount.com

# IMPORTANT: Save this file! You'll need it for GitHub Secrets
```

---

## 📝 **Phase 5: Create Dockerfiles**

### **Backend Dockerfile**

I'll create this in the next step...

### **Frontend Dockerfile**

I'll create this too...

---

## 🔐 **Phase 6: Configure Secrets**

### **1. Google Cloud Secret Manager**

```bash
# Store MongoDB connection string
echo -n "mongodb+srv://matrimonial_app:YOUR_PASSWORD@matrimonial-cluster.xxxxx.mongodb.net/" | \
  gcloud secrets create mongodb-url --data-file=-

# Store Redis URL
echo -n "redis://default:YOUR_PASSWORD@redis-xxxxx.cloud.redislabs.com:12345" | \
  gcloud secrets create redis-url --data-file=-

# Store JWT secret
echo -n "$(openssl rand -hex 32)" | \
  gcloud secrets create jwt-secret --data-file=-

# Store SMTP password
echo -n "YOUR_SMTP_PASSWORD" | \
  gcloud secrets create smtp-password --data-file=-
```

### **2. GitHub Secrets**

Go to: `https://github.com/YOUR_USERNAME/profiledata/settings/secrets/actions`

Add these secrets:

**GCP_SA_KEY:**
```bash
# Copy content of gcp-key.json
cat gcp-key.json
# Paste entire JSON into GitHub Secret
```

**GCP_PROJECT_ID:**
```
matrimonial-prod
```

---

## 🚀 **Phase 7: Deploy!**

### **Option 1: Deploy via GitHub Actions (Recommended)**

1. **Update deployment workflows** (I'll do this)
2. **Push to main branch**
3. **Watch deployment** in GitHub Actions

### **Option 2: Manual Deployment**

**Backend:**
```bash
cd fastapi_backend

# Deploy to Cloud Run
gcloud run deploy matrimonial-backend \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars MONGODB_URL=mongodb+srv://...,REDIS_URL=redis://... \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 10
```

**Frontend:**
```bash
cd frontend

# Build first
npm run build

# Deploy to Cloud Run
gcloud run deploy matrimonial-frontend \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 512Mi \
  --cpu 1
```

---

## 🧪 **Phase 8: Test Deployment**

```bash
# Get backend URL
gcloud run services describe matrimonial-backend \
  --region us-central1 \
  --format="value(status.url)"

# Get frontend URL
gcloud run services describe matrimonial-frontend \
  --region us-central1 \
  --format="value(status.url)"

# Test backend health
curl https://matrimonial-backend-xxxxx.run.app/health

# Test frontend
curl https://matrimonial-frontend-xxxxx.run.app
```

---

## 💰 **Cost Estimate**

### **Free Tier (Startup)**

| Service | Free Tier | Cost After |
|---------|-----------|------------|
| MongoDB Atlas | 512 MB forever | $0.08/GB/month |
| Redis Cloud | 30 MB forever | $0/month |
| Cloud Run (Backend) | 2M requests/month | $0.40/M requests |
| Cloud Run (Frontend) | 2M requests/month | $0.40/M requests |
| Cloud Storage | 5 GB | $0.02/GB/month |

**Estimated Monthly Cost:** **$0-10/month** (within free tier)

### **Production Scale**

| Users | Requests/Month | Est. Cost |
|-------|----------------|-----------|
| 100   | ~100K          | $0 (free) |
| 1,000 | ~1M            | $0-5      |
| 10,000| ~10M           | $20-50    |

---

## 📊 **Phase 9: Monitoring**

### **Cloud Run Logs:**
```bash
# Backend logs
gcloud run services logs read matrimonial-backend \
  --region us-central1 \
  --limit 50

# Frontend logs
gcloud run services logs read matrimonial-frontend \
  --region us-central1 \
  --limit 50
```

### **MongoDB Atlas Monitoring:**
- Go to Atlas dashboard
- View metrics, slow queries, performance

### **Set Up Alerts:**
```bash
# Cloud Run errors
gcloud alpha monitoring policies create \
  --notification-channels=YOUR_CHANNEL_ID \
  --display-name="High Error Rate" \
  --condition-display-name="Error rate > 5%" \
  --condition-threshold-value=5
```

---

## 🔄 **Phase 10: Continuous Deployment**

Once set up, your workflow:

```
1. Make changes locally
2. git push origin main
3. GitHub Actions runs tests
4. If tests pass → Auto-deploy to Cloud Run
5. Check logs for deployment status
6. New version live in ~5 minutes!
```

---

## 🐛 **Troubleshooting**

### **Issue: MongoDB Connection Failed**

**Check:**
```bash
# Test connection string
mongosh "YOUR_MONGODB_URL"
```

**Fix:**
- Verify password is correct
- Check Network Access in MongoDB Atlas
- Add Cloud Run IPs to whitelist

### **Issue: Cloud Run Build Failed**

**Check:**
```bash
# View build logs
gcloud builds list --limit=5
gcloud builds log BUILD_ID
```

**Common fixes:**
- Check Dockerfile syntax
- Verify all dependencies in requirements.txt
- Check Python version compatibility

### **Issue: High Costs**

**Optimize:**
- Set min-instances to 0 (scale to zero)
- Reduce memory allocation
- Use Cloud CDN for static files
- Enable request timeout

---

## 🔐 **Security Checklist**

- [ ] MongoDB: IP whitelist configured
- [ ] MongoDB: Strong password (16+ chars)
- [ ] Redis: Password authentication enabled
- [ ] Cloud Run: Environment variables secured
- [ ] Service Account: Minimal permissions
- [ ] HTTPS: Enabled (automatic on Cloud Run)
- [ ] CORS: Configured for frontend domain
- [ ] Rate limiting: Enabled in backend
- [ ] Secrets: Using Secret Manager (not env vars)

---

## 📚 **Next Steps**

1. ✅ Export local MongoDB → Run `./export_mongodb.sh`
2. ✅ Create MongoDB Atlas cluster
3. ✅ Import data to Atlas
4. ✅ Set up Redis Cloud
5. ✅ Configure GCP project
6. ✅ Create service account
7. ✅ Add GitHub secrets
8. ✅ Deploy!

---

**Ready to start? Let's do this step by step!** 🚀
