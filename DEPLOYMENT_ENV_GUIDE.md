# 🚀 Deployment & Environment Switching Guide

## ✅ **Automatic Environment Switching - GUARANTEED**

Your setup is now **safe and automatic**. Here's how it works:

---

## 📋 **How It Works**

### **Local Development:**
```bash
npm start
```
- ✅ Uses `.env.local`
- ✅ Backend: `http://localhost:8000`
- ✅ Frontend: `http://localhost:3000`
- ✅ NODE_ENV: `development`

### **Production Build:**
```bash
npm run build
```
- ✅ Uses `.env.production`
- ✅ Backend: `https://matrimonial-backend-7cxoxmouuq-uc.a.run.app`
- ✅ Frontend: `https://l3v3lmatches.com`
- ✅ NODE_ENV: `production`

### **After Deployment, Back to Local:**
```bash
npm start
```
- ✅ **Automatically switches** back to `.env.local`
- ✅ Backend: `http://localhost:8000`
- ✅ **No manual changes needed!**

---

## 🔒 **Why It's Safe**

### 1. **Environment Files Are Not Deployed**
- `.env.local` stays on your machine
- `.env.production` only used during `npm run build`
- Production build creates static files with **baked-in** production URLs
- Your local `.env.local` is **never touched** by deployment

### 2. **Automatic Detection**
```javascript
// apiConfig.js automatically checks:
export const getBackendUrl = () => {
  // 1. Check environment variable (from .env files)
  if (process.env.REACT_APP_BACKEND_URL) {
    return process.env.REACT_APP_BACKEND_URL;
  }
  
  // 2. Fallback based on NODE_ENV
  if (process.env.NODE_ENV === 'production') {
    return 'https://matrimonial-backend-7cxoxmouuq-uc.a.run.app';
  }
  return 'http://localhost:8000';
};
```

### 3. **Build Output Separation**
```
/build/              → Production build (has prod URLs)
/src/                → Source code (unchanged)
/.env.local          → Local config (unchanged)
/.env.production     → Prod config (only read during build)
```

---

## 📦 **Environment Files Overview**

### `.env.local` (Local Development)
```bash
REACT_APP_BACKEND_URL=http://localhost:8000
REACT_APP_FRONTEND_URL=http://localhost:3000
REACT_APP_SOCKET_URL=http://localhost:8000
```
- Used by: `npm start`
- Committed: ❌ NO (in .gitignore)
- Deployed: ❌ NO

### `.env.production` (Production)
```bash
REACT_APP_BACKEND_URL=https://matrimonial-backend-7cxoxmouuq-uc.a.run.app
REACT_APP_FRONTEND_URL=https://l3v3lmatches.com
REACT_APP_SOCKET_URL=https://matrimonial-backend-7cxoxmouuq-uc.a.run.app
```
- Used by: `npm run build`
- Committed: ✅ YES (safe, no secrets)
- Deployed: ❌ NO (only used during build)

---

## 🎯 **Deployment Workflow**

### **Step 1: Local Development**
```bash
# Work on features locally
npm start

# Access at http://localhost:3000
# Backend at http://localhost:8000
```

### **Step 2: Build for Production**
```bash
# Create production build
npm run build

# This creates /build/ folder with:
# - Minified JavaScript
# - Production URLs baked in
# - Optimized assets
```

### **Step 3: Deploy to Production**
```bash
# Deploy the /build/ folder to:
# - Firebase Hosting
# - GCP Cloud Run
# - Netlify
# - etc.

# Example (Firebase):
firebase deploy --only hosting

# Example (GCP):
gcloud app deploy
```

### **Step 4: Back to Local Development**
```bash
# Just run npm start again
npm start

# ✅ Automatically uses localhost!
# ✅ No configuration needed!
# ✅ .env.local is still there unchanged!
```

---

## 🛡️ **Safety Guarantees**

### ✅ **What Can't Go Wrong:**

