# Install Cloudflare Turnstile Package (100% FREE!)

## Why Cloudflare Turnstile?

✅ **Completely FREE** - No limits, no paid tiers  
✅ **Better Privacy** - No Google tracking  
✅ **Better UX** - Often invisible (no checkbox)  
✅ **Faster** - Lightweight  
✅ **More Reliable** - Cloudflare infrastructure  

## Installation Required

```bash
cd /Users/rajsiripuram02/opt/appsrc/profiledata/frontend
npm install react-turnstile
```

## Setup Steps

### 1. Get Turnstile Keys (FREE!)
1. Go to: https://dash.cloudflare.com/
2. Sign up/login (free account)
3. Go to **"Turnstile"** in the sidebar
4. Click **"Add Site"**
5. Fill in:
   - **Site name:** L3V3L Matches
   - **Domain:** `l3v3lmatches.com` (or use wildcard: `*.l3v3lmatches.com`)
   - **Widget Mode:** Managed (Recommended)
6. Click **"Create"**
7. Copy your **Site Key** and **Secret Key**

### 2. Update Site Key
Replace the test key in `Login.js` line ~441:
```javascript
sitekey="1x00000000000000000000AA"  // Test key
```

With your actual key:
```javascript
sitekey="YOUR_ACTUAL_SITE_KEY_HERE"
```

### 3. Backend Verification
The backend needs to verify the CAPTCHA token. Add this to your login endpoint:

```python
# In routes.py - login endpoint
import requests

@router.post("/login")
async def login(username: str, password: str, captchaToken: str = None):
    # Verify Turnstile CAPTCHA
    if captchaToken:
        verify_url = "https://challenges.cloudflare.com/turnstile/v0/siteverify"
        verify_data = {
            "secret": "YOUR_SECRET_KEY",
            "response": captchaToken
        }
        verify_response = requests.post(verify_url, json=verify_data)
        result = verify_response.json()
        
        if not result.get("success"):
            raise HTTPException(status_code=400, detail="CAPTCHA verification failed")
    
    # Continue with normal login logic
    ...
```

### 4. Environment Variables
Add to `.env`:
```
TURNSTILE_SECRET_KEY=your_secret_key_here
```

## Test Keys (Development Only)
Cloudflare provides test keys that always pass:
- **Site Key (always passes):** `1x00000000000000000000AA`
- **Site Key (always blocks):** `2x00000000000000000000AB`
- **Site Key (force interactive):** `3x00000000000000000000FF`
- **Secret Key:** `1x0000000000000000000000000000000AA`

⚠️ **DO NOT use test keys in production!**

## Comparison: Turnstile vs reCAPTCHA

| Feature | Cloudflare Turnstile | Google reCAPTCHA |
|---------|---------------------|------------------|
| **Price** | 100% Free (unlimited) | Free up to 1M/month, then paid |
| **Privacy** | No tracking | Tracks users via Google |
| **Speed** | Faster (smaller JS) | Slower |
| **UX** | Often invisible | Checkbox/image challenges |
| **Setup** | Easier | More complex |

**Winner:** 🏆 **Cloudflare Turnstile**
