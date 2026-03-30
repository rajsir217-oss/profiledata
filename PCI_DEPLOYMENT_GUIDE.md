# PCI Compliance Deployment Guide

## Summary of Changes

### Backend Changes (FastAPI)
1. **Created**: `/fastapi_backend/middleware/cache_control.py`
   - CacheControlMiddleware class
   - Route classification (sensitive vs non-sensitive)
   - PCI-compliant headers
   - HTTP/1.0 Pragma compatibility

2. **Modified**: `/fastapi_backend/main.py`
   - Added cache control middleware
   - Integrated into middleware chain

### Frontend Changes (React App Engine)
1. **Created**: `/frontend/server.js`
   - Custom Express server
   - Cache-Control middleware
   - Pragma header logic for PCI compliance

2. **Modified**: `/frontend/package.json`
   - Added Express and Helmet dependencies
   - Added server script

3. **Modified**: `/frontend/app.yaml`
   - Changed from `runtime: custom` to `runtime: nodejs20`
   - Added health check configuration
   - Added manual scaling

## Deployment Steps

### 1. Deploy Backend (FastAPI)
```bash
cd /Users/rajsiripuram02/opt/appsrc/profiledata/fastapi_backend
gcloud run deploy profiledata --source . --region us-central1
```

### 2. Deploy Frontend (App Engine)
```bash
cd /Users/rajsiripuram02/opt/appsrc/profiledata/frontend

# Install dependencies
npm install express helmet --legacy-peer-deps

# Build the app
npm run build

# Deploy to App Engine
gcloud app deploy
```

### 3. Verify Deployment
```bash
# Test headers
python3 test_cache_headers.py

# Test specific routes
curl -I https://l3v3lmatches.com/register2
curl -I https://l3v3lmatches.com/terms
```

## Expected Headers After Deployment

### Sensitive Routes (register2, login, etc.)
```http
HTTP/1.1 200
cache-control: max-age=0, must-revalidate, no-cache, no-store, private
# No Pragma header for HTTP/1.1+ clients
```

### Non-Sensitive Routes (home, about, etc.)
```http
HTTP/1.1 200
cache-control: no-cache
# No Pragma header for HTTP/1.1+ clients
```

### Static Assets
```http
HTTP/1.1 200
cache-control: public, max-age=31536000, immutable
# No Pragma header
```

## PCI Compliance Checklist

- [x] No duplicate Cache-Control directives
- [x] Sensitive routes have strict headers
- [x] Non-sensitive routes have no-cache
- [x] Pragma header only for HTTP/1.0 compatibility
- [x] Static assets have appropriate caching
- [x] All routes have Cache-Control headers

## Testing

Run the test script to verify compliance:
```bash
python3 test_cache_headers.py
```

Expected output:
```
=== Cache-Control Header Test for PCI Compliance ===

🔒 Testing SENSITIVE Routes:
Expected: max-age=0, must-revalidate, no-cache, no-store, private
----------------------------------------------------------------------
✅ PASS /register2
     Cache-Control: max-age=0, must-revalidate, no-cache, no-store, private
     Pragma: 

✅ PASS /login
     Cache-Control: max-age=0, must-revalidate, no-cache, no-store, private
     Pragma: 

🌐 Testing NON-SENSITIVE Routes:
Expected: no-cache
----------------------------------------------------------------------
✅ PASS /
     Cache-Control: no-cache

✅ PASS /about
     Cache-Control: no-cache

✅ PCI COMPLIANCE TEST PASSED: 6/6 routes compliant
```

## Troubleshooting

### If headers are incorrect:
1. Check deployment logs for errors
2. Verify middleware is properly loaded
3. Check if frontend is using custom server
4. Ensure no other middleware is overriding headers

### Common Issues:
- **Frontend still using old headers**: Ensure app.yaml is using nodejs20 runtime
- **Duplicate headers**: Check for multiple cache control middleware
- **Missing headers**: Verify middleware order in main.py/server.js

## Security Benefits

1. **Web Cache Poisoning Prevention**
   - Sensitive data never cached in shared caches
   - Proper Cache-Control headers prevent exploitation

2. **Deprecated Header Removal**
   - Pragma only for HTTP/1.0 clients
   - Reduces attack surface

3. **Fresh Data Guarantee**
   - Sensitive pages always revalidated
   - Users see latest authentication status

After deployment, the application should pass all PCI compliance scans for Cache-Control headers.
