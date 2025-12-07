# Email Template Automatic Environment Detection 🌍

**Date:** December 6, 2025  
**Issue:** Email templates had hardcoded URLs causing production deployment issues  
**Solution:** Automatic environment detection with appropriate .env file loading

---

## ✅ What Was Fixed

### Problem
Email templates (status notifications) had **hardcoded URLs**:
```html
<a href="https://usvedika.com/dashboard">Go to Dashboard</a>
<a href="https://usvedika.com/contact">Contact Support</a>
```

**Impact:**
- ❌ Wrong URLs in local development (pointed to production)
- ❌ Manual updates needed every deployment
- ❌ Production changes broke local environment

### Solution
**Automatic environment detection** using `EnvironmentManager`:

1. **Detects environment automatically:**
   - **Local:** When running on localhost
   - **Production:** When running on Google Cloud Run (K_SERVICE env var)
   - **Custom:** Via `APP_ENVIRONMENT` environment variable

2. **Loads correct .env file:**
   - **Local:** `.env.local` → `APP_URL=http://localhost:3000`
   - **Production:** `.env.production` → `APP_URL=https://l3v3lmatches.com`

3. **Templates use placeholders:**
   ```html
   <a href="{app_url}/dashboard">Go to Dashboard</a>
   <a href="{app_url}/contact">Contact Support</a>
   ```

4. **Placeholders replaced at seed time:**
   - Seed script loads environment
   - Replaces `{app_url}` with actual `APP_URL`
   - Saves to database with correct URLs

---

## 🏗️ How It Works

### Environment Files

**`.env.local`** (Development)
```bash
ENV=development
FRONTEND_URL=http://localhost:3000
BACKEND_URL=http://localhost:8000
APP_URL=http://localhost:3000
```

**`.env.production`** (Production)
```bash
ENV=production
FRONTEND_URL="https://l3v3lmatches.com"
BACKEND_URL="https://matrimonial-backend-7cxoxmouuq-uc.a.run.app"
APP_URL="https://l3v3lmatches.com"
```

### Seed Script (`seed_status_change_templates.py`)

```python
from env_config import EnvironmentManager

# Auto-detect environment
env_manager = EnvironmentManager()
current_env = env_manager.detect_environment()  # Returns 'local' or 'production'
env_manager.load_environment_config(current_env)  # Loads .env.local or .env.production

# Get APP_URL from environment
APP_URL = os.getenv("APP_URL", "http://localhost:3000")

# Replace placeholders in templates
template_copy["body"] = template_copy["body"].replace("{app_url}", APP_URL)
```

### Detection Logic

**EnvironmentManager.detect_environment():**
```python
# Priority 1: Explicit APP_ENVIRONMENT variable
if os.environ.get('APP_ENVIRONMENT'):
    return os.environ.get('APP_ENVIRONMENT')

# Priority 2: Google Cloud Run detection
if os.environ.get('K_SERVICE'):
    return 'production'

# Priority 3: Docker detection
if os.path.exists('/.dockerenv'):
    return 'docker'

# Priority 4: Default
return 'local'
```

---

## 📋 Updated Files

### 1. `seed_status_change_templates.py`
**Changes:**
- ✅ Imports `EnvironmentManager`
- ✅ Auto-detects environment on startup
- ✅ Loads correct `.env` file
- ✅ Replaces `{app_url}` placeholders with actual URL
- ✅ Shows environment and URL in output

**Template Changes:**
- ✅ All hardcoded `https://usvedika.com` → `{app_url}`
- ✅ 4 templates updated: approved, suspended, banned, paused

### 2. `reseed_templates.sh` (NEW)
**Purpose:** Safe reseeding script with environment detection

**Features:**
- ✅ Auto-detects environment
- ✅ Shows which .env file will be used
- ✅ Requires confirmation for production
- ✅ Displays APP_URL being used
- ✅ Executable: `./reseed_templates.sh`

---

## 🚀 Usage

### Local Development

**Automatic (recommended):**
```bash
cd fastapi_backend
./reseed_templates.sh
```

**Output:**
```
🌍 Environment: LOCAL (development)
📍 APP_URL: http://localhost:3000
✅ Updated 4 templates
```

**Manual:**
```bash
python3 seed_status_change_templates.py
```

### Production Deployment

**Option 1: During deployment**
```bash
# On Google Cloud Run, environment auto-detected
python3 seed_status_change_templates.py

# Output:
# 🌍 Environment: production
# 📍 APP_URL: https://l3v3lmatches.com
```

**Option 2: Force environment**
```bash
export APP_ENVIRONMENT=production
./reseed_templates.sh
```

**Option 3: Manual via Template Manager UI**
1. Login as admin
2. Go to: `/notification-management` → Templates tab
3. Edit templates manually

---

## ⚙️ Environment Variables

### Required in All Environments

```bash
APP_URL=<your-frontend-url>
MONGODB_URL=<your-mongodb-connection>
DATABASE_NAME=<your-database-name>
```

### Optional Override

```bash
# Force specific environment
APP_ENVIRONMENT=production  # or 'local', 'staging'
```

---

## 🧪 Testing

### Verify Local Templates
```bash
# 1. Reseed templates
./reseed_templates.sh

# 2. Check database
mongosh matrimonialDB --quiet --eval "
  db.notification_templates.findOne(
    {trigger: 'status_approved'}, 
    {body: 1}
  ).body
" | grep -o 'http://localhost:3000'
```

**Expected:** Should show `http://localhost:3000`

### Verify Production Templates

