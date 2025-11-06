# Deployment Architecture

## ⚠️ CRITICAL: Multi-Project Setup

Our application spans **TWO Google Cloud projects**. This is important for ALL deployments.

### Project Structure

```
┌─────────────────────────────────────────┐
│  l3v3lmatchmsgs (Domain Management)     │
│  - DNS Zone: l3v3lmatches-com           │
│  - Domain: l3v3lmatches.com             │
│  - DNS Records: A, AAAA, CNAME          │
└─────────────────────────────────────────┘
                    │
                    │ Points to ↓
                    │
┌─────────────────────────────────────────┐
│  matrimonial-staging (App Services)     │
│  - Frontend: matrimonial-frontend       │
│  - Backend: matrimonial-backend         │
│  - Domain Mapping: l3v3lmatches.com     │
│  - Database: MongoDB                    │
│  - Storage: GCS                         │
└─────────────────────────────────────────┘
```

### Why Two Projects?

- Domain `l3v3lmatches.com` was initially registered in `l3v3lmatchmsgs`
- Application services deployed in `matrimonial-staging`
- DNS in l3v3lmatchmsgs points to services in matrimonial-staging

---

## Deployment Checklist

### Before Every Deployment

1. ✅ Ensure you have access to BOTH projects
2. ✅ Verify DNS records still point correctly
3. ✅ Check domain mapping exists in matrimonial-staging

### Deploy Backend

```bash
cd /path/to/profiledata
./deploy_gcp/deploy_backend_simple.sh
```

**Project:** matrimonial-staging  
**Service:** matrimonial-backend  
**Updates:** Code, environment variables

### Deploy Frontend

```bash
cd /path/to/profiledata
./deploy_gcp/deploy_frontend_full.sh
```

**Project:** matrimonial-staging  
**Service:** matrimonial-frontend  
**Updates:** Code, builds production bundle

### Verify Domain Mapping

```bash
# Check domain mapping status
gcloud beta run domain-mappings describe \
  --domain l3v3lmatches.com \
  --region us-central1 \
  --project matrimonial-staging

# Check DNS records
gcloud dns record-sets list \
  --zone l3v3lmatches-com \
  --project l3v3lmatchmsgs
```

---

## Troubleshooting

### Issue: "Can't reach this page" after deployment

**Cause:** Domain mapping may need refresh

**Fix:**
```bash
# Recreate domain mapping
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

### Issue: DNS not resolving

**Cause:** DNS records missing or incorrect

**Fix:**
```bash
./deploy_gcp/fix-domain-dns.sh
```

### Issue: SSL certificate error

**Cause:** Certificate provisioning failed or expired

**Wait:** 15-30 minutes for automatic retry  
**Or Force:** Delete and recreate domain mapping (see above)

---

## Required Permissions

### l3v3lmatchmsgs Project

- `roles/dns.admin` - Manage DNS records
- `roles/viewer` - View resources

### matrimonial-staging Project

- `roles/run.admin` - Deploy Cloud Run services
- `roles/cloudbuild.builds.editor` - Build containers
- `roles/storage.admin` - Manage GCS buckets
- `roles/iam.serviceAccountUser` - Use service accounts

---

## DNS Configuration

### Current Records (l3v3lmatchmsgs)

```
NAME                   TYPE   TTL    DATA
l3v3lmatches.com.      A      300    216.239.32.21
                                     216.239.34.21
                                     216.239.36.21
                                     216.239.38.21

l3v3lmatches.com.      AAAA   300    2001:4860:4802:32::15
                                     2001:4860:4802:34::15
                                     2001:4860:4802:36::15
                                     2001:4860:4802:38::15

www.l3v3lmatches.com.  CNAME  300    ghs.googlehosted.com.
```

### DO NOT MODIFY THESE

These IPs are Google Cloud Run anycast addresses. They route traffic to your services in matrimonial-staging.

---

## Service URLs

### Production URLs (Public)

- **Primary:** https://l3v3lmatches.com
- **WWW:** https://www.l3v3lmatches.com

### Cloud Run URLs (Direct)

- **Frontend:** https://matrimonial-frontend-7cxoxmouuq-uc.a.run.app
- **Backend:** https://matrimonial-backend-7cxoxmouuq-uc.a.run.app

### Use Case

- **Users:** Access via l3v3lmatches.com
- **Debugging:** Use Cloud Run URLs to bypass DNS
- **Testing:** Use Cloud Run URLs before domain mapping

---

## Common Commands

### Switch Projects

```bash
# Switch to domain project
gcloud config set project l3v3lmatchmsgs

# Switch to services project
gcloud config set project matrimonial-staging
```

### View Current Project

```bash
gcloud config get-value project
```

### List All Resources

```bash
# DNS zones
gcloud dns managed-zones list --project l3v3lmatchmsgs

# Cloud Run services
gcloud run services list --project matrimonial-staging

# Domain mappings
gcloud beta run domain-mappings list \
  --region us-central1 \
  --project matrimonial-staging
```

---

## Emergency Procedures

### Complete Service Outage

1. Verify services are running:
   ```bash
   gcloud run services describe matrimonial-frontend \
     --region us-central1 \
     --project matrimonial-staging
   ```

2. Check domain mapping:
   ```bash
   gcloud beta run domain-mappings describe \
     --domain l3v3lmatches.com \
     --region us-central1 \
     --project matrimonial-staging
   ```

3. Test direct Cloud Run URL:
   ```bash
   curl -I https://matrimonial-frontend-7cxoxmouuq-uc.a.run.app
   ```

4. If Cloud Run works but domain doesn't:
   ```bash
   ./deploy_gcp/fix-domain-dns.sh
   ```

### Rollback Deployment

```bash
# List revisions
gcloud run revisions list \
  --service matrimonial-frontend \
  --region us-central1 \
  --project matrimonial-staging

# Rollback to previous revision
gcloud run services update-traffic matrimonial-frontend \
  --to-revisions=REVISION-NAME=100 \
  --region us-central1 \
  --project matrimonial-staging
```

---

## Future Improvements

### Option 1: Migrate Domain to matrimonial-staging

**Benefits:**
- Single project management
- Simpler deployments
- Unified billing and monitoring

**Steps:**
1. Transfer DNS zone from l3v3lmatchmsgs to matrimonial-staging
2. Update nameservers at domain registrar
3. Recreate domain mapping
4. Wait for propagation (24-48 hours)

### Option 2: Rename matrimonial-staging to Production

**Benefits:**
- Clearer project purpose
- Better separation of staging vs production

**Considerations:**
- Cannot rename GCP projects (project ID is immutable)
- Would need to create new project and migrate

---

## Last Updated

November 4, 2025

## Maintained By

Development Team

## Contact

For deployment issues, contact: rajl3v3l@gmail.com
