# CI/CD Pipeline Documentation
**Last Updated:** October 25, 2025  
**Status:** ✅ Configured and Ready

---

## 📋 **Overview**

This project uses **GitHub Actions** for CI/CD with four workflows:

1. **test-backend.yml** - Backend testing on every PR/push
2. **test-frontend.yml** - Frontend testing on every PR/push  
3. **deploy-backend.yml** - Deploy backend to Google Cloud Run
4. **deploy-frontend.yml** - Deploy frontend to Google Cloud Run

---

## 🎯 **What Runs When**

### **On Pull Request or Push to `dev` or `main`:**

**Backend Tests** (`test-backend.yml`):
- ✅ Sets up Python 3.12
- ✅ Starts MongoDB & Redis services
- ✅ Installs dependencies
- ✅ Runs pytest with coverage
- ✅ Checks minimum 70% coverage
- ✅ Uploads coverage to Codecov (optional)

**Frontend Tests** (`test-frontend.yml`):
- ✅ Sets up Node.js 18
- ✅ Installs dependencies
- ✅ Runs ESLint
- ✅ Runs Jest tests with coverage
- ✅ Builds the application
- ✅ Checks bundle size
- ✅ Uploads coverage to Codecov (optional)

### **On Push to `main` Branch Only:**

**Deploy Backend** (`deploy-backend.yml`):
1. ✅ Runs all backend tests first
2. ✅ If tests pass → Deploys to Google Cloud Run
3. ✅ Outputs deployment URL

**Deploy Frontend** (`deploy-frontend.yml`):
1. ✅ Builds and tests frontend first
2. ✅ If build succeeds → Deploys to Google Cloud Run
3. ✅ Outputs deployment URL

---

## ⚙️ **Required GitHub Secrets**

### **For Testing Only:**
No secrets needed! Tests will run automatically.

### **For Deployment (Optional):**

Go to your GitHub repo → **Settings** → **Secrets and variables** → **Actions**

#### **1. GCP_SA_KEY** (Google Cloud Service Account Key)
```bash
# Required for: deploy-backend.yml, deploy-frontend.yml
# How to create:
```

**Steps to create GCP Service Account Key:**

1. **Go to Google Cloud Console**
   ```
   https://console.cloud.google.com/
   ```

2. **Create a Service Account:**
   - Navigate to **IAM & Admin** → **Service Accounts**
   - Click **Create Service Account**
   - Name: `github-actions-deployer`
   - Grant roles:
     - `Cloud Run Admin`
     - `Service Account User`
     - `Storage Admin` (for container images)

3. **Create JSON Key:**
   - Click on the service account
   - Go to **Keys** tab
   - Add Key → Create new key → JSON
   - Download the JSON file

4. **Add to GitHub Secrets:**
   - Copy the entire JSON file content
   - In GitHub: **Settings** → **Secrets** → **New repository secret**
   - Name: `GCP_SA_KEY`
   - Value: Paste the JSON content

#### **2. CODECOV_TOKEN** (Code Coverage - Optional)
```bash
# For: test-backend.yml, test-frontend.yml  
# Get from: https://codecov.io/
```

**To add Codecov (optional but recommended):**
1. Go to https://codecov.io/
2. Sign in with GitHub
3. Add your repository
4. Copy the upload token
5. Add as GitHub secret: `CODECOV_TOKEN`

---

## 🚀 **Deployment Configuration**

### **Current Setup:**

**Project:** `matrimonial-staging`  
**Region:** `us-central1`  
**Services:**
- Backend: `matrimonial-backend`
- Frontend: `matrimonial-frontend`

### **To Change Project/Region:**

Edit these lines in the deployment workflows:

```yaml
# In deploy-backend.yml and deploy-frontend.yml
project_id: your-project-id      # Line ~29
--region your-region             # Line ~40
--project your-project-id        # Line ~41
```

---

## 🧪 **Running Workflows Manually**

All workflows support manual triggers via **workflow_dispatch**.

**To run manually:**
1. Go to **Actions** tab in GitHub
2. Select the workflow (e.g., "Test Backend")
3. Click **Run workflow**
4. Select branch
5. Click **Run workflow** button

---

## 📊 **Monitoring CI/CD**

### **GitHub Actions Dashboard:**
```
https://github.com/YOUR_USERNAME/profiledata/actions
```

### **Check Status Badge** (Add to README):

**Backend Tests:**
```markdown
![Backend Tests](https://github.com/YOUR_USERNAME/profiledata/workflows/Test%20Backend/badge.svg)
```

**Frontend Tests:**
```markdown
![Frontend Tests](https://github.com/YOUR_USERNAME/profiledata/workflows/Test%20Frontend/badge.svg)
```

---

## 🐛 **Troubleshooting**

### **Issue: "Context access might be invalid: GCP_SA_KEY"**

**Cause:** Secret not configured  
**Solution:**
1. Create Google Cloud Service Account (see above)
2. Add `GCP_SA_KEY` secret to GitHub
3. Or disable deployment workflows until ready

### **Issue: "Tests failed"**

**Backend:**
```bash
# Run locally to debug:
cd fastapi_backend
pytest -v
```

**Frontend:**
```bash
# Run locally to debug:
cd frontend
npm test
```

