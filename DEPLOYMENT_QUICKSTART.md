# 🚀 Quick Deployment Guide
**Deploy to Google Cloud in 15 minutes**

---

## ⚡ **FASTEST WAY - Automated Script**

```bash
# 1. Make script executable
chmod +x deploy_to_gcloud.sh export_mongodb.sh

# 2. Run deployment (it will guide you through everything)
./deploy_to_gcloud.sh
```

**The script will:**
- ✅ Export your local MongoDB
- ✅ Help you set up MongoDB Atlas (FREE)
- ✅ Import your data to Atlas
- ✅ Configure Redis
- ✅ Deploy backend to Cloud Run
- ✅ Deploy frontend to Cloud Run
- ✅ Configure secrets securely
- ✅ Give you live URLs!

**Time:** ~15 minutes  
**Cost:** $0/month (free tier)

---

## 📋 **Prerequisites** (one-time setup)

### 1. Install Google Cloud SDK
```bash
# Mac
brew install --cask google-cloud-sdk

# Or download from:
# https://cloud.google.com/sdk/docs/install
```

### 2. Install MongoDB Tools
```bash
# Mac
brew install mongodb-database-tools

# Or download from:
# https://www.mongodb.com/try/download/database-tools
```

### 3. Create MongoDB Atlas Account (FREE)
- Go to: https://www.mongodb.com/cloud/atlas/register
- Create account (no credit card required)
- That's it! Script will guide you through cluster setup

---

## 🎯 **Manual Deployment (Step-by-Step)**

If you prefer manual control:

### **Step 1: Export MongoDB**
```bash
./export_mongodb.sh
```
**Output:** `mongodb_backup_YYYYMMDD_HHMMSS.tar.gz`

### **Step 2: Set Up MongoDB Atlas**
1. Go to https://cloud.mongodb.com
2. Create M0 (FREE) cluster
3. Create database user
4. Get connection string:
   ```
   mongodb+srv://user:pass@cluster.mongodb.net/
   ```

### **Step 3: Import Data**
```bash
# Extract backup
tar -xzf mongodb_backup_*.tar.gz
cd mongodb_backup_*

# Import
mongorestore --uri="YOUR_MONGODB_URL" --db matrimonialDB matrimonialDB/
```

### **Step 4: Deploy Backend**
```bash
cd fastapi_backend

gcloud run deploy matrimonial-backend \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars MONGODB_URL=YOUR_URL
```

### **Step 5: Deploy Frontend**
```bash
cd frontend

# Set backend URL in .env.production
echo "REACT_APP_API_URL=YOUR_BACKEND_URL" > .env.production

gcloud run deploy matrimonial-frontend \
  --source . \
  --region us-central1 \
  --allow-unauthenticated
```

---

## 🔑 **Required Information**

Have these ready before starting:

| Item | Example | Where to Get |
|------|---------|--------------|
| MongoDB URL | mongodb+srv://... | MongoDB Atlas dashboard |
| Redis URL (optional) | redis://... | Redis Cloud or skip |
| GCP Project ID | matrimonial-prod | Choose any name |
| Region | us-central1 | Closest to users |

---

## 💰 **Cost Breakdown**

### **Free Tier (Perfect for Starting)**

| Service | Free Amount | After Free Tier |
|---------|-------------|-----------------|
| MongoDB Atlas | 512 MB storage | $0.08/GB/month |
| Redis Cloud | 30 MB | $0/month |
| Cloud Run | 2M requests | $0.40/M requests |
| Cloud Build | 120 builds | $0.003/build-min |

**Monthly Cost:** **$0** for ~1000 users

### **Scaling Costs**

| Users | Requests/Month | Monthly Cost |
|-------|----------------|--------------|
| 100 | ~50K | $0 (free) |
| 1,000 | ~500K | $0 (free) |
| 5,000 | ~2.5M | $1-5 |
| 10,000 | ~5M | $10-20 |
| 50,000 | ~25M | $50-100 |

---

## 🧪 **Testing Deployment**

```bash
# Get URLs
gcloud run services list --region us-central1

# Test backend
curl https://YOUR-BACKEND.run.app/health

# Test frontend
open https://YOUR-FRONTEND.run.app
```

---

## 📊 **Monitoring**

### **View Logs:**
```bash
# Backend logs
gcloud run services logs read matrimonial-backend --region us-central1

# Frontend logs  
gcloud run services logs read matrimonial-frontend --region us-central1

# Follow live logs
gcloud run services logs tail matrimonial-backend --region us-central1
```

### **Cloud Console:**
- Metrics: https://console.cloud.google.com/run
- Billing: https://console.cloud.google.com/billing
- MongoDB: https://cloud.mongodb.com

---

## 🐛 **Common Issues**

### **Issue: "gcloud: command not found"**
```bash
# Install Google Cloud SDK first
brew install --cask google-cloud-sdk
```

### **Issue: "Permission denied"**
```bash
# Make scripts executable
chmod +x *.sh
```

### **Issue: "MongoDB connection failed"**
- Check username/password
- Verify IP whitelist in MongoDB Atlas
- Test connection: `mongosh "YOUR_URL"`

### **Issue: "Cloud Run build failed"**
```bash
# Check build logs
gcloud builds list --limit=5
gcloud builds log BUILD_ID
```

### **Issue: "High costs"**
```bash
# Set min instances to 0 (scale to zero)
gcloud run services update SERVICE_NAME \
  --min-instances 0 \
  --region us-central1
```

---

## 🔄 **Updating Deployment**

### **Update Backend:**
```bash
cd fastapi_backend
gcloud run deploy matrimonial-backend --source . --region us-central1
```

### **Update Frontend:**
```bash
cd frontend
npm run build
gcloud run deploy matrimonial-frontend --source . --region us-central1
```

### **Or use GitHub Actions:**
```bash
git push origin main
# Automatically deploys via CI/CD!
```

---

## 🔐 **Security Checklist**

Before going live:

- [ ] MongoDB: Strong password (16+ characters)
- [ ] MongoDB: IP whitelist configured
- [ ] Redis: Password enabled
- [ ] Cloud Run: Min instances = 0
- [ ] Secrets: Using Secret Manager (not env vars)
- [ ] HTTPS: Enabled (automatic)
- [ ] CORS: Frontend domain whitelisted
- [ ] Rate limiting: Enabled in backend
- [ ] JWT secret: Generated securely
- [ ] Backups: Automated (MongoDB Atlas)

---

## 📞 **Support**

**Documentation:**
- Full guide: `GOOGLE_CLOUD_DEPLOYMENT.md`
- CI/CD setup: `CI_CD_SETUP.md`
- Troubleshooting: Check GitHub issues

**Need Help?**
1. Check logs first
2. Review documentation
3. Create GitHub issue with error details

---

## ⚡ **TL;DR - Just Run This:**

```bash
chmod +x deploy_to_gcloud.sh
./deploy_to_gcloud.sh
```

**Follow the prompts. Done in 15 minutes!** 🎉

---

**Last Updated:** October 25, 2025
