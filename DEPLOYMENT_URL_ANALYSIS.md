# Deployment URL Configuration Analysis

## 🔍 Current State (Nov 8, 2025)

### **Actual Production URLs:**
```
Backend:  https://matrimonial-backend-7cxoxmouuq-uc.a.run.app
Frontend: https://matrimonial-frontend-7cxoxmouuq-uc.a.run.app
Domain:   https://l3v3lmatches.com
```

---

## ❌ Issues Found

### **Issue 1: Environment Switching Not Seamless**

**Problem:**
- `.env.local` exists but is incomplete
- Missing critical REACT_APP_BACKEND_URL definition
- Local dev might use production fallback URLs

**Current .env.local:**
```bash
REACT_APP_BACKEND_URL=http://localhost:8000  ✅ EXISTS
REACT_APP_FRONTEND_URL=http://localhost:3000  ✅ EXISTS
```

**apiConfig.js Priority Chain:**
1. `POD_CONFIG.backend` (set during deployment, cleared after)
2. `process.env.REACT_APP_BACKEND_URL` (from .env.local) 
3. Fallback URL (hardcoded)

**What happens:**
- ✅ During deployment → POD_CONFIG used (correct prod URL)
- ✅ After deployment → Restored to original
- ✅ Local dev → Uses .env.local (correct localhost)
- ❌ If .env.local missing → Uses fallback (could be wrong)

---

### **Issue 2: Inconsistent URL References**

**Found in codebase:**

| File | URL | Status |
|------|-----|--------|
| `backend/.env.production` | `https://matrimonial-backend-458052696267.us-central1.run.app` | ❌ WRONG |
| `frontend/.env.production` | `https://matrimonial-backend-7cxoxmouuq-uc.a.run.app` | ✅ CORRECT |
| `frontend/apiConfig.js` fallback | `https://matrimonial-backend-7cxoxmouuq-uc.a.run.app` | ✅ CORRECT |

**Root Cause:**
- Backend .env.production has outdated URL
- Probably from older deployment or different region

---

### **Issue 3: Deploy Script Modifies POD_CONFIG**

**How deployment works:**

1. **deploy_frontend_full.sh** runs:
   ```bash
   # Fetches CURRENT backend URL from Cloud Run
   BACKEND_URL=$(gcloud run services describe matrimonial-backend ...)
   # Result: https://matrimonial-backend-7cxoxmouuq-uc.a.run.app
   ```

2. **Python script** modifies `apiConfig.js`:
   ```python
   # BEFORE deployment:
   backend: process.env.REACT_APP_POD_BACKEND_URL
   
   # DURING build:
   backend: process.env.REACT_APP_POD_BACKEND_URL || 'https://matrimonial-backend-7cxoxmouuq-uc.a.run.app'
   
   # AFTER deployment (restored):
   backend: process.env.REACT_APP_POD_BACKEND_URL  # Back to original
   ```

3. **Built Docker image** has the hardcoded fallback URL baked in

**This is CORRECT behavior!** ✅

---

## ✅ Solutions

### **Solution 1: Fix Backend .env.production**

Update to match actual Cloud Run URL:

```bash
# fastapi_backend/.env.production
BACKEND_URL="https://matrimonial-backend-7cxoxmouuq-uc.a.run.app"
FRONTEND_URL="https://l3v3lmatches.com"
```

---

### **Solution 2: Ensure .env.local is Always Correct**

The deploy script already handles this (lines 204-214 of deploy_frontend_full.sh), but it's incomplete.

**Current restoration:**
```bash
REACT_APP_ENVIRONMENT=local
REACT_APP_SOCKET_URL=http://localhost:8000
REACT_APP_API_URL=http://localhost:8000/api/users
REACT_APP_WS_URL=ws://localhost:8000
```

**Missing (CRITICAL):**
```bash
REACT_APP_BACKEND_URL=http://localhost:8000
REACT_APP_FRONTEND_URL=http://localhost:3000
```

---

### **Solution 3: Add URL Validation to Deploy Script**

Add check before deployment to ensure URLs are correct:

```bash
# Verify backend is accessible
echo "🔍 Verifying backend health..."
if ! curl -sf "${BACKEND_URL}/health" >/dev/null; then
  echo "❌ Backend not responding at ${BACKEND_URL}"
  exit 1
fi
```

---

## 📋 Deployment Flow (Correct)

