# 🌐 Domain Setup Guide: l3v3lmatches.com

## Overview
This guide will help you map your domain **l3v3lmatches.com** to your Cloud Run services.

---

## 📋 Prerequisites

- ✅ Domain registered in Google Domains: **l3v3lmatches.com**
- ✅ Cloud Run services deployed:
  - Backend: `matrimonial-backend` (us-central1)
  - Frontend: `matrimonial-frontend` (us-central1)
- ✅ Google Cloud DNS API enabled
- ✅ Billing enabled on GCP project

---

## 🎯 Proposed Domain Structure

| Domain/Subdomain | Points To | Purpose |
|------------------|-----------|---------|
| `l3v3lmatches.com` | Frontend | Main website |
| `www.l3v3lmatches.com` | Frontend | WWW alias |
| `api.l3v3lmatches.com` | Backend | API endpoints |

---

## 📝 Step-by-Step Setup

### Step 1: Create Cloud DNS Zone

```bash
# Create DNS zone for your domain
gcloud dns managed-zones create l3v3lmatches-zone \
  --dns-name="l3v3lmatches.com." \
  --description="DNS zone for l3v3lmatches.com" \
  --project=matrimonial-staging
```

**Expected Output:**
```
Created [https://dns.googleapis.com/dns/v1/projects/matrimonial-staging/managedZones/l3v3lmatches-zone].
```

---

### Step 2: Get Name Servers

```bash
# Get the name servers assigned to your zone
gcloud dns managed-zones describe l3v3lmatches-zone \
  --project=matrimonial-staging \
  --format="value(nameServers)"
```

**Expected Output:** (example)
```
ns-cloud-a1.googledomains.com.
ns-cloud-a2.googledomains.com.
ns-cloud-a3.googledomains.com.
ns-cloud-a4.googledomains.com.
```

**⚠️ IMPORTANT:** Save these name servers - you'll need them for Google Domains!

---

### Step 3: Update Name Servers in Google Domains

