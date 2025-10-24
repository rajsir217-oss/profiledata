# Custom Domain Setup - l3v3lmatch.com

**Domain:** l3v3lmatch.com (Bluehost)  
**Target:** Google Cloud Run Application  
**Date:** Oct 24, 2025

---

## 🎯 Goal

Map custom domain `l3v3lmatch.com` to Cloud Run instead of:
- ❌ `matrimonial-frontend-458052696267.us-central1.run.app` (ugly!)
- ✅ `l3v3lmatch.com` (user-friendly!)

---

## 📋 Step-by-Step Setup

### Step 1: Map Domain in Google Cloud Console

#### Option A: Using Cloud Console (Recommended for beginners)

1. **Go to Cloud Run Console:**
   - https://console.cloud.google.com/run
   - Select project: `matrimonial-staging`

2. **Open your service:**
   - Click `matrimonial-frontend`

3. **Add Custom Domain:**
   - Click **"MANAGE CUSTOM DOMAINS"** at the top
   - Click **"ADD MAPPING"**
   - Select your service: `matrimonial-frontend`
   - Choose: **"Verify a new domain"**

4. **Verify Domain Ownership:**
   - Enter: `l3v3lmatch.com`
   - Google will ask you to verify ownership
   - Choose verification method: **DNS TXT record** (easiest)
   - Copy the TXT record values

5. **Add to Bluehost DNS (verification):**
   - Go to Bluehost DNS settings
   - Add TXT record:
     ```
     Type: TXT
     Host: @ (or leave blank)
     Value: [paste Google's verification string]
     TTL: Automatic
     ```
   - Wait 5-10 minutes for DNS propagation
   - Click "Verify" in Google Cloud Console

6. **Configure Subdomain (optional):**
   - You can map both:
     - `l3v3lmatch.com` (root domain)
     - `www.l3v3lmatch.com` (www subdomain)

7. **Get DNS Records:**
   - After verification, Google will provide DNS records
   - Copy these values (A and AAAA records)

#### Option B: Using gcloud CLI (Advanced)

```bash
# 1. Map domain to Cloud Run service
gcloud run domain-mappings create \
  --service=matrimonial-frontend \
  --domain=l3v3lmatch.com \
  --region=us-central1 \
  --project=matrimonial-staging

# 2. Verify domain (if not already verified)
gcloud domains verify l3v3lmatch.com

# 3. Get DNS records to configure
gcloud run domain-mappings describe \
  --domain=l3v3lmatch.com \
  --region=us-central1 \
  --project=matrimonial-staging
```

---

### Step 2: Configure DNS in Bluehost

1. **Login to Bluehost:**
   - https://my.bluehost.com/hosting/app
   - Go to **Domains** → Select `l3v3lmatch.com`

2. **Access DNS Management:**
   - Click **"Manage"** next to l3v3lmatch.com
   - Go to **"Advanced DNS"** or **"DNS"** tab

3. **Add A Records (IPv4):**
   ```
   Type: A
   Host: @ (or leave blank for root domain)
   Points to: 216.239.32.21
   TTL: 1 Hour (or Automatic)
   ```
   
   ```
   Type: A
   Host: @ 
   Points to: 216.239.34.21
   TTL: 1 Hour
   ```
   
   ```
   Type: A
   Host: @
   Points to: 216.239.36.21
   TTL: 1 Hour
   ```
   
   ```
   Type: A
   Host: @
   Points to: 216.239.38.21
   TTL: 1 Hour
   ```

4. **Add AAAA Records (IPv6) - Optional but recommended:**
   ```
   Type: AAAA
   Host: @
   Points to: 2001:4860:4802:32::15
   TTL: 1 Hour
   ```
   
   ```
   Type: AAAA
   Host: @
   Points to: 2001:4860:4802:34::15
   TTL: 1 Hour
   ```
   
   ```
   Type: AAAA
   Host: @
   Points to: 2001:4860:4802:36::15
   TTL: 1 Hour
   ```
   
   ```
   Type: AAAA
   Host: @
   Points to: 2001:4860:4802:38::15
   TTL: 1 Hour
   ```

5. **For www subdomain (optional):**
   ```
   Type: CNAME
   Host: www
   Points to: ghs.googlehosted.com
   TTL: 1 Hour
   ```

6. **Remove conflicting records:**
   - Delete any existing A records for @ (root)
   - Delete any existing AAAA records for @ (root)
   - Keep only the Google Cloud Run records

7. **Save Changes**

---

### Step 3: Wait for DNS Propagation

- **Time:** 5 minutes to 48 hours (usually 15-30 minutes)
- **Check status:**
  ```bash
  # Check A records
  nslookup l3v3lmatch.com
  
  # Check propagation globally
  # Visit: https://dnschecker.org
  # Enter: l3v3lmatch.com
  ```

---

### Step 4: Verify SSL Certificate (Automatic)

Google Cloud Run automatically provisions SSL certificates:

1. **Check certificate status:**
   ```bash
   gcloud run domain-mappings describe \
     --domain=l3v3lmatch.com \
     --region=us-central1 \
     --project=matrimonial-staging
   ```

2. **Certificate provisioning:**
   - Usually takes 15-60 minutes
   - Google automatically creates Let's Encrypt certificate
   - HTTPS is enabled by default

3. **Verify HTTPS works:**
   - Try: https://l3v3lmatch.com
   - Should show green padlock 🔒

---

### Step 5: Update Application URLs (Optional)