### **Issue: "Coverage below 70%"**

**Solution:** Add more tests! Minimum coverage is 70%.

```bash
# Check coverage locally:
cd fastapi_backend
pytest --cov=. --cov-report=html
# Open htmlcov/index.html in browser
```

### **Issue: "Deployment failed - authentication"**

**Cause:** Missing or invalid GCP credentials  
**Solution:**
1. Verify `GCP_SA_KEY` secret exists
2. Check service account has correct roles
3. Verify project ID is correct

---

## 🔒 **Security Best Practices**

### **Secrets Management:**

✅ **DO:**
- Use GitHub Secrets for all sensitive data
- Rotate service account keys regularly
- Limit service account permissions
- Use different accounts for staging/production

❌ **DON'T:**
- Commit credentials to git
- Use admin/owner roles for deployment
- Share service account keys
- Log secrets in workflow outputs

### **Branch Protection:**

**Recommended Settings:**
```
Settings → Branches → Branch protection rules

For 'main' branch:
✅ Require pull request reviews (1 approver)
✅ Require status checks to pass
   - Test Backend
   - Test Frontend
✅ Require branches to be up to date
✅ Include administrators
```

---

## 📈 **Code Coverage Goals**

| Component | Minimum | Target | Current |
|-----------|---------|--------|---------|
| Backend   | 70%     | 85%    | TBD     |
| Frontend  | 70%     | 85%    | TBD     |

**View Coverage:**
- Codecov: https://codecov.io/gh/YOUR_USERNAME/profiledata
- Local: Run tests with `--cov` flag

---

## 🚦 **Workflow Status**

### **✅ Enabled Workflows:**

1. **Test Backend** - Runs on every PR/push
2. **Test Frontend** - Runs on every PR/push
3. **Deploy Backend** - Runs on push to main (needs GCP_SA_KEY)
4. **Deploy Frontend** - Runs on push to main (needs GCP_SA_KEY)

### **⏸️ To Disable Deployment:**

If not ready to deploy to cloud:

**Option 1:** Don't add `GCP_SA_KEY` secret (workflows will skip)

**Option 2:** Comment out deployment workflows:
```bash
# Rename to disable:
mv .github/workflows/deploy-backend.yml .github/workflows/deploy-backend.yml.disabled
mv .github/workflows/deploy-frontend.yml .github/workflows/deploy-frontend.yml.disabled
```

**Option 3:** Add condition to workflows:
```yaml
if: false  # Temporarily disable
```

---

## 🔄 **Development Workflow**

### **Recommended Git Flow:**

```
1. Create feature branch from dev
   git checkout -b feature/my-feature dev

2. Make changes and commit
   git add .
   git commit -m "feat: add new feature"

3. Push and create PR
   git push origin feature/my-feature

4. GitHub Actions runs tests automatically
   ✅ Backend tests
   ✅ Frontend tests

5. If tests pass → Merge to dev
   
6. When ready for production → PR from dev to main
   
7. Merge to main triggers deployment
   ✅ Tests run again
   ✅ If pass → Auto-deploy to Cloud Run
```

---

## 📦 **Alternative Deployment Options**

### **Option 1: Vercel (Frontend)**

Simpler than Google Cloud Run for static sites:

```yaml
# .github/workflows/deploy-frontend-vercel.yml
- name: Deploy to Vercel
  uses: amondnet/vercel-action@v25
  with:
    vercel-token: ${{ secrets.VERCEL_TOKEN }}
    vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
    vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
```

### **Option 2: Heroku (Backend)**

```yaml
# .github/workflows/deploy-backend-heroku.yml
- name: Deploy to Heroku
  uses: akhileshns/heroku-deploy@v3.12.14
  with:
    heroku_api_key: ${{ secrets.HEROKU_API_KEY }}
    heroku_app_name: "matrimonial-backend"
    heroku_email: "your@email.com"
```

### **Option 3: AWS Elastic Beanstalk**

```yaml
- name: Deploy to AWS
  uses: einaregilsson/beanstalk-deploy@v21
  with:
    aws_access_key: ${{ secrets.AWS_ACCESS_KEY_ID }}
    aws_secret_key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
    application_name: matrimonial-app
    environment_name: matrimonial-prod
```

---

## 🎓 **Next Steps**

### **Phase 1: Testing (Current)**
- ✅ Backend tests on PR
- ✅ Frontend tests on PR
- ✅ Coverage reports

### **Phase 2: Deployment (Optional)**
- ⏸️ Configure GCP credentials
- ⏸️ Set up staging environment
- ⏸️ Configure production deployment

### **Phase 3: Advanced (Future)**
- Performance testing
- E2E tests with Playwright
- Automated security scans
- Lighthouse CI for performance
- Automated database migrations
- Blue-green deployments

---

## 📞 **Support & Resources**

**GitHub Actions Docs:**
- https://docs.github.com/en/actions

**Google Cloud Run Docs:**
- https://cloud.google.com/run/docs

**Codecov Docs:**
- https://docs.codecov.com/

**Questions?**
Check existing GitHub issues or create a new one!

---

**Last Updated:** October 25, 2025  
**Maintained By:** Development Team
