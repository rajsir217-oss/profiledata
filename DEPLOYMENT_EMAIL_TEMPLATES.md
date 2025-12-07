# 🚀 Email Template Deployment Guide

**Problem Solved:** Email templates automatically use correct URLs for each environment

---

## ✅ How It Works Now

### Local Development
```bash
cd fastapi_backend
./reseed_templates.sh
```
**Result:** Templates use `http://localhost:3000`

### Production Deployment
When deploying to Google Cloud Run:
```bash
# Environment auto-detected as "production"
# Templates automatically use https://l3v3lmatches.com
```

---

## 📋 Quick Reference

### Environment Files

| File | When Used | APP_URL |
|------|-----------|---------|
| `.env.local` | Local development | `http://localhost:3000` |
| `.env.production` | Google Cloud Run | `https://l3v3lmatches.com` |

### Auto-Detection Rules

| Environment | Detection Method |
|-------------|------------------|
| **Production** | `K_SERVICE` env var exists (Cloud Run) |
| **Local** | Running on localhost |
| **Custom** | Set `APP_ENVIRONMENT=production` |

---

## 🔧 Common Tasks

### Update Production Domain
```bash
# 1. Edit .env.production
nano fastapi_backend/.env.production

# 2. Change APP_URL
APP_URL="https://your-new-domain.com"

# 3. Deploy to production (templates auto-update)
```

### Test Template URLs Locally
```bash
cd fastapi_backend

# Check current environment
python3 -c "from env_config import EnvironmentManager; print(EnvironmentManager().detect_environment())"

# Check APP_URL being used
python3 -c "import os; from env_config import EnvironmentManager; EnvironmentManager().load_environment_config(); print(os.getenv('APP_URL'))"

# Verify templates in database
mongosh matrimonialDB --quiet --eval "
  db.notification_templates.findOne({trigger: 'status_approved'}, {body: 1})
" | grep -o 'href="http[^"]*"' | head -5
```

### Force Production URLs Locally (Testing)
```bash
export APP_ENVIRONMENT=production
./reseed_templates.sh
# Templates will now use https://l3v3lmatches.com
```

---

## 🎯 What Changed

### Before ❌
- Hardcoded URLs in templates
- Manual updates every deployment
- Production URLs in local emails
- Broken links after domain changes

### After ✅
- Automatic environment detection
- Correct URLs for each environment
- Single source of truth (.env files)
- Zero manual intervention

---

## 📝 Files Updated

1. **seed_status_change_templates.py**
   - Uses `EnvironmentManager` for auto-detection
   - Loads `.env.local` or `.env.production`
   - Replaces `{app_url}` with actual URL

2. **reseed_templates.sh** (NEW)
   - Safe reseeding script
   - Confirms before production changes
   - Shows which environment/URL being used

3. **Email Templates**
   - All `https://usvedika.com` → `{app_url}`
   - 4 templates: approved, suspended, banned, paused

---

## 🚨 Important Notes

1. **Never hardcode URLs in templates** - Always use `{app_url}`
2. **Keep .env files updated** - They control template URLs
3. **Test locally first** - Run `./reseed_templates.sh` before deploying
4. **Production auto-detects** - No manual steps needed on Cloud Run

---

## 📞 Quick Help

**Templates have wrong URLs?**
```bash
./reseed_templates.sh
```

**Need to change domain?**
```bash
# Edit .env.production
nano .env.production
# Update APP_URL
# Deploy to production
```

**Emergency URL fix?**
- Login as admin
- Go to `/notification-management`
- Edit templates manually

---

**Result:** Email templates now work correctly in both local and production environments! 🎉