Update your frontend to use the new domain:

#### Update `apiConfig.js`:

```javascript
// frontend/src/config/apiConfig.js
const getEnvironment = () => {
  const hostname = window.location.hostname;
  
  // Production - Custom domain
  if (hostname === 'l3v3lmatch.com' || hostname === 'www.l3v3lmatch.com') {
    return 'production';
  }
  
  // Production - Cloud Run domain
  if (hostname.includes('run.app')) {
    return 'production';
  }
  
  // Development
  return 'development';
};
```

---

## 🎨 Recommended Setup

### Main Domain:
- ✅ `l3v3lmatch.com` → Frontend (matrimonial-frontend)
- ✅ `https://l3v3lmatch.com` (HTTPS automatically enabled)

### Subdomain for API (optional):
- ✅ `api.l3v3lmatch.com` → Backend (matrimonial-backend)

To set up API subdomain:

1. **Map API subdomain in Cloud Run:**
   ```bash
   gcloud run domain-mappings create \
     --service=matrimonial-backend \
     --domain=api.l3v3lmatch.com \
     --region=us-central1 \
     --project=matrimonial-staging
   ```

2. **Add CNAME in Bluehost:**
   ```
   Type: CNAME
   Host: api
   Points to: ghs.googlehosted.com
   TTL: 1 Hour
   ```

---

## ✅ Verification Checklist

After DNS propagation:

- [ ] `http://l3v3lmatch.com` redirects to `https://l3v3lmatch.com`
- [ ] `https://l3v3lmatch.com` loads your app
- [ ] SSL certificate is valid (green padlock)
- [ ] `https://www.l3v3lmatch.com` works (if configured)
- [ ] Old Cloud Run URL still works (as backup)

---

## 🔍 Troubleshooting

### Issue 1: "Domain not verified"
**Solution:**
- Check TXT record in Bluehost DNS
- Wait 10-15 minutes for DNS propagation
- Try verification again

### Issue 2: "DNS records not found"
**Solution:**
- Double-check A/AAAA records in Bluehost
- Ensure no typos in IP addresses
- Wait 30-60 minutes for global DNS propagation

### Issue 3: "SSL certificate pending"
**Solution:**
- Wait up to 60 minutes for automatic provisioning
- Ensure DNS records are correctly configured
- Check domain mapping status in Cloud Console

### Issue 4: "Site not secure" or certificate error
**Solution:**
- Wait for automatic SSL provisioning (15-60 min)
- Verify domain mapping is complete
- Check certificate status with gcloud command

### Issue 5: "Page not found" or 404 error
**Solution:**
- Verify Cloud Run service is running
- Check domain mapping points to correct service
- Ensure service has public access (allUsers)

---

## 📊 DNS Record Summary

**For Bluehost DNS Management:**

| Type | Host | Points To | Purpose |
|------|------|-----------|---------|
| TXT | @ | [Google verification] | Domain ownership |
| A | @ | 216.239.32.21 | Cloud Run IPv4 #1 |
| A | @ | 216.239.34.21 | Cloud Run IPv4 #2 |
| A | @ | 216.239.36.21 | Cloud Run IPv4 #3 |
| A | @ | 216.239.38.21 | Cloud Run IPv4 #4 |
| AAAA | @ | 2001:4860:4802:32::15 | Cloud Run IPv6 #1 |
| AAAA | @ | 2001:4860:4802:34::15 | Cloud Run IPv6 #2 |
| AAAA | @ | 2001:4860:4802:36::15 | Cloud Run IPv6 #3 |
| AAAA | @ | 2001:4860:4802:38::15 | Cloud Run IPv6 #4 |
| CNAME | www | ghs.googlehosted.com | WWW subdomain |

---

## 🚀 Quick Start Commands

```bash
# 1. Map domain to Cloud Run
gcloud run domain-mappings create \
  --service=matrimonial-frontend \
  --domain=l3v3lmatch.com \
  --region=us-central1 \
  --project=matrimonial-staging

# 2. Get DNS records (after verification)
gcloud run domain-mappings describe \
  --domain=l3v3lmatch.com \
  --region=us-central1 \
  --project=matrimonial-staging

# 3. Check DNS propagation
nslookup l3v3lmatch.com

# 4. Test HTTPS
curl -I https://l3v3lmatch.com
```

---

## 📱 Marketing Benefits

### Before:
```
User sees: https://matrimonial-frontend-458052696267.us-central1.run.app
Thinks: "Is this legit? Looks like a development site..."
```

### After:
```
User sees: https://l3v3lmatch.com
Thinks: "Professional! This is the real deal!"
```

---

## 🎯 Next Steps

1. **Set up domain mapping** (15 minutes)
2. **Configure DNS in Bluehost** (10 minutes)
3. **Wait for DNS propagation** (15-60 minutes)
4. **Verify HTTPS works** (1 minute)
5. **Update marketing materials** with new URL
6. **Share the clean URL** with users!

---

## 📞 Support

If you encounter issues:
1. Check [Google Cloud Run Documentation](https://cloud.google.com/run/docs/mapping-custom-domains)
2. Verify DNS records with [DNS Checker](https://dnschecker.org)
3. Contact Bluehost support for DNS issues
4. Contact Google Cloud support for Cloud Run issues

---

**Status:** Ready to configure  
**Estimated Time:** 30 minutes + DNS propagation  
**Difficulty:** Medium

Your app will be accessible at: **https://l3v3lmatch.com** 🎉
