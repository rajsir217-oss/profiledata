# Deployment Configuration Guide

## 📋 Configuration Overview

### Required Configurations by Environment

| Configuration | Local | Production (GCP) | Description |
|--------------|-------|------------------|-------------|
| **MONGODB_URL** | `mongodb://localhost:27017` | `mongodb+srv://...@mongocluster0...` | Database connection |
| **DATABASE_NAME** | `matrimonialDB` | `matrimonialDB` | Database name |
| **REDIS_URL** | `redis://localhost:6379` | `redis://...@redis-cloud.com:11872` | Cache/Queue |
| **FRONTEND_URL** | `http://localhost:3000` | `https://profiledata-pod.ue.r.appspot.com` | Frontend URL |
| **BACKEND_URL** | `http://localhost:8000` | `https://matrimonial-backend-458052696267.us-central1.run.app` | Backend API |
| **USE_GCS** | `false` | `true` | Use cloud storage |
| **GCS_BUCKET_NAME** | ` ` | `matrimonial-images-prod` | Storage bucket |
| **GCS_PROJECT_ID** | ` ` | `profiledata-438623` | GCP project |

## 🚀 Local Development Setup

### 1. Copy Local Environment File
```bash
cd fastapi_backend
cp .env.local .env
```

### 2. Update Credentials
Edit `.env` and add your local credentials:
- SMTP credentials for email
- Twilio credentials for SMS (optional)

### 3. Start Services
```bash
# Start MongoDB locally
brew services start mongodb-community

# Start Redis (optional)
brew services start redis

# Start backend
./bstart.sh

# Start frontend
./fstart.sh
```

## ☁️ GCP Deployment

### 1. Set Environment Variables
```bash
# Backend deployment
gcloud run services update matrimonial-backend \
  --region us-central1 \
  --set-env-vars \
    MONGODB_URL='mongodb+srv://rajl3v3l_db_user:3F01eZUHTY9tx07u@mongocluster0.rebdf0h.mongodb.net/matrimonialDB?retryWrites=true&w=majority&appName=MongoCluster0',\
    DATABASE_NAME=matrimonialDB,\
    REDIS_URL='redis://default:2svzScwOza6YUFifjx32WIWqWHytrq12@redis-11872.c263.us-east-1-2.ec2.redns.redis-cloud.com:11872',\
    BACKEND_URL='https://matrimonial-backend-458052696267.us-central1.run.app',\
    FRONTEND_URL='https://profiledata-pod.ue.r.appspot.com',\
    USE_GCS=true,\
    GCS_BUCKET_NAME='matrimonial-images-prod',\
    GCS_PROJECT_ID='profiledata-438623',\
    SMTP_HOST='smtp.gmail.com',\
    SMTP_PORT=587,\
    FROM_EMAIL='noreply@l3v3l.com',\
    FROM_NAME='L3V3L Dating'
```

### 2. Set Secrets (Sensitive Data)
```bash
# Create secrets in Google Secret Manager
echo -n "your-secret-key" | gcloud secrets create jwt-secret-key --data-file=-
echo -n "your-smtp-password" | gcloud secrets create smtp-password --data-file=-

# Grant access to Cloud Run service
gcloud secrets add-iam-policy-binding jwt-secret-key \
  --member="serviceAccount:YOUR-SERVICE-ACCOUNT@PROJECT.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

# Reference in Cloud Run
gcloud run services update matrimonial-backend \
  --update-secrets=SECRET_KEY=jwt-secret-key:latest,\
                   SMTP_PASSWORD=smtp-password:latest
```

### 3. Frontend Environment Variables
For frontend React app, set build-time variables:

```bash
# .env.production for frontend
REACT_APP_ENVIRONMENT=production
REACT_APP_API_URL=https://matrimonial-backend-458052696267.us-central1.run.app/api/users
REACT_APP_SOCKET_URL=https://matrimonial-backend-458052696267.us-central1.run.app

# Build with production env
npm run build
```

## 🔍 Environment Detection

### Backend Detection Logic
```python
# Automatically detects environment based on:
1. APP_ENVIRONMENT env var (highest priority)
2. K_SERVICE env var (Cloud Run indicator)
3. Docker container check
4. Port 8080 (Cloud Run default)
5. Default to 'local'
```

### Frontend Detection Logic
```javascript
// Automatically detects based on:
1. window.location.hostname === 'localhost' → local
2. hostname.includes('dev') → development
3. hostname.includes('stage') → staging
4. Default → production
```

## 📊 Configuration Validation

### Check Your Configuration
```bash
cd fastapi_backend
python env_config.py
```

This will:
- Auto-detect your environment
- Load appropriate config file
- Validate all required settings
- Show current configuration

## 🔄 Switching Environments

### For Backend
```bash
# Local development
export APP_ENVIRONMENT=local
./bstart.sh

# Staging test
export APP_ENVIRONMENT=staging
./bstart.sh

# Production (don't run locally!)
export APP_ENVIRONMENT=production
```

### For Frontend
```bash
# Local
npm start  # Uses localhost detection

# Production build
REACT_APP_ENVIRONMENT=production npm run build
```

## 📝 Configuration Files

| File | Purpose | When to Use |
|------|---------|-------------|
| `.env` | Default/current config | Active configuration |
| `.env.local` | Local development | Development machine |
| `.env.staging` | Staging environment | Testing deployment |
| `.env.production` | Production settings | Reference for GCP |
| `.env.test` | Test configuration | Running tests |

## ⚠️ Important Notes

1. **Never commit** `.env` files with real credentials
2. **Use Secret Manager** for sensitive data in production
3. **Different databases** for local vs production
4. **Image Storage**: 
   - Local: Files in `uploads/` folder
   - Production: Google Cloud Storage
5. **Test configuration** before deploying

## 🐛 Troubleshooting

### Issue: Wrong environment detected
```bash
# Force environment
export APP_ENVIRONMENT=local
```

### Issue: Missing configuration
```bash
# Check what's missing
python env_config.py
```

### Issue: Can't connect to MongoDB
```bash
# Check MongoDB URL format
# Local: mongodb://localhost:27017
# Atlas: mongodb+srv://user:pass@cluster...
```

### Issue: Images not loading
- Local: Check `USE_GCS=false`
- Production: Check `USE_GCS=true` and bucket permissions