1. Go to [Google Domains](https://domains.google.com)
2. Click on **l3v3lmatches.com**
3. Navigate to **DNS** settings
4. Under **Name servers**, click **Use custom name servers**
5. Enter the 4 name servers from Step 2
6. Click **Save**

**⏱️ Propagation Time:** 5 minutes to 48 hours (usually 5-30 minutes)

---

### Step 4: Map Domains to Cloud Run Services

Run the automated script:

```bash
cd deploy_gcp
./map-domain.sh
```

**What this does:**
1. Maps `www.l3v3lmatches.com` → Frontend
2. Maps `l3v3lmatches.com` → Frontend
3. Maps `api.l3v3lmatches.com` → Backend
4. Shows DNS records to add

**Expected Output:**
```
✅ www.l3v3lmatches.com mapped to matrimonial-frontend
✅ l3v3lmatches.com mapped to matrimonial-frontend
✅ api.l3v3lmatches.com mapped to matrimonial-backend
```

---

### Step 5: Add DNS Records

After running the script, you'll get DNS records like:

```
For www.l3v3lmatches.com:
  CNAME: www -> ghs.googlehosted.com.

For l3v3lmatches.com:
  A: @ -> 216.239.32.21
  A: @ -> 216.239.34.21
  A: @ -> 216.239.36.21
  A: @ -> 216.239.38.21

For api.l3v3lmatches.com:
  CNAME: api -> ghs.googlehosted.com.
```

**Add these records to Cloud DNS:**

```bash
# Add WWW CNAME
gcloud dns record-sets create www.l3v3lmatches.com. \
  --zone=l3v3lmatches-zone \
  --type=CNAME \
  --ttl=300 \
  --rrdatas="ghs.googlehosted.com." \
  --project=matrimonial-staging

# Add root A records
gcloud dns record-sets create l3v3lmatches.com. \
  --zone=l3v3lmatches-zone \
  --type=A \
  --ttl=300 \
  --rrdatas="216.239.32.21,216.239.34.21,216.239.36.21,216.239.38.21" \
  --project=matrimonial-staging

# Add API CNAME
gcloud dns record-sets create api.l3v3lmatches.com. \
  --zone=l3v3lmatches-zone \
  --type=CNAME \
  --ttl=300 \
  --rrdatas="ghs.googlehosted.com." \
  --project=matrimonial-staging
```

---

### Step 6: Wait for SSL Certificates

Google Cloud Run automatically provisions SSL certificates for your domains.

**Check SSL certificate status:**

```bash
# Check www subdomain
gcloud run domain-mappings describe www.l3v3lmatches.com \
  --region=us-central1 \
  --project=matrimonial-staging

# Check root domain
gcloud run domain-mappings describe l3v3lmatches.com \
  --region=us-central1 \
  --project=matrimonial-staging

# Check API subdomain
gcloud run domain-mappings describe api.l3v3lmatches.com \
  --region=us-central1 \
  --project=matrimonial-staging
```

**⏱️ Certificate Provisioning Time:** 15 minutes to 2 hours

---

## 🔍 Verification

### Check Domain Mapping Status

```bash
# List all domain mappings
gcloud run domain-mappings list \
  --region=us-central1 \
  --project=matrimonial-staging
```

### Test DNS Resolution

```bash
# Test WWW subdomain
nslookup www.l3v3lmatches.com

# Test root domain
nslookup l3v3lmatches.com

# Test API subdomain
nslookup api.l3v3lmatches.com
```

### Test HTTPS Access

```bash
# Test frontend (should return HTML)
curl -I https://www.l3v3lmatches.com
curl -I https://l3v3lmatches.com

# Test backend (should return API response)
curl https://api.l3v3lmatches.com/health
```

---

## 🔧 Update Application Configuration

### Backend (.env.production)

```bash
# Update these in /fastapi_backend/.env.production
FRONTEND_URL=https://www.l3v3lmatches.com
BACKEND_URL=https://api.l3v3lmatches.com
SOCKET_URL=https://api.l3v3lmatches.com
```

### Frontend (apiConfig.js)

```javascript
// Update /frontend/src/config/apiConfig.js
export const getBackendUrl = () => {
  return 'https://api.l3v3lmatches.com';
};

export const getSocketUrl = () => {
  return 'https://api.l3v3lmatches.com';
};

export const getFrontendUrl = () => {
  return 'https://www.l3v3lmatches.com';
};
```

---

## 🚀 Redeploy with New URLs

After updating configuration:

```bash
cd deploy_gcp
./deploy-cloudrun-all.sh
```

This will deploy both services with the new domain configuration.

---

## 🐛 Troubleshooting

### Issue: "Domain mapping failed"

**Cause:** DNS not propagated yet  
**Solution:** Wait 5-30 minutes, then try again

### Issue: "SSL certificate not provisioning"

**Cause:** DNS records not correct  
**Solution:** Verify DNS records match exactly what Cloud Run expects

```bash
# Get expected DNS records
gcloud run domain-mappings describe www.l3v3lmatches.com \
  --region=us-central1 \
  --project=matrimonial-staging \
  --format="value(status.resourceRecords)"
```

### Issue: "Name servers not updated"

**Cause:** Wrong name servers in Google Domains  
**Solution:** Double-check name servers match Cloud DNS zone

```bash
# Get correct name servers
gcloud dns managed-zones describe l3v3lmatches-zone \
  --project=matrimonial-staging \
  --format="value(nameServers)"
```

### Issue: "CORS errors with custom domain"

**Cause:** CORS not configured for new domain  
**Solution:** Update CORS settings in backend

```python
# In fastapi_backend/main.py
origins = [
    "https://www.l3v3lmatches.com",
    "https://l3v3lmatches.com",
    "http://localhost:3000"  # Keep for dev
]
```

---

## 📊 DNS Record Summary

Once complete, your DNS should look like:

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | @ | 216.239.32.21 | 300 |
| A | @ | 216.239.34.21 | 300 |
| A | @ | 216.239.36.21 | 300 |
| A | @ | 216.239.38.21 | 300 |
| CNAME | www | ghs.googlehosted.com. | 300 |
| CNAME | api | ghs.googlehosted.com. | 300 |
| NS | @ | ns-cloud-a1.googledomains.com. | 21600 |
| NS | @ | ns-cloud-a2.googledomains.com. | 21600 |
| NS | @ | ns-cloud-a3.googledomains.com. | 21600 |
| NS | @ | ns-cloud-a4.googledomains.com. | 21600 |

---

## ✅ Final Checklist

- [ ] DNS zone created in Cloud DNS
- [ ] Name servers updated in Google Domains
- [ ] Domain mappings created (www, root, api)
- [ ] DNS records added to Cloud DNS
- [ ] SSL certificates provisioned (wait 15min-2hrs)
- [ ] Application config updated (apiConfig.js, .env.production)
- [ ] Services redeployed with new config
- [ ] All URLs accessible via HTTPS
- [ ] No CORS errors
- [ ] MongoDB connection string updated (if using Atlas)

---

## 🎉 Success!

Once all steps are complete, your app will be accessible at:

- 🌐 **https://www.l3v3lmatches.com** - Main website
- 🌐 **https://l3v3lmatches.com** - Redirects to www
- 🔌 **https://api.l3v3lmatches.com** - API backend

**🔒 All traffic will be encrypted with Google-managed SSL certificates!**

---

## 📞 Support

If you encounter issues:

1. Check Cloud Run logs: `gcloud logging tail --limit=50`
2. Verify DNS propagation: https://dnschecker.org
3. Check SSL cert status in GCP Console: [Cloud Run → Your Service → Domain Mappings]
4. Review this guide's troubleshooting section

---

**Document Version:** 1.0  
**Last Updated:** November 2, 2025  
**Domain:** l3v3lmatches.com  
**Project:** matrimonial-staging