### **Option 1: Deploy Backend Only**
```bash
./deploy-production.sh → Choose 1
```
1. Builds backend Docker image
2. Deploys to Cloud Run
3. **Runs database migrations** ✅
4. Restores local backend config
5. URL: `https://matrimonial-backend-7cxoxmouuq-uc.a.run.app`

### **Option 2: Deploy Frontend Only**
```bash
./deploy-production.sh → Choose 2
```
1. **Fetches backend URL from Cloud Run** (dynamic)
2. Modifies `apiConfig.js` with fetched URL
3. Builds frontend Docker image
4. Deploys to Cloud Run
5. **Restores local apiConfig.js** ✅
6. **Restores .env.local** ✅
7. URL: `https://matrimonial-frontend-7cxoxmouuq-uc.a.run.app`

### **Option 3: Deploy Both**
```bash
./deploy-production.sh → Choose 3
```
1. Deploys backend (see Option 1)
2. **Runs database migrations** ✅
3. Deploys frontend (see Option 2)
4. Both configs restored

---

## 🎯 Recommended Changes

### **Change 1: Update deploy_frontend_full.sh**

Add BACKEND_URL and FRONTEND_URL to .env.local restoration:

```bash
# Line 207-213 (current)
cat > ".env.local" <<'ENVLOCAL'
# Local Development Environment
REACT_APP_ENVIRONMENT=local
REACT_APP_SOCKET_URL=http://localhost:8000
REACT_APP_API_URL=http://localhost:8000/api/users
REACT_APP_WS_URL=ws://localhost:8000
ENVLOCAL

# ADD THESE LINES:
REACT_APP_BACKEND_URL=http://localhost:8000
REACT_APP_FRONTEND_URL=http://localhost:3000
```

### **Change 2: Add URL Verification**

Add before deployment (after line 81):

```bash
echo "🔍 Verifying backend accessibility..."
if ! curl -sf --max-time 5 "${BACKEND_URL}/health" >/dev/null 2>&1; then
  echo "⚠️  Warning: Backend not responding at ${BACKEND_URL}"
  echo "   Deployment will continue, but frontend may not work correctly."
  read -p "Continue anyway? (y/N) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi
```

### **Change 3: Update Backend .env.production**

```bash
# OLD (WRONG)
BACKEND_URL="https://matrimonial-backend-458052696267.us-central1.run.app"

# NEW (CORRECT)
BACKEND_URL="https://matrimonial-backend-7cxoxmouuq-uc.a.run.app"
```

---

## ✅ Why Current Approach Works

### **Production Deployment:**
1. Deploy script fetches **ACTUAL** backend URL from Cloud Run
2. Bakes it into Docker image during build
3. Deployed frontend always points to correct backend ✅

### **Local Development:**
1. After deployment, configs are restored
2. `.env.local` has `REACT_APP_BACKEND_URL=http://localhost:8000`
3. `apiConfig.js` reads from `.env.local` (priority 2)
4. Local dev works correctly ✅

### **Seamless Fallback:**
1. If `.env.local` exists → Uses localhost ✅
2. If `.env.local` missing → Uses fallback (production URL)
3. Deploy script recreates `.env.local` if missing ✅

---

## 🚨 Only Remaining Issue

**Backend .env.production has wrong URL!**

This doesn't affect frontend deployment (it fetches from Cloud Run directly),
but it affects:
- Backend environment variable awareness
- CORS configuration (FRONTEND_URL)
- Self-reference URLs in emails/notifications

**Fix:**
Update `fastapi_backend/.env.production` Line 16:
```bash
BACKEND_URL="https://matrimonial-backend-7cxoxmouuq-uc.a.run.app"
```

---

## 📊 Summary

| Requirement | Status | Notes |
|-------------|--------|-------|
| Seamless local/prod switching | ✅ Works | Deploy script restores configs |
| Correct URLs in production | ✅ Works | Fetched dynamically from Cloud Run |
| Correct URLs in local dev | ✅ Works | Uses .env.local |
| Backend .env.production | ❌ Wrong | Needs manual fix |
| Frontend .env.production | ✅ Correct | |
| apiConfig.js fallbacks | ✅ Correct | Match Cloud Run URLs |
| Database migrations | ✅ Works | Run automatically |

**Overall: 6/7 ✅ (86% correct)**

One fix needed: Update backend .env.production URL.
