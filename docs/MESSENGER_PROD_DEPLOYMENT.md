# Messenger Production Deployment Guide

**Status:** Draft v1
**Domain:** `messenger.l3v3lmatches.com`
**Last updated:** 2026-05-05
**Companion to:** `deploy_gcp/tmp/DOMAIN_SETUP_GUIDE.md`

---

## 1. Goal

Deploy the L3V3L Messenger web client (the `messenger-web/` webpack bundle) to Google Cloud Run as a third public-facing service, accessible at:

> **https://messenger.l3v3lmatches.com**

It will share the existing backend at `https://api.l3v3lmatches.com` — no new backend service is needed.

---

## 2. Final production layout

| Subdomain | Cloud Run Service | Source folder | Purpose |
|---|---|---|---|
| `l3v3lmatches.com` / `www.l3v3lmatches.com` | `matrimonial-frontend` | `frontend/` | Main React app |
| `api.l3v3lmatches.com` | `matrimonial-backend` | `fastapi_backend/` | FastAPI + Socket.IO |
| **`messenger.l3v3lmatches.com`** | **`matrimonial-messenger`** *(new)* | **`messenger-web/`** | Messenger web client |

---

## 3. Prerequisites

- ✅ Existing prod project: `matrimonial-staging` (region `us-central1`)
- ✅ DNS zone `l3v3lmatches-zone` already managing `l3v3lmatches.com`
- ✅ Backend already deployed at `api.l3v3lmatches.com`
- ✅ `gcloud` CLI authenticated; `docker` available
- ✅ Required APIs already enabled: `run`, `cloudbuild`, `artifactregistry`, `dns`

---

## 4. Code changes required (PR-1)

These must be merged **before** running the deployment script.

### 4.1 Fix wrong production URLs

**File:** `messenger/src/config/api.js`

Currently:
```js
production: {
  BASE_URL: 'https://l3v3lmatches.com',     // ❌ wrong — points to frontend
  WS_URL:   'https://l3v3lmatches.com',     // ❌ wrong
}
```

Change to:
```js
production: {
  BASE_URL: 'https://api.l3v3lmatches.com',
  WS_URL:   'https://api.l3v3lmatches.com',
}
```

### 4.2 Add prod URL detection helper

The messenger web build should auto-pick the right backend based on `window.location.hostname`. Update `messenger-web/src/config/apiConfig.js` (mirroring `frontend/src/config/apiConfig.js`) so:

```js
export const getBackendUrl = () => {
  const host = window.location.hostname;
  if (host === 'messenger.l3v3lmatches.com') return 'https://api.l3v3lmatches.com';
  if (host.endsWith('.l3v3lmatches.com'))    return 'https://api.l3v3lmatches.com';
  if (host === 'localhost')                  return 'http://localhost:8000';
  return process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
};
```

### 4.3 Backend CORS update

**File:** `fastapi_backend/main.py`

Add the messenger origin to `origins`:

```python
origins = [
    "https://www.l3v3lmatches.com",
    "https://l3v3lmatches.com",
    "https://messenger.l3v3lmatches.com",   # NEW
    "http://localhost:3000",
    "http://localhost:3030",                # local messenger-web dev
]
```

Also update Socket.IO `cors_allowed_origins` if it's set explicitly.

### 4.4 `.env` config additions

In `fastapi_backend/.env.production`:

```
MESSENGER_FRONTEND_URL=https://messenger.l3v3lmatches.com
```

Reference it from `config.py` so any backend code that needs to generate links (e.g., email "Open in Messenger" buttons) uses the right URL.

---

## 5. Build & deployment scaffolding (PR-2)

Add these files to the repo so the messenger can be built into a container and deployed.

### 5.1 `messenger-web/Dockerfile`

```dockerfile
# ---- Build stage ----
FROM node:20-alpine AS builder
WORKDIR /app
COPY messenger-web/package*.json ./messenger-web/
COPY messenger/package*.json ./messenger/
RUN cd messenger-web && npm ci
COPY messenger-web/ ./messenger-web/
COPY messenger/ ./messenger/
WORKDIR /app/messenger-web
ENV NODE_ENV=production
RUN npm run build   # produces /app/messenger-web/dist

# ---- Runtime stage ----
FROM nginx:alpine
COPY --from=builder /app/messenger-web/dist /usr/share/nginx/html
COPY messenger-web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
```

### 5.2 `messenger-web/nginx.conf`

