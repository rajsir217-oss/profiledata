# Deploy Scripts Cleanup Summary

**Date:** November 4, 2025  
**Reason:** Migration to single-project setup complete

---

## ✅ Active Scripts (Use These)

### Primary Deployment
- **`deploy-production.sh`** - Main production deployment script
  - Deploys backend and/or frontend
  - Verifies DNS and domain mapping
  - Single project (matrimonial-staging)
  - **USE THIS FOR ALL PRODUCTION DEPLOYMENTS**

### Individual Service Deployment
- **`deploy_backend_simple.sh`** - Deploy backend only
- **`deploy_frontend_full.sh`** - Deploy frontend only

### Documentation
- **`DOMAIN_SETUP_GUIDE.md`** - Domain setup documentation
- **`CLEANUP_SUMMARY.md`** - This file

---

## 🗑️ Archived Scripts (.noneed)

These scripts were used for initial setup and migration. They are no longer needed now that everything is in `matrimonial-staging`.

### Migration Scripts
- `1-create-dns-zone.sh.noneed` - Created DNS zones (done)
- `2-map-domains.sh.noneed` - Mapped domains to Cloud Run (done)
- `3-add-dns-records.sh.noneed` - Added DNS records (done)
- `fix-domain-dns.sh.noneed` - Fixed cross-project DNS (no longer needed)
- `migrate-dns-now.sh.noneed` - Migration script (completed)
- `migrate-domain-to-staging.sh.noneed` - Domain migration (completed)
- `setup-custom-domain.sh.noneed` - Initial domain setup (done)

### Old Deployment Scripts
- `deploy-cloudrun-all.sh.noneed` - Replaced by deploy-production.sh
- `deploy-gcp-all.sh.noneed` - Replaced by deploy-production.sh
- `deploy-gcp.sh.noneed` - Replaced by deploy-production.sh
- `deploy_cloudrun.sh.noneed` - Replaced by deploy-production.sh
- `deploy_frontend_simple.sh.noneed` - Use deploy_frontend_full.sh instead
- `deploy_to_gcloud.sh.noneed` - Old deployment script

### Utility Scripts
- `pre-deploy-check.sh.noneed` - Not needed with simplified setup
- `switch-env.sh.noneed` - Environment handled in main scripts
- `switch-environment.sh.noneed` - Environment handled in main scripts

---

## 📁 Current Architecture

### Single Project Setup (Simplified)

```
matrimonial-staging (GCP Project)
├── DNS Zone: l3v3lmatches-zone
│   ├── A records → Cloud Run IPs
│   ├── AAAA records → Cloud Run IPv6
│   └── CNAME (www, api)
├── Cloud Run Services
│   ├── matrimonial-frontend
│   └── matrimonial-backend
└── Domain Mapping
    └── l3v3lmatches.com → matrimonial-frontend
```

### What Changed

**Before (Cross-Project):**
- Domain DNS in `l3v3lmatchmsgs`
- Services in `matrimonial-staging`
- Required managing both projects

**After (Single Project):**
- Everything in `matrimonial-staging`
- Simpler deployments
- Easier management

---

## 🚀 Deployment Workflow

### Standard Production Deployment

```bash
cd /Users/rajsiripuram02/opt/appsrc/profiledata
./deploy_gcp/deploy-production.sh
```

**This script will:**
1. Check access to matrimonial-staging
2. Verify DNS configuration
3. Ask what to deploy (backend, frontend, or both)
4. Deploy selected services
5. Verify domain mapping
6. Show URLs and SSL status

### Quick Individual Deployments

**Backend only:**
```bash
./deploy_gcp/deploy_backend_simple.sh
```

**Frontend only:**
```bash
./deploy_gcp/deploy_frontend_full.sh
```

---

## 🔍 Verification Commands

### Check DNS
```bash
dig l3v3lmatches.com A +short
# Should show: 216.239.32.21, 216.239.34.21, etc.
```

### Check Domain Mapping
```bash
gcloud beta run domain-mappings describe \
  --domain l3v3lmatches.com \
  --region us-central1 \
  --project matrimonial-staging
```

### Check Services
```bash
gcloud run services list \
  --project matrimonial-staging \
  --region us-central1
```

---

## 🧹 Optional Cleanup

You can safely delete the `.noneed` files after 1 week of successful operation:

```bash
cd /Users/rajsiripuram02/opt/appsrc/profiledata/deploy_gcp
rm -f *.noneed
```

**Keep backups:** If you prefer, move them to a backup folder instead:

```bash
mkdir -p ../backups/old-deploy-scripts
mv *.noneed ../backups/old-deploy-scripts/
```

---

## 📝 Notes

### DNS Management
- Domain registered with Squarespace (registrar only)
- DNS managed via Google Cloud DNS in matrimonial-staging
- Nameservers: ns-cloud-e*.googledomains.com

### Future Deployments
- Always use `deploy-production.sh` for consistency
- Script automatically verifies configuration
- Supports rollback via Cloud Run revisions

### Documentation
- See `DEPLOYMENT_ARCHITECTURE.md` for full details
- See `QUICK_DEPLOY_GUIDE.md` for quick reference

---

## ✅ Migration Complete

All resources consolidated into `matrimonial-staging` project:
- ✅ DNS zone migrated
- ✅ Domain mapping verified
- ✅ Services running
- ✅ Site live at https://l3v3lmatches.com
- ✅ Simplified deployment workflow

**Status:** Production-ready 🎉
