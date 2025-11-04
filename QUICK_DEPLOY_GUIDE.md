# Quick Deployment Guide

## ⚠️ IMPORTANT: Multi-Project Setup

Your app uses **TWO Google Cloud projects**:

```
┌──────────────────────┐
│  l3v3lmatchmsgs      │  ← Domain DNS lives here
│  (Domain Project)    │
└──────────────────────┘
          ↓ points to
┌──────────────────────┐
│  matrimonial-staging │  ← Services live here
│  (Services Project)  │
└──────────────────────┘
```

---

## Quick Deploy (Production)

### One Command to Rule Them All

```bash
cd /Users/rajsiripuram02/opt/appsrc/profiledata
./deploy_gcp/deploy-production.sh
```

This script:
- ✅ Checks access to both projects
- ✅ Verifies DNS configuration
- ✅ Deploys backend and/or frontend
- ✅ Verifies domain mapping
- ✅ Shows you the status

---

## Individual Deployments

### Deploy Backend Only

```bash
./deploy_gcp/deploy_backend_simple.sh
```

### Deploy Frontend Only

```bash
./deploy_gcp/deploy_frontend_full.sh
```

---

## After Deployment - Always Check

### 1. Test the Site

```bash
# Visit these URLs:
https://l3v3lmatches.com
https://www.l3v3lmatches.com
```

### 2. Check DNS

```bash
dig l3v3lmatches.com +short
# Should show: 216.239.32.21, 216.239.34.21, etc.
```

### 3. Check Domain Mapping

```bash
gcloud beta run domain-mappings describe \
  --domain l3v3lmatches.com \
  --region us-central1 \
  --project matrimonial-staging
```

---

## Common Issues & Quick Fixes

### Issue: "DNS_PROBE_FINISHED_NXDOMAIN"

**Cause:** DNS records missing or incorrect  
**Fix:**
```bash
./deploy_gcp/fix-domain-dns.sh
```

### Issue: "NET::ERR_CERT_AUTHORITY_INVALID"

**Cause:** SSL certificate still provisioning  
**Fix:** Wait 15-30 minutes, or:
```bash
# Force certificate refresh
gcloud beta run domain-mappings delete \
  --domain l3v3lmatches.com \
  --region us-central1 \
  --project matrimonial-staging \
  --quiet

gcloud beta run domain-mappings create \
  --service matrimonial-frontend \
  --domain l3v3lmatches.com \
  --region us-central1 \
  --project matrimonial-staging
```

### Issue: Changes not showing up

**Cause:** Browser cache or CDN  
**Fix:**
```bash
# Clear DNS cache
sudo dscacheutil -flushcache
sudo killall -HUP mDNSResponder

# Hard refresh browser: Cmd+Shift+R (Mac)
```

---

## Will the Multi-Project Setup Cause Issues?

### YES - Potential Issues:

1. **Team Confusion**
   - New developers may look in wrong project
   - **Solution:** Use `deploy-production.sh` - it handles both projects

2. **Permission Management**
   - Need access to both projects
   - **Solution:** Request access to both: l3v3lmatchmsgs AND matrimonial-staging

3. **Monitoring Split**
   - DNS metrics in one project, app metrics in another
   - **Solution:** Bookmark both dashboards

### NO - Not a Problem If:

1. ✅ You use the provided deployment scripts
2. ✅ Everyone reads `DEPLOYMENT_ARCHITECTURE.md`
3. ✅ Team has access to both projects

---

## Long-Term Solution: Consolidate to One Project

**Recommended:** Migrate domain DNS to matrimonial-staging

### When to Migrate:

- ✅ When you have scheduled downtime (5-30 minutes)
- ✅ After verifying current setup works
- ✅ When team agrees on the change

### How to Migrate:

```bash
./deploy_gcp/migrate-domain-to-staging.sh
```

**This script will:**
1. Export DNS records from l3v3lmatchmsgs
2. Create DNS zone in matrimonial-staging
3. Show you new nameservers to update at domain registrar
4. Guide you through the process

**After migration:**
- ✅ Everything in ONE project
- ✅ Simpler deployments
- ✅ Unified billing & monitoring
- ✅ Less confusion

---

## Emergency: Site is Down

### Step 1: Is it DNS or Services?

```bash
# Test Cloud Run URLs directly (bypasses DNS)
curl -I https://matrimonial-frontend-7cxoxmouuq-uc.a.run.app
curl -I https://matrimonial-backend-7cxoxmouuq-uc.a.run.app
```

**If Cloud Run URLs work:** DNS issue → Run `./deploy_gcp/fix-domain-dns.sh`  
**If Cloud Run URLs fail:** Service issue → Check logs and redeploy

### Step 2: Check Logs

```bash
# Frontend logs
gcloud run logs read matrimonial-frontend \
  --region us-central1 \
  --project matrimonial-staging \
  --limit 50

# Backend logs
gcloud run logs read matrimonial-backend \
  --region us-central1 \
  --project matrimonial-staging \
  --limit 50
```

### Step 3: Rollback if Needed

```bash
# List recent revisions
gcloud run revisions list \
  --service matrimonial-frontend \
  --region us-central1 \
  --project matrimonial-staging

# Rollback to previous revision
gcloud run services update-traffic matrimonial-frontend \
  --to-revisions=PREVIOUS-REVISION-NAME=100 \
  --region us-central1 \
  --project matrimonial-staging
```

---

## Daily Workflow

### Before Deploying

1. Pull latest code: `git pull`
2. Test locally: `npm start` / `uvicorn main:app --reload`
3. Commit changes: `git commit -am "Your changes"`
4. Push to repo: `git push`

### Deploy

```bash
./deploy_gcp/deploy-production.sh
```

### After Deploying

1. Test the site: https://l3v3lmatches.com
2. Check for errors in browser console
3. Monitor logs for 5-10 minutes

---

## Helpful Commands

### Switch Projects Quickly

```bash
# Domain project
gcloud config set project l3v3lmatchmsgs

# Services project
gcloud config set project matrimonial-staging

# Check current project
gcloud config get-value project
```

### View All Resources

```bash
# DNS zones (in l3v3lmatchmsgs)
gcloud dns managed-zones list --project l3v3lmatchmsgs

# Cloud Run services (in matrimonial-staging)
gcloud run services list --project matrimonial-staging --region us-central1

# Domain mappings (in matrimonial-staging)
gcloud beta run domain-mappings list \
  --region us-central1 \
  --project matrimonial-staging
```

---

## Documentation

- **Full Architecture:** See `DEPLOYMENT_ARCHITECTURE.md`
- **Migration Guide:** See `./deploy_gcp/migrate-domain-to-staging.sh`
- **This Guide:** Quick reference for daily deployments

---

## Summary

✅ **Current Setup Works** - Site is live and functional  
⚠️ **Two Projects** - Domain in l3v3lmatchmsgs, Services in matrimonial-staging  
🔧 **Use Scripts** - `deploy-production.sh` handles complexity  
🚀 **Future** - Consider migrating DNS to single project  

**Your production site: https://l3v3lmatches.com** 🎉