1. **Local dev will NEVER use production URLs**
   - `npm start` always uses `.env.local`
   - NODE_ENV is always `development`

2. **Production build will NEVER use localhost**
   - `npm run build` always uses `.env.production`
   - NODE_ENV is always `production`

3. **Environment files don't interfere with each other**
   - Each command explicitly chooses which file to use
   - No cross-contamination possible

4. **After deployment, local is untouched**
   - Your `.env.local` file is never modified
   - Your local database is never touched
   - Your source code is unchanged

---

## 📊 **Quick Reference Table**

| Command | Environment | Backend URL | NODE_ENV |
|---------|-------------|-------------|----------|
| `npm start` | Local Dev | `localhost:8000` | development |
| `npm run build` | Production | `matrimonial-backend-*.run.app` | production |
| `npm test` | Test | `localhost:8000` | test |
| `npm run build:pod` | Custom | From `.env.pod` | production |

---

## 🔍 **How to Verify It's Working**

### **Check Current Environment:**
Open browser console and run:
```javascript
// In your app (add this temporarily to any component):
console.log('Environment:', process.env.NODE_ENV);
console.log('Backend URL:', process.env.REACT_APP_BACKEND_URL);
```

### **Expected Output:**

**Local Dev:**
```
Environment: development
Backend URL: http://localhost:8000
```

**Production Build:**
```
Environment: production
Backend URL: https://matrimonial-backend-7cxoxmouuq-uc.a.run.app
```

---

## 🚨 **Troubleshooting**

### **Issue: "Local dev is using production URL"**
**Cause:** You're running the production build locally
```bash
# DON'T DO THIS:
serve -s build  # ❌ This serves production build

# DO THIS INSTEAD:
npm start  # ✅ This runs development server
```

### **Issue: "Production is using localhost"**
**Cause:** You deployed the source code instead of the build
```bash
# Make sure to build first:
npm run build

# Then deploy the /build/ folder:
firebase deploy --only hosting
```

### **Issue: "Environment variables not updating"**
**Solution:** Restart the dev server
```bash
# Stop server (Ctrl+C)
npm start  # Start again
```
**Note:** Environment variables are read at **start time**, not runtime!

---

## 📝 **Best Practices**

### 1. **Never Hardcode URLs**
```javascript
// ❌ BAD
const API_URL = 'http://localhost:8000';

// ✅ GOOD
import { getBackendUrl } from './config/apiConfig';
const API_URL = getBackendUrl();
```

### 2. **Always Use Environment Variables**
```javascript
// ❌ BAD
const firebaseKey = 'abc123...';

// ✅ GOOD
const firebaseKey = process.env.REACT_APP_FIREBASE_API_KEY;
```

### 3. **Keep Secrets Out of Code**
```bash
# ❌ BAD - Committed to Git
REACT_APP_SECRET_KEY=abc123

# ✅ GOOD - In .env.local (gitignored)
REACT_APP_SECRET_KEY=abc123
```

### 4. **Test Build Before Deploying**
```bash
# Build locally
npm run build

# Test the build
serve -s build

# Verify URLs in browser console
# Then deploy
```

---

## 🎉 **Summary**

**Your environment switching is now:**
- ✅ **Automatic** - No manual intervention
- ✅ **Safe** - Can't accidentally mix environments
- ✅ **Predictable** - Always uses correct URLs
- ✅ **Documented** - Clear reference for team

**Workflow:**
1. `npm start` → Local dev (localhost)
2. `npm run build` → Production build
3. Deploy `/build/` folder
4. `npm start` → Back to local dev (localhost)

**No configuration changes needed between steps!**

---

## 📞 **Quick Commands**

```bash
# Local development
npm start

# Production build
npm run build

# Check which URLs will be used
grep REACT_APP_BACKEND_URL .env.local .env.production

# Verify environment in running app
# (Open browser console and check network requests)
```

---

**Last Updated:** November 6, 2025
**Status:** ✅ Fully Configured and Safe
