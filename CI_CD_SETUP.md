# CI/CD Setup - Automatic Deployment on Main Branch

**Date:** Oct 24, 2025  
**Status:** ✅ Configured

---

## 🎯 What's Set Up

Automatic deployment to Google Cloud Run when you merge to `main` branch:

1. **Frontend Deployment** - `.github/workflows/deploy-frontend.yml`
   - Triggers on: Push to `main` with `frontend/**` changes
   - Deploys: matrimonial-frontend to Cloud Run
   
2. **Backend Deployment** - `.github/workflows/deploy-backend.yml`
   - Triggers on: Push to `main` with `backend/**` changes
   - Deploys: matrimonial-backend to Cloud Run

---

## 📋 Setup Steps

### Step 1: Create Service Account Key

1. **Go to Google Cloud Console:**
   - https://console.cloud.google.com/iam-admin/serviceaccounts
   - Project: matrimonial-staging

2. **Create Service Account:**
   ```bash
   gcloud iam service-accounts create github-actions \
     --display-name="GitHub Actions Deployer" \
     --project=matrimonial-staging
   ```

3. **Grant Permissions:**
   ```bash
   # Cloud Run Admin
   gcloud projects add-iam-policy-binding matrimonial-staging \
     --member="serviceAccount:github-actions@matrimonial-staging.iam.gserviceaccount.com" \
     --role="roles/run.admin"
   
   # Service Account User
   gcloud projects add-iam-policy-binding matrimonial-staging \
     --member="serviceAccount:github-actions@matrimonial-staging.iam.gserviceaccount.com" \
     --role="roles/iam.serviceAccountUser"
   
   # Storage Admin (for Cloud Build)
   gcloud projects add-iam-policy-binding matrimonial-staging \
     --member="serviceAccount:github-actions@matrimonial-staging.iam.gserviceaccount.com" \
     --role="roles/storage.admin"
   ```

4. **Create and Download Key:**
   ```bash
   gcloud iam service-accounts keys create github-actions-key.json \
     --iam-account=github-actions@matrimonial-staging.iam.gserviceaccount.com \
     --project=matrimonial-staging
   ```

---

### Step 2: Add Secret to GitHub

1. **Go to GitHub Repository:**
   - Navigate to your repo
   - Click **Settings** → **Secrets and variables** → **Actions**

2. **Add Repository Secret:**
   - Click **"New repository secret"**
   - Name: `GCP_SA_KEY`
   - Value: Copy entire contents of `github-actions-key.json`
   - Click **"Add secret"**

3. **Delete local key file (security):**
   ```bash
   rm github-actions-key.json
   ```

---

### Step 3: Test the Workflow

1. **Make a change:**
   ```bash
   # Example: Update README
   echo "# Test CI/CD" >> frontend/README.md
   git add frontend/README.md
   git commit -m "test: CI/CD deployment"
   ```

2. **Push to main:**
   ```bash
   git push origin main
   ```

3. **Watch deployment:**
   - Go to GitHub → Actions tab
   - See workflow running
   - Check logs for deployment status

---

## 🔄 Workflow Details

### Frontend Deployment Workflow

**File:** `.github/workflows/deploy-frontend.yml`

**Triggers:**
- Push to `main` branch
- Changes in `frontend/**` folder
- Manual trigger (workflow_dispatch)

**Steps:**
1. Checkout code
2. Authenticate to Google Cloud
3. Set up Cloud SDK
4. Configure Docker
5. Build and deploy to Cloud Run
6. Output service URL

**Deployment Command:**
```bash
gcloud run deploy matrimonial-frontend \
  --source . \
  --region us-central1 \
  --project matrimonial-staging \
  --allow-unauthenticated \
  --platform managed \
  --quiet
```

### Backend Deployment Workflow

**File:** `.github/workflows/deploy-backend.yml`

**Triggers:**
- Push to `main` branch
- Changes in `backend/**` folder
- Manual trigger (workflow_dispatch)

**Steps:**
1. Checkout code
2. Authenticate to Google Cloud
3. Set up Cloud SDK
4. Configure Docker
5. Build and deploy to Cloud Run
6. Output service URL

**Deployment Command:**
```bash
gcloud run deploy matrimonial-backend \
  --source . \
  --region us-central1 \
  --project matrimonial-staging \
  --allow-unauthenticated \
  --platform managed \
  --quiet
```

---

## 🎯 Usage Examples

### Scenario 1: Frontend Changes

```bash
# Make frontend changes
vim frontend/src/components/Dashboard.js

# Commit and push to main
git add frontend/
git commit -m "feat: update dashboard UI"
git push origin main

# ✅ GitHub Actions automatically deploys frontend
```

### Scenario 2: Backend Changes

```bash
# Make backend changes
vim backend/app/routes/users.py

# Commit and push to main
git add backend/
git commit -m "fix: user profile API"
git push origin main

# ✅ GitHub Actions automatically deploys backend
```