```nginx
server {
  listen 8080;
  server_name _;
  root /usr/share/nginx/html;
  index index.html;

  # SPA fallback
  location / {
    try_files $uri $uri/ /index.html;
  }

  # Cache static assets aggressively
  location ~* \.(?:js|css|woff2?|svg|png|jpg|webp)$ {
    expires 30d;
    add_header Cache-Control "public, immutable";
  }

  # Never cache index.html
  location = /index.html {
    add_header Cache-Control "no-store, no-cache, must-revalidate";
  }
}
```

### 5.3 `messenger-web/package.json` — add a `build` script

```jsonc
{
  "scripts": {
    "start": "webpack serve --config ./webpack.config.js",
    "build": "NODE_ENV=production webpack --config ./webpack.config.js"
  }
}
```

Update `webpack.config.js` to honor `mode: process.env.NODE_ENV` and emit to `dist/`.

### 5.4 `deploy_gcp/deploy_messenger.sh`

```bash
#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

PROJECT_ID="${PROJECT_ID:-matrimonial-staging}"
REGION="${REGION:-us-central1}"
SERVICE_NAME="${SERVICE_NAME:-matrimonial-messenger}"
IMAGE_TAG="${IMAGE_TAG:-latest}"
IMAGE_URI="gcr.io/${PROJECT_ID}/${SERVICE_NAME}:${IMAGE_TAG}"

echo "🛠️  Setting gcloud project to $PROJECT_ID"
gcloud config set project "$PROJECT_ID" >/dev/null

echo "📦 Building image: $IMAGE_URI"
gcloud builds submit "$REPO_ROOT" \
  --config=- <<EOF
steps:
  - name: gcr.io/cloud-builders/docker
    args: ['build', '-t', '$IMAGE_URI', '-f', 'messenger-web/Dockerfile', '.']
images: ['$IMAGE_URI']
EOF

echo "🚀 Deploying $SERVICE_NAME to Cloud Run"
gcloud run deploy "$SERVICE_NAME" \
  --image="$IMAGE_URI" \
  --region="$REGION" \
  --platform=managed \
  --allow-unauthenticated \
  --port=8080 \
  --memory=256Mi \
  --cpu=1 \
  --min-instances=0 \
  --max-instances=10 \
  --concurrency=80

echo "✅ Deployed. Service URL:"
gcloud run services describe "$SERVICE_NAME" --region="$REGION" \
  --format="value(status.url)"
```

Make it executable: `chmod +x deploy_gcp/deploy_messenger.sh`.

---

## 6. One-time domain mapping

After the first successful deploy:

```bash
# 6.1  Map subdomain to the Cloud Run service
gcloud beta run domain-mappings create \
  --service=matrimonial-messenger \
  --domain=messenger.l3v3lmatches.com \
  --region=us-central1 \
  --project=matrimonial-staging

# 6.2  Verify mapping & get DNS record
gcloud beta run domain-mappings describe \
  --domain=messenger.l3v3lmatches.com \
  --region=us-central1 \
  --project=matrimonial-staging \
  --format='value(status.resourceRecords)'

# Expected output: a CNAME pointing to ghs.googlehosted.com.
```

```bash
# 6.3  Add DNS CNAME in the existing zone
gcloud dns record-sets create messenger.l3v3lmatches.com. \
  --zone=l3v3lmatches-zone \
  --type=CNAME \
  --ttl=300 \
  --rrdatas="ghs.googlehosted.com." \
  --project=matrimonial-staging
```

Google-managed SSL is provisioned automatically; allow ~10–30 minutes for the cert to issue.

---

## 7. Verification

### 7.1 DNS

```bash
dig messenger.l3v3lmatches.com CNAME +short
# Expected: ghs.googlehosted.com.
```

### 7.2 HTTPS reachability

```bash
curl -I https://messenger.l3v3lmatches.com
# Expected: HTTP/2 200, content-type: text/html
```

### 7.3 End-to-end smoke test

1. Open `https://messenger.l3v3lmatches.com` in browser.
2. Login with a known prod user.
3. Verify:
   - Login → `https://api.l3v3lmatches.com/api/auth/login` (200, returns JWT)
   - Conversations load (`GET /api/users/messages/conversations`)
   - Socket.IO connects to `wss://api.l3v3lmatches.com/socket.io/`
   - Send a test message → recipient receives via socket
   - Profile pictures load with auth token

### 7.4 CORS check

