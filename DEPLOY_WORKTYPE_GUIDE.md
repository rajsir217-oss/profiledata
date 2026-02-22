# Deploy WorkType Search Changes - Step by Step Guide

## 🎯 Objective
Deploy the updated backend with workType search functionality to production

## 📋 Prerequisites
- Google Cloud SDK installed and configured
- Access to the matrimonial project

## 🚀 Deployment Steps

### 1. Deploy Backend

```bash
# Navigate to backend directory
cd /Users/rajsiripuram02/opt/appsrc/profiledata/fastapi_backend

# Build and deploy to Cloud Run
gcloud builds submit --tag gcr.io/[YOUR_PROJECT_ID]/matrimonial-backend .

gcloud run deploy matrimonial-backend \
  --image gcr.io/[YOUR_PROJECT_ID]/matrimonial-backend \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars="MONGODB_URL=$(grep MONGODB_URL .env.production | cut -d'=' -f2-)" \
  --set-env-vars="JWT_SECRET=$(grep JWT_SECRET .env.production | cut -d'=' -f2-)" \
  --set-env-vars="EMAIL_FROM=$(grep EMAIL_FROM .env.production | cut -d'=' -f2-)" \
  --set-env-vars="SMTP_HOST=$(grep SMTP_HOST .env.production | cut -d'=' -f2-)" \
  --set-env-vars="SMTP_PORT=$(grep SMTP_PORT .env.production | cut -d'=' -f2-)" \
  --set-env-vars="SMTP_USER=$(grep SMTP_USER .env.production | cut -d'=' -f2-)" \
  --set-env-vars="SMTP_PASSWORD=$(grep SMTP_PASSWORD .env.production | cut -d'=' -f2-)" \
  --set-env-vars="TWILIO_ACCOUNT_SID=$(grep TWILIO_ACCOUNT_SID .env.production | cut -d'=' -f2-)" \
  --set-env-vars="TWILIO_AUTH_TOKEN=$(grep TWILIO_AUTH_TOKEN .env.production | cut -d'=' -f2-)" \
  --set-env-vars="TWILIO_FROM_PHONE=$(grep TWILIO_FROM_PHONE .env.production | cut -d'=' -f2-)" \
  --set-env-vars="FRONTEND_URL=https://l3v3lmatches.com"
```

### 2. Update Frontend Config

```bash
# Navigate to frontend
cd /Users/rajsiripuram02/opt/appsrc/profiledata/frontend

# Get the new backend URL (from previous step output)
# Update public/config.js with new backend URL
cat > public/config.js << EOF
window.RUNTIME_CONFIG = {
  SOCKET_URL: "https://matrimonial-backend-7cxoxmouuq-uc.a.run.app",
  API_URL: "https://matrimonial-backend-7cxoxmouuq-uc.a.run.app/api/users"
};
EOF

# Build and deploy frontend
npm run build

gcloud builds submit --tag gcr.io/[YOUR_PROJECT_ID]/matrimonial-frontend .

gcloud run deploy matrimonial-frontend \
  --image gcr.io/[YOUR_PROJECT_ID]/matrimonial-frontend \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

## ✅ Verification Steps

### 1. Check Backend API
```bash
# Test occupation options endpoint
curl "https://matrimonial-backend-7cxoxmouuq-uc.a.run.app/api/users/search/occupation-options" | jq '.options[:5]'
```

Expected: Should return standardized categories like "Accountant", "Analyst", "Artist", etc.

### 2. Test Search Functionality
1. Go to https://l3v3lmatches.com/search
2. Click on occupation filter
3. Should see 29 standard categories (not 347 descriptions)
4. Select "Doctor" - should find all medical professionals

### 3. Verify WorkType Updates
The 384 users should now have their workType field updated and searchable.

## 📊 Expected Results

### Before Deployment:
- Occupation dropdown: 347 unique descriptions
- Search "Doctor": Finds only exact matches

### After Deployment:
- Occupation dropdown: 29 standard categories
- Search "Doctor": Finds ALL medical professionals
- Better search coverage and user experience

## 🔍 Troubleshooting

If the occupation dropdown still shows old values:
1. Clear browser cache
2. Check backend deployment logs: `gcloud logs read "resource.type=cloud_run_revision"`
3. Verify frontend config.js is updated

## 📝 Notes

- WorkType updates are already applied to production database
- Backend changes include backward compatibility
- No frontend code changes needed, only config update
