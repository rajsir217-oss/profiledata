# 📦 MongoDB Migration Guide
**Copy Local MongoDB Data to Remote MongoDB**

---

## ⚡ **Quick Start (5 minutes)**

```bash
# 1. Make script executable
chmod +x migrate_mongodb_to_cloud.sh

# 2. Run migration
./migrate_mongodb_to_cloud.sh
```

**The script will:**
1. ✅ Check your local MongoDB
2. ✅ Show database statistics
3. ✅ Export all data
4. ✅ Connect to remote MongoDB
5. ✅ Import all data
6. ✅ Verify successful migration
7. ✅ Update environment variables

---

## 🎯 **What You Need First**

### **Option 1: MongoDB Atlas (Recommended - FREE)**

**Setup (2 minutes):**

1. **Create Account:**
   - Go to: https://www.mongodb.com/cloud/atlas/register
   - Sign up (no credit card needed)

2. **Create Cluster:**
   - Click "Build a Database"
   - Select **FREE** tier (M0 Sandbox - 512MB)
   - Region: **us-central1** (same as your Cloud Run)
   - Cluster name: `matrimonial-cluster`

3. **Create User:**
   - Database Access → Add New User
   - Username: `matrimonial_app`
   - Password: Generate secure password (save it!)
   - Privileges: `readWriteAnyDatabase`

4. **Allow Network Access:**
   - Network Access → Add IP Address
   - For now: `0.0.0.0/0` (allow from anywhere)
   - Later: Add specific Cloud Run IPs

5. **Get Connection String:**
   - Click "Connect" → "Connect your application"
   - Copy connection string:
   ```
   mongodb+srv://matrimonial_app:YOUR_PASSWORD@matrimonial-cluster.xxxxx.mongodb.net/
   ```
   - **Replace** `<password>` with your actual password
   - **Remove** `myFirstDatabase` if present

**Cost:** FREE forever (512MB storage)

### **Option 2: Google Cloud MongoDB**

If you want MongoDB on Google Cloud:

```bash
# Create a VM with MongoDB
gcloud compute instances create mongodb-server \
  --zone=us-central1-a \
  --machine-type=e2-micro \
  --boot-disk-size=10GB \
  --tags=mongodb

# SSH and install MongoDB
gcloud compute ssh mongodb-server
```

**Cost:** ~$5-10/month (VM costs)

---

## 🚀 **Migration Steps**

### **Step 1: Ensure Local MongoDB is Running**

```bash
# Check if MongoDB is running
mongosh --eval "db.version()"

# If not running, start it:
brew services start mongodb-community

# Or on Linux:
sudo systemctl start mongod
```

### **Step 2: Run Migration Script**

```bash
./migrate_mongodb_to_cloud.sh
```

**What it does:**
1. Shows your local database stats
2. Asks for remote MongoDB URL
3. Tests connection
4. Exports all data
5. Asks if you want to merge or replace
6. Imports to remote MongoDB
7. Verifies the import

### **Step 3: Choose Import Mode**

**Merge Mode:**
- Keeps existing data
- Adds new documents
- Good for: Adding data to existing database

**Replace Mode:**
- Drops existing collections
- Imports fresh data
- Good for: Clean migration, first-time setup

---

## 📊 **What Gets Migrated**

**Everything in your local `matrimonialDB`:**

| Collection | What's Included |
|------------|-----------------|
| users | All 203 users (profiles, passwords, settings) |
| messages | All messages and chat history |
| conversations | All conversation metadata |
| favorites | All favorites lists |
| shortlists | All shortlisted profiles |
| exclusions | All excluded users |
| pii_requests | All PII access requests |
| pii_grants | All granted PII access |
| notification_queue | Pending notifications |
| notification_log | Notification history |
| notification_preferences | User notification settings |
| activity_logs | User activity tracking |
| dynamic_jobs | Scheduled jobs |
| job_executions | Job execution history |

**Plus:**
- ✅ All indexes
- ✅ All document structure
- ✅ All relationships
- ✅ Everything!

---

## 🔧 **After Migration: Update Backend**

### **Local Testing:**

```bash
cd fastapi_backend

# Create .env file with remote MongoDB
cat > .env << EOF
MONGODB_URL=mongodb+srv://matrimonial_app:PASSWORD@cluster.mongodb.net/
DATABASE_NAME=matrimonialDB
EOF

# Test connection
python3 << EOF
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def test():
    client = AsyncIOMotorClient("YOUR_MONGODB_URL")
    db = client.matrimonialDB
    users = await db.users.count_documents({})
    print(f"✅ Connected! Found {users} users")
    
asyncio.run(test())
EOF
```

### **Update GitHub Secrets (for deployment):**

1. **Go to GitHub:**
   ```
   https://github.com/YOUR_USERNAME/profiledata/settings/secrets/actions
   ```

2. **Add/Update Secret:**
   - Name: `MONGODB_URL`
   - Value: `mongodb+srv://matrimonial_app:PASSWORD@cluster.mongodb.net/`

3. **Your deployment workflow will automatically use it!**

### **Update Cloud Run Deployment:**

If you've already deployed, update the environment variable:

```bash
gcloud run services update matrimonial-backend \
  --region us-central1 \
  --update-env-vars MONGODB_URL="mongodb+srv://matrimonial_app:PASSWORD@cluster.mongodb.net/"
```