```bash
curl -I -X OPTIONS https://api.l3v3lmatches.com/api/auth/login \
  -H "Origin: https://messenger.l3v3lmatches.com" \
  -H "Access-Control-Request-Method: POST"
# Expected: 200 with Access-Control-Allow-Origin: https://messenger.l3v3lmatches.com
```

---

## 8. CI/CD integration (optional, follow-up PR)

Add to `cloudbuild.yaml` (or a new `cloudbuild.messenger.yaml`):

```yaml
steps:
  - name: gcr.io/cloud-builders/docker
    args: ['build', '-t', 'gcr.io/$PROJECT_ID/matrimonial-messenger:$SHORT_SHA',
           '-f', 'messenger-web/Dockerfile', '.']
  - name: gcr.io/cloud-builders/docker
    args: ['push', 'gcr.io/$PROJECT_ID/matrimonial-messenger:$SHORT_SHA']
  - name: gcr.io/google.com/cloudsdktool/cloud-sdk
    entrypoint: gcloud
    args:
      - run
      - deploy
      - matrimonial-messenger
      - --image=gcr.io/$PROJECT_ID/matrimonial-messenger:$SHORT_SHA
      - --region=us-central1
      - --platform=managed
options:
  logging: CLOUD_LOGGING_ONLY
```

Trigger on pushes to `main` (or `dev` first for staging environment).

---

## 9. Cost estimate

| Item | Estimate |
|---|---|
| Cloud Run (256Mi, scale-to-zero, low traffic) | **$0–5/mo** |
| Cloud Build (1 build/day, ~3 min each) | **$0** (free tier covers it) |
| Egress (small static bundle) | **$0–1/mo** |
| Google-managed SSL cert | **Free** |
| **Total incremental cost** | **~$5/mo** |

---

## 10. Rollback

```bash
# List revisions
gcloud run revisions list --service=matrimonial-messenger --region=us-central1

# Route 100% traffic to the previous revision
gcloud run services update-traffic matrimonial-messenger \
  --to-revisions=<previous-revision-name>=100 \
  --region=us-central1
```

DNS does **not** need to change for rollback — it always points to the service, not a specific revision.

---

## 11. Implementation checklist

### PR-1: Code corrections
- [ ] Fix `messenger/src/config/api.js` production URLs
- [ ] Add `messenger-web/src/config/apiConfig.js` with hostname-based detection
- [ ] Update `fastapi_backend/main.py` CORS origins
- [ ] Add `MESSENGER_FRONTEND_URL` to `.env.production`

### PR-2: Build scaffolding
- [ ] Add `messenger-web/Dockerfile`
- [ ] Add `messenger-web/nginx.conf`
- [ ] Add `build` script to `messenger-web/package.json`
- [ ] Update `webpack.config.js` for production mode + `dist/` output
- [ ] Add `deploy_gcp/deploy_messenger.sh`

### Deployment
- [ ] Run `./deploy_gcp/deploy_messenger.sh` and verify Cloud Run URL works
- [ ] `gcloud run domain-mappings create` for `messenger.l3v3lmatches.com`
- [ ] Add DNS CNAME record
- [ ] Wait for SSL cert provisioning (~15 min)
- [ ] Smoke-test login + send/receive
- [ ] Update CI/CD pipeline (optional)

---

## 12. Future improvements

- **iOS / Android stores:** the `messenger/` React Native app can ship to App Store / Play Store; the web bundle is just one of three targets.
- **CDN / Cloud Storage hosting:** for purely static SPA, Cloud Storage + Load Balancer can be cheaper than Cloud Run; revisit if traffic grows.
- **PWA install:** add a manifest + service worker to `messenger-web/web/` so users can install it as an app.
- **Subdomain isolation cookies:** consider setting cookies on `.l3v3lmatches.com` for SSO across `www`, `api`, and `messenger` subdomains.

---

## 13. References

- `@/Users/rajsiripuram02/opt/appsrc/profiledata/deploy_gcp/tmp/DOMAIN_SETUP_GUIDE.md` — original domain setup
- `@/Users/rajsiripuram02/opt/appsrc/profiledata/deploy_gcp/deploy_frontend_full.sh` — frontend deploy template (mirror this)
- `@/Users/rajsiripuram02/opt/appsrc/profiledata/frontend/Dockerfile.prod` — frontend Dockerfile template
- `@/Users/rajsiripuram02/opt/appsrc/profiledata/messenger/src/config/api.js` — config to fix
- `@/Users/rajsiripuram02/opt/appsrc/profiledata/messenger-web/webpack.config.js` — webpack to extend
