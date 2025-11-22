# Node.js 20 Upgrade Guide

**Date:** November 18, 2025  
**Issue:** Deployment warnings due to Node.js version mismatch  
**Solution:** Upgraded from Node 18 to Node 20

---

## 🚨 The Problem

During production deployment, you saw these warnings:

```
npm warn EBADENGINE Unsupported engine
npm warn EBADENGINE   required: { node: '>=20.0.0' }
npm warn EBADENGINE   current: { node: 'v18.20.8', npm: '10.8.2' }
```

**Root Cause:** Several npm packages now require Node.js >=20:
- `glob@11.0.3`
- `jackspeak@4.0.1`
- `lru-cache@11.2.2`
- `minimatch@10.0.1`
- `path-scurry@2.0.1`

---

## ✅ What Was Fixed

### 1. Docker Images Updated

All Dockerfiles now use Node 20:

**Before:**
```dockerfile
FROM node:18-alpine
FROM node:18-slim
```

**After:**
```dockerfile
FROM node:20-alpine
FROM node:20-slim
```

**Files Modified:**
- `/frontend/Dockerfile` → `node:20-slim`
- `/frontend/Dockerfile.prod` → `node:20-alpine` (both stages)
- `/frontend/Dockerfile.dev` → `node:20-alpine`

### 2. Package.json Engines Field Added

**File:** `/frontend/package.json`

Added explicit Node version requirement:

```json
{
  "engines": {
    "node": ">=20.0.0",
    "npm": ">=10.0.0"
  }
}
```

This ensures:
- ✅ Deployment platforms check version compatibility
- ✅ Developers get warned if using wrong version
- ✅ CI/CD pipelines can validate requirements

### 3. .nvmrc File Created

**File:** `/frontend/.nvmrc`

```
20
```

**Benefits:**
- Automatic Node version switching with nvm
- Consistent version across team
- IDE integration (VS Code detects .nvmrc)

---

## 🚀 Deployment Instructions

### Option 1: Using Docker (Recommended)

**No changes needed!** The Dockerfiles now use Node 20 automatically.

```bash
# Build production image
docker build -f frontend/Dockerfile.prod -t myapp:latest \
  --build-arg REACT_APP_API_URL=https://api.example.com \
  --build-arg REACT_APP_SOCKET_URL=wss://api.example.com \
  frontend/

# Run container
docker run -p 8080:8080 myapp:latest
```

### Option 2: Cloud Run / GCP

**No changes needed!** Docker images automatically use Node 20.

```bash
# Build and deploy
gcloud builds submit --config cloudbuild.yaml

# Or using deploy script
cd deploy_gcp
./deploy.sh production
```

### Option 3: Direct Node Installation

If deploying without Docker, upgrade Node:

**Using nvm (Recommended):**
```bash
# Install Node 20
nvm install 20
nvm use 20
nvm alias default 20

# Verify
node --version  # Should show v20.x.x
```

**Using apt (Ubuntu/Debian):**
```bash
# Add NodeSource repository
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -

# Install Node 20
sudo apt-get install -y nodejs

# Verify
node --version  # Should show v20.x.x
```

**Using brew (macOS):**
```bash
# Update Homebrew
brew update

# Install Node 20
brew install node@20
brew link node@20 --force

# Verify
node --version  # Should show v20.x.x
```

---

## 👨‍💻 Local Development Setup

### If You Use nvm (Recommended)

The `.nvmrc` file makes this automatic:

```bash
# In project directory, just run:
nvm use

# Output: Now using node v20.x.x
```

nvm will automatically switch to Node 20 when you enter the project folder.

### If You Don't Use nvm

**Install nvm first:**

```bash
# macOS/Linux
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Or using Homebrew (macOS)
brew install nvm

# Restart terminal, then:
nvm install 20
nvm use 20
```

### Verify Your Setup

```bash
# Check Node version
node --version
# Should output: v20.x.x (e.g., v20.11.0)

# Check npm version  
npm --version
# Should output: 10.x.x or higher

# Test build
cd frontend
npm install
npm run build
# Should complete without EBADENGINE warnings
```