### Scenario 3: Both Frontend & Backend

```bash
# Make changes to both
git add frontend/ backend/
git commit -m "feat: new feature with frontend and backend changes"
git push origin main

# ✅ GitHub Actions deploys BOTH services
```

### Scenario 4: Manual Deployment

1. Go to GitHub → Actions
2. Select workflow (Frontend or Backend)
3. Click "Run workflow"
4. Choose branch: `main`
5. Click "Run workflow" button

---

## ✅ Benefits

1. **No Manual Deployment** - Push to main = auto-deploy
2. **Consistent Deployments** - Same process every time
3. **Audit Trail** - All deployments logged in GitHub Actions
4. **Rollback Easy** - Revert commit → auto-redeploy previous version
5. **Branch Protection** - Can enforce PR reviews before merge to main

---

## 🔒 Security Best Practices

1. **Service Account Key** stored as GitHub secret (encrypted)
2. **Minimal Permissions** - Service account has only required roles
3. **No Key in Code** - Never commit service account key
4. **Audit Logs** - All deployments tracked in Google Cloud
5. **Branch Protection** - Consider requiring PR reviews

---

## 📊 Monitoring Deployments

### GitHub Actions Dashboard

```
Repository → Actions tab
└── All workflows shown
    ├── Deploy Frontend
    └── Deploy Backend
        ├── ✅ Success (green check)
        ├── ❌ Failed (red X)
        └── ⏳ In Progress (yellow circle)
```

### Google Cloud Run Console

```
https://console.cloud.google.com/run
└── matrimonial-staging
    ├── matrimonial-frontend
    │   └── Latest revision: matrimonial-frontend-000XX
    └── matrimonial-backend
        └── Latest revision: matrimonial-backend-000XX
```

---

## 🛠️ Troubleshooting

### Issue: "Permission Denied" Error

**Solution:**
```bash
# Verify service account has correct roles
gcloud projects get-iam-policy matrimonial-staging \
  --flatten="bindings[].members" \
  --filter="bindings.members:github-actions@matrimonial-staging.iam.gserviceaccount.com"
```

### Issue: "Invalid Credentials" Error

**Solution:**
1. Check GitHub secret `GCP_SA_KEY` is correctly set
2. Regenerate service account key if needed
3. Update GitHub secret with new key

### Issue: Deployment Hangs

**Solution:**
1. Check Cloud Build logs in Google Cloud Console
2. Verify Dockerfile is correct
3. Check for resource limits or quotas

### Issue: Wrong Branch Deployed

**Solution:**
- Workflows only trigger on `main` branch
- Check which branch you pushed to
- Merge feature branch to `main` to trigger deployment

---

## 🎓 Git Workflow Recommendation

### Development Workflow:

```bash
# 1. Create feature branch
git checkout -b feature/new-feature

# 2. Make changes
vim frontend/src/...

# 3. Commit changes
git add .
git commit -m "feat: add new feature"

# 4. Push feature branch (NO deployment yet)
git push origin feature/new-feature

# 5. Create Pull Request on GitHub
# 6. Review & approve PR
# 7. Merge to main (TRIGGERS DEPLOYMENT)

# ✅ Automatic deployment happens!
```

### Hotfix Workflow:

```bash
# 1. Create hotfix branch
git checkout -b hotfix/critical-bug

# 2. Fix the bug
vim backend/app/...

# 3. Commit
git add .
git commit -m "fix: critical bug"

# 4. Push and merge directly to main (urgent)
git push origin hotfix/critical-bug
# Merge PR immediately

# ✅ Deploys automatically
```

---

## 📋 Checklist

Before enabling CI/CD:

- [ ] Service account created
- [ ] Permissions granted
- [ ] Service account key generated
- [ ] GitHub secret `GCP_SA_KEY` added
- [ ] Workflow files committed to repo
- [ ] Test deployment successful
- [ ] Team notified about new workflow

---

## 🚀 Next Steps

1. **Set up branch protection** (optional but recommended):
   - Require PR reviews before merge to `main`
   - Require status checks to pass

2. **Add environment secrets** (if needed):
   - Database passwords
   - API keys
   - Other sensitive config

3. **Set up notifications**:
   - Slack/Discord notifications on deployment
   - Email notifications on failure

4. **Add deployment badges** to README:
   ```markdown
   ![Deploy Frontend](https://github.com/YOUR_ORG/profiledata/actions/workflows/deploy-frontend.yml/badge.svg)
   ![Deploy Backend](https://github.com/YOUR_ORG/profiledata/actions/workflows/deploy-backend.yml/badge.svg)
   ```

---

**Status:** ✅ Ready to use  
**Automatic Deployment:** Enabled on `main` branch merge  
**Manual Deployment:** Available via GitHub Actions UI