```bash
# 1. Set environment
export APP_ENVIRONMENT=production

# 2. Reseed
./reseed_templates.sh

# 3. Check database
mongosh <PRODUCTION_MONGO_URL> --quiet --eval "
  db.notification_templates.findOne(
    {trigger: 'status_approved'}, 
    {body: 1}
  ).body
" | grep -o 'https://l3v3lmatches.com'
```

**Expected:** Should show `https://l3v3lmatches.com`

---

## 🔧 Troubleshooting

### Templates Still Have Wrong URLs

**Solution:**
```bash
# 1. Verify environment detection
python3 -c "from env_config import EnvironmentManager; print(EnvironmentManager().detect_environment())"

# 2. Check APP_URL
python3 -c "import os; from env_config import EnvironmentManager; EnvironmentManager().load_environment_config(); print(os.getenv('APP_URL'))"

# 3. Reseed with verbose output
python3 seed_status_change_templates.py
```

### Different URL Needed

**Option 1: Update .env file**
```bash
# Edit the file
nano .env.local  # or .env.production

# Change APP_URL
APP_URL=https://my-custom-domain.com

# Reseed
./reseed_templates.sh
```

**Option 2: Override temporarily**
```bash
export APP_URL=https://my-custom-domain.com
python3 seed_status_change_templates.py
```

---

## 📊 Template Status

All 4 status notification templates now use dynamic URLs:

| Template | Trigger | URLs Replaced |
|----------|---------|---------------|
| Profile Approved | `status_approved` | 3 URLs |
| Account Suspended | `status_suspended` | 3 URLs |
| Account Banned | `status_banned` | 2 URLs |
| Account Paused | `status_paused` | 3 URLs |

**Total:** 11 hardcoded URLs → Dynamic placeholders

---

## 🎯 Benefits

### Before (Hardcoded)
- ❌ Manual updates every deployment
- ❌ Different templates for local/production
- ❌ Easy to forget to update
- ❌ Production URLs in local emails
- ❌ Broken links after domain changes

### After (Auto-Detection)
- ✅ Automatic environment detection
- ✅ Single template source for all environments
- ✅ No manual intervention needed
- ✅ Correct URLs always
- ✅ Easy domain changes (update .env only)
- ✅ Safe with confirmation prompts
- ✅ Clear logging of what's happening

---

## 🔐 Security Notes

- ✅ `.env.local` and `.env.production` in `.gitignore`
- ✅ Production confirmation required
- ✅ No secrets in templates (only URLs)
- ✅ Environment auto-detection prevents accidents

---

## 📚 Related Files

- `/fastapi_backend/env_config.py` - EnvironmentManager
- `/fastapi_backend/.env.local` - Local environment config
- `/fastapi_backend/.env.production` - Production environment config
- `/fastapi_backend/config.py` - Settings loader (uses EnvironmentManager)
- `/fastapi_backend/seed_status_change_templates.py` - Template seeder
- `/fastapi_backend/reseed_templates.sh` - Reseeding script

---

## 🎓 Best Practices

1. **Always use the shell script:**
   ```bash
   ./reseed_templates.sh
   ```

2. **Never hardcode URLs:**
   ```html
   ❌ <a href="https://usvedika.com/dashboard">
   ✅ <a href="{app_url}/dashboard">
   ```

3. **Update .env files, not templates:**
   - Template changes → Edit `seed_status_change_templates.py`
   - URL changes → Edit `.env.local` or `.env.production`

4. **Test in all environments:**
   - Local: `./reseed_templates.sh`
   - Production: Check after deployment

5. **Use Template Manager UI for quick fixes:**
   - Emergency URL changes
   - Template content updates
   - Preview before saving

---

## ✅ Deployment Checklist

### Before Deploying to Production

- [ ] Verify `.env.production` has correct `APP_URL`
- [ ] Test template seeding locally first
- [ ] Backup current templates (Template Manager UI)
- [ ] Check notification queue is empty

### During Deployment

- [ ] Code deploys to Cloud Run
- [ ] Environment auto-detects as `production`
- [ ] Templates auto-reseed with production URLs
- [ ] Email notifications use correct links

### After Deployment

- [ ] Verify template URLs in database
- [ ] Send test status notification
- [ ] Check email received has correct links
- [ ] Monitor notification logs

---

## 🚨 Emergency Rollback

If templates have wrong URLs in production:

```bash
# 1. Connect to production database
mongosh <PRODUCTION_MONGO_URL>

# 2. Update status_approved template
db.notification_templates.updateOne(
  {trigger: "status_approved"},
  {$set: {
    body: db.notification_templates.findOne({trigger: "status_approved"}).body
      .replace("WRONG_URL", "https://l3v3lmatches.com")
  }}
)

# 3. Repeat for other templates
# status_suspended, status_banned, status_paused
```

**Better:** Use Template Manager UI → Edit → Save

---

## 📞 Support

**Issue:** Email links still wrong?  
**Check:** `mongosh matrimonialDB --eval "db.notification_templates.findOne({trigger: 'status_approved'})"`

**Issue:** Wrong environment detected?  
**Check:** `python3 -c "from env_config import EnvironmentManager; print(EnvironmentManager().detect_environment())"`

**Issue:** Need different URL temporarily?  
**Fix:** `export APP_URL=https://new-url.com && python3 seed_status_change_templates.py`

---

**Summary:** Email templates now automatically use the correct URLs for each environment. No more manual updates! Just keep `.env.local` and `.env.production` up to date. 🎉