---

## 🔍 Verification Checklist

After upgrading, verify everything works:

### ✅ No More Warnings

```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
```

**Expected:** No `npm warn EBADENGINE` messages

### ✅ Build Succeeds

```bash
npm run build
```

**Expected:** Build completes successfully, creates `/build` folder

### ✅ App Runs

```bash
npm start
```

**Expected:** App starts on port 3000, no console errors

### ✅ Production Build Works

```bash
docker build -f Dockerfile.prod -t test:latest .
docker run -p 8080:8080 test:latest
```

**Expected:** Container starts, app accessible at http://localhost:8080

---

## 🐛 Troubleshooting

### Issue: "nvm: command not found"

**Solution:** Install nvm first:
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc  # or ~/.zshrc
```

### Issue: Still seeing EBADENGINE warnings

**Cause:** Old `node_modules` cached

**Solution:**
```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
```

### Issue: "Cannot find module" errors

**Cause:** Dependencies not installed for Node 20

**Solution:**
```bash
npm install
# If that fails:
npm ci --legacy-peer-deps
```

### Issue: Docker build fails with Node 18 cache

**Cause:** Docker layer cache using old Node 18 image

**Solution:**
```bash
# Force rebuild without cache
docker build --no-cache -f Dockerfile.prod -t myapp:latest .
```

### Issue: Cloud Run deployment fails

**Cause:** Old image still deployed

**Solution:**
```bash
# Force new build
gcloud builds submit --no-cache --config cloudbuild.yaml

# Or delete old images first
gcloud container images list-tags gcr.io/PROJECT_ID/IMAGE_NAME
gcloud container images delete gcr.io/PROJECT_ID/IMAGE_NAME:TAG
```

---

## 📊 Node.js Version Comparison

| Aspect | Node 18 | Node 20 (Current) |
|--------|---------|-------------------|
| **Release** | April 2022 | April 2023 |
| **LTS Until** | April 2025 | April 2026 |
| **Performance** | Baseline | ~10% faster |
| **Package Support** | Declining | Current |
| **Security Updates** | Limited | Active |
| **Our Status** | ⚠️ Deprecated | ✅ Recommended |

---

## 🔮 Future Considerations

### Node 22 (Next LTS - April 2025)

When Node 22 becomes LTS:
1. Update `.nvmrc` to `22`
2. Update Dockerfiles to `node:22-alpine`
3. Update `package.json` engines to `>=22.0.0`
4. Test build and deployment
5. Update this guide

### Staying Up to Date

**Check for updates quarterly:**
```bash
# Check current version
node --version

# Check latest LTS
nvm list-remote --lts

# If outdated, upgrade:
nvm install --lts
nvm alias default lts/*
```

---

## 📝 Summary

### Changes Made
- ✅ Upgraded all Dockerfiles from Node 18 → Node 20
- ✅ Added `engines` field to package.json
- ✅ Created `.nvmrc` for local development
- ✅ Documented upgrade process

### Benefits
- ✅ No more EBADENGINE warnings
- ✅ Access to latest npm packages
- ✅ Better performance (~10% faster)
- ✅ Extended security support until 2026
- ✅ Consistent environment (dev/prod)

### Next Steps
1. Pull latest code
2. Run `nvm use` (or install Node 20)
3. Delete `node_modules` and `package-lock.json`
4. Run `npm install`
5. Verify build works
6. Deploy to production

---

## 🆘 Need Help?

**Common Commands:**
```bash
# Check current Node version
node --version

# Switch to Node 20 (with nvm)
nvm use 20

# Clean install dependencies
rm -rf node_modules package-lock.json && npm install

# Test production build
docker build -f Dockerfile.prod -t test .

# Deploy to production
./deploy_gcp/deploy.sh production
```

**Issues?**
- Check Docker daemon is running
- Verify you have latest code pulled
- Ensure no `node_modules` cache issues
- Try building with `--no-cache` flag

---

**Upgrade Completed:** November 18, 2025  
**Status:** ✅ Production Ready  
**Node Version:** 20.x (LTS until April 2026)
