# Environment Setup - Quick Start Guide

## 🚀 5-Minute Setup

### 1. Choose Your Environment

```bash
# Local development (default)
cp .env.local.example .env.local

# Docker development
cp .env.docker.example .env.docker

# Cloud development
cp .env.dev.example .env.dev

# Staging
cp .env.stage.example .env.stage

# Production
cp .env.pod.example .env.pod
```

### 2. Configure Backend URLs

Edit the `.env.*` file you just created:

```bash
# Example for dev environment
nano .env.dev
```

**Replace `yourdomain.com` with your actual backend URL:**

```bash
REACT_APP_ENVIRONMENT=dev
REACT_APP_DEV_BACKEND_URL=https://backend-dev-abc123-uc.a.run.app
REACT_APP_DEV_API_URL=https://backend-dev-abc123-uc.a.run.app/api/users
REACT_APP_DEV_WS_URL=wss://backend-dev-abc123-uc.a.run.app
```

### 3. Build for Your Environment

```bash
# Using npm scripts (requires env-cmd package)
npm run build:dev

# OR using bash script
./scripts/build-for-env.sh dev

# OR manually
REACT_APP_ENVIRONMENT=dev npm run build
```

### 4. Deploy

```bash
# Google Cloud Run
./scripts/deploy-to-gcloud.sh dev YOUR_PROJECT_ID us-central1

# OR manually deploy build/ folder to your hosting platform
```

---

## 📋 All Available Commands

### Development

```bash
npm start                    # Local development (auto-detects localhost)
npm run start:docker         # Start with Docker config
npm run start:dev           # Start with dev config (testing)
```

### Building

```bash
npm run build               # Default build (auto-detects environment)
npm run build:local         # Build for local
npm run build:docker        # Build for Docker
npm run build:dev           # Build for dev environment
npm run build:stage         # Build for staging
npm run build:pod           # Build for production
```

### Scripts

```bash
./scripts/build-for-env.sh [ENV]        # Build with environment validation
./scripts/deploy-to-gcloud.sh [ENV]    # Build + Deploy to Google Cloud
```

---

## 🌍 Environment Cheat Sheet

| Environment | When to Use | Backend Example |
|------------|-------------|-----------------|
| **local** | Local dev on your machine | `localhost:8000` |
| **docker** | Docker Compose containers | `backend:8000` |
| **dev** | Cloud dev/testing | `dev-backend.run.app` |
| **stage** | Pre-production testing | `stage-backend.run.app` |
| **pod** | Production | `api.yourdomain.com` |

---

## ✅ Verify Your Setup

After building, check the configuration:

```bash
# 1. Search for any localhost references (should only be in fallbacks)
grep -r "localhost:8000" build/ | grep -v "RUNTIME_CONFIG" | wc -l
# Should output: 0

# 2. Start the app and check console
npm start
# Open browser console and look for:
# 🌍 Environment: [your-env]
# 🔗 Backend URL: [your-backend-url]
```

---

## 🆘 Common Issues

### Issue: "Environment not detected correctly"

**Fix:** Set explicitly:

```bash
REACT_APP_ENVIRONMENT=dev npm start
```

### Issue: "Still calling localhost in production"

**Fix:** Clear cache and rebuild:

```bash
rm -rf node_modules/.cache build/
npm run build:pod
```

### Issue: "Docker containers can't connect"

**Fix:** Use service names, not localhost:

```bash
# In .env.docker
REACT_APP_SOCKET_URL=http://backend:8000  # ✅ Correct
# NOT: http://localhost:8000               # ❌ Wrong
```

---

## 📚 Full Documentation

- **Complete Guide:** [ENVIRONMENT_CONFIGURATION.md](../ENVIRONMENT_CONFIGURATION.md)
- **Fix Summary:** [LOCALHOST_URL_FIX_SUMMARY.md](../LOCALHOST_URL_FIX_SUMMARY.md)

---

## 💡 Pro Tips

1. **Never commit `.env.pod`** (production secrets)
2. **Always verify** backend URL in browser console after deployment
3. **Use scripts** instead of manual builds to avoid mistakes
4. **Test locally** before deploying to cloud
5. **Keep `.env.*.example` files** updated with your team

---

## 🎯 Quick Deploy to Production

```bash
# 1. Setup (first time only)
cp .env.pod.example .env.pod
nano .env.pod  # Add your production backend URL

# 2. Build
npm run build:pod

# 3. Deploy
./scripts/deploy-to-gcloud.sh pod YOUR_PROJECT_ID

# 4. Verify
# Open the deployed URL and check browser console
```

**Done! Your frontend now points to the correct backend in all environments! 🎉**
