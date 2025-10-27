# Deployment Guide

## Environment Management

This project now includes **automatic environment switching** to eliminate manual config.js changes.

### Quick Reference

```bash
# Switch to local development
./switch-environment.sh local

# Switch to production (for deployment)
./switch-environment.sh pod

# Check deployment readiness
./pre-deploy-check.sh

# Deploy (automatically switches to production)
./deploy-gcp.sh
```

---

## Development Workflow

### 1. Local Development

```bash
# Ensure you're in local mode
./switch-environment.sh local

# Start backend
cd fastapi_backend
uvicorn main:socket_app --reload

# Start frontend (new terminal)
cd frontend
npm start
```

**Config:** Uses `localhost:8000` for backend, `localhost:3000` for frontend, DEBUG enabled.

---

## Deployment Workflow

### Option A: Automatic (Recommended)

```bash
# 1. Check if ready
./pre-deploy-check.sh

# 2. Deploy (automatically switches to production)
./deploy-gcp.sh
```

The deployment script now **automatically**:
- Switches `config.js` to production mode
- Uses GCP URLs
- Disables debug mode

### Option B: Manual Control

```bash
# 1. Manually switch to production
./switch-environment.sh pod

# 2. Check configuration
./pre-deploy-check.sh

# 3. Deploy
./deploy-gcp.sh
```

---

## Post-Deployment

### Return to Local Development

**Important:** After deployment, switch back to local:

```bash
./switch-environment.sh local
```

This ensures you don't accidentally commit production URLs for local work.

---

## How It Works

### The `switch-environment.sh` Script

Automatically updates `frontend/public/config.js` with:

**Local Mode:**
- ENVIRONMENT: `'local'`
- SOCKET_URL: `http://localhost:8000`
- DEBUG: `true`

**Production Mode (pod):**
- ENVIRONMENT: `'pod'`
- SOCKET_URL: `https://matrimonial-backend-458052696267.us-central1.run.app`
- DEBUG: `false`

### Integration with Deployment

The `deploy-gcp.sh` script automatically calls:
```bash
./switch-environment.sh pod
```
before building and deploying the frontend.

---

## Best Practices

### ✅ DO:
- Use `./switch-environment.sh local` when starting local development
- Let `./deploy-gcp.sh` handle production switching automatically
- Run `./pre-deploy-check.sh` before every deployment
- Commit the switch script changes to the repo

### ❌ DON'T:
- Manually edit `config.js` (use the switch script instead)
- Commit `config.js` with production URLs if working locally
- Deploy without running pre-deploy checks

---

## Environment Files Reference

### Frontend
- `frontend/public/config.js` - Runtime config (auto-updated by switch script)
- `frontend/src/config/apiConfig.js` - API URL configuration (with auto-detection)

### Backend
- `fastapi_backend/.env` - Local development (USE_GCS=false)
- `fastapi_backend/.env.production` - Production settings (USE_GCS=true)

---

## Troubleshooting

### Problem: "config.js is set to 'local'" error

**Solution:**
```bash
./switch-environment.sh pod
```

### Problem: Still seeing localhost URLs after deployment

**Solution:**
1. Check if deployment script ran successfully
2. Verify `config.js` is in production mode
3. Clear browser cache
4. Hard refresh (Cmd+Shift+R on Mac, Ctrl+Shift+R on Windows)

### Problem: API calls failing in production

**Check:**
1. Backend is deployed and running
2. `config.js` has correct GCP URLs
3. CORS is configured properly in backend
4. Check browser console for specific errors

---

## Deployment Options

When running `./deploy-gcp.sh`, you'll see:

```
1) Backend only      - Deploy FastAPI backend to Cloud Run
2) Frontend only     - Deploy React frontend to App Engine
3) Both             - Full deployment (recommended)
4) Update env vars  - Update backend environment variables only
```

**First deployment:** Choose option 3 (Both)  
**Code changes only:** Choose 1 or 2 depending on what changed  
**Config changes only:** Choose option 4

---

## URLs

### Production
- **Frontend:** https://profiledata-pod.ue.r.appspot.com
- **Backend:** https://matrimonial-backend-458052696267.us-central1.run.app
- **API Docs:** https://matrimonial-backend-458052696267.us-central1.run.app/docs

### Local
- **Frontend:** http://localhost:3000
- **Backend:** http://localhost:8000
- **API Docs:** http://localhost:8000/docs

---

## Quick Tips

```bash
# View deployment logs
gcloud logging tail --limit 50

# Check backend status
gcloud run services describe matrimonial-backend --region us-central1

# Check frontend status
gcloud app browse

# View Cloud Run URL
gcloud run services list
```

---

## Summary

**No more manual config.js editing!** 🎉

- **Development:** `./switch-environment.sh local`
- **Deployment:** `./deploy-gcp.sh` (automatic switch)
- **Verification:** `./pre-deploy-check.sh`

The deployment process is now streamlined and less error-prone.