---

## ✅ **Verification**

### **Test Remote Connection:**

```bash
# Test with mongosh
mongosh "mongodb+srv://matrimonial_app:PASSWORD@cluster.mongodb.net/"

# In mongosh:
use matrimonialDB
db.users.countDocuments()  # Should show 203
db.messages.countDocuments()
show collections
```

### **Test from Backend:**

```bash
cd fastapi_backend

# Test with Python
python3 << 'EOF'
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def test():
    MONGODB_URL = "mongodb+srv://matrimonial_app:PASSWORD@cluster.mongodb.net/"
    client = AsyncIOMotorClient(MONGODB_URL)
    db = client.matrimonialDB
    
    print("Testing connection...")
    collections = await db.list_collection_names()
    print(f"✅ Collections: {len(collections)}")
    
    for coll in collections:
        count = await db[coll].count_documents({})
        print(f"  - {coll}: {count} documents")
    
    client.close()

asyncio.run(test())
EOF
```

---

## 🐛 **Troubleshooting**

### **"Connection refused" or "Network error"**

**Check Network Access in MongoDB Atlas:**
1. Go to Atlas dashboard
2. Network Access → Add IP Address
3. Add `0.0.0.0/0` (allow from anywhere)
4. Wait 1-2 minutes for changes to apply

### **"Authentication failed"**

**Check credentials:**
- Username is correct (`matrimonial_app`)
- Password doesn't have special characters (URL encode if it does)
- Try resetting password in Atlas

### **"Database not found"**

**Solution:**
- MongoDB creates database automatically when you insert data
- The migration script uses `--db matrimonialDB` to specify database name
- Check if you're connecting to the right cluster

### **"Cannot connect to local MongoDB"**

```bash
# Start MongoDB
brew services start mongodb-community

# Or manually:
mongod --config /opt/homebrew/etc/mongod.conf
```

### **"mongodump: command not found"**

```bash
# Install MongoDB tools
brew install mongodb-database-tools
```

---

## 💡 **Pro Tips**

### **1. Regular Backups:**

```bash
# Schedule daily backups
crontab -e

# Add this line (runs daily at 2 AM):
0 2 * * * /path/to/export_mongodb.sh
```

### **2. Atlas Automatic Backups:**

MongoDB Atlas (FREE tier) includes:
- ✅ Point-in-time backups (last 24 hours)
- ✅ Snapshot backups
- ✅ Easy restore

**Enable in Atlas:**
- Go to cluster → Backup
- Configure backup schedule

### **3. Connection String Security:**

**Don't:**
- ❌ Commit connection strings to git
- ❌ Share credentials in Slack/email
- ❌ Use weak passwords

**Do:**
- ✅ Use environment variables
- ✅ Use GitHub Secrets
- ✅ Rotate passwords regularly
- ✅ Use IP whitelist

### **4. Monitor Usage:**

**MongoDB Atlas Dashboard:**
- Database size
- Connection count
- Query performance
- Slow queries

**Set up alerts:**
- Storage > 80%
- High connection count
- Unusual query patterns

---

## 📊 **MongoDB Atlas Free Tier Limits**

| Feature | Free Tier (M0) | Paid Tier |
|---------|----------------|-----------|
| Storage | 512 MB | Unlimited |
| RAM | Shared | Dedicated |
| Connections | 500 | Unlimited |
| Backups | Last 24 hours | Configurable |
| Cost | **FREE forever** | From $9/month |

**What 512MB fits:**
- ~10,000 user profiles
- ~100,000 messages
- ~50,000 notifications
- Perfect for startup/MVP!

**When to upgrade:**
- Storage > 400 MB (80%)
- Consistent high traffic
- Need dedicated resources
- Multiple environments (dev/staging/prod)

---

## 🔄 **Syncing Local ↔ Cloud**

### **Option 1: One-time migration (recommended)**

Use this script once, then use cloud MongoDB as primary.

### **Option 2: Periodic sync**

If you still develop locally but want to sync to cloud:

```bash
# Cron job to sync daily
0 3 * * * /path/to/migrate_mongodb_to_cloud.sh merge
```

### **Option 3: Always use cloud**

Update local backend to use cloud MongoDB:

```bash
# In fastapi_backend/.env
MONGODB_URL=mongodb+srv://matrimonial_app:PASSWORD@cluster.mongodb.net/
```

---

## 📝 **Summary**

**What This Script Does:**
1. ✅ Exports your entire local MongoDB database
2. ✅ Connects to remote MongoDB (Atlas or custom)
3. ✅ Imports all data safely
4. ✅ Verifies successful migration
5. ✅ Keeps backup if needed

**Time Required:** 5 minutes  
**Data Loss Risk:** None (creates backup)  
**Recommended MongoDB:** Atlas (FREE)  
**Cost:** $0/month

**After migration:**
- ✅ Update backend environment variables
- ✅ Update GitHub secrets
- ✅ Test connection
- ✅ Deploy!

---

## 🎉 **Ready to Migrate!**

```bash
chmod +x migrate_mongodb_to_cloud.sh
./migrate_mongodb_to_cloud.sh
```

**Questions?** Check the troubleshooting section above!

---

**Last Updated:** October 25, 2025
