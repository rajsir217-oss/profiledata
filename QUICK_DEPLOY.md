# 🚀 Quick Deployment Guide

## Prerequisites

1. **Install Google Cloud CLI**
   ```bash
   # macOS
   brew install --cask google-cloud-sdk
   
   # Or download from: https://cloud.google.com/sdk/docs/install
   ```

2. **Login to GCP**
   ```bash
   gcloud auth login
   ```

3. **Set Project**
   ```bash
   gcloud config set project profiledata-438623
   ```

## Deployment Options

### Option 1: Full Deployment (Backend + Frontend)
```bash
./deploy-gcp.sh
# Select: 3) Both (full deployment)
```

### Option 2: Backend Only
```bash
./deploy-gcp.sh
# Select: 1) Backend only
```

### Option 3: Frontend Only
```bash
./deploy-gcp.sh
# Select: 2) Frontend only
```

### Option 4: Update Environment Variables
```bash
./deploy-gcp.sh
# Select: 4) Update environment variables only
```

## Setting Up Secrets (Recommended)

For sensitive data like API keys and passwords:

```bash
./set-gcp-secrets.sh
```

This will prompt you for:
- JWT Secret Key
- SMTP credentials
- Twilio credentials (optional)

## Manual Deployment Steps

### Backend Deployment

1. **Navigate to backend directory**
   ```bash
   cd fastapi_backend
   ```

2. **Deploy to Cloud Run**
   ```bash
   gcloud run deploy matrimonial-backend \
     --source . \
     --region us-central1 \
     --platform managed \
     --allow-unauthenticated \
     --port 8080
   ```

3. **Set environment variables**
   ```bash
   gcloud run services update matrimonial-backend \
     --region us-central1 \
     --set-env-vars \
       MONGODB_URL='mongodb+srv://...',\
       DATABASE_NAME='matrimonialDB',\
       BACKEND_URL='https://your-backend-url',\
       FRONTEND_URL='https://your-frontend-url',\
       USE_GCS=true
   ```

### Frontend Deployment

1. **Navigate to frontend directory**
   ```bash
   cd frontend
   ```

2. **Build production version**
   ```bash
   REACT_APP_ENVIRONMENT=production npm run build
   ```

3. **Deploy to App Engine**
   ```bash
   gcloud app deploy
   ```

## Environment Configuration

### Backend Environment Variables

**Required:**
- `MONGODB_URL` - MongoDB Atlas connection string
- `DATABASE_NAME` - Database name (matrimonialDB)
- `REDIS_URL` - Redis Cloud connection string
- `BACKEND_URL` - Your Cloud Run backend URL
- `FRONTEND_URL` - Your App Engine frontend URL
- `USE_GCS` - Set to `true` for production
- `GCS_BUCKET_NAME` - Google Cloud Storage bucket
- `GCS_PROJECT_ID` - Your GCP project ID

**Optional (via Secrets):**
- `SECRET_KEY` - JWT signing key
- `SMTP_USER` - Email service username
- `SMTP_PASSWORD` - Email service password
- `TWILIO_ACCOUNT_SID` - SMS service account
- `TWILIO_AUTH_TOKEN` - SMS service token
- `TWILIO_FROM_PHONE` - SMS sender number

### Frontend Environment Variables

Create `.env.production` in frontend directory:
```env
REACT_APP_ENVIRONMENT=production
REACT_APP_API_URL=https://your-backend-url/api/users
REACT_APP_SOCKET_URL=https://your-backend-url
REACT_APP_BACKEND_URL=https://your-backend-url
```

## Monitoring & Logs

### View Backend Logs
```bash
gcloud logging tail --service=matrimonial-backend
```

### View Frontend Logs
```bash
gcloud app logs tail
```

### Check Service Status
```bash
# Backend
gcloud run services describe matrimonial-backend --region us-central1

# Frontend
gcloud app describe
```

## URLs After Deployment

| Service | URL |
|---------|-----|
| **Backend API** | `https://matrimonial-backend-XXXXX.us-central1.run.app` |
| **API Docs** | `https://matrimonial-backend-XXXXX.us-central1.run.app/docs` |
| **Frontend** | `https://profiledata-pod.ue.r.appspot.com` |

## Troubleshooting

### Build Fails
```bash
# Check logs
gcloud builds log [BUILD_ID]

# Common issues:
# - Missing dependencies in requirements.txt
# - Dockerfile errors
# - Build timeout (increase in cloudbuild.yaml)
```

### Service Won't Start
```bash
# Check service logs
gcloud logging tail --service=matrimonial-backend --limit 50

# Common issues:
# - Missing environment variables
# - Database connection errors
# - Port mismatch (should be 8080)
```

### Frontend Build Fails
```bash
# Check build output
# Common issues:
# - Missing .env.production
# - Build script errors in package.json
# - Missing dependencies
```

### Can't Connect to Database
- Verify MongoDB Atlas IP whitelist (allow GCP IPs or 0.0.0.0/0)
- Check connection string format
- Verify database user permissions

## Rollback

### Rollback Backend
```bash
gcloud run services update-traffic matrimonial-backend \
  --to-revisions PREVIOUS_REVISION=100 \
  --region us-central1
```

### Rollback Frontend
```bash
gcloud app versions list
gcloud app services set-traffic default --splits VERSION_ID=1
```

## Cost Optimization

### Backend (Cloud Run)
- Set `--min-instances 0` to scale to zero
- Set `--max-instances` based on load
- Use `--cpu 1` for small workloads

### Frontend (App Engine)
- Use `F1` or `F2` instance class in app.yaml
- Set `min_instances: 0` for automatic scaling
- Enable automatic scaling in app.yaml

## CI/CD Setup (Future)

### GitHub Actions
Create `.github/workflows/deploy.yml`:
```yaml
name: Deploy to GCP
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: google-github-actions/setup-gcloud@v0
      - run: ./deploy-gcp.sh
```

## Support

- **GCP Console**: https://console.cloud.google.com
- **Documentation**: See `DEPLOYMENT_GUIDE.md`
- **Environment Setup**: See `LOCAL_GCP_STRATEGY.md`
